import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

const nativeFetch = globalThis.fetch;
const fetch = (input, init = {}) => {
  const headers = new Headers(init.headers || {});
  headers.set('Connection', 'close');
  return nativeFetch(input, { ...init, headers });
};

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function makeBmp1x1() {
  const buffer = Buffer.alloc(58);
  buffer.write('BM', 0, 'ascii');
  buffer.writeUInt32LE(58, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(1, 18);
  buffer.writeInt32LE(1, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(4, 34);
  buffer[54] = 0;
  buffer[55] = 0;
  buffer[56] = 255;
  buffer[57] = 0;
  return buffer;
}

async function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, ...options });
    let stderr = '';
    child.stderr?.on('data', chunk => stderr += chunk);
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error(`${command} failed (${code}): ${stderr}`)));
  });
}

async function stopChild(child, timeoutMs = 2000) {
  if (child.exitCode != null) return;
  await new Promise(resolve => {
    const timer = setTimeout(resolve, timeoutMs);
    timer.unref?.();
    child.once('close', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGKILL');
  });
}

async function waitForServer(origin, child, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode != null) throw new Error(`Server exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) return response.json();
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Server did not become ready in time');
}

async function waitForJob(origin, id, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await fetch(`${origin}/api/render/jobs/${encodeURIComponent(id)}`);
    assert.equal(response.status, 200);
    const job = await response.json();
    if (job.status === 'completed') return job;
    if (job.status === 'failed') throw new Error(job.error || 'Render failed');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Render job timed out');
}

async function waitForPackage(origin, token, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await fetch(`${origin}/api/project-packages/${encodeURIComponent(token)}/status`);
    assert.equal(response.status, 200);
    const state = await response.json();
    if (state.state === 'ready') return state;
    if (state.state === 'error' || state.state === 'cancelled') throw new Error(state.error || 'Project package failed');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Project package timed out');
}

function extractStoredZipEntries(buffer) {
  const entries = new Map();
  let offset = 0;
  while (offset + 46 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x02014B50) { offset++; continue; }
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    assert.notEqual(compressedSize, 0xFFFFFFFF, 'Small QA archive unexpectedly used ZIP64');
    assert.equal(compressedSize, uncompressedSize, 'STORE entry must keep original size');
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    assert.equal(buffer.readUInt32LE(localOffset), 0x04034B50);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    entries.set(name, buffer.subarray(dataStart, dataStart + uncompressedSize));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function ffprobe(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffprobe', [
      '-v', 'error', '-count_frames', '-show_entries',
      'format=start_time,duration:stream=index,codec_type,start_time,duration,avg_frame_rate,nb_read_frames,sample_aspect_ratio',
      '-of', 'json', filePath
    ], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => stdout += chunk);
    child.stderr.on('data', chunk => stderr += chunk);
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(stderr)));
  });
}

test('HTTP API, upload, range streaming, validation and render pipeline', { timeout: 60000 }, async t => {
  const port = await freePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatcut-test-'));
  fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'temp', 'render-stale'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'uploads', 'stale.uploading'), 'partial');
  fs.writeFileSync(path.join(dataDir, 'temp', 'render-stale', 'partial.tmp'), 'partial');
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'backend/src/server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', BEATCUT_DATA_DIR: dataDir, BEATCUT_MAX_UPLOAD_BYTES: String(1024 * 1024), BEATCUT_MAX_JSON_BYTES: '2048' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  let logs = '';
  child.stdout.on('data', chunk => logs += chunk);
  child.stderr.on('data', chunk => logs += chunk);
  t.after(async () => {
    await stopChild(child);
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const health = await waitForServer(origin, child);
  assert.equal(health.ok, true);
  assert.equal(health.maxUploadBytes, 1024 * 1024);
  assert.equal(fs.existsSync(path.join(dataDir, 'uploads', 'stale.uploading')), false);
  assert.equal(fs.existsSync(path.join(dataDir, 'temp', 'render-stale')), false);

  const vendorJsZip = await fetch(`${origin}/vendor/jszip.min.js`);
  assert.equal(vendorJsZip.status, 200);
  assert.match(vendorJsZip.headers.get('content-type') || '', /javascript/);
  assert.ok((await vendorJsZip.text()).includes('JSZip'));

  const preflight = await fetch(`${origin}/api/media/upload`, {
    method: 'OPTIONS',
    headers: { Origin: 'null', 'Access-Control-Request-Method': 'POST' }
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'null');

  const bmp = makeBmp1x1();
  const upload = await fetch(`${origin}/api/media/upload?name=${encodeURIComponent('test.bmp')}`, {
    method: 'POST', headers: { 'Content-Type': 'image/bmp' }, body: bmp
  });
  if (!health.ffprobe) {
    assert.equal(upload.status, 415);
    return;
  }
  assert.equal(upload.status, 201, logs);
  const media = await upload.json();
  assert.equal(media.type, 'image');
  assert.equal(media.width, 1);
  assert.equal(media.height, 1);
  assert.ok(!('filePath' in media));

  const head = await fetch(`${origin}${media.url}`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal((await head.arrayBuffer()).byteLength, 0);

  const normalizedNameUpload = await fetch(`${origin}/api/media/upload?name=${encodeURIComponent('..\\safe.bmp')}`, {
    method: 'POST', headers: { 'Content-Type': 'image/bmp' }, body: bmp
  });
  assert.equal(normalizedNameUpload.status, 201);
  assert.equal((await normalizedNameUpload.json()).name, 'safe.bmp');

  const fakeMp4 = await fetch(`${origin}/api/media/upload?name=fake.mp4`, {
    method: 'POST', headers: { 'Content-Type': 'video/mp4' }, body: Buffer.from('not-a-video')
  });
  assert.equal(fakeMp4.status, 415);
  const fakeError = await fakeMp4.json();
  assert.match(fakeError.error, /unterstütztes Medium|lesbares Video/);
  assert.doesNotMatch(fakeError.error, /[/\\](mnt|tmp|data)[/\\]/i);

  const traversal = await fetch(`${origin}/media/%2e%2e%2fbeatcut.sqlite`);
  assert.equal(traversal.status, 403);

  const malformedPath = await fetch(`${origin}/%E0%A4%A`);
  assert.equal(malformedPath.status, 400);

  if (health.ffmpeg) {
    const sourceVideo = path.join(dataDir, 'source-video.mp4');
    await run('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=160x90:r=30:d=0.6',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=0.6',
      '-shortest', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '35', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '64k', sourceVideo
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    const videoUpload = await fetch(`${origin}/api/media/upload?name=${encodeURIComponent('qa-video.mp4')}`, {
      method: 'POST', headers: { 'Content-Type': 'video/mp4' }, body: fs.readFileSync(sourceVideo)
    });
    assert.equal(videoUpload.status, 201, logs);
    const videoMedia = await videoUpload.json();
    assert.equal(videoMedia.type, 'video');
    assert.equal(videoMedia.hasAudio, true);
    assert.equal(videoMedia.width, 160);
    assert.equal(videoMedia.height, 90);
    assert.ok(videoMedia.duration > 0.5);
    assert.match(videoMedia.thumbnailUrl || '', /^\/thumbs\/.+\.jpg$/);
    const thumbnailResponse = await fetch(`${origin}${videoMedia.thumbnailUrl}`);
    assert.equal(thumbnailResponse.status, 200);
    assert.match(thumbnailResponse.headers.get('content-type') || '', /^image\/jpeg/);
  }

  const range = await fetch(`${origin}${media.url}`, { headers: { Range: 'bytes=-10' } });
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 10);
  assert.match(range.headers.get('content-range') || '', /^bytes \d+-\d+\/58$/);

  const badExt = await fetch(`${origin}/api/media/upload?name=bad.exe`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: Buffer.from('x')
  });
  assert.equal(badExt.status, 415);

  const tooLarge = await fetch(`${origin}/api/media/upload?name=large.bmp`, {
    method: 'POST', headers: { 'Content-Type': 'image/bmp' }, body: Buffer.alloc(1024 * 1024 + 1)
  });
  assert.equal(tooLarge.status, 413);

  const badStaticMethod = await fetch(`${origin}/index.html`, { method: 'POST' });
  assert.equal(badStaticMethod.status, 405);

  const badJson = await fetch(`${origin}/api/projects/project-1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{bad'
  });
  assert.equal(badJson.status, 400);

  const tooLargeJson = await fetch(`${origin}/api/projects/project-large`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filler: 'x'.repeat(4096) })
  });
  assert.equal(tooLargeJson.status, 413);

  const projectPackageProject = { version: 21, projectName: 'QA Multi Track', clips: [], tracks: [] };
  const invalidPackageId = await fetch(`${origin}/api/project-packages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      project: projectPackageProject, name: 'Bad', assets: [{ id: '../escape', name: 'x.mp4', size: 1 }]
    })
  });
  assert.equal(invalidPackageId.status, 400);
  const invalidPackageSize = await fetch(`${origin}/api/project-packages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      project: projectPackageProject, name: 'Bad', assets: [{ id: 'asset-zero', name: 'x.mp4', size: 0 }]
    })
  });
  assert.equal(invalidPackageSize.status, 400);
  const packageAssets = [
    { id: 'asset-a', name: 'a.mp4', data: Buffer.from('video-a') },
    { id: 'asset-b', name: 'b.mp4', data: Buffer.from('video-b') },
    { id: 'asset-c', name: 'c.jpg', data: Buffer.from('image-c') }
  ];
  const packageCreate = await fetch(`${origin}/api/project-packages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      project: projectPackageProject,
      name: 'QA Project',
      assets: packageAssets.map(item => ({ id: item.id, name: item.name, size: item.data.length })),
      audio: null
    })
  });
  assert.equal(packageCreate.status, 201, logs);
  const packageSession = await packageCreate.json();
  assert.ok(packageSession.token);

  const wrongSizeUpload = await fetch(`${origin}/api/project-packages/${packageSession.token}/assets/asset-a`, {
    method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: Buffer.from('x')
  });
  assert.equal(wrongSizeUpload.status, 400);

  const earlyFinalize = await fetch(`${origin}/api/project-packages/${packageSession.token}/finalize`, { method: 'POST' });
  assert.equal(earlyFinalize.status, 409);

  for (const item of packageAssets) {
    const uploaded = await fetch(`${origin}/api/project-packages/${packageSession.token}/assets/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': item.name.endsWith('.jpg') ? 'image/jpeg' : 'video/mp4' }, body: item.data
    });
    assert.equal(uploaded.status, 201, logs);
  }
  const finalizePackage = await fetch(`${origin}/api/project-packages/${packageSession.token}/finalize`, { method: 'POST' });
  assert.equal(finalizePackage.status, 202, logs);
  const packageReady = await waitForPackage(origin, packageSession.token);
  assert.equal(packageReady.state, 'ready');
  assert.match(packageReady.downloadUrl || '', /\/download$/);
  const packageDownload = await fetch(`${origin}${packageReady.downloadUrl}`);
  assert.equal(packageDownload.status, 200, logs);
  assert.match(packageDownload.headers.get('content-disposition') || '', /QA Project\.beatcut/i);
  const packageBuffer = Buffer.from(await packageDownload.arrayBuffer());
  assert.equal(packageBuffer.readUInt32LE(0), 0x04034B50);
  const packageEntries = extractStoredZipEntries(packageBuffer);
  assert.equal(packageEntries.get('project.json')?.toString('utf8'), JSON.stringify(projectPackageProject));
  for (const item of packageAssets) {
    assert.deepEqual(packageEntries.get(`assets/${item.id}__${item.name}`), item.data);
  }

  const project = {
    id: 'project-1', name: 'QA Render', width: 320, height: 320, fps: 30,
    durationLimit: 1, bpm: 120, beatsPerClip: 4, socialSafe60: true,
    clips: [{ id: 'clip-1', mediaId: media.id, start: 0, duration: 1, sourceStart: 0, audioEnabled: false }],
    musicSegments: [], texts: []
  };
  const save = await fetch(`${origin}/api/projects/project-1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(project)
  });
  assert.equal(save.status, 200);

  if (!health.ffmpeg) return;
  const render = await fetch(`${origin}/api/render/jobs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(project)
  });
  assert.equal(render.status, 202, logs);
  const job = await render.json();
  const completed = await waitForJob(origin, job.id);
  assert.equal(completed.status, 'completed');

  const fileName = decodeURIComponent(completed.outputUrl.split('/').at(-1));
  const outputPath = path.join(dataDir, 'renders', fileName);
  const probe = await ffprobe(outputPath);
  assert.equal(Number(probe.format.start_time), 0);
  assert.equal(Number(probe.format.duration), 1);
  const video = probe.streams.find(stream => stream.codec_type === 'video');
  const audio = probe.streams.find(stream => stream.codec_type === 'audio');
  assert.equal(video.avg_frame_rate, '30/1');
  assert.equal(Number(video.start_time), 0);
  assert.equal(Number(video.duration), 1);
  assert.equal(Number(video.nb_read_frames), 30);
  assert.equal(video.sample_aspect_ratio, '1:1');
  assert.equal(Number(audio.start_time), 0);
  assert.equal(Number(audio.duration), 1);

  const socialProject = {
    ...project,
    id: 'project-60',
    name: 'QA Social 60',
    height: 568,
    durationLimit: 60,
    clips: [{ id: 'clip-60', mediaId: media.id, start: 0, duration: 60, sourceStart: 0, audioEnabled: false }]
  };
  const socialRender = await fetch(`${origin}/api/render/jobs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(socialProject)
  });
  assert.equal(socialRender.status, 202);
  const socialJob = await socialRender.json();
  const socialCompleted = await waitForJob(origin, socialJob.id, 60000);
  const socialFileName = decodeURIComponent(socialCompleted.outputUrl.split('/').at(-1));
  const socialProbe = await ffprobe(path.join(dataDir, 'renders', socialFileName));
  assert.equal(Number(socialProbe.format.start_time), 0);
  assert.equal(Number(socialProbe.format.duration), 59.9);
  const socialVideo = socialProbe.streams.find(stream => stream.codec_type === 'video');
  const socialAudio = socialProbe.streams.find(stream => stream.codec_type === 'audio');
  assert.equal(socialVideo.avg_frame_rate, '30/1');
  assert.equal(Number(socialVideo.start_time), 0);
  assert.equal(Number(socialVideo.duration), 59.9);
  assert.equal(Number(socialVideo.nb_read_frames), 1797);
  assert.equal(socialVideo.sample_aspect_ratio, '1:1');
  assert.equal(Number(socialAudio.start_time), 0);
  assert.equal(Number(socialAudio.duration), 59.9);
});

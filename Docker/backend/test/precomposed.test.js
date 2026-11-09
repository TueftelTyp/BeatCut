import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
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

async function stopChild(child, timeoutMs = 3000) {
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
  throw new Error('Server did not become ready');
}

async function waitForJob(origin, id, timeoutMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await fetch(`${origin}/api/render/jobs/${encodeURIComponent(id)}`);
    assert.equal(response.status, 200);
    const job = await response.json();
    if (['completed', 'failed', 'cancelled'].includes(job.status)) return job;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Render job ${id} timed out`);
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stderr}`);
}

function makeRawH264(filePath, duration, width = 320, height = 568, fps = 30) {
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', `color=c=#241b4a:s=${width}x${height}:r=${fps}:d=${duration}`,
    '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '32',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-g', String(fps * 2), '-sc_threshold', '0',
    '-f', 'h264', filePath
  ]);
}

function makeWebmAudio(filePath, duration) {
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=48000:duration=${duration}`,
    '-c:a', 'libopus', '-b:a', '64k', '-ar', '48000', '-ac', '2', filePath
  ]);
}

function makeWavAudio(filePath, duration) {
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=48000:duration=${duration}`,
    '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', filePath
  ]);
}

function makeWebmComposite(filePath, duration, width = 320, height = 568, fps = 30) {
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', `testsrc2=s=${width}x${height}:r=${fps}:d=${duration}`,
    '-f', 'lavfi', '-i', `sine=frequency=523.25:sample_rate=48000:duration=${duration}`,
    '-shortest', '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '450k',
    '-c:a', 'libopus', '-b:a', '64k', '-ar', '48000', '-ac', '2', filePath
  ]);
}

function probe(filePath) {
  const result = spawnSync('ffprobe', [
    '-v', 'error', '-count_frames', '-show_entries',
    'format=start_time,duration:stream=codec_name,codec_type,start_time,duration,avg_frame_rate,nb_read_frames,sample_aspect_ratio,sample_rate,channels',
    '-of', 'json', filePath
  ], { encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}

async function uploadInput(origin, kind, filePath, mime) {
  const response = await fetch(`${origin}/api/render/inputs/${kind}`, {
    method: 'POST', headers: { 'Content-Type': mime }, body: fs.readFileSync(filePath)
  });
  const text = await response.text();
  assert.equal(response.status, 201, text);
  return JSON.parse(text);
}

function projectFor(videoToken, audioToken, duration, options = {}) {
  return {
    id: options.id || 'precomposed-project',
    name: options.name || 'Precomposed QA',
    width: options.width || 320,
    height: options.height || 568,
    fps: options.fps || 30,
    duration,
    durationLimit: duration,
    bpm: 120,
    beatsPerClip: 4,
    socialSafe60: options.socialSafe60 ?? false,
    quality: 'low',
    precomposedVideoToken: videoToken,
    precomposedAudioToken: audioToken || null,
    clips: [], musicSegments: [], texts: []
  };
}

test('precomposed full-editor export path muxes exact H.264/AAC MP4 and social 60 safely', { timeout: 120000 }, async t => {
  const ffmpegCheck = spawnSync('ffmpeg', ['-version'], { windowsHide: true });
  const ffprobeCheck = spawnSync('ffprobe', ['-version'], { windowsHide: true });
  assert.equal(ffmpegCheck.status, 0, 'FFmpeg is required for this integration test');
  assert.equal(ffprobeCheck.status, 0, 'FFprobe is required for this integration test');

  const port = await freePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatcut-precomposed-'));
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatcut-precomposed-src-'));
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'backend/src/server.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port), HOST: '127.0.0.1', BEATCUT_DATA_DIR: dataDir,
      BEATCUT_MAX_UPLOAD_BYTES: String(16 * 1024 * 1024)
    },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });
  let logs = '';
  child.stdout.on('data', chunk => logs += chunk);
  child.stderr.on('data', chunk => logs += chunk);
  t.after(async () => {
    await stopChild(child);
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });

  const health = await waitForServer(origin, child);
  assert.equal(health.ffmpeg, true, health.ffmpegError);

  const wrongMime = await fetch(`${origin}/api/render/inputs/video`, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: Buffer.from('x')
  });
  assert.equal(wrongMime.status, 415);

  const missingTokenProject = projectFor('12345678-1234-1234-1234-123456789abc', null, 1, { id: 'missing-token' });
  const missingToken = await fetch(`${origin}/api/render/jobs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(missingTokenProject)
  });
  assert.equal(missingToken.status, 404);

  const oneVideo = path.join(sourceDir, 'one.h264');
  const oneAudio = path.join(sourceDir, 'one.wav');
  makeRawH264(oneVideo, 1);
  makeWavAudio(oneAudio, 1);
  const videoUpload = await uploadInput(origin, 'video', oneVideo, 'video/h264');
  const audioUpload = await uploadInput(origin, 'audio', oneAudio, 'audio/wav');

  const oneProject = projectFor(videoUpload.token, audioUpload.token, 1, { id: 'precomposed-one' });
  const create = await fetch(`${origin}/api/render/jobs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(oneProject)
  });
  assert.equal(create.status, 202, logs);
  const created = await create.json();
  const completed = await waitForJob(origin, created.id);
  assert.equal(completed.status, 'completed', completed.error || logs);
  const outputPath = path.join(dataDir, 'renders', decodeURIComponent(completed.outputUrl.split('/').at(-1)));
  const info = probe(outputPath);
  assert.equal(Number(info.format.start_time), 0);
  assert.equal(Number(info.format.duration), 1);
  const video = info.streams.find(item => item.codec_type === 'video');
  const audio = info.streams.find(item => item.codec_type === 'audio');
  assert.equal(video.codec_name, 'h264');
  assert.equal(video.avg_frame_rate, '30/1');
  assert.equal(Number(video.start_time), 0);
  assert.equal(Number(video.duration), 1);
  assert.equal(Number(video.nb_read_frames), 30);
  assert.equal(video.sample_aspect_ratio, '1:1');
  assert.equal(audio.codec_name, 'aac');
  assert.equal(Number(audio.start_time), 0);
  assert.equal(Number(audio.duration), 1);
  assert.equal(audio.sample_rate, '48000');
  assert.equal(Number(audio.channels), 2);
  assert.equal(fs.existsSync(path.join(dataDir, 'precomposed', `video-${videoUpload.token}.h264`)), false);
  assert.equal(fs.existsSync(path.join(dataDir, 'precomposed', `audio-${audioUpload.token}.webm`)), false);

  // Firefox/Browser-Kompatibilitätsweg: vollständige Echtzeit-Canvasaufnahme als WebM,
  // anschließend serverseitig zu exakt getaktetem H.264/AAC-MP4 normalisieren.
  const compatWebm = path.join(sourceDir, 'compat.webm');
  makeWebmComposite(compatWebm, 1);
  const compatUpload = await uploadInput(origin, 'video', compatWebm, 'video/webm');
  const compatProject = {
    ...projectFor(compatUpload.token, null, 1, { id: 'precomposed-webm' }),
    precomposedVideoFormat: 'webm',
    precomposedAudioEmbedded: true
  };
  const compatCreate = await fetch(`${origin}/api/render/jobs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(compatProject)
  });
  assert.equal(compatCreate.status, 202, logs);
  const compatCreated = await compatCreate.json();
  const compatCompleted = await waitForJob(origin, compatCreated.id);
  assert.equal(compatCompleted.status, 'completed', compatCompleted.error || logs);
  const compatOutput = path.join(dataDir, 'renders', decodeURIComponent(compatCompleted.outputUrl.split('/').at(-1)));
  const compatInfo = probe(compatOutput);
  assert.equal(Number(compatInfo.format.start_time), 0);
  assert.equal(Number(compatInfo.format.duration), 1);
  const compatVideo = compatInfo.streams.find(item => item.codec_type === 'video');
  const compatAudio = compatInfo.streams.find(item => item.codec_type === 'audio');
  assert.equal(compatVideo.codec_name, 'h264');
  assert.equal(compatVideo.avg_frame_rate, '30/1');
  assert.equal(Number(compatVideo.nb_read_frames), 30);
  assert.equal(compatVideo.sample_aspect_ratio, '1:1');
  assert.equal(compatAudio.codec_name, 'aac');
  assert.equal(Number(compatAudio.start_time), 0);
  assert.equal(Number(compatAudio.duration), 1);

  const socialVideo = path.join(sourceDir, 'social.h264');
  const socialAudio = path.join(sourceDir, 'social.webm');
  makeRawH264(socialVideo, 59.9);
  makeWebmAudio(socialAudio, 59.9);
  const socialVideoUpload = await uploadInput(origin, 'video', socialVideo, 'video/h264');
  const socialAudioUpload = await uploadInput(origin, 'audio', socialAudio, 'audio/webm');
  const socialProject = projectFor(socialVideoUpload.token, socialAudioUpload.token, 59.9, { id: 'precomposed-social' });
  const socialCreate = await fetch(`${origin}/api/render/jobs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(socialProject)
  });
  assert.equal(socialCreate.status, 202, logs);
  const socialCreated = await socialCreate.json();
  const socialCompleted = await waitForJob(origin, socialCreated.id, 90000);
  assert.equal(socialCompleted.status, 'completed', socialCompleted.error || logs);
  const socialOutput = path.join(dataDir, 'renders', decodeURIComponent(socialCompleted.outputUrl.split('/').at(-1)));
  const socialInfo = probe(socialOutput);
  assert.equal(Number(socialInfo.format.start_time), 0);
  assert.equal(Number(socialInfo.format.duration), 59.9);
  const socialVideoStream = socialInfo.streams.find(item => item.codec_type === 'video');
  const socialAudioStream = socialInfo.streams.find(item => item.codec_type === 'audio');
  assert.equal(socialVideoStream.avg_frame_rate, '30/1');
  assert.equal(Number(socialVideoStream.start_time), 0);
  assert.equal(Number(socialVideoStream.duration), 59.9);
  assert.equal(Number(socialVideoStream.nb_read_frames), 1797);
  assert.equal(socialVideoStream.sample_aspect_ratio, '1:1');
  assert.equal(Number(socialAudioStream.start_time), 0);
  assert.equal(Number(socialAudioStream.duration), 59.9);
});

test('queued/precomposed render can be cancelled and temporary input is removed', { timeout: 30000 }, async t => {
  const port = await freePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatcut-cancel-'));
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatcut-cancel-src-'));
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'backend/src/server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', BEATCUT_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });
  t.after(async () => {
    await stopChild(child);
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });
  const health = await waitForServer(origin, child);
  assert.equal(health.ffmpeg, true, health.ffmpegError);

  const videoFile = path.join(sourceDir, 'cancel.h264');
  makeRawH264(videoFile, 8, 640, 360, 60);
  const uploaded = await uploadInput(origin, 'video', videoFile, 'video/h264');
  const create = await fetch(`${origin}/api/render/jobs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(projectFor(uploaded.token, null, 8, { id: 'cancel-project', width: 640, height: 360, fps: 60 }))
  });
  assert.equal(create.status, 202);
  const job = await create.json();
  const cancel = await fetch(`${origin}/api/render/jobs/${encodeURIComponent(job.id)}`, { method: 'DELETE' });
  assert.ok(cancel.status === 200 || cancel.status === 409);
  const terminal = await waitForJob(origin, job.id, 20000);
  if (cancel.status === 200) assert.equal(terminal.status, 'cancelled');
  assert.equal(fs.existsSync(path.join(dataDir, 'precomposed', `video-${uploaded.token}.h264`)), false);
});

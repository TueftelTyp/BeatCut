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

async function stopChild(child, timeoutMs = 3000) {
  if (child.exitCode != null) return;
  await new Promise(resolve => {
    const timer = setTimeout(resolve, timeoutMs);
    timer.unref?.();
    child.once('close', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGKILL');
  });
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stderr}`);
}

function makeJpeg(filePath, width = 320, height = 568) {
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', `color=c=#6f45ff:s=${width}x${height}:d=0.04`,
    '-frames:v', '1', '-q:v', '2', filePath
  ]);
}

function makeWav(filePath, duration) {
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=48000:duration=${duration}`,
    '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', filePath
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

async function waitForFrameExport(origin, token, timeoutMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await fetch(`${origin}/api/frame-exports/${encodeURIComponent(token)}/status`);
    assert.equal(response.status, 200);
    const state = await response.json();
    if (state.state === 'ready') return state;
    if (state.state === 'error') throw new Error(state.error || 'Frame export failed');
    if (state.state === 'cancelled') throw new Error('Frame export cancelled unexpectedly');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Frame export timed out');
}

test('deterministic frame sequence export creates exact H.264/AAC MP4 without WebCodecs/WebM', { timeout: 120000 }, async t => {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatcut-frame-export-'));
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatcut-frame-source-'));
  const frameFile = path.join(sourceDir, 'frame.jpg');
  const audioFile = path.join(sourceDir, 'audio.wav');
  makeJpeg(frameFile);
  makeWav(audioFile, 1);

  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/server.js'], {
    cwd: path.join(root, 'backend'),
    env: { ...process.env, PORT: String(port), BEATCUT_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
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
  assert.equal(health.ffmpeg, true, logs);

  const create = await fetch(`${origin}/api/frame-exports`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Frame QA', width: 320, height: 568, fps: 30, totalFrames: 30, duration: 1, quality: 'high', includeAudio: true })
  });
  const createText = await create.text();
  assert.equal(create.status, 201, createText);
  const session = JSON.parse(createText);
  assert.ok(session.token);

  const frameBytes = fs.readFileSync(frameFile);
  for (let i = 0; i < 30; i++) {
    const upload = await fetch(`${origin}/api/frame-exports/${encodeURIComponent(session.token)}/frames/${i}`, {
      method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: frameBytes
    });
    assert.equal(upload.status, 201, `frame ${i}: ${await upload.text()}`);
  }

  const audioUpload = await fetch(`${origin}/api/frame-exports/${encodeURIComponent(session.token)}/audio`, {
    method: 'PUT', headers: { 'Content-Type': 'audio/wav' }, body: fs.readFileSync(audioFile)
  });
  assert.equal(audioUpload.status, 201, await audioUpload.text());

  const finalize = await fetch(`${origin}/api/frame-exports/${encodeURIComponent(session.token)}/finalize`, { method: 'POST' });
  assert.equal(finalize.status, 202, await finalize.text());
  const completed = await waitForFrameExport(origin, session.token);
  assert.equal(completed.state, 'ready');
  assert.ok(completed.downloadUrl);

  const response = await fetch(`${origin}${completed.downloadUrl}`);
  assert.equal(response.status, 200);
  const outputPath = path.join(sourceDir, 'output.mp4');
  fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
  const info = probe(outputPath);
  const video = info.streams.find(stream => stream.codec_type === 'video');
  const audio = info.streams.find(stream => stream.codec_type === 'audio');
  assert.equal(video.codec_name, 'h264');
  assert.equal(video.avg_frame_rate, '30/1');
  assert.equal(Number(video.nb_read_frames), 30);
  assert.equal(video.sample_aspect_ratio, '1:1');
  assert.equal(audio.codec_name, 'aac');
  assert.equal(Number(audio.sample_rate), 48000);
  assert.equal(Number(audio.channels), 2);
  assert.ok(Math.abs(Number(info.format.start_time || 0)) < 0.001);
  assert.ok(Math.abs(Number(info.format.duration) - 1) < 0.03, `duration=${info.format.duration}`);
});

test('frame export rejects missing frames and can be cancelled safely', { timeout: 30000 }, async t => {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatcut-frame-cancel-'));
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/server.js'], {
    cwd: path.join(root, 'backend'),
    env: { ...process.env, PORT: String(port), BEATCUT_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });
  t.after(async () => { await stopChild(child); fs.rmSync(dataDir, { recursive: true, force: true }); });
  await waitForServer(origin, child);

  const create = await fetch(`${origin}/api/frame-exports`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Cancel QA', width: 320, height: 568, fps: 30, totalFrames: 30, duration: 1, quality: 'medium', includeAudio: false })
  });
  assert.equal(create.status, 201);
  const session = await create.json();

  const finalizeEarly = await fetch(`${origin}/api/frame-exports/${encodeURIComponent(session.token)}/finalize`, { method: 'POST' });
  assert.equal(finalizeEarly.status, 409);

  const cancel = await fetch(`${origin}/api/frame-exports/${encodeURIComponent(session.token)}`, { method: 'DELETE' });
  assert.equal(cancel.status, 204);
  const status = await fetch(`${origin}/api/frame-exports/${encodeURIComponent(session.token)}/status`);
  assert.equal(status.status, 404);
});

test('deterministic frame export passes the former 826-frame stall point', { timeout: 120000 }, async t => {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatcut-frame-826-'));
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatcut-frame-826-src-'));
  const frameFile = path.join(sourceDir, 'frame.jpg');
  makeJpeg(frameFile, 64, 64);
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/server.js'], {
    cwd: path.join(root, 'backend'), env: { ...process.env, PORT: String(port), BEATCUT_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });
  t.after(async () => { await stopChild(child); fs.rmSync(dataDir, { recursive: true, force: true }); fs.rmSync(sourceDir, { recursive: true, force: true }); });
  await waitForServer(origin, child);

  const totalFrames = 830;
  const fps = 30;
  const create = await fetch(`${origin}/api/frame-exports`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Beyond 826', width: 64, height: 64, fps, totalFrames, duration: totalFrames / fps, quality: 'low', includeAudio: false })
  });
  const createText = await create.text();
  assert.equal(create.status, 201, createText);
  const session = JSON.parse(createText);
  const bytes = fs.readFileSync(frameFile);
  for (let i = 0; i < totalFrames; i++) {
    const upload = await fetch(`${origin}/api/frame-exports/${encodeURIComponent(session.token)}/frames/${i}`, {
      method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: bytes
    });
    if (upload.status !== 201) throw new Error(`frame ${i}: ${upload.status} ${await upload.text()}`);
  }
  const finalize = await fetch(`${origin}/api/frame-exports/${encodeURIComponent(session.token)}/finalize`, { method: 'POST' });
  assert.equal(finalize.status, 202, await finalize.text());
  const completed = await waitForFrameExport(origin, session.token, 90000);
  const response = await fetch(`${origin}${completed.downloadUrl}`);
  assert.equal(response.status, 200);
  const outputPath = path.join(sourceDir, 'output.mp4');
  fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
  const info = probe(outputPath);
  const video = info.streams.find(stream => stream.codec_type === 'video');
  assert.equal(Number(video.nb_read_frames), totalFrames);
  assert.equal(video.avg_frame_rate, '30/1');
  assert.ok(Math.abs(Number(info.format.duration) - totalFrames / fps) < 0.04, `duration=${info.format.duration}`);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
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

async function waitForHealth(origin, child, timeoutMs = 10000) {
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

function collectProcess(child) {
  let output = '';
  child.stdout?.on('data', chunk => output += chunk);
  child.stderr?.on('data', chunk => output += chunk);
  return () => output;
}

async function waitForExit(child, timeoutMs = 10000) {
  if (child.exitCode != null) return child.exitCode;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error('Process did not exit in time')); }, timeoutMs);
    timer.unref?.();
    const onError = error => { cleanup(); reject(error); };
    const onClose = code => { cleanup(); resolve(code); };
    const cleanup = () => {
      clearTimeout(timer);
      child.off('error', onError);
      child.off('close', onClose);
    };
    child.once('error', onError);
    child.once('close', onClose);
  });
}

async function killAndWait(child, timeoutMs = 2000) {
  if (child.exitCode != null) return;
  await new Promise(resolve => {
    const timer = setTimeout(resolve, timeoutMs);
    timer.unref?.();
    child.once('close', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGKILL');
  });
}

test('missing FFmpeg tools are reported clearly and upload returns 503', { timeout: 20000 }, async t => {
  const port = await freePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatcut-tools-missing-'));
  const emptyTools = fs.mkdtempSync(path.join(os.tmpdir(), 'beatcut-empty-tools-'));
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'backend/src/server.js'], {
    cwd: root,
    env: {
      ...process.env,
      PATH: emptyTools,
      PORT: String(port),
      HOST: '127.0.0.1',
      BEATCUT_DATA_DIR: dataDir,
      BEATCUT_TOOLS_DIR: emptyTools
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  t.after(async () => {
    if (child.exitCode == null) await killAndWait(child);
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(emptyTools, { recursive: true, force: true });
  });

  const health = await waitForHealth(`http://127.0.0.1:${port}`, child);
  assert.equal(health.ffmpeg, false);
  assert.equal(health.ffprobe, false);

  const upload = await fetch(`http://127.0.0.1:${port}/api/media/upload?name=test.bmp`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/bmp' },
    body: makeBmp1x1()
  });
  assert.equal(upload.status, 503);
  const body = await upload.json();
  assert.match(body.error, /FFprobe ist nicht lauffähig|FFprobe wurde nicht gefunden/);
});

test('public bind is refused without explicit opt-in', { timeout: 10000 }, async () => {
  const port = await freePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatcut-remote-bind-'));
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'backend/src/server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '0.0.0.0', BEATCUT_DATA_DIR: dataDir, BEATCUT_ALLOW_REMOTE: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  const output = collectProcess(child);
  try {
    const code = await waitForExit(child);
    assert.equal(code, 1);
    assert.match(output(), /BEATCUT_ALLOW_REMOTE=1/);
  } finally {
    if (child.exitCode == null) child.kill('SIGKILL');
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('launcher reports an occupied port instead of opening a broken page', { timeout: 10000 }, async () => {
  const blocker = net.createServer();
  await new Promise((resolve, reject) => {
    blocker.once('error', reject);
    blocker.listen(0, '127.0.0.1', resolve);
  });
  const address = blocker.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatcut-port-conflict-'));
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'backend/src/launcher.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', BEATCUT_DATA_DIR: dataDir, BEATCUT_NO_BROWSER: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  const output = collectProcess(child);
  try {
    const code = await waitForExit(child);
    assert.equal(code, 1);
    assert.match(output(), /Port .* wird bereits verwendet/);
  } finally {
    blocker.close();
    if (child.exitCode == null) child.kill('SIGKILL');
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

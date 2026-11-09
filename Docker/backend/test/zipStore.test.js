import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { writeStoredZip } from '../src/zipStore.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

test('server ZIP writer is compatible with the editor JSZip loader and rejects traversal names', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatcut-zipstore-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const projectPath = path.join(dir, 'project.json');
  const mediaPath = path.join(dir, 'media.bin');
  fs.writeFileSync(projectPath, JSON.stringify({ version: 21, projectName: 'Kompatibel' }));
  fs.writeFileSync(mediaPath, Buffer.from([1, 2, 3, 4, 5, 6]));
  const output = path.join(dir, 'test.beatcut');

  await writeStoredZip(output, [
    { name: 'project.json', filePath: projectPath },
    { name: 'assets/media-1__ä-video.mp4', filePath: mediaPath }
  ]);
  assert.equal(fs.readFileSync(output).readUInt32LE(0), 0x04034B50);

  const context = { console, Uint8Array, ArrayBuffer, Blob, TextEncoder, TextDecoder, setTimeout, clearTimeout, Promise };
  context.self = context; context.window = context; context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'frontend', 'vendor', 'jszip.min.js'), 'utf8'), context);
  const zip = await context.JSZip.loadAsync(fs.readFileSync(output), { checkCRC32: true });
  assert.equal(await zip.file('project.json').async('string'), fs.readFileSync(projectPath, 'utf8'));
  assert.deepEqual(Array.from(await zip.file('assets/media-1__ä-video.mp4').async('uint8array')), [1, 2, 3, 4, 5, 6]);

  await assert.rejects(
    () => writeStoredZip(path.join(dir, 'bad.zip'), [{ name: '../escape.bin', filePath: mediaPath }]),
    /Unsicherer ZIP-Dateiname/
  );
});

test('server ZIP writer streams several larger entries without building a browser-style aggregate Blob', { timeout: 30000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatcut-zipstore-large-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const entries = [];
  for (let i = 0; i < 3; i++) {
    const filePath = path.join(dir, `source-${i}.bin`);
    const fd = fs.openSync(filePath, 'w');
    try { fs.ftruncateSync(fd, 16 * 1024 * 1024); } finally { fs.closeSync(fd); }
    entries.push({ name: `assets/a${i}__source-${i}.mp4`, filePath });
  }
  const output = path.join(dir, 'large.beatcut');
  let updates = 0;
  const result = await writeStoredZip(output, entries, { onProgress: info => { if (info.progress >= 0 && info.progress <= 1) updates++; } });
  assert.equal(result.entries, 3);
  assert.ok(updates > 3);
  const stat = fs.statSync(output);
  assert.ok(stat.size > 48 * 1024 * 1024);
  assert.ok(stat.size < 49 * 1024 * 1024);
});

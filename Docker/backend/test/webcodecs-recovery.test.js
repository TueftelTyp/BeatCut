import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runProcess, resolveFfmpegPath, resolveFfprobePath } from '../src/ffmpeg.js';

test('server FFmpeg accepts concatenated Annex-B H.264 sessions after encoder restart', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatcut-annexb-'));
  try {
    const segments = [];
    for (let i = 0; i < 5; i++) {
      const file = path.join(dir, `frame-${i}.h264`);
      await runProcess(resolveFfmpegPath(), [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'lavfi', '-i', 'color=c=black:s=320x180:r=30',
        '-frames:v', '1',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
        '-x264-params', 'keyint=1:min-keyint=1:scenecut=0',
        '-f', 'h264', file
      ], { timeoutMs: 30000 });
      segments.push(file);
    }

    const joined = path.join(dir, 'joined.h264');
    fs.writeFileSync(joined, Buffer.concat(segments.map(file => fs.readFileSync(file))));
    const mp4 = path.join(dir, 'out.mp4');
    await runProcess(resolveFfmpegPath(), [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-r', '30', '-f', 'h264', '-i', joined,
      '-frames:v', '5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', mp4
    ], { timeoutMs: 30000 });

    const probe = await runProcess(resolveFfprobePath(), [
      '-v', 'error', '-count_frames', '-select_streams', 'v:0',
      '-show_entries', 'stream=nb_read_frames,r_frame_rate', '-of', 'json', mp4
    ], { capture: true, timeoutMs: 30000 });
    const json = JSON.parse(probe.stdout);
    assert.equal(json.streams?.[0]?.nb_read_frames, '5');
    assert.equal(json.streams?.[0]?.r_frame_rate, '30/1');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

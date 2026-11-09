import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getMedia, getRenderJob, insertRenderJob, updateRenderJob } from './db.js';
import { resolveFfmpegPath, runProcess } from './ffmpeg.js';
import { precomposedDir, renderDir, tempDir } from './paths.js';

const queue = [];
const controllers = new Map();
let running = false;
const MAX_AUDIO_INPUTS = 256;

export function enqueueRender(project) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const job = {
    id,
    projectId: project.id ?? null,
    status: 'queued',
    progress: 0,
    stage: 'Wartet auf Renderer',
    createdAt: now,
    updatedAt: now
  };
  insertRenderJob(job);
  queue.push({ id, project: structuredClone(project) });
  void processQueue();
  return job;
}

export function cancelRender(id) {
  const job = getRenderJob(id);
  if (!job || ['completed', 'failed', 'cancelled'].includes(job.status)) return false;

  const queuedIndex = queue.findIndex(item => item.id === id);
  if (queuedIndex >= 0) {
    const [item] = queue.splice(queuedIndex, 1);
    cleanupRenderInputs(item?.project);
    updateRenderJob(id, {
      status: 'cancelled',
      progress: 100,
      stage: 'Abgebrochen',
      error: null
    });
    return true;
  }

  const controller = controllers.get(id);
  if (controller) {
    updateRenderJob(id, { stage: 'Abbruch läuft' });
    controller.abort();
    return true;
  }

  return false;
}

async function processQueue() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const item = queue.shift();
      if (!item) continue;
      const existing = getRenderJob(item.id);
      if (!existing || existing.status === 'cancelled') {
        cleanupRenderInputs(item.project);
        continue;
      }
      try {
        await renderProject(item.id, item.project);
      } catch (error) {
        if (error?.code === 'ABORT_ERR') {
          updateRenderJob(item.id, {
            status: 'cancelled',
            progress: 100,
            stage: 'Abgebrochen',
            error: null
          });
        } else {
          console.error(`Renderjob ${item.id} fehlgeschlagen:`, error);
          updateRenderJob(item.id, {
            status: 'failed',
            progress: 100,
            stage: 'Fehlgeschlagen',
            error: publicRenderError(error)
          });
        }
      } finally {
        cleanupRenderInputs(item.project);
      }
    }
  } finally {
    running = false;
  }
}

async function renderProject(jobId, project) {
  const controller = new AbortController();
  controllers.set(jobId, controller);
  try {
    updateRenderJob(jobId, { status: 'running', progress: 1, stage: 'Projekt wird vorbereitet' });
    if (project.precomposedVideoToken) {
      await renderPrecomposedProject(jobId, project, controller.signal);
      return;
    }
    await renderLegacyProject(jobId, project, controller.signal);
  } finally {
    controllers.delete(jobId);
  }
}

async function renderPrecomposedProject(jobId, project, signal) {
  const fps = clampInt(project.fps, 24, 60, 30);
  const width = even(clampInt(project.width, 2, 7680, 1080));
  const height = even(clampInt(project.height, 2, 7680, 1920));
  const { exactDuration, totalFrames } = exactPlan(project, fps);
  const videoPath = renderInputPath(project.precomposedVideoToken, 'video');
  const audioPath = project.precomposedAudioToken ? renderInputPath(project.precomposedAudioToken, 'audio') : null;

  if (!fs.existsSync(videoPath)) throw new Error('Vorbereitetes Render-Video wurde nicht gefunden.');
  if (audioPath && !fs.existsSync(audioPath)) throw new Error('Vorbereitetes Render-Audio wurde nicht gefunden.');

  const outputName = `${sanitize(project.name || 'BeatCut')}-${jobId.slice(0, 8)}.mp4`;
  const outputPath = path.join(renderDir, outputName);
  const quality = qualitySettings(project.quality);
  const durationText = exactDuration.toFixed(9);
  const rate = String(fps);
  const videoFormat = project.precomposedVideoFormat === 'webm' ? 'webm' : 'h264';
  const embeddedAudio = videoFormat === 'webm' && project.precomposedAudioEmbedded === true;
  const args = ['-y', '-fflags', '+genpts'];
  if (videoFormat === 'h264') args.push('-r', rate, '-f', 'h264');
  args.push('-i', videoPath);

  if (audioPath) args.push('-i', audioPath);
  args.push('-map', '0:v:0');
  if (audioPath) args.push('-map', '1:a:0?');
  else if (embeddedAudio) args.push('-map', '0:a:0?');

  args.push(
    '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=${rate},trim=duration=${durationText},setpts=PTS-STARTPTS`,
    '-frames:v', String(totalFrames),
    '-r', rate,
    '-fps_mode', 'cfr',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', quality.crf,
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'high',
    '-level', '4.2',
    '-tag:v', 'avc1',
    '-g', String(Math.max(1, fps * 2)),
    '-keyint_min', String(Math.max(1, fps * 2)),
    '-sc_threshold', '0',
    '-video_track_timescale', '90000'
  );

  if (audioPath || embeddedAudio) {
    args.push(
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '48000',
      '-ac', '2',
      '-af', `aresample=async=1:first_pts=0,apad=pad_dur=${durationText},atrim=0:${durationText},asetpts=PTS-STARTPTS`
    );
  } else {
    args.push('-an');
  }

  args.push(
    '-t', durationText,
    '-avoid_negative_ts', 'disabled',
    '-use_editlist', '1',
    '-max_muxing_queue_size', '4096',
    '-map_metadata', '-1',
    '-movflags', '+faststart',
    '-progress', 'pipe:1',
    '-nostats',
    outputPath
  );

  updateRenderJob(jobId, { progress: 5, stage: 'MP4 wird serverseitig gerendert' });
  const onStdout = createProgressHandler(jobId, exactDuration, 5, 96, 'MP4 wird serverseitig gerendert');
  await runProcess(resolveFfmpegPath(), args, { signal, onStdout });

  if (signal.aborted) {
    try { fs.rmSync(outputPath, { force: true }); } catch {}
    const error = new Error('Rendern wurde abgebrochen.');
    error.code = 'ABORT_ERR';
    throw error;
  }

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size <= 0) throw new Error('FFmpeg hat keine gültige MP4-Datei erzeugt.');
  updateRenderJob(jobId, {
    status: 'completed',
    progress: 100,
    stage: `Fertig · ${exactDuration.toFixed(3)} s · ${totalFrames} Frames`,
    outputUrl: `/renders/${encodeURIComponent(outputName)}`,
    error: null
  });
}

async function renderLegacyProject(jobId, project, signal) {
  const fps = clampInt(project.fps, 24, 60, 30);
  const width = even(clampInt(project.width, 320, 3840, 1080));
  const height = even(clampInt(project.height, 320, 3840, 1920));
  const { exactDuration, totalFrames } = exactPlan(project, fps);

  const workDir = path.join(tempDir, `render-${jobId}`);
  fs.mkdirSync(workDir, { recursive: true });
  const visualSegments = buildVisualSegments(project, totalFrames, fps);
  const segmentFiles = [];

  try {
    for (let i = 0; i < visualSegments.length; i++) {
      if (signal.aborted) throw abortError();
      const segment = visualSegments[i];
      const out = path.join(workDir, `segment-${String(i).padStart(4, '0')}.mp4`);
      await renderVisualSegment(segment, out, { width, height, fps, signal });
      segmentFiles.push(out);
      updateRenderJob(jobId, {
        progress: 5 + Math.round(((i + 1) / visualSegments.length) * 55),
        stage: `Videosegment ${i + 1} von ${visualSegments.length}`
      });
    }

    const concatList = path.join(workDir, 'concat.txt');
    fs.writeFileSync(concatList, segmentFiles.map(file => `file '${escapeConcat(file)}'`).join('\n'), 'utf8');
    const videoOnly = path.join(workDir, 'video-only.mp4');
    await runProcess(resolveFfmpegPath(), [
      '-y', '-fflags', '+genpts', '-f', 'concat', '-safe', '0', '-i', concatList,
      '-map', '0:v:0', '-an', '-c:v', 'copy', '-t', exactDuration.toFixed(9),
      '-avoid_negative_ts', 'disabled', '-video_track_timescale', '90000', '-use_editlist', '1',
      '-movflags', '+faststart', videoOnly
    ], { signal });

    updateRenderJob(jobId, { progress: 68, stage: 'Audio wird gemischt' });
    const outputName = `${sanitize(project.name || 'BeatCut')}-${jobId.slice(0, 8)}.mp4`;
    const outputPath = path.join(renderDir, outputName);
    await muxAudio(project, videoOnly, outputPath, exactDuration, fps, signal);
    updateRenderJob(jobId, {
      status: 'completed', progress: 100, stage: 'Fertig',
      outputUrl: `/renders/${encodeURIComponent(outputName)}`, error: null
    });
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

function exactPlan(project, fps) {
  const rawDuration = determineDuration(project);
  const requestedDuration = project.socialSafe60 !== false && rawDuration >= 59.95 && rawDuration <= 60.2 ? 59.9 : rawDuration;
  const totalFrames = Math.max(1, Math.floor(requestedDuration * fps + 1e-7));
  return { totalFrames, exactDuration: totalFrames / fps };
}

export function determineDuration(project) {
  if (Number.isFinite(Number(project.duration)) && Number(project.duration) > 0) {
    let duration = Number(project.duration);
    if (Number.isFinite(Number(project.durationLimit)) && Number(project.durationLimit) > 0) duration = Math.min(duration, Number(project.durationLimit));
    return Math.max(0.05, duration);
  }
  const clipEnd = (project.clips || []).reduce((max, clip) => Math.max(max, n(clip.start) + Math.max(0, n(clip.duration))), 0);
  const musicEnd = (project.musicSegments || []).reduce((max, item) => Math.max(max, n(item.start) + Math.max(0, n(item.duration))), 0);
  const textEnd = (project.texts || []).reduce((max, item) => Math.max(max, n(item.start) + Math.max(0, n(item.duration))), 0);
  let duration = Math.max(clipEnd, musicEnd, textEnd, 1);
  if (Number.isFinite(Number(project.durationLimit)) && Number(project.durationLimit) > 0) duration = Math.min(duration, Number(project.durationLimit));
  return Math.max(0.1, duration);
}

export function buildVisualSegments(project, totalFrames, fps) {
  const clips = (project.clips || [])
    .map((clip, index) => {
      const media = getMedia(clip.mediaId);
      if (!media) return null;
      const startFrame = clampInt(Math.round(n(clip.start) * fps), 0, totalFrames, 0);
      const endFrame = clampInt(Math.round((n(clip.start) + Math.max(0.01, n(clip.duration))) * fps), 0, totalFrames, totalFrames);
      return { clip, media, index, startFrame, endFrame };
    })
    .filter(Boolean)
    .filter(item => item.endFrame > item.startFrame);

  const boundaries = new Set([0, totalFrames]);
  for (const item of clips) { boundaries.add(item.startFrame); boundaries.add(item.endFrame); }
  const sortedBoundaries = [...boundaries].sort((a, b) => a - b);
  const segments = [];

  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const from = sortedBoundaries[i];
    const to = sortedBoundaries[i + 1];
    if (to <= from) continue;
    const active = clips.filter(item => item.startFrame <= from && item.endFrame > from).sort((a, b) => b.startFrame - a.startFrame || a.index - b.index)[0];
    if (!active) { appendSegment(segments, { kind: 'gap', frames: to - from }); continue; }
    const sourceStart = Math.max(0, n(active.clip.sourceStart) + (from - active.startFrame) / fps);
    if (active.media.type === 'video' && active.media.duration > 0 && sourceStart >= active.media.duration - 1 / fps) {
      appendSegment(segments, { kind: 'gap', frames: to - from });
      continue;
    }
    appendSegment(segments, { kind: 'media', mediaId: active.clip.mediaId, sourceStart, frames: to - from });
  }
  if (!segments.length) segments.push({ kind: 'gap', frames: totalFrames });
  return segments;
}

function appendSegment(segments, next) {
  const previous = segments.at(-1);
  if (previous?.kind === 'gap' && next.kind === 'gap') { previous.frames += next.frames; return; }
  segments.push(next);
}

async function renderVisualSegment(segment, outputPath, settings) {
  const { width, height, fps, signal } = settings;
  const duration = segment.frames / fps;
  const baseVideoFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=${fps},format=yuv420p,setpts=PTS-STARTPTS`;
  const common = [
    '-an', '-frames:v', String(segment.frames), '-r', String(fps), '-fps_mode', 'cfr',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-g', String(fps * 2), '-keyint_min', String(fps * 2), '-sc_threshold', '0',
    '-video_track_timescale', '90000', '-use_editlist', '1', '-movflags', '+faststart', outputPath
  ];

  if (segment.kind === 'gap') {
    await runProcess(resolveFfmpegPath(), ['-y', '-f', 'lavfi', '-i', `color=c=black:s=${width}x${height}:r=${fps}:d=${duration.toFixed(9)}`, '-vf', baseVideoFilter, ...common], { signal });
    return;
  }

  const media = getMedia(segment.mediaId);
  if (!media || !fs.existsSync(media.filePath)) throw new Error(`Medium ${segment.mediaId} wurde nicht gefunden.`);
  if (media.type === 'image') {
    await runProcess(resolveFfmpegPath(), ['-y', '-loop', '1', '-framerate', String(fps), '-t', duration.toFixed(9), '-i', media.filePath, '-vf', baseVideoFilter, ...common], { signal });
    return;
  }

  const remainingSource = media.duration > 0 ? Math.max(0, media.duration - segment.sourceStart) : duration;
  const padDuration = Math.max(0, duration - remainingSource);
  const videoFilter = padDuration > 1 / fps
    ? `tpad=stop_mode=clone:stop_duration=${padDuration.toFixed(9)},trim=duration=${duration.toFixed(9)},${baseVideoFilter}`
    : `trim=duration=${duration.toFixed(9)},${baseVideoFilter}`;
  await runProcess(resolveFfmpegPath(), ['-y', '-ss', segment.sourceStart.toFixed(9), '-i', media.filePath, '-vf', videoFilter, ...common], { signal });
}

async function muxAudio(project, videoPath, outputPath, duration, fps, signal) {
  const audioItems = collectAudioItems(project, duration);
  if (audioItems.length > MAX_AUDIO_INPUTS) throw new Error(`Zu viele Audiosegmente (${audioItems.length}; Maximum ${MAX_AUDIO_INPUTS}).`);

  const args = ['-y', '-fflags', '+genpts', '-i', videoPath];
  for (const item of audioItems) args.push('-i', item.filePath);
  let filter;
  if (audioItems.length) {
    const parts = [];
    const labels = [];
    audioItems.forEach((item, index) => {
      const input = index + 1;
      const label = `a${index}`;
      let chain = `[${input}:a]atrim=start=${item.sourceStart.toFixed(9)}:duration=${item.duration.toFixed(9)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=${item.volume.toFixed(6)}`;
      if (item.fadeIn > 0) chain += `,afade=t=in:st=0:d=${Math.min(item.fadeIn, item.duration).toFixed(9)}`;
      if (item.fadeOut > 0) {
        const fadeOut = Math.min(item.fadeOut, item.duration);
        chain += `,afade=t=out:st=${Math.max(0, item.duration - fadeOut).toFixed(9)}:d=${fadeOut.toFixed(9)}`;
      }
      const delay = Math.max(0, Math.round(item.start * 1000));
      chain += `,adelay=${delay}|${delay}[${label}]`;
      parts.push(chain);
      labels.push(`[${label}]`);
    });
    parts.push(`${labels.join('')}amix=inputs=${labels.length}:duration=longest:normalize=0,alimiter=limit=0.95,apad=pad_dur=${duration.toFixed(9)},atrim=0:${duration.toFixed(9)},aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS[aout]`);
    filter = parts.join(';');
  } else {
    filter = `anullsrc=channel_layout=stereo:sample_rate=48000,apad=pad_dur=${duration.toFixed(9)},atrim=0:${duration.toFixed(9)},asetpts=PTS-STARTPTS[aout]`;
  }

  args.push(
    '-filter_complex', filter, '-map', '0:v:0', '-map', '[aout]', '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-r', String(fps), '-fps_mode', 'cfr',
    '-t', duration.toFixed(9), '-avoid_negative_ts', 'disabled', '-video_track_timescale', '90000', '-use_editlist', '1',
    '-max_muxing_queue_size', '4096', '-map_metadata', '-1', '-movflags', '+faststart', outputPath
  );
  await runProcess(resolveFfmpegPath(), args, { signal });
}

function collectAudioItems(project, duration) {
  const items = [];
  for (const clip of project.clips || []) {
    if (clip.audioEnabled === false) continue;
    const media = getMedia(clip.mediaId);
    if (!media?.hasAudio || media.type !== 'video' || !fs.existsSync(media.filePath)) continue;
    const start = Math.max(0, n(clip.start));
    if (start >= duration) continue;
    const sourceStart = Math.max(0, n(clip.sourceStart));
    const available = media.duration > 0 ? Math.max(0, media.duration - sourceStart) : n(clip.duration);
    const clipDuration = Math.min(Math.max(0.01, n(clip.duration)), duration - start, available);
    if (!(clipDuration > 0)) continue;
    items.push({ filePath: media.filePath, sourceStart, start, duration: clipDuration, volume: clip.audioVolume == null ? 1 : clamp(n(clip.audioVolume), 0, 10), fadeIn: Math.max(0, n(clip.audioFadeIn)), fadeOut: Math.max(0, n(clip.audioFadeOut)) });
  }
  for (const music of project.musicSegments || []) {
    const media = getMedia(music.mediaId);
    if (!media?.hasAudio || !fs.existsSync(media.filePath)) continue;
    const start = Math.max(0, n(music.start));
    if (start >= duration) continue;
    const sourceStart = Math.max(0, n(music.sourceStart));
    const available = media.duration > 0 ? Math.max(0, media.duration - sourceStart) : n(music.duration);
    const itemDuration = Math.min(Math.max(0.01, n(music.duration)), duration - start, available);
    if (!(itemDuration > 0)) continue;
    items.push({ filePath: media.filePath, sourceStart, start, duration: itemDuration, volume: music.volume == null ? 1 : clamp(n(music.volume), 0, 10), fadeIn: Math.max(0, n(music.fadeIn)), fadeOut: Math.max(0, n(music.fadeOut)) });
  }
  return items;
}

function createProgressHandler(jobId, duration, min, max, stage) {
  let buffer = '';
  let lastUpdate = 0;
  return text => {
    buffer += text;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('out_time=')) continue;
      const seconds = parseTime(line.slice('out_time='.length));
      if (!Number.isFinite(seconds) || duration <= 0) continue;
      const now = Date.now();
      if (now - lastUpdate < 250 && seconds < duration) continue;
      lastUpdate = now;
      const ratio = clamp(seconds / duration, 0, 1);
      updateRenderJob(jobId, { progress: min + Math.round((max - min) * ratio), stage });
    }
  };
}

function parseTime(value) {
  const match = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(String(value).trim());
  if (!match) return NaN;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function renderInputPath(token, kind) {
  const extension = kind === 'video' ? '.h264' : '.webm';
  return path.join(precomposedDir, `${kind}-${token}${extension}`);
}

function cleanupRenderInputs(project) {
  if (!project) return;
  if (project.precomposedVideoToken) { try { fs.rmSync(renderInputPath(project.precomposedVideoToken, 'video'), { force: true }); } catch {} }
  if (project.precomposedAudioToken) { try { fs.rmSync(renderInputPath(project.precomposedAudioToken, 'audio'), { force: true }); } catch {} }
}

function qualitySettings(name) {
  return { low: { crf: '28' }, medium: { crf: '23' }, high: { crf: '20' }, 'very-high': { crf: '17' } }[name] || { crf: '20' };
}

function abortError() {
  const error = new Error('Rendern wurde abgebrochen.');
  error.code = 'ABORT_ERR';
  return error;
}

function publicRenderError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const firstLine = message.split(/\r?\n/, 1)[0].trim();
  return (firstLine || 'Rendern fehlgeschlagen.').slice(0, 700);
}

function n(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function clampInt(value, min, max, fallback) { const parsed = Math.round(Number(value)); if (!Number.isFinite(parsed)) return fallback; return Math.max(min, Math.min(max, parsed)); }
function even(value) { return value % 2 === 0 ? value : value - 1; }
function sanitize(value) { return String(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'BeatCut'; }
function escapeConcat(value) { return path.resolve(value).replaceAll("'", "'\\''").replaceAll('\\', '/'); }

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { toolsDir } from './paths.js';

const DEFAULT_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const CAPTURE_LIMIT = 2 * 1024 * 1024;
const ERROR_TAIL_LIMIT = 64 * 1024;

function resolveTool(name) {
  const executable = process.platform === 'win32' ? `${name}.exe` : name;
  const local = path.join(toolsDir, executable);
  return fs.existsSync(local) ? local : executable;
}

export function resolveFfmpegPath() {
  return resolveTool('ffmpeg');
}

export function resolveFfprobePath() {
  return resolveTool('ffprobe');
}

export async function checkTool(command) {
  try {
    const result = await runProcess(command, ['-version'], { capture: true, timeoutMs: 15000 });
    const firstLine = (result.stdout || result.stderr || '').split(/\r?\n/, 1)[0] || '';
    return { ok: true, command, version: firstLine.slice(0, 300), error: '' };
  } catch (error) {
    return {
      ok: false,
      command,
      version: '',
      error: publicToolError(command, error)
    };
  }
}

export async function probeMedia(filePath) {
  const result = await runProcess(resolveFfprobePath(), [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=index,codec_type,width,height,duration',
    '-of', 'json',
    filePath
  ], { capture: true, timeoutMs: 60000 });

  let json;
  try {
    json = JSON.parse(result.stdout || '{}');
  } catch (error) {
    throw new Error(`FFprobe lieferte ungültige JSON-Daten: ${error instanceof Error ? error.message : String(error)}`);
  }

  const streams = Array.isArray(json.streams) ? json.streams : [];
  const video = streams.find(stream => stream.codec_type === 'video');
  const audio = streams.find(stream => stream.codec_type === 'audio');
  const durationCandidates = [json.format?.duration, video?.duration, audio?.duration]
    .map(Number)
    .filter(Number.isFinite);
  const duration = durationCandidates.length ? Math.max(...durationCandidates) : 0;

  return {
    duration: Math.max(0, duration),
    width: Math.max(0, Number(video?.width || 0)),
    height: Math.max(0, Number(video?.height || 0)),
    hasAudio: Boolean(audio),
    hasVideo: Boolean(video)
  };
}

export async function createVideoThumbnail(inputPath, outputPath) {
  await runProcess(resolveFfmpegPath(), [
    '-y',
    '-ss', '0.3',
    '-i', inputPath,
    '-frames:v', '1',
    '-vf', "scale='min(420,iw)':-2",
    '-q:v', '3',
    outputPath
  ], { timeoutMs: 60000 });
}

export function runProcess(command, args, options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const capture = Boolean(options.capture);
  const signal = options.signal;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const error = new Error(`${path.basename(command)} wurde abgebrochen.`);
      error.code = 'ABORT_ERR';
      reject(error);
      return;
    }

    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer = null;

    const appendBounded = (current, text, limit, keepTail = false) => {
      if (!text) return current;
      const combined = current + text;
      if (Buffer.byteLength(combined, 'utf8') <= limit) return combined;
      if (keepTail) return combined.slice(-limit);
      return combined.slice(0, limit);
    };

    const terminateTree = () => {
      if (!child.pid) return;
      if (process.platform === 'win32') {
        try {
          spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
            windowsHide: true,
            stdio: 'ignore',
            shell: false
          });
        } catch {}
      } else {
        try { child.kill('SIGKILL'); } catch {}
      }
    };

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (signal && onAbort) signal.removeEventListener('abort', onAbort);
    };

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      error ? reject(error) : resolve(value);
    };

    const onAbort = signal ? () => {
      terminateTree();
      const error = new Error(`${path.basename(command)} wurde abgebrochen.`);
      error.code = 'ABORT_ERR';
      finish(error);
    } : null;

    if (signal && onAbort) signal.addEventListener('abort', onAbort, { once: true });

    child.stdout?.on('data', chunk => {
      const text = chunk.toString();
      if (capture) stdout = appendBounded(stdout, text, CAPTURE_LIMIT, false);
      options.onStdout?.(text);
    });

    child.stderr?.on('data', chunk => {
      const text = chunk.toString();
      stderr = appendBounded(stderr, text, ERROR_TAIL_LIMIT, true);
      options.onStderr?.(text);
    });

    child.on('error', error => finish(error));
    child.on('close', code => {
      if (settled) return;
      if (code === 0) {
        finish(null, { stdout, stderr });
        return;
      }
      const error = new Error(formatExitError(command, code, stderr));
      error.exitCode = code;
      finish(error);
    });

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        terminateTree();
        const error = new Error(`${path.basename(command)} wurde nach ${Math.round(timeoutMs / 1000)} Sekunden wegen Zeitüberschreitung beendet.`);
        error.code = 'ETIMEDOUT';
        finish(error);
      }, timeoutMs);
      timer.unref?.();
    }
  });
}

function formatExitError(command, code, stderr) {
  const base = path.basename(command);
  if (process.platform === 'win32' && (code === 3221225781 || code === -1073741515)) {
    return `${base} konnte nicht gestartet werden, weil eine benötigte Windows-DLL fehlt (0xC0000135). Verwende einen vollständigen Static-Build von FFmpeg oder kopiere alle DLLs des verwendeten Shared-Builds nach tools/ffmpeg.`;
  }
  return `${base} beendet mit Code ${code}.\n${stderr || 'Keine Fehlerausgabe.'}`;
}

function publicToolError(command, error) {
  if (error?.code === 'ENOENT') {
    return `${path.basename(command)} wurde nicht gefunden. Lege FFmpeg/FFprobe in tools/ffmpeg ab oder füge sie dem PATH hinzu.`;
  }
  const message = error instanceof Error ? error.message : String(error);
  return message.split(/\r?\n/).slice(0, 3).join(' ').slice(0, 900);
}

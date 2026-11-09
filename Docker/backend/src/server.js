import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  closeDb,
  deleteMedia,
  getMedia,
  getProject,
  getRenderJob,
  insertMedia,
  listMedia,
  listProjects,
  markInterruptedRenderJobsFailed,
  saveProject
} from './db.js';
import { checkTool, createVideoThumbnail, probeMedia, resolveFfmpegPath, resolveFfprobePath, runProcess } from './ffmpeg.js';
import { cancelRender, enqueueRender } from './renderQueue.js';
import { cleanupStaleTransferArtifacts, cleanupStartupArtifacts, frameExportDir, frontendDir, precomposedDir, projectPackageDir, renderDir, thumbDir, uploadDir } from './paths.js';
import { assertProject, ValidationError } from './validation.js';
import { writeStoredZip } from './zipStore.js';

const DEFAULT_PORT = 5000;
const maxJsonBytes = envInt('BEATCUT_MAX_JSON_BYTES', 25 * 1024 * 1024, 1024, 100 * 1024 * 1024);
const maxUploadBytes = envInt('BEATCUT_MAX_UPLOAD_BYTES', 8 * 1024 * 1024 * 1024, 1024, 32 * 1024 * 1024 * 1024);
const maxProjectPackageBytes = envInt('BEATCUT_MAX_PROJECT_PACKAGE_BYTES', 16 * 1024 * 1024 * 1024, 1024 * 1024, 64 * 1024 * 1024 * 1024);
const allowedUploadExtensions = new Set([
  '.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi', '.mpeg', '.mpg', '.mts', '.m2ts',
  '.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus',
  '.png', '.jpg', '.jpeg', '.webp', '.bmp'
]);
const projectPackageSessions = new Map();
const frameExportSessions = new Map();
const maxFrameBytes = envInt('BEATCUT_MAX_FRAME_BYTES', 24 * 1024 * 1024, 256 * 1024, 128 * 1024 * 1024);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

cleanupStartupArtifacts();
markInterruptedRenderJobsFailed();

export function createBeatCutServer() {
  const maintenanceTimer = setInterval(() => {
    cleanupStaleTransferArtifacts();
    cleanupProjectPackageSessions();
    cleanupFrameExportSessions();
  }, 60 * 60 * 1000);
  maintenanceTimer.unref?.();
  const server = http.createServer(async (req, res) => {
    setCommonHeaders(res);
    try {
      const url = new URL(req.url || '/', 'http://beatcut.local');
      const pathname = safeDecodePathname(url.pathname);

      if (req.method === 'OPTIONS' && pathname.startsWith('/api/')) {
        applyCors(req, res);
        res.writeHead(204, {
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-File-Name, X-Mime-Type',
          'Access-Control-Max-Age': '600'
        }).end();
        return;
      }

      if (pathname.startsWith('/api/')) {
        applyCors(req, res);
        await handleApi(req, res, pathname, url);
        return;
      }

      if (pathname.startsWith('/media/')) {
        assertReadMethod(req);
        await serveFile(req, res, safeJoin(uploadDir, pathname.slice('/media/'.length)));
        return;
      }
      if (pathname.startsWith('/thumbs/')) {
        assertReadMethod(req);
        await serveFile(req, res, safeJoin(thumbDir, pathname.slice('/thumbs/'.length)));
        return;
      }
      if (pathname.startsWith('/renders/')) {
        assertReadMethod(req);
        await serveFile(req, res, safeJoin(renderDir, pathname.slice('/renders/'.length)), true);
        return;
      }

      assertReadMethod(req);
      const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const filePath = safeJoin(frontendDir, requested);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        await serveFile(req, res, filePath);
        return;
      }

      await serveFile(req, res, path.join(frontendDir, 'index.html'));
    } catch (error) {
      handleRequestError(res, error);
    }
  });
  server.requestTimeout = envInt('BEATCUT_REQUEST_TIMEOUT_MS', 2 * 60 * 60 * 1000, 60 * 1000, 24 * 60 * 60 * 1000);
  server.headersTimeout = 60 * 1000;
  server.keepAliveTimeout = 5 * 1000;
  server.maxHeadersCount = 100;
  server.once('close', () => clearInterval(maintenanceTimer));
  return server;
}

async function createProjectPackageSession(req, res) {
  const body = await readJson(req);
  const project = body?.project;
  if (!project || typeof project !== 'object' || Array.isArray(project)) {
    throw new HttpError(400, 'Projektbeschreibung fehlt oder ist ungültig.');
  }

  const projectJson = JSON.stringify(project);
  if (Buffer.byteLength(projectJson, 'utf8') > maxJsonBytes) throw new HttpError(413, 'Projektbeschreibung ist zu groß.');

  const rawAssets = Array.isArray(body.assets) ? body.assets : [];
  if (rawAssets.length > 10000) throw new HttpError(400, 'Projekt enthält zu viele Medien.');
  const expected = new Map();
  let totalBytes = 0;
  for (const item of rawAssets) {
    const id = validateRouteId(String(item?.id || ''));
    if (expected.has(`asset:${id}`)) throw new HttpError(400, `Doppelte Medien-ID: ${id}`);
    const name = normalizeOriginalFileName(item?.name || 'medium.bin');
    const size = validateExpectedSize(item?.size, `Medium ${name}`);
    const ext = path.extname(name).toLowerCase();
    if (!allowedUploadExtensions.has(ext)) throw new HttpError(415, `Dateityp ${ext || '(ohne Erweiterung)'} wird nicht unterstützt.`);
    totalBytes += size;
    expected.set(`asset:${id}`, { kind: 'asset', id, name, size, entryName: `assets/${id}__${name}`, uploaded: false, filePath: null });
  }

  if (body.audio) {
    const name = normalizeOriginalFileName(body.audio.name || 'audio.bin');
    const size = validateExpectedSize(body.audio.size, `Musik ${name}`);
    const ext = path.extname(name).toLowerCase();
    if (!allowedUploadExtensions.has(ext) || detectType(name) !== 'audio') throw new HttpError(415, 'Musikdatei hat einen nicht unterstützten Dateityp.');
    totalBytes += size;
    expected.set('audio', { kind: 'audio', id: 'audio', name, size, entryName: `audio__${name}`, uploaded: false, filePath: null });
  }

  const estimatedArchiveBytes = totalBytes + Buffer.byteLength(projectJson, 'utf8') + expected.size * 512 + 64 * 1024;
  if (estimatedArchiveBytes > maxProjectPackageBytes) {
    throw new HttpError(413, `Projektmedien sind zu groß. Maximal ${formatBytes(maxProjectPackageBytes)} pro Projektdatei.`);
  }

  const token = randomUUID();
  const sessionDir = path.join(projectPackageDir, token);
  const filesDir = path.join(sessionDir, 'files');
  fs.mkdirSync(filesDir, { recursive: true });
  const projectPath = path.join(sessionDir, 'project.json');
  fs.writeFileSync(projectPath, projectJson, { encoding: 'utf8', flag: 'wx' });
  const requestedName = normalizeProjectDownloadName(body.name || project?.projectName || 'BeatCut-Projekt');
  const session = {
    token,
    sessionDir,
    filesDir,
    projectPath,
    outputPath: path.join(sessionDir, 'project.beatcut'),
    downloadName: requestedName,
    expected,
    state: 'uploading',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    uploadedBytes: 0,
    totalBytes,
    packageProgress: 0,
    packageBytes: 0,
    error: '',
    abortController: null
  };
  projectPackageSessions.set(token, session);
  return sendJson(res, 201, { token, totalBytes, entries: expected.size, name: requestedName });
}

async function uploadProjectPackageEntry(req, res, token, kind, id) {
  const session = getProjectPackageSession(token);
  if (session.state !== 'uploading') throw new HttpError(409, 'Projektdatei nimmt keine weiteren Uploads an.');
  const key = kind === 'audio' ? 'audio' : `asset:${id}`;
  const entry = session.expected.get(key);
  if (!entry) throw new HttpError(404, 'Projektmedium ist für diese Projektdatei nicht vorgesehen.');

  const declared = req.headers['content-length'] == null ? null : Number(req.headers['content-length']);
  if (declared != null && (!Number.isFinite(declared) || declared < 0)) throw new HttpError(400, 'Ungültige Content-Length.');
  if (declared != null && declared !== entry.size) {
    if (declared <= Math.min(maxUploadBytes, entry.size + 16 * 1024 * 1024)) await drainRequestBody(req);
    else req.resume();
    throw new HttpError(400, `Dateigröße stimmt nicht mit dem Projekt überein (${entry.name}).`);
  }

  const finalPath = path.join(session.filesDir, `${kind === 'audio' ? 'audio' : id}.bin`);
  const temporaryPath = `${finalPath}.uploading`;
  try {
    fs.rmSync(temporaryPath, { force: true });
    fs.rmSync(finalPath, { force: true });
    const bytes = await streamRequestToFile(req, temporaryPath, Math.min(maxUploadBytes, entry.size + 1));
    if (bytes !== entry.size) throw new HttpError(400, `Upload ist unvollständig (${entry.name}).`);
    fs.renameSync(temporaryPath, finalPath);
    entry.uploaded = true;
    entry.filePath = finalPath;
    session.uploadedBytes = [...session.expected.values()].reduce((sum, value) => sum + (value.uploaded ? value.size : 0), 0);
    session.updatedAt = Date.now();
    return sendJson(res, 201, { ok: true, bytes });
  } catch (error) {
    try { fs.rmSync(temporaryPath, { force: true }); } catch {}
    throw error;
  }
}

function finalizeProjectPackage(res, token) {
  const session = getProjectPackageSession(token);
  if (session.state === 'packaging' || session.state === 'ready') {
    return sendJson(res, 202, publicProjectPackageStatus(session));
  }
  if (session.state !== 'uploading') throw new HttpError(409, 'Projektdatei kann nicht finalisiert werden.');
  const missing = [...session.expected.values()].filter(entry => !entry.uploaded || !entry.filePath || !fs.existsSync(entry.filePath));
  if (missing.length) throw new HttpError(409, `Es fehlen noch ${missing.length} Projektmedium/Projektmedien.`);

  session.state = 'packaging';
  session.packageProgress = 0;
  session.error = '';
  session.abortController = new AbortController();
  session.updatedAt = Date.now();

  const entries = [
    { name: 'project.json', filePath: session.projectPath },
    ...[...session.expected.values()].filter(entry => entry.kind === 'asset').map(entry => ({ name: entry.entryName, filePath: entry.filePath })),
    ...[...session.expected.values()].filter(entry => entry.kind === 'audio').map(entry => ({ name: entry.entryName, filePath: entry.filePath }))
  ];

  void writeStoredZip(session.outputPath, entries, {
    signal: session.abortController.signal,
    onProgress: info => {
      session.packageProgress = Math.max(0, Math.min(1, Number(info.progress) || 0));
      session.updatedAt = Date.now();
    }
  }).then(result => {
    session.state = 'ready';
    session.packageProgress = 1;
    session.packageBytes = Number(result.bytes <= BigInt(Number.MAX_SAFE_INTEGER) ? result.bytes : 0n);
    session.updatedAt = Date.now();
    session.abortController = null;
  }).catch(error => {
    session.state = error?.name === 'AbortError' ? 'cancelled' : 'error';
    session.error = error?.name === 'AbortError' ? 'Projektdatei wurde abgebrochen.' : 'Projektdatei konnte auf dem Server nicht erstellt werden.';
    session.updatedAt = Date.now();
    session.abortController = null;
    console.error('Projektdatei-Erstellung fehlgeschlagen:', error);
  });

  return sendJson(res, 202, publicProjectPackageStatus(session));
}

function sendProjectPackageStatus(res, token) {
  const session = getProjectPackageSession(token);
  return sendJson(res, 200, publicProjectPackageStatus(session));
}

async function downloadProjectPackage(req, res, token) {
  const session = getProjectPackageSession(token);
  if (session.state !== 'ready' || !fs.existsSync(session.outputPath)) throw new HttpError(409, 'Projektdatei ist noch nicht fertig.');
  session.updatedAt = Date.now();
  return serveFile(req, res, session.outputPath, session.downloadName);
}

function deleteProjectPackageSession(res, token) {
  const session = projectPackageSessions.get(token);
  if (!session) {
    res.writeHead(204).end();
    return;
  }
  try { session.abortController?.abort(); } catch {}
  projectPackageSessions.delete(token);
  try { fs.rmSync(session.sessionDir, { recursive: true, force: true }); } catch {}
  res.writeHead(204).end();
}

function publicProjectPackageStatus(session) {
  return {
    token: session.token,
    state: session.state,
    uploadedBytes: session.uploadedBytes,
    totalBytes: session.totalBytes,
    progress: session.packageProgress,
    bytes: session.packageBytes,
    error: session.error,
    name: session.downloadName,
    downloadUrl: session.state === 'ready' ? `/api/project-packages/${encodeURIComponent(session.token)}/download` : null
  };
}

function getProjectPackageSession(token) {
  const session = projectPackageSessions.get(token);
  if (!session) throw new HttpError(404, 'Projektdatei-Sitzung nicht gefunden oder abgelaufen.');
  return session;
}

function cleanupProjectPackageSessions(maxAgeMs = 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs;
  for (const [token, session] of projectPackageSessions) {
    if (session.updatedAt >= cutoff || session.state === 'packaging') continue;
    try { session.abortController?.abort(); } catch {}
    projectPackageSessions.delete(token);
    try { fs.rmSync(session.sessionDir, { recursive: true, force: true }); } catch {}
  }
}

function validateExpectedSize(value, label) {
  const size = Number(value);
  if (!Number.isSafeInteger(size) || size <= 0) throw new HttpError(400, `${label}: ungültige Dateigröße.`);
  if (size > maxUploadBytes) throw new HttpError(413, `${label} ist zu groß. Maximal ${formatBytes(maxUploadBytes)} pro Datei.`);
  return size;
}

function normalizeProjectDownloadName(value) {
  let base = String(value || 'BeatCut-Projekt').replaceAll('\0', '').replaceAll('\\', '/');
  base = path.posix.basename(base).trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/[. ]+$/g, '');
  if (base.toLowerCase().endsWith('.beatcut')) base = base.slice(0, -8);
  if (!base) base = 'BeatCut-Projekt';
  if (base.length > 180) base = base.slice(0, 180);
  return `${base}.beatcut`;
}

function sanitizeDownloadFileName(value) {
  let name = String(value || 'download.bin').replaceAll('\0', '').replaceAll('\\', '/');
  name = path.posix.basename(name).trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/[. ]+$/g, '');
  if (!name) name = 'download.bin';
  if (name.length > 220) name = name.slice(0, 220);
  return name;
}

export function startServer(options = {}) {
  const port = options.port ?? Number(process.env.PORT || DEFAULT_PORT);
  const host = options.host ?? process.env.HOST ?? '127.0.0.1';
  if (!isLoopbackBind(host) && process.env.BEATCUT_ALLOW_REMOTE !== '1') {
    throw new Error('Aus Sicherheitsgründen ist eine öffentliche Bindung nur mit BEATCUT_ALLOW_REMOTE=1 erlaubt. Für einen Reverse Proxy kann BeatCut auf 127.0.0.1 bleiben.');
  }
  const server = createBeatCutServer();
  server.listen(port, host, () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    console.log(`BeatCut Studio Server: http://${host}:${actualPort}`);
    console.log(`Datenordner: ${path.resolve(uploadDir, '..')}`);
  });
  return server;
}

async function handleApi(req, res, pathname, url) {
  if (req.method === 'GET' && pathname === '/api/health') {
    const [ffmpeg, ffprobe] = await Promise.all([checkTool(resolveFfmpegPath()), checkTool(resolveFfprobePath())]);
    return sendJson(res, 200, {
      ok: true,
      ffmpeg: ffmpeg.ok,
      ffprobe: ffprobe.ok,
      ffmpegVersion: ffmpeg.version,
      ffprobeVersion: ffprobe.version,
      ffmpegError: ffmpeg.error || '',
      ffprobeError: ffprobe.error || '',
      maxUploadBytes
    });
  }

  if (req.method === 'GET' && pathname === '/api/media') {
    return sendJson(res, 200, listMedia().map(stripInternalMedia));
  }

  if (req.method === 'POST' && pathname === '/api/media/upload') {
    return uploadMedia(req, res, url);
  }

  if (req.method === 'POST' && pathname === '/api/frame-exports') {
    return createFrameExportSession(req, res);
  }

  const frameExportFrameMatch = pathname.match(/^\/api\/frame-exports\/([^/]+)\/frames\/(\d+)$/);
  if (frameExportFrameMatch && req.method === 'PUT') {
    return uploadFrameExportFrame(req, res, validateRouteId(frameExportFrameMatch[1]), Number(frameExportFrameMatch[2]));
  }

  const frameExportAudioMatch = pathname.match(/^\/api\/frame-exports\/([^/]+)\/audio$/);
  if (frameExportAudioMatch && req.method === 'PUT') {
    return uploadFrameExportAudio(req, res, validateRouteId(frameExportAudioMatch[1]));
  }

  const frameExportFinalizeMatch = pathname.match(/^\/api\/frame-exports\/([^/]+)\/finalize$/);
  if (frameExportFinalizeMatch && req.method === 'POST') {
    return finalizeFrameExport(res, validateRouteId(frameExportFinalizeMatch[1]));
  }

  const frameExportStatusMatch = pathname.match(/^\/api\/frame-exports\/([^/]+)\/status$/);
  if (frameExportStatusMatch && req.method === 'GET') {
    return sendJson(res, 200, publicFrameExportStatus(getFrameExportSession(validateRouteId(frameExportStatusMatch[1]))));
  }

  const frameExportDownloadMatch = pathname.match(/^\/api\/frame-exports\/([^/]+)\/download$/);
  if (frameExportDownloadMatch && (req.method === 'GET' || req.method === 'HEAD')) {
    const session = getFrameExportSession(validateRouteId(frameExportDownloadMatch[1]));
    if (session.state !== 'ready' || !session.outputPath) throw new HttpError(409, 'MP4-Datei ist noch nicht fertig.');
    return serveFile(req, res, session.outputPath, session.downloadName);
  }

  const frameExportDeleteMatch = pathname.match(/^\/api\/frame-exports\/([^/]+)$/);
  if (frameExportDeleteMatch && req.method === 'DELETE') {
    return deleteFrameExportSession(res, validateRouteId(frameExportDeleteMatch[1]));
  }

  if (req.method === 'POST' && pathname === '/api/render/inputs/video') {
    return uploadRenderInput(req, res, 'video');
  }

  if (req.method === 'POST' && pathname === '/api/render/inputs/audio') {
    return uploadRenderInput(req, res, 'audio');
  }

  if (req.method === 'POST' && pathname === '/api/project-packages') {
    return createProjectPackageSession(req, res);
  }

  const packageAssetMatch = pathname.match(/^\/api\/project-packages\/([^/]+)\/assets\/([^/]+)$/);
  if (packageAssetMatch && req.method === 'PUT') {
    return uploadProjectPackageEntry(req, res, validateRouteId(packageAssetMatch[1]), 'asset', validateRouteId(packageAssetMatch[2]));
  }

  const packageAudioMatch = pathname.match(/^\/api\/project-packages\/([^/]+)\/audio$/);
  if (packageAudioMatch && req.method === 'PUT') {
    return uploadProjectPackageEntry(req, res, validateRouteId(packageAudioMatch[1]), 'audio', 'audio');
  }

  const packageFinalizeMatch = pathname.match(/^\/api\/project-packages\/([^/]+)\/finalize$/);
  if (packageFinalizeMatch && req.method === 'POST') {
    return finalizeProjectPackage(res, validateRouteId(packageFinalizeMatch[1]));
  }

  const packageStatusMatch = pathname.match(/^\/api\/project-packages\/([^/]+)\/status$/);
  if (packageStatusMatch && req.method === 'GET') {
    return sendProjectPackageStatus(res, validateRouteId(packageStatusMatch[1]));
  }

  const packageDownloadMatch = pathname.match(/^\/api\/project-packages\/([^/]+)\/download$/);
  if (packageDownloadMatch && (req.method === 'GET' || req.method === 'HEAD')) {
    return downloadProjectPackage(req, res, validateRouteId(packageDownloadMatch[1]));
  }

  const packageDeleteMatch = pathname.match(/^\/api\/project-packages\/([^/]+)$/);
  if (packageDeleteMatch && req.method === 'DELETE') {
    return deleteProjectPackageSession(res, validateRouteId(packageDeleteMatch[1]));
  }

  const renderInputMatch = pathname.match(/^\/api\/render\/inputs\/(video|audio)\/([^/]+)$/);
  if (renderInputMatch && req.method === 'DELETE') {
    const kind = renderInputMatch[1];
    const token = validateRouteId(renderInputMatch[2]);
    try { fs.rmSync(renderInputPath(token, kind), { force: true }); } catch {}
    res.writeHead(204).end();
    return;
  }

  const mediaMatch = pathname.match(/^\/api\/media\/([^/]+)$/);
  if (mediaMatch && req.method === 'DELETE') {
    const id = validateRouteId(mediaMatch[1]);
    const media = getMedia(id);
    if (!media) throw new HttpError(404, 'Medium nicht gefunden.');
    try { fs.rmSync(media.filePath, { force: true }); } catch {}
    if (media.thumbnailUrl) {
      try { fs.rmSync(path.join(thumbDir, path.basename(media.thumbnailUrl)), { force: true }); } catch {}
    }
    deleteMedia(id);
    res.writeHead(204).end();
    return;
  }

  if (req.method === 'GET' && pathname === '/api/projects') {
    return sendJson(res, 200, listProjects());
  }

  const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch && req.method === 'GET') {
    const project = getProject(validateRouteId(projectMatch[1]));
    if (!project) throw new HttpError(404, 'Projekt nicht gefunden.');
    return sendJson(res, 200, project);
  }
  if (projectMatch && req.method === 'PUT') {
    const id = validateRouteId(projectMatch[1]);
    const body = await readJson(req);
    const project = { ...body, id };
    assertProject(project);
    return sendJson(res, 200, saveProject(project));
  }

  if (req.method === 'POST' && pathname === '/api/render/jobs') {
    const project = await readJson(req);
    assertProject(project, {
      requireVisualClip: true,
      mediaExists: id => {
        const media = getMedia(id);
        return Boolean(media && fs.existsSync(media.filePath));
      },
      renderInputExists: (token, kind) => fs.existsSync(renderInputPath(token, kind))
    });
    return sendJson(res, 202, enqueueRender(project));
  }

  const jobMatch = pathname.match(/^\/api\/render\/jobs\/([^/]+)$/);
  if (jobMatch && req.method === 'GET') {
    const job = getRenderJob(validateRouteId(jobMatch[1]));
    if (!job) throw new HttpError(404, 'Renderjob nicht gefunden.');
    return sendJson(res, 200, job);
  }
  if (jobMatch && req.method === 'DELETE') {
    const id = validateRouteId(jobMatch[1]);
    const job = getRenderJob(id);
    if (!job) throw new HttpError(404, 'Renderjob nicht gefunden.');
    const cancelled = cancelRender(id);
    return sendJson(res, cancelled ? 200 : 409, cancelled ? { ok: true } : { error: 'Renderjob kann nicht mehr abgebrochen werden.' });
  }

  throw new HttpError(404, 'API-Endpunkt nicht gefunden.');
}


async function createFrameExportSession(req, res) {
  const body = await readJson(req);
  const width = clampIntValue(body?.width, 2, 7680, 'Projektbreite');
  const height = clampIntValue(body?.height, 2, 7680, 'Projekthöhe');
  if (width % 2 || height % 2) throw new HttpError(400, 'Projektbreite und Projekthöhe müssen gerade Zahlen sein.');
  const fps = clampIntValue(body?.fps, 1, 60, 'FPS');
  const totalFrames = clampIntValue(body?.totalFrames, 1, 60 * 60 * 6 * 60, 'Frameanzahl');
  const duration = Number(body?.duration);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 6 * 60 * 60) throw new HttpError(400, 'Ungültige Exportdauer.');
  const expectedDuration = totalFrames / fps;
  if (Math.abs(expectedDuration - duration) > Math.max(0.001, 1 / fps + 1e-6)) throw new HttpError(400, 'Frameanzahl, FPS und Dauer passen nicht zusammen.');
  const quality = ['low', 'medium', 'high', 'very-high'].includes(body?.quality) ? body.quality : 'high';
  const includeAudio = body?.includeAudio === true;
  const rawName = String(body?.name || 'BeatCut').trim().slice(0, 200) || 'BeatCut';
  const token = randomUUID();
  const sessionDir = path.join(frameExportDir, token);
  const framesDir = path.join(sessionDir, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });
  const session = {
    token, sessionDir, framesDir, width, height, fps, totalFrames,
    duration: expectedDuration, quality, includeAudio, name: rawName,
    downloadName: `${sanitizeDownloadFileName(rawName || 'BeatCut')}.mp4`,
    outputPath: path.join(sessionDir, 'output.mp4'), audioPath: null,
    state: 'uploading', progress: 0, stage: 'Frames werden übertragen', error: '',
    uploadedFrames: new Set(), createdAt: Date.now(), updatedAt: Date.now(), abortController: null
  };
  frameExportSessions.set(token, session);
  return sendJson(res, 201, { token, totalFrames, duration: session.duration, fps, width, height });
}

async function uploadFrameExportFrame(req, res, token, index) {
  const session = getFrameExportSession(token);
  if (session.state !== 'uploading') throw new HttpError(409, 'Frame-Export nimmt keine weiteren Frames an.');
  if (!Number.isInteger(index) || index < 0 || index >= session.totalFrames) throw new HttpError(400, 'Ungültiger Frameindex.');
  const mime = normalizeMime(String(req.headers['content-type'] || ''));
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw new HttpError(415, 'Exportframe muss JPEG, PNG oder WebP sein.');
  const ext = mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg';
  const base = `frame-${String(index).padStart(8, '0')}`;
  const finalPath = path.join(session.framesDir, `${base}${ext}`);
  const temporaryPath = `${finalPath}.uploading`;
  for (const candidate of ['.jpg', '.png', '.webp']) {
    try { fs.rmSync(path.join(session.framesDir, `${base}${candidate}`), { force: true }); } catch {}
  }
  try {
    const bytes = await streamRequestToFile(req, temporaryPath, maxFrameBytes);
    if (bytes <= 0) throw new HttpError(400, 'Exportframe ist leer.');
    fs.renameSync(temporaryPath, finalPath);
    session.uploadedFrames.add(index);
    session.updatedAt = Date.now();
    session.progress = Math.min(70, Math.round((session.uploadedFrames.size / session.totalFrames) * 70));
    session.stage = `Frames ${session.uploadedFrames.size}/${session.totalFrames}`;
    return sendJson(res, 201, { ok: true, index, bytes, received: session.uploadedFrames.size });
  } catch (error) {
    try { fs.rmSync(temporaryPath, { force: true }); } catch {}
    throw error;
  }
}

async function uploadFrameExportAudio(req, res, token) {
  const session = getFrameExportSession(token);
  if (session.state !== 'uploading') throw new HttpError(409, 'Frame-Export nimmt kein Audio mehr an.');
  if (!session.includeAudio) throw new HttpError(409, 'Für diesen Export wurde Audio deaktiviert.');
  const mime = normalizeMime(String(req.headers['content-type'] || 'application/octet-stream'));
  const allowed = new Set(['audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'application/octet-stream']);
  if (!allowed.has(mime)) throw new HttpError(415, 'Exportaudio muss WAV, WebM/Opus oder Ogg sein.');
  const ext = mime.includes('wav') ? '.wav' : mime.includes('ogg') ? '.ogg' : '.webm';
  const finalPath = path.join(session.sessionDir, `audio${ext}`);
  const temporaryPath = `${finalPath}.uploading`;
  try {
    for (const candidate of ['audio.wav', 'audio.webm', 'audio.ogg']) { try { fs.rmSync(path.join(session.sessionDir, candidate), { force: true }); } catch {} }
    const bytes = await streamRequestToFile(req, temporaryPath, maxUploadBytes);
    if (bytes <= 0) throw new HttpError(400, 'Exportaudio ist leer.');
    fs.renameSync(temporaryPath, finalPath);
    session.audioPath = finalPath;
    session.updatedAt = Date.now();
    return sendJson(res, 201, { ok: true, bytes });
  } catch (error) {
    try { fs.rmSync(temporaryPath, { force: true }); } catch {}
    throw error;
  }
}

function finalizeFrameExport(res, token) {
  const session = getFrameExportSession(token);
  if (session.state === 'rendering' || session.state === 'ready') return sendJson(res, 202, publicFrameExportStatus(session));
  if (session.state !== 'uploading') throw new HttpError(409, 'Frame-Export kann nicht finalisiert werden.');
  if (session.uploadedFrames.size !== session.totalFrames) throw new HttpError(409, `Es fehlen noch ${session.totalFrames - session.uploadedFrames.size} Frames.`);
  if (session.includeAudio && (!session.audioPath || !fs.existsSync(session.audioPath))) throw new HttpError(409, 'Der Audiomix wurde noch nicht übertragen.');
  const missing = [];
  for (let i = 0; i < session.totalFrames; i++) if (!session.uploadedFrames.has(i)) { missing.push(i); if (missing.length >= 10) break; }
  if (missing.length) throw new HttpError(409, `Frames fehlen: ${missing.join(', ')}`);
  session.state = 'rendering';
  session.progress = 72;
  session.stage = 'FFmpeg erzeugt MP4';
  session.error = '';
  session.updatedAt = Date.now();
  session.abortController = new AbortController();
  void runFrameExportSession(session);
  return sendJson(res, 202, publicFrameExportStatus(session));
}

async function runFrameExportSession(session) {
  try {
    const firstFrame = findFrameFile(session, 0);
    if (!firstFrame) throw new Error('Erster Exportframe fehlt.');
    const ext = path.extname(firstFrame).toLowerCase();
    for (let i = 0; i < session.totalFrames; i++) {
      const file = findFrameFile(session, i);
      if (!file || path.extname(file).toLowerCase() !== ext) throw new Error(`Frame ${i} fehlt oder hat ein anderes Format.`);
    }
    const pattern = path.join(session.framesDir, `frame-%08d${ext}`);
    const durationText = session.duration.toFixed(9);
    const q = { low: '28', medium: '23', high: '20', 'very-high': '17' }[session.quality] || '20';
    const args = ['-y', '-framerate', String(session.fps), '-start_number', '0', '-i', pattern];
    if (session.includeAudio && session.audioPath) args.push('-i', session.audioPath);
    args.push('-map', '0:v:0');
    if (session.includeAudio && session.audioPath) args.push('-map', '1:a:0?');
    args.push(
      '-vf', `scale=${session.width}:${session.height}:force_original_aspect_ratio=decrease,pad=${session.width}:${session.height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=${session.fps},trim=duration=${durationText},setpts=PTS-STARTPTS`,
      '-frames:v', String(session.totalFrames), '-r', String(session.fps), '-fps_mode', 'cfr',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', q, '-pix_fmt', 'yuv420p',
      '-profile:v', 'high', '-level', '4.2', '-tag:v', 'avc1',
      '-g', String(Math.max(1, session.fps * 2)), '-keyint_min', String(Math.max(1, session.fps * 2)), '-sc_threshold', '0',
      '-video_track_timescale', '90000'
    );
    if (session.includeAudio && session.audioPath) {
      args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-af', `aresample=async=1:first_pts=0,apad=pad_dur=${durationText},atrim=0:${durationText},asetpts=PTS-STARTPTS`);
    } else args.push('-an');
    args.push('-t', durationText, '-avoid_negative_ts', 'disabled', '-use_editlist', '1', '-max_muxing_queue_size', '4096', '-map_metadata', '-1', '-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', session.outputPath);
    let buffer = '';
    let last = 0;
    const onStdout = text => {
      buffer += text;
      const lines = buffer.split(/\r?\n/); buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('out_time=')) continue;
        const seconds = parseFfmpegTime(line.slice(9));
        if (!Number.isFinite(seconds)) continue;
        const now = Date.now(); if (now - last < 250 && seconds < session.duration) continue; last = now;
        const ratio = Math.max(0, Math.min(1, seconds / Math.max(.001, session.duration)));
        session.progress = 72 + Math.round(ratio * 27);
        session.stage = `FFmpeg rendert MP4 · ${Math.round(ratio * 100)} %`;
        session.updatedAt = Date.now();
      }
    };
    await runProcess(resolveFfmpegPath(), args, { signal: session.abortController.signal, onStdout, timeoutMs: 6 * 60 * 60 * 1000 });
    if (session.abortController.signal.aborted) throw abortFrameExportError();
    if (!fs.existsSync(session.outputPath) || fs.statSync(session.outputPath).size <= 0) throw new Error('FFmpeg hat keine MP4-Datei erzeugt.');
    try { fs.rmSync(session.framesDir, { recursive: true, force: true }); } catch {}
    if (session.audioPath) { try { fs.rmSync(session.audioPath, { force: true }); } catch {} }
    session.state = 'ready'; session.progress = 100; session.stage = 'Fertig'; session.updatedAt = Date.now();
  } catch (error) {
    if (error?.code === 'ABORT_ERR') {
      session.state = 'cancelled'; session.progress = 100; session.stage = 'Abgebrochen'; session.error = '';
    } else {
      console.error(`Frame-Export ${session.token} fehlgeschlagen:`, error);
      session.state = 'error'; session.progress = 100; session.stage = 'Fehlgeschlagen'; session.error = publicFrameExportError(error);
    }
    session.updatedAt = Date.now();
    try { fs.rmSync(session.outputPath, { force: true }); } catch {}
  } finally {
    session.abortController = null;
  }
}

function findFrameFile(session, index) {
  const base = path.join(session.framesDir, `frame-${String(index).padStart(8, '0')}`);
  for (const ext of ['.jpg', '.png', '.webp']) { const file = base + ext; if (fs.existsSync(file)) return file; }
  return null;
}

function getFrameExportSession(token) {
  const session = frameExportSessions.get(token);
  if (!session) throw new HttpError(404, 'Frame-Export wurde nicht gefunden oder ist abgelaufen.');
  return session;
}

function publicFrameExportStatus(session) {
  return {
    token: session.token, state: session.state, progress: session.progress, stage: session.stage,
    uploadedFrames: session.uploadedFrames.size, totalFrames: session.totalFrames,
    duration: session.duration, fps: session.fps,
    downloadUrl: session.state === 'ready' ? `/api/frame-exports/${encodeURIComponent(session.token)}/download` : null,
    name: session.downloadName, error: session.error || ''
  };
}

function deleteFrameExportSession(res, token) {
  const session = frameExportSessions.get(token);
  if (!session) { res.writeHead(204).end(); return; }
  try { session.abortController?.abort(); } catch {}
  frameExportSessions.delete(token);
  try { fs.rmSync(session.sessionDir, { recursive: true, force: true }); } catch {}
  res.writeHead(204).end();
}

function cleanupFrameExportSessions(maxAgeMs = 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs;
  for (const [token, session] of frameExportSessions) {
    if (session.state === 'rendering') continue;
    if (session.updatedAt >= cutoff) continue;
    frameExportSessions.delete(token);
    try { fs.rmSync(session.sessionDir, { recursive: true, force: true }); } catch {}
  }
}

function parseFfmpegTime(value) {
  const match = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(String(value).trim());
  if (!match) return NaN;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function publicFrameExportError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (message.split(/\r?\n/, 1)[0].trim() || 'Frame-Export fehlgeschlagen.').slice(0, 700);
}

function abortFrameExportError() { const error = new Error('Frame-Export wurde abgebrochen.'); error.code = 'ABORT_ERR'; return error; }

function clampIntValue(value, min, max, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min || parsed > max) throw new HttpError(400, `${label} ist ungültig.`);
  return parsed;
}

async function uploadRenderInput(req, res, kind) {
  const isVideo = kind === 'video';
  const expectedMime = isVideo ? new Set(['video/h264', 'video/webm', 'application/octet-stream']) : new Set(['audio/webm', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'application/octet-stream']);
  const mime = normalizeMime(String(req.headers['content-type'] || 'application/octet-stream'));
  if (!expectedMime.has(mime)) {
    throw new HttpError(415, isVideo ? 'Render-Video muss H.264 Annex-B oder WebM sein.' : 'Render-Audio muss WebM/Opus, Ogg oder WAV sein.');
  }
  const token = randomUUID();
  const filePath = renderInputPath(token, kind);
  try {
    const bytes = await streamRequestToFile(req, filePath, maxUploadBytes);
    if (bytes <= 0) throw new HttpError(400, 'Render-Eingabe ist leer.');
    return sendJson(res, 201, { token, bytes });
  } catch (error) {
    try { fs.rmSync(filePath, { force: true }); } catch {}
    throw error;
  }
}

function renderInputPath(token, kind) {
  validateRouteId(token);
  const extension = kind === 'video' ? '.h264' : '.webm';
  return path.join(precomposedDir, kind + '-' + token + extension);
}

async function uploadMedia(req, res, url) {
  const queryName = url.searchParams.get('name');
  const legacyName = req.headers['x-file-name'];
  const rawName = queryName || (legacyName ? safeDecodeHeader(String(legacyName)) : 'upload.bin');
  const fileName = normalizeOriginalFileName(rawName);
  const mime = normalizeMime(String(req.headers['content-type'] || req.headers['x-mime-type'] || 'application/octet-stream'));
  const lengthHeader = req.headers['content-length'];
  const declaredLength = lengthHeader == null ? null : Number(lengthHeader);

  if (declaredLength != null && (!Number.isFinite(declaredLength) || declaredLength < 0)) {
    throw new HttpError(400, 'Ungültige Content-Length.');
  }
  if (declaredLength != null && declaredLength > maxUploadBytes) {
    // Früh ablehnen, den bereits eintreffenden Request-Body aber verwerfen. Ein sofortiges
    // Socket-Destroy konnte Browser/undici sonst sporadisch nur einen Netzwerkfehler statt
    // der sauberen 413-Antwort sehen lassen. Es wird nichts davon im Speicher gepuffert.
    // Body stromweise verwerfen, aber die Verbindung nicht aktiv schließen. Ein erzwungenes
    // `Connection: close` kann Browser/undici die bereits gesendete 413-Antwort als reinen
    // Netzwerkfehler melden lassen. `resume()` puffert den Body nicht im Arbeitsspeicher.
    if (declaredLength <= maxUploadBytes + 16 * 1024 * 1024) await drainRequestBody(req);
    else req.resume();
    return sendJson(res, 413, { error: `Datei ist zu groß. Maximal ${formatBytes(maxUploadBytes)}.` });
  }

  const ext = path.extname(fileName).toLowerCase();
  if (!allowedUploadExtensions.has(ext)) {
    throw new HttpError(415, `Dateityp ${ext || '(ohne Erweiterung)'} wird nicht unterstützt.`);
  }

  const type = detectType(fileName, mime);
  const storedBase = randomUUID();
  const temporaryPath = path.join(uploadDir, `${storedBase}.uploading`);
  const storedName = `${storedBase}${ext}`;
  const finalPath = path.join(uploadDir, storedName);
  let thumbnailPath = null;

  try {
    await streamRequestToFile(req, temporaryPath, maxUploadBytes);

    let meta;
    try {
      meta = await probeMedia(temporaryPath);
    } catch (error) {
      console.warn(`Medienanalyse für ${fileName} fehlgeschlagen:`, error instanceof Error ? error.message : error);
      if (isToolUnavailableError(error)) {
        throw new HttpError(503, 'FFprobe ist nicht lauffähig. Prüfe tools/ffmpeg. Unter Windows muss entweder ein vollständiger Static-Build verwendet werden oder alle DLLs des Shared-Builds müssen vorhanden sein.');
      }
      throw new HttpError(415, 'Datei konnte nicht als unterstütztes Medium gelesen werden.');
    }

    validateProbedMedia(type, meta);
    fs.renameSync(temporaryPath, finalPath);

    const id = randomUUID();
    let thumbnailUrl = null;
    if (type === 'video') {
      const thumbName = `${id}.jpg`;
      try {
        thumbnailPath = path.join(thumbDir, thumbName);
        await createVideoThumbnail(finalPath, thumbnailPath);
        thumbnailUrl = `/thumbs/${thumbName}`;
      } catch (error) {
        console.warn(`Thumbnail für ${fileName} fehlgeschlagen:`, error instanceof Error ? error.message : error);
      }
    }

    const media = {
      id,
      name: fileName,
      type,
      filePath: finalPath,
      url: `/media/${encodeURIComponent(storedName)}`,
      thumbnailUrl,
      duration: type === 'image' ? Math.max(5, Number(meta.duration || 0)) : Number(meta.duration || 0),
      width: Number(meta.width || 0),
      height: Number(meta.height || 0),
      hasAudio: Boolean(meta.hasAudio),
      createdAt: new Date().toISOString()
    };
    insertMedia(media);
    return sendJson(res, 201, stripInternalMedia(media));
  } catch (error) {
    try { fs.rmSync(temporaryPath, { force: true }); } catch {}
    try { fs.rmSync(finalPath, { force: true }); } catch {}
    if (thumbnailPath) { try { fs.rmSync(thumbnailPath, { force: true }); } catch {} }
    throw error;
  }
}

async function streamRequestToFile(req, filePath, limit) {
  const output = fs.createWriteStream(filePath, { flags: 'wx' });
  let bytes = 0;
  let outputError = null;
  output.on('error', error => { outputError = error; });

  try {
    for await (const chunk of req) {
      if (outputError) throw outputError;
      bytes += chunk.length;
      if (bytes > limit) throw new HttpError(413, `Datei ist zu groß. Maximal ${formatBytes(limit)}.`);
      if (!output.write(chunk)) await once(output, 'drain');
    }
    if (req.aborted) throw new HttpError(499, 'Upload wurde vom Browser abgebrochen.');
    if (outputError) throw outputError;
    output.end();
    await once(output, 'finish');
    return bytes;
  } catch (error) {
    output.destroy();
    throw error;
  }
}

async function drainRequestBody(req) {
  try {
    for await (const _chunk of req) {
      // Absichtlich verwerfen: vermeidet bei kleinen Überschreitungen einen TCP-Race,
      // ohne den Request-Body im Arbeitsspeicher zu puffern.
    }
  } catch {}
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxJsonBytes) throw new HttpError(413, 'JSON-Anfrage ist zu groß.');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Ungültige JSON-Anfrage.');
  }
}

function sendJson(res, status, value) {
  if (res.headersSent) return;
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

async function serveFile(req, res, filePath, download = false) {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new HttpError(404, 'Datei nicht gefunden.');
  }

  const stat = fs.statSync(filePath);
  const mime = mimeFor(filePath);
  const headers = {
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': download ? 'no-store' : cacheControlFor(filePath)
  };
  if (download) {
    const requestedName = typeof download === 'string' ? download : path.basename(filePath);
    const safeDownloadName = sanitizeDownloadFileName(requestedName);
    const asciiDownloadName = safeDownloadName.normalize('NFKD').replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'download.bin';
    headers['Content-Disposition'] = `attachment; filename="${asciiDownloadName}"; filename*=UTF-8''${encodeURIComponent(safeDownloadName)}`;
  }

  const range = parseRange(req.headers.range, stat.size);
  if (range?.invalid) {
    res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}` }).end();
    return;
  }

  const methodIsHead = req.method === 'HEAD';
  if (range) {
    const { start, end } = range;
    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Content-Length': end - start + 1
    });
    if (methodIsHead) return res.end();
    pipeFile(res, filePath, { start, end });
    return;
  }

  res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  if (methodIsHead) return res.end();
  pipeFile(res, filePath);
}

function pipeFile(res, filePath, options = undefined) {
  const stream = fs.createReadStream(filePath, options);
  stream.on('error', error => {
    console.error('Dateistream fehlgeschlagen:', error);
    if (!res.headersSent) sendJson(res, 500, { error: 'Datei konnte nicht gelesen werden.' });
    else res.destroy(error);
  });
  stream.pipe(res);
}

function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!match) return { invalid: true };
  const [, startText, endText] = match;
  if (!startText && !endText) return { invalid: true };

  let start;
  let end;
  if (!startText) {
    const suffix = Number(endText);
    if (!Number.isFinite(suffix) || suffix <= 0) return { invalid: true };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText ? Number(endText) : size - 1;
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= size || end < start) {
    return { invalid: true };
  }
  end = Math.min(end, size - 1);
  return { start, end };
}

function assertReadMethod(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Methode nicht erlaubt.');
}

function cacheControlFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.html', '.js', '.css'].includes(ext)) return 'no-cache';
  return 'public, max-age=3600';
}

function safeJoin(base, relative) {
  const root = path.resolve(base);
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(root + path.sep)) throw new HttpError(403, 'Ungültiger Pfad.');
  return target;
}

function safeDecodePathname(value) {
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.includes('\0')) throw new HttpError(400, 'Ungültiger URL-Pfad.');
    return decoded;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Ungültig codierter URL-Pfad.');
  }
}

function safeDecodeHeader(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function normalizeOriginalFileName(value) {
  const normalizedSeparators = String(value || 'upload.bin').replaceAll('\0', '').replaceAll('\\', '/');
  const name = path.posix.basename(normalizedSeparators).trim();
  if (!name || name.length > 240) throw new HttpError(400, 'Dateiname ist ungültig oder zu lang.');
  return name;
}

function normalizeMime(value) {
  return String(value || 'application/octet-stream').split(';', 1)[0].trim().toLowerCase();
}

function isToolUnavailableError(error) {
  if (error?.code === 'ENOENT') return true;
  const message = error instanceof Error ? error.message : String(error);
  return /0xC0000135|benötigte Windows-DLL fehlt|konnte nicht gestartet werden/i.test(message);
}

function validateProbedMedia(type, meta) {
  if (type === 'image' && (!meta.hasVideo || meta.width <= 0 || meta.height <= 0)) {
    throw new HttpError(415, 'Die Datei enthält kein lesbares Bild.');
  }
  if (type === 'video' && (!meta.hasVideo || meta.width <= 0 || meta.height <= 0 || meta.duration <= 0)) {
    throw new HttpError(415, 'Die Datei enthält kein lesbares Video mit gültiger Dauer.');
  }
  if (type === 'audio' && (!meta.hasAudio || meta.duration <= 0)) {
    throw new HttpError(415, 'Die Datei enthält kein lesbares Audio mit gültiger Dauer.');
  }
}

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.bmp': 'image/bmp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4', '.m4v': 'video/x-m4v', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.opus': 'audio/ogg'
  })[ext] || 'application/octet-stream';
}

function detectType(name, _mime) {
  const ext = path.extname(name).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.bmp'].includes(ext)) return 'image';
  if (['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus'].includes(ext)) return 'audio';
  return 'video';
}

function stripInternalMedia(media) {
  const { filePath, ...publicMedia } = media;
  return publicMedia;
}

function validateRouteId(value) {
  if (typeof value !== 'string' || value.length > 120 || !/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new HttpError(400, 'Ungültige ID.');
  }
  return value;
}

function handleRequestError(res, error) {
  const isExpected = error instanceof HttpError || error instanceof ValidationError;
  const status = isExpected ? error.status : 500;
  const message = error instanceof Error ? error.message : String(error);
  if (status >= 500) console.error(error);
  const publicMessage = isExpected ? message : (status >= 500 ? 'Interner Serverfehler.' : message);
  if (!res.headersSent) sendJson(res, status, { error: publicMessage });
  else res.destroy();
}

function setCommonHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'");
}

function isLoopbackBind(host) {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;
  const host = String(req.headers.host || '');
  const isLoopbackHost = /^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(host);
  const isLocalDevOrigin = origin === 'null' || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin);
  const configured = String(process.env.BEATCUT_ALLOWED_ORIGINS || '')
    .split(',').map(value => value.trim()).filter(Boolean);
  if ((isLoopbackHost && isLocalDevOrigin) || configured.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

function formatBytes(bytes) {
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  const mb = bytes / (1024 ** 2);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function envInt(name, fallback, min, max) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
}

let mainServer = null;
if (isMainModule()) {
  try {
    mainServer = startServer();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    closeDb();
    process.exit(1);
  }
  mainServer.on('error', error => {
    if (error?.code === 'EADDRINUSE') console.error(`Port ${process.env.PORT || DEFAULT_PORT} wird bereits verwendet.`);
    else console.error('BeatCut-Server konnte nicht gestartet werden:', error instanceof Error ? error.message : error);
    closeDb();
    process.exitCode = 1;
  });
  const shutdown = signal => {
    console.log(`\n${signal}: BeatCut wird beendet ...`);
    mainServer.close(() => {
      closeDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const backendDir = path.resolve(here, '..');
export const rootDir = path.resolve(backendDir, '..');

function resolveConfiguredPath(value, fallback) {
  if (!value) return fallback;
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(rootDir, value);
}

export const dataDir = resolveConfiguredPath(process.env.BEATCUT_DATA_DIR, path.join(rootDir, 'data'));
export const uploadDir = path.join(dataDir, 'uploads');
export const renderDir = path.join(dataDir, 'renders');
export const tempDir = path.join(dataDir, 'temp');
export const thumbDir = path.join(dataDir, 'thumbs');
export const precomposedDir = path.join(dataDir, 'precomposed');
export const projectPackageDir = path.join(tempDir, 'project-packages');
export const frameExportDir = path.join(tempDir, 'frame-exports');
export const frontendDir = resolveConfiguredPath(process.env.BEATCUT_FRONTEND_DIR, path.join(rootDir, 'frontend'));
export const toolsDir = resolveConfiguredPath(process.env.BEATCUT_TOOLS_DIR, path.join(rootDir, 'tools', 'ffmpeg'));

for (const dir of [dataDir, uploadDir, renderDir, tempDir, thumbDir, precomposedDir, projectPackageDir, frameExportDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

export function cleanupStartupArtifacts() {
  for (const entry of safeReadDir(tempDir)) {
    if (!entry.name.startsWith('render-')) continue;
    try { fs.rmSync(path.join(tempDir, entry.name), { recursive: true, force: true }); } catch {}
  }
  for (const entry of safeReadDir(uploadDir)) {
    if (!entry.name.endsWith('.uploading')) continue;
    try { fs.rmSync(path.join(uploadDir, entry.name), { force: true }); } catch {}
  }
  for (const entry of safeReadDir(precomposedDir)) {
    if (!entry.isFile()) continue;
    try { fs.rmSync(path.join(precomposedDir, entry.name), { force: true }); } catch {}
  }
  for (const entry of safeReadDir(projectPackageDir)) {
    try { fs.rmSync(path.join(projectPackageDir, entry.name), { recursive: true, force: true }); } catch {}
  }
  for (const entry of safeReadDir(frameExportDir)) {
    try { fs.rmSync(path.join(frameExportDir, entry.name), { recursive: true, force: true }); } catch {}
  }
}

export function cleanupStaleTransferArtifacts(maxAgeMs = 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - Math.max(60_000, Number(maxAgeMs) || 0);
  cleanupOldFiles(precomposedDir, () => true, cutoff);
  cleanupOldFiles(uploadDir, entry => entry.name.endsWith('.uploading'), cutoff);
  cleanupOldDirectories(projectPackageDir, cutoff);
  cleanupOldDirectories(frameExportDir, cutoff);
}

function cleanupOldFiles(dir, predicate, cutoff) {
  for (const entry of safeReadDir(dir)) {
    if (!entry.isFile() || !predicate(entry)) continue;
    const filePath = path.join(dir, entry.name);
    try {
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) fs.rmSync(filePath, { force: true });
    } catch {}
  }
}

function cleanupOldDirectories(dir, cutoff) {
  for (const entry of safeReadDir(dir)) {
    if (!entry.isDirectory()) continue;
    const dirPath = path.join(dir, entry.name);
    try {
      const stat = fs.statSync(dirPath);
      if (stat.mtimeMs < cutoff) fs.rmSync(dirPath, { recursive: true, force: true });
    } catch {}
  }
}

function safeReadDir(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
}

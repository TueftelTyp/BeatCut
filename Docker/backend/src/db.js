import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { dataDir } from './paths.js';

const dbPath = path.join(dataDir, 'beatcut.sqlite');
export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration REAL NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 0,
    height INTEGER NOT NULL DEFAULT 0,
    has_audio INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    project_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS render_jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    status TEXT NOT NULL,
    progress REAL NOT NULL DEFAULT 0,
    stage TEXT NOT NULL DEFAULT '',
    output_url TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

export function listMedia() {
  return db.prepare('SELECT * FROM media ORDER BY created_at DESC').all().map(mapMediaRow);
}

export function getMedia(id) {
  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(id);
  return row ? mapMediaRow(row) : null;
}

export function insertMedia(media) {
  db.prepare(`
    INSERT INTO media (id, name, type, file_path, url, thumbnail_url, duration, width, height, has_audio, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    media.id,
    media.name,
    media.type,
    media.filePath,
    media.url,
    media.thumbnailUrl ?? null,
    media.duration ?? 0,
    media.width ?? 0,
    media.height ?? 0,
    media.hasAudio ? 1 : 0,
    media.createdAt
  );
}

export function deleteMedia(id) {
  db.prepare('DELETE FROM media WHERE id = ?').run(id);
}

export function listProjects() {
  return db.prepare('SELECT id, name, updated_at FROM projects ORDER BY updated_at DESC').all().map(row => ({
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at
  }));
}

export function getProject(id) {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!row) return null;
  try {
    return JSON.parse(row.project_json);
  } catch (error) {
    throw new Error(`Projekt ${id} enthält ungültige JSON-Daten: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function saveProject(project) {
  const now = new Date().toISOString();
  const normalized = { ...project, updatedAt: now };
  db.prepare(`
    INSERT INTO projects (id, name, project_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      project_json = excluded.project_json,
      updated_at = excluded.updated_at
  `).run(project.id, project.name || 'Unbenanntes Projekt', JSON.stringify(normalized), now);
  return normalized;
}

export function insertRenderJob(job) {
  db.prepare(`
    INSERT INTO render_jobs (id, project_id, status, progress, stage, output_url, error, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(job.id, job.projectId ?? null, job.status, job.progress ?? 0, job.stage ?? '', null, null, job.createdAt, job.updatedAt);
}

export function updateRenderJob(id, patch) {
  const current = getRenderJob(id);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  db.prepare(`
    UPDATE render_jobs
    SET status = ?, progress = ?, stage = ?, output_url = ?, error = ?, updated_at = ?
    WHERE id = ?
  `).run(next.status, next.progress, next.stage, next.outputUrl ?? null, next.error ?? null, next.updatedAt, id);
  return next;
}

export function getRenderJob(id) {
  const row = db.prepare('SELECT * FROM render_jobs WHERE id = ?').get(id);
  return row ? mapJobRow(row) : null;
}

export function markInterruptedRenderJobsFailed() {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE render_jobs
    SET status = 'failed', progress = 100, stage = 'Unterbrochen',
        error = 'Der Server wurde während des Renderns beendet.', updated_at = ?
    WHERE status IN ('queued', 'running')
  `).run(now);
}

export function closeDb() {
  try {
    db.close();
  } catch {
    // Bereits geschlossen oder Laufzeit beendet.
  }
}

function mapMediaRow(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    filePath: row.file_path,
    url: row.url,
    thumbnailUrl: row.thumbnail_url,
    duration: Number(row.duration || 0),
    width: Number(row.width || 0),
    height: Number(row.height || 0),
    hasAudio: Boolean(row.has_audio),
    createdAt: row.created_at
  };
}

function mapJobRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    progress: Number(row.progress || 0),
    stage: row.stage,
    outputUrl: row.output_url,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

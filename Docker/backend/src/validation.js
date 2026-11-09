const MAX_PROJECT_SECONDS = 6 * 60 * 60;
const MAX_CLIPS = 2000;
const MAX_MUSIC_SEGMENTS = 256;
const MAX_TEXTS = 5000;
const RENDER_TOKEN_RE = /^[A-Za-z0-9._-]{1,120}$/;

export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

export function assertProject(project, { requireVisualClip = false, mediaExists = null, renderInputExists = null } = {}) {
  if (!project || typeof project !== 'object' || Array.isArray(project)) {
    throw new ValidationError('Ungültiges Projektobjekt.');
  }

  assertShortId(project.id, 'Projekt-ID', true);
  assertText(project.name ?? '', 'Projektname', 200, true);
  assertNumber(project.width, 'Projektbreite', 2, 7680);
  assertNumber(project.height, 'Projekthöhe', 2, 7680);
  if (Number(project.width) % 2 !== 0 || Number(project.height) % 2 !== 0) {
    throw new ValidationError('Projektbreite und Projekthöhe müssen gerade Zahlen sein.');
  }

  const fps = Number(project.fps);
  if (![24, 25, 30, 50, 60].includes(fps)) {
    throw new ValidationError('FPS muss 24, 25, 30, 50 oder 60 sein.');
  }
  if (Number(project.width) * Number(project.height) * fps > 7680 * 4320 * 60) {
    throw new ValidationError('Die Kombination aus Auflösung und FPS ist für einen einzelnen Renderjob zu groß.');
  }

  if (project.durationLimit != null) assertNumber(project.durationLimit, 'Videolimit', 0.05, MAX_PROJECT_SECONDS);
  if (project.duration != null) assertNumber(project.duration, 'Projektdauer', 0.05, MAX_PROJECT_SECONDS);
  assertNumber(project.bpm ?? 120, 'BPM', 30, 300);
  assertNumber(project.beatsPerClip ?? 4, 'Beats pro Clip', 1, 16);

  if (project.socialSafe60 != null && typeof project.socialSafe60 !== 'boolean') {
    throw new ValidationError('socialSafe60 muss true oder false sein.');
  }

  if (project.quality != null && !['low', 'medium', 'high', 'very-high'].includes(project.quality)) {
    throw new ValidationError('Unbekannte Exportqualität.');
  }

  const preVideo = normalizeRenderToken(project.precomposedVideoToken, 'Render-Video-Token');
  const preAudio = normalizeRenderToken(project.precomposedAudioToken, 'Render-Audio-Token', true);
  const preVideoFormat = project.precomposedVideoFormat ?? 'h264';
  if (!['h264', 'webm'].includes(preVideoFormat)) throw new ValidationError('Unbekanntes vorbereitetes Videoformat.');
  if (project.precomposedAudioEmbedded != null && typeof project.precomposedAudioEmbedded !== 'boolean') {
    throw new ValidationError('precomposedAudioEmbedded muss true oder false sein.');
  }
  if (project.precomposedAudioEmbedded && preVideoFormat !== 'webm') {
    throw new ValidationError('Eingebettetes Render-Audio ist nur bei WebM-Eingaben zulässig.');
  }
  if (preVideo && renderInputExists && !renderInputExists(preVideo, 'video')) {
    throw new ValidationError('Die vorbereitete Render-Videodatei wurde nicht gefunden.', 404);
  }
  if (preAudio && renderInputExists && !renderInputExists(preAudio, 'audio')) {
    throw new ValidationError('Die vorbereitete Render-Audiodatei wurde nicht gefunden.', 404);
  }

  if (!Array.isArray(project.clips ?? [])) throw new ValidationError('clips muss ein Array sein.');
  if (!Array.isArray(project.musicSegments ?? [])) throw new ValidationError('musicSegments muss ein Array sein.');
  if (!Array.isArray(project.texts ?? [])) throw new ValidationError('texts muss ein Array sein.');
  const clips = project.clips ?? [];
  if (clips.length > MAX_CLIPS) throw new ValidationError(`Maximal ${MAX_CLIPS} Videoclips pro Projekt.`);
  if ((project.musicSegments ?? []).length > MAX_MUSIC_SEGMENTS) throw new ValidationError(`Maximal ${MAX_MUSIC_SEGMENTS} Musiksegmente pro Projekt.`);
  if ((project.texts ?? []).length > MAX_TEXTS) throw new ValidationError(`Maximal ${MAX_TEXTS} Textobjekte pro Projekt.`);
  if (requireVisualClip && clips.length === 0 && !preVideo) {
    throw new ValidationError('Das Projekt enthält kein renderbares Video.');
  }

  for (const [index, clip] of clips.entries()) {
    assertTimelineItem(clip, `Clip ${index + 1}`);
    assertTimelineEnd(clip, `Clip ${index + 1}`);
    assertOptionalNumber(clip.scale, `Clip ${index + 1}: Skalierung`, 0.01, 100);
    assertOptionalNumber(clip.rotation, `Clip ${index + 1}: Rotation`, -36000, 36000);
    assertOptionalNumber(clip.opacity, `Clip ${index + 1}: Deckkraft`, 0, 1);
    assertOptionalNumber(clip.audioVolume, `Clip ${index + 1}: Audiolautstärke`, 0, 10);
    assertOptionalNumber(clip.audioFadeIn, `Clip ${index + 1}: Fade-In`, 0, MAX_PROJECT_SECONDS);
    assertOptionalNumber(clip.audioFadeOut, `Clip ${index + 1}: Fade-Out`, 0, MAX_PROJECT_SECONDS);
    if (clip.audioEnabled != null && typeof clip.audioEnabled !== 'boolean') {
      throw new ValidationError(`Clip ${index + 1}: audioEnabled muss true oder false sein.`);
    }
    if (mediaExists && clip.mediaId && !mediaExists(clip.mediaId)) {
      throw new ValidationError(`Clip ${index + 1} verweist auf ein nicht vorhandenes Medium.`);
    }
  }

  for (const [index, music] of (project.musicSegments ?? []).entries()) {
    assertTimelineItem(music, `Musiksegment ${index + 1}`);
    assertTimelineEnd(music, `Musiksegment ${index + 1}`);
    assertOptionalNumber(music.volume, `Musiksegment ${index + 1}: Lautstärke`, 0, 10);
    assertOptionalNumber(music.fadeIn, `Musiksegment ${index + 1}: Fade-In`, 0, MAX_PROJECT_SECONDS);
    assertOptionalNumber(music.fadeOut, `Musiksegment ${index + 1}: Fade-Out`, 0, MAX_PROJECT_SECONDS);
    if (mediaExists && music.mediaId && !mediaExists(music.mediaId)) {
      throw new ValidationError(`Musiksegment ${index + 1} verweist auf ein nicht vorhandenes Medium.`);
    }
  }

  for (const [index, text] of (project.texts ?? []).entries()) {
    assertShortId(text?.id, `Text ${index + 1}: ID`, true);
    assertOptionalNumber(text?.start, `Text ${index + 1}: Start`, 0, MAX_PROJECT_SECONDS);
    assertOptionalNumber(text?.duration, `Text ${index + 1}: Dauer`, 0.01, MAX_PROJECT_SECONDS);
    if (text?.start != null && text?.duration != null) assertTimelineEnd(text, `Text ${index + 1}`);
  }

  return project;
}

function normalizeRenderToken(value, label, optional = false) {
  if (value == null || value === '') {
    if (optional) return null;
    return null;
  }
  if (typeof value !== 'string' || !RENDER_TOKEN_RE.test(value)) throw new ValidationError(`${label} ist ungültig.`);
  return value;
}

function assertTimelineEnd(item, label) {
  const end = Number(item.start) + Number(item.duration);
  if (!Number.isFinite(end) || end > MAX_PROJECT_SECONDS) {
    throw new ValidationError(`${label}: Ende darf ${MAX_PROJECT_SECONDS} Sekunden nicht überschreiten.`);
  }
}

function assertTimelineItem(item, label) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new ValidationError(`${label} ist ungültig.`);
  assertShortId(item.id, `${label}: ID`, true);
  if (item.mediaId != null && item.mediaId !== '') assertShortId(item.mediaId, `${label}: Medien-ID`, true);
  assertNumber(item.start, `${label}: Start`, 0, MAX_PROJECT_SECONDS);
  assertNumber(item.duration, `${label}: Dauer`, 0.01, MAX_PROJECT_SECONDS);
  assertNumber(item.sourceStart ?? 0, `${label}: Quellstart`, 0, MAX_PROJECT_SECONDS);
}

function assertShortId(value, label, required = false) {
  if (value == null || value === '') {
    if (required) throw new ValidationError(`${label} fehlt.`);
    return;
  }
  if (typeof value !== 'string' || value.length > 120 || !/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new ValidationError(`${label} ist ungültig.`);
  }
}

function assertText(value, label, maxLength, required = false) {
  if (value == null || value === '') {
    if (required) throw new ValidationError(`${label} fehlt.`);
    return;
  }
  if (typeof value !== 'string' || value.length > maxLength) throw new ValidationError(`${label} ist ungültig oder zu lang.`);
}

function assertNumber(value, label, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new ValidationError(`${label} muss zwischen ${min} und ${max} liegen.`);
  }
}

function assertOptionalNumber(value, label, min, max) {
  if (value == null) return;
  assertNumber(value, label, min, max);
}

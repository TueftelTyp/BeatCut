import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { assertProject, ValidationError } from '../src/validation.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const htmlPath = path.join(root, 'frontend', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const serverSource = fs.readFileSync(path.join(root, 'backend', 'src', 'server.js'), 'utf8');

function extractModuleScript(source) {
  const open = '<script type="module">';
  const start = source.indexOf(open);
  assert.notEqual(start, -1, 'Frontend must contain a module script');
  const end = source.indexOf('</script>', start + open.length);
  assert.notEqual(end, -1, 'Module script must be closed');
  return source.slice(start + open.length, end);
}

const moduleScript = extractModuleScript(html);
const moduleStart = html.indexOf('<script type="module">');
const initialMarkup = html.slice(0, moduleStart);

function unique(values) {
  return [...new Set(values)];
}

test('Full editor module has valid JavaScript syntax', () => {
  const temp = path.join(root, 'backend', 'test', '.frontend-syntax.mjs');
  try {
    fs.writeFileSync(temp, moduleScript, 'utf8');
    const result = spawnSync(process.execPath, ['--check', temp], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    fs.rmSync(temp, { force: true });
  }
});

test('Initial frontend markup contains no duplicate IDs and all $() references can exist', () => {
  const initialIds = [...initialMarkup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const duplicates = unique(initialIds.filter((id, index) => initialIds.indexOf(id) !== index));
  assert.deepEqual(duplicates, []);

  // The inspector intentionally creates controls dynamically through innerHTML. Those IDs
  // are valid candidates too, but never coexist in multiple inspector instances.
  const dynamicIds = [...moduleScript.matchAll(/\bid=[\\]?"([A-Za-z0-9_-]+)[\\]?"/g)].map(match => match[1]);
  const possibleIds = new Set([...initialIds, ...dynamicIds]);
  const referenced = [...moduleScript.matchAll(/\$\(["']([^"']+)["']\)/g)].map(match => match[1]);
  const missing = unique(referenced.filter(id => !possibleIds.has(id))).sort();
  assert.deepEqual(missing, []);
});

test('Restored editor contains the full feature groups and server export bridge', () => {
  assert.ok(html.includes('<script src="/vendor/jszip.min.js"></script>'), 'JSZip must be vendored locally');
  assert.ok(fs.existsSync(path.join(root, 'frontend', 'vendor', 'jszip.min.js')), 'Vendored JSZip file is missing');

  const required = [
    'runSmart', 'analyzeAsset', 'projectBeats', 'clip-audio', 'copySelectedToPlayhead',
    'undoWeb', 'redoWeb', 'renderMultiClipAudio', 'inspectText', 'inspectEffect',
    'inspectTransition', 'inspectAudioEffect', 'audioRate', 'tapeMode',
    'encodeProjectVideoWebCodecs', 'recordProjectAudioRealtime', 'serverExportProject', 'serverMuxRecordedWebmToMp4',
    '/api/render/inputs/${kind}', '/api/render/jobs',
    'serializeProject', 'applyProject', 'downloadProject', 'loadBrowser'
  ];
  for (const marker of required) assert.ok(html.includes(marker), `Missing full-editor marker: ${marker}`);

  const effects = [
    'flash', 'glitch', 'strobe', 'vignette', 'film-grain', 'cinematic', 'neon', 'dream',
    'shake', 'hue', 'zoom-punch', 'black-white', 'warm', 'cold', 'invert', 'blur-pulse',
    'rgb-shift', 'scanlines', 'exposure-pulse', 'soft-glow', 'letterbox', 'pixelate', 'color-wash'
  ];
  const transitions = [
    'fade', 'black', 'white', 'flash', 'zoom', 'spin', 'blur', 'glitch', 'slide-left',
    'slide-right', 'slide-up', 'slide-down', 'wipe-left', 'wipe-right', 'wipe-up', 'wipe-down',
    'whip-left', 'whip-right', 'iris', 'bars'
  ];
  const audioFx = ['volume-down', 'mute', 'volume-pulse', 'speed-150', 'speed-200', 'slow-075', 'slow-050', 'tape-stop', 'tape-start'];
  for (const name of [...effects, ...transitions, ...audioFx]) assert.ok(html.includes(name), `Missing effect/transition/audio-FX: ${name}`);
  assert.ok(html.includes('MAX_BEATCUT_ARCHIVE_BYTES'), 'Project archive size guard is missing');
  assert.ok(html.includes('checkCRC32:true'), 'Project ZIP CRC validation is missing');
  assert.ok(html.includes('waitForMediaMetadataStrict'), 'Strict export metadata wait is missing');
  assert.ok(html.includes('Video-Seek nach'), 'Strict export seek timeout is missing');
  assert.ok(!html.includes('https://unpkg.com'), 'Runtime frontend must not depend on unpkg scripts');
  assert.ok(!serverSource.includes('https://unpkg.com'), 'CSP must not allow unpkg runtime scripts');
  assert.ok(html.includes('preparedAudioContext'), 'MP4 export must pre-activate browser audio in the user gesture');
});

test('Project loader preserves legacy music when old project has no musicSegments property', () => {
  assert.match(moduleScript, /const storedMusicSegments=Array\.isArray\(p\.musicSegments\)\?p\.musicSegments:\(Array\.isArray\(p\.audioSegments\)\?p\.audioSegments:null\)/);
  assert.match(moduleScript, /if\(storedMusicSegments!==null\)musicSegments=structuredClone\(storedMusicSegments\);else if\(!audioFile\)musicSegments=\[\]/);
  assert.match(moduleScript, /version:22/);
});

test('Project download streams media to the server and never constructs one giant browser Blob', () => {
  const start = moduleScript.indexOf('$("downloadProject").onclick=async()=>');
  const end = moduleScript.indexOf('function guessMime', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = moduleScript.slice(start, end);
  assert.ok(block.includes('downloadProjectPackageServer'));
  assert.ok(moduleScript.includes('uploadProjectPackageFile'));
  assert.ok(moduleScript.includes('/api/project-packages'));
  assert.ok(moduleScript.includes('/finalize'));
  assert.ok(moduleScript.includes('/status'));
  assert.ok(!block.includes('zip.generateAsync'));
  assert.ok(!block.includes('new Blob'));
  assert.ok(serverSource.includes('writeStoredZip'));
});

test('MP4 audio export prefers offline WAV rendering so tab mute cannot silence normal exports', () => {
  assert.ok(moduleScript.includes('async function renderProjectAudioOffline(duration)'));
  assert.ok(moduleScript.includes('new OfflineAudioContext(2,frames,sampleRate)'));
  assert.ok(moduleScript.includes('audioBufferToWavBlob'));
  assert.ok(moduleScript.includes('async function renderProjectAudioForExport(duration,preparedContext=null)'));
  assert.ok(moduleScript.includes('audioBlob=await renderProjectAudioForExport(plan.duration,preparedAudioContext);'));
  assert.ok(moduleScript.includes('RATE_FX_REALTIME_REQUIRED'));
  assert.ok(serverSource.includes("'audio/wav'"));
});

test('Preview waits for decoded frames and holds the last complete composite during transient seeks', () => {
  assert.ok(moduleScript.includes('frameCacheTimes=new Map()'));
  assert.ok(moduleScript.includes('requestVideoFrameCallback'));
  assert.ok(moduleScript.includes('if(!v||v.seeking||v.readyState<HTMLMediaElement.HAVE_CURRENT_DATA'));
  assert.ok(moduleScript.includes('const waitingForVideo=!visualDrawn&&visible.some'));
  assert.ok(moduleScript.includes('ctx.drawImage(previewFallback,0,0,projectWidth,projectHeight)'));
  assert.ok(moduleScript.includes('if(!exportState){'));
});


test('SmartCut scene analysis exposes editable signed weights and persists them', () => {
  for (const id of ['analysisMotion','analysisContrast','analysisSaturation','analysisSharpness','analysisBrightness','analysisWarmth','analysisAccuracy']) {
    assert.ok(html.includes(`id="${id}"`), `Missing analysis control: ${id}`);
  }
  assert.ok(moduleScript.includes('const ANALYSIS_PRESETS='));
  assert.ok(moduleScript.includes('analysis:getAnalysisSettings()'));
  assert.ok(moduleScript.includes('setAnalysisControls(s.analysis||analysisPreset'));
  assert.ok(moduleScript.includes('sceneMetricScore(metrics,analysis)'));
  assert.ok(moduleScript.includes('rankedSceneSamples(a,s.analysis)'));
});


test('SmartCut signed scene weights change rankings in both directions', () => {
  const start = moduleScript.indexOf('const ANALYSIS_VERSION=2;');
  const end = moduleScript.indexOf('const special=', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = moduleScript.slice(start, end);
  const context = {
    structuredClone,
    clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
    $: id => id === 'smartStyle' ? { value: 'balanced' } : null,
    friendly: v => v
  };
  vm.runInNewContext(block, context);
  const moving = { motion: .9, contrast: .5, saturation: .5, sharpness: .5, brightness: .5, warmth: .5 };
  const calm = { motion: .1, contrast: .5, saturation: .5, sharpness: .5, brightness: .5, warmth: .5 };
  const highMotion = { weights: { motion: 100, contrast: 0, saturation: 0, sharpness: 0, brightness: 0, warmth: 0 }, accuracy: 70 };
  const lowMotion = { weights: { motion: -100, contrast: 0, saturation: 0, sharpness: 0, brightness: 0, warmth: 0 }, accuracy: 70 };
  assert.ok(context.sceneMetricScore(moving, highMotion) > context.sceneMetricScore(calm, highMotion));
  assert.ok(context.sceneMetricScore(calm, lowMotion) > context.sceneMetricScore(moving, lowMotion));
  assert.equal(context.sceneMetricScore(moving, { weights: { motion:0, contrast:0, saturation:0, sharpness:0, brightness:0, warmth:0 }, accuracy: 70 }), .5);
});

test('SmartCut scene analysis uses coarse-to-fine sampling and raw scene metrics', () => {
  assert.ok(moduleScript.includes('const ANALYSIS_VERSION=2'));
  assert.ok(moduleScript.includes('sharpness:clamp'));
  assert.ok(moduleScript.includes('motionBetween(data,previous,delta)'));
  assert.ok(moduleScript.includes('const q=requiredAccuracy/100'));
  assert.ok(moduleScript.includes('const offsets=q>=.85?[-.4,-.2,.2,.4]:[-.32,.32]'));
  assert.ok(moduleScript.includes('samples:cleaned'));
  assert.ok(moduleScript.includes('sceneWindowScore(a,start,d,s.analysis)'));
});

test('WebCodecs flush watchdog times out a stalled codec and marks it recoverable', async () => {
  const start = moduleScript.indexOf('const WEB_CODECS_FLUSH_TIMEOUT_MS=6000;');
  const end = moduleScript.indexOf('function concatByteArrays(parts,total){', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = moduleScript.slice(start, end);
  const context = { setTimeout, clearTimeout, Promise, Error, Math, String };
  vm.runInNewContext(block, context);

  const resolved = await context.withExportTimeout(
    Promise.resolve('ok'),
    50,
    () => context.makeWebCodecsTimeout('flush', 50)
  );
  assert.equal(resolved, 'ok');

  const timeoutError = await context.withExportTimeout(
    new Promise(() => {}),
    20,
    () => context.makeWebCodecsTimeout('flush', 20)
  ).then(() => null, error => error);
  assert.ok(timeoutError instanceof Error);
  assert.equal(timeoutError.code, 'WEB_CODECS_TIMEOUT');
  assert.equal(context.isRecoverableWebCodecsError(timeoutError), true);

  assert.ok(moduleScript.includes('await withExportTimeout('));
  assert.ok(moduleScript.includes('encoder.flush(),'));
  assert.ok(moduleScript.includes('WEB_CODECS_FLUSH_TIMEOUT_MS'));
});

test('WebCodecs timeout recovery retries the same frame and can fall back instead of hanging forever', () => {
  const start = moduleScript.indexOf('async function encodeProjectVideoWebCodecs(settings,plan){');
  const end = moduleScript.indexOf('function waitForMediaMetadata(el,timeout=4000){', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = moduleScript.slice(start, end);
  assert.ok(block.includes('for(let attempt=0;attempt<3&&!committed;attempt++)'));
  assert.ok(block.includes('if(isRecoverableWebCodecsError(error)&&attempt<2)'));
  assert.ok(block.includes('await recoverEncoder(error);'));
  assert.ok(block.includes('throw wrapped;'));
  assert.ok(moduleScript.includes('fallbackToRecorder=true;'));
  assert.ok(moduleScript.includes('return browserDeterministicExport(settings);'));
});

test('Project validation accepts normal and precomposed projects', () => {
  assert.doesNotThrow(() => assertProject({
    id: 'project-1', name: 'Test', width: 1080, height: 1920, fps: 30,
    durationLimit: 60, bpm: 120, beatsPerClip: 4, socialSafe60: true,
    clips: [], musicSegments: [], texts: []
  }));
  assert.doesNotThrow(() => assertProject({
    id: 'render-1', name: 'Precomposed', width: 1080, height: 1920, fps: 30,
    duration: 12, durationLimit: 12, bpm: 120, beatsPerClip: 4, socialSafe60: false,
    precomposedVideoToken: '12345678-1234-1234-1234-123456789abc',
    precomposedAudioToken: 'abcdefab-1234-1234-1234-abcdefabcdef',
    clips: [], musicSegments: [], texts: []
  }));
});

test('Project validation rejects invalid values, IDs, pixel rates and timeline overflow', () => {
  const base = {
    id: 'project-1', name: 'Test', width: 1080, height: 1920, fps: 30,
    durationLimit: 60, bpm: 120, beatsPerClip: 4, socialSafe60: true,
    clips: [], musicSegments: [], texts: []
  };
  assert.throws(() => assertProject({ ...base, width: 0 }), ValidationError);
  assert.throws(() => assertProject({ ...base, id: '../escape' }), ValidationError);
  assert.throws(() => assertProject({ ...base, width: 1081 }), ValidationError);
  assert.throws(() => assertProject({ ...base, width: 7680, height: 7680, fps: 60 }), ValidationError);
  assert.throws(() => assertProject({
    ...base, durationLimit: null,
    clips: [{ id: 'c', mediaId: 'm', start: 21599, duration: 2, sourceStart: 0 }]
  }), ValidationError);
  assert.throws(() => assertProject({ ...base, precomposedVideoToken: '../../escape' }), ValidationError);
});

test('Playback loop stays non-blocking so video canvas and playhead cannot be stalled by audio promises', () => {
  const loopStart = moduleScript.indexOf('function loop(){');
  const loopEnd = moduleScript.indexOf('$("play").onclick=togglePlay;', loopStart);
  assert.notEqual(loopStart, -1);
  assert.notEqual(loopEnd, -1);
  const block = moduleScript.slice(loopStart, loopEnd);
  assert.ok(block.includes('syncVideos(t,false);'));
  assert.ok(block.includes('syncOriginalAudio(t,false);'));
  assert.ok(block.includes('updatePlayhead(t,true);'));
  assert.ok(block.includes('raf=requestAnimationFrame(loop);'));
  assert.ok(!block.includes('await syncVideos'));
  assert.ok(!block.includes('await syncOriginalAudio'));
  assert.match(moduleScript, /syncOriginalAudio = function syncOriginalAudio\(time,force=false\)/);
  assert.ok(moduleScript.includes('playMediaNonBlocking'));
});

test('SmartCut always clears busy UI and cannot report 100 percent before final completion', () => {
  const start = moduleScript.indexOf('async function runSmart(regenerate=false){');
  const end = moduleScript.indexOf('$("applySmart").onclick=()=>runSmart(false);', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = moduleScript.slice(start, end);
  assert.ok(block.includes('finally{'));
  assert.ok(block.includes('setSmartBusy(false);'));
  assert.ok(block.includes('hideTask();'));
  assert.ok(block.includes('Math.min(99'));
  assert.ok(block.includes('task(regenerate?"SmartCut neu generieren":"SmartCut",.5'));
  assert.ok(block.includes('smartModal.classList.add("hidden")'));
});

test('Playhead has a dedicated drag handler and enlarged hit target', () => {
  assert.ok(moduleScript.includes('playhead.addEventListener("pointerdown"'));
  assert.ok(html.includes('.playhead::after{left:-11px!important;width:25px!important;cursor:ew-resize}'));
  assert.ok(html.includes('.playhead{width:3px!important'));
});


test('Playback loop schedules rendering even when media play promises never settle', () => {
  const start = moduleScript.indexOf('function loop(){');
  const end = moduleScript.indexOf('$("play").onclick=togglePlay;', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const loopSource = moduleScript.slice(start, end);
  const calls = { video: 0, audio: 0, music: 0, render: 0, head: 0, raf: 0 };
  const never = new Promise(() => {});
  const context = {
    playing: true,
    playStart: 0,
    playPerf: 0,
    currentTime: 0,
    projectDuration: 10,
    performance: { now: () => 1000 },
    syncVideos: () => { calls.video++; return never; },
    syncOriginalAudio: () => { calls.audio++; return never; },
    syncMusic: () => { calls.music++; return never; },
    renderFrame: () => { calls.render++; },
    updatePlayhead: () => { calls.head++; },
    requestAnimationFrame: () => { calls.raf++; return 123; },
    pausePlayback: () => {},
    lastMediaSyncAt: 0,
    lastPreviewRenderAt: 0,
    MEDIA_SYNC_INTERVAL_MS: 1000 / 30,
    PREVIEW_FRAME_MS: 1000 / 30,
    raf: 0
  };
  vm.runInNewContext(loopSource, context);
  context.loop();
  assert.deepEqual(calls, { video: 1, audio: 1, music: 1, render: 1, head: 1, raf: 1 });
  assert.equal(context.raf, 123);
});

test('Preview throttling skips duplicate 60 Hz renders but keeps the playhead responsive', () => {
  const start = moduleScript.indexOf('function loop(){');
  const end = moduleScript.indexOf('$("play").onclick=togglePlay;', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const loopSource = moduleScript.slice(start, end);
  const calls = { video: 0, audio: 0, music: 0, render: 0, head: 0, raf: 0 };
  let now = 1000;
  const context = {
    playing: true, playStart: 0, playPerf: 0, currentTime: 0, projectDuration: 10,
    performance: { now: () => now },
    syncVideos: () => calls.video++, syncOriginalAudio: () => calls.audio++, syncMusic: () => calls.music++,
    renderFrame: () => calls.render++, updatePlayhead: () => calls.head++,
    requestAnimationFrame: () => { calls.raf++; return 1; }, pausePlayback: () => {},
    lastMediaSyncAt: 0, lastPreviewRenderAt: 0, MEDIA_SYNC_INTERVAL_MS: 1000/30, PREVIEW_FRAME_MS: 1000/30, raf: 0
  };
  vm.runInNewContext(loopSource, context);
  context.loop();
  now = 1016; context.loop();
  now = 1034; context.loop();
  assert.equal(calls.render, 2);
  assert.equal(calls.video, 2);
  assert.equal(calls.audio, 2);
  assert.equal(calls.music, 2);
  assert.equal(calls.head, 3);
  assert.equal(calls.raf, 3);
});

test('Preview playback is throttled and avoids redundant cache copies while playing', () => {
  assert.ok(moduleScript.includes('const PREVIEW_FPS=30;'));
  assert.ok(moduleScript.includes('const MEDIA_SYNC_INTERVAL_MS=1000/30;'));
  assert.ok(moduleScript.includes('if(frameNow-lastPreviewRenderAt>=PREVIEW_FRAME_MS||lastPreviewRenderAt===0)'));
  assert.ok(moduleScript.includes('if(frameNow-lastMediaSyncAt>=MEDIA_SYNC_INTERVAL_MS||lastMediaSyncAt===0)'));
  const renderStart = moduleScript.indexOf('function renderFrame(time=currentTime){');
  const renderEnd = moduleScript.indexOf('\n', renderStart);
  const renderSource = moduleScript.slice(renderStart, renderEnd > renderStart ? renderEnd : moduleScript.length);
  assert.ok(!renderSource.includes('cacheVideoFrame(c,v)'), 'renderFrame must not copy every active video frame into a cache canvas');
  assert.ok(moduleScript.includes('requestVideoFrameCallback'));
  assert.ok(moduleScript.includes('if(!v.__beatcutRvfc)cacheVideoFrame(c,v);'));
  assert.ok(moduleScript.includes('v.seeking||v.readyState<HTMLMediaElement.HAVE_CURRENT_DATA'));
  assert.ok(moduleScript.includes('previewFallbackValid'));
  assert.ok(moduleScript.includes('if(!exportState){'));
  assert.ok(moduleScript.includes('drift>.70'));
  assert.ok(moduleScript.includes('if(!hasRateFx)return end-start;'));
});

test('renderFrame renders active transitions without a temporal-dead-zone error', () => {
  const start = moduleScript.indexOf('function renderFrame(time=currentTime){');
  const end = moduleScript.indexOf('function updateTextHandle', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const source = moduleScript.slice(start, end);
  assert.ok(source.includes('time<x.start+x.duration'));
  assert.ok(!source.includes('time<t.start+t.duration'));

  let transitionCalls = 0;
  const context = {
    currentTime: 0.5,
    videoCache: new Map(),
    activeClips: () => [],
    cacheVideoFrame: () => {},
    ctx: {
      setTransform: () => {},
      globalAlpha: 1,
      filter: 'none',
      fillStyle: '#000',
      fillRect: () => {}
    },
    projectWidth: 1080,
    projectHeight: 1920,
    track: () => ({ visible: true }),
    drawClip: () => {},
    special: { fx: { visible: true }, transition: { visible: true }, text: { visible: true } },
    effects: [],
    transitions: [{ id: 'tr-1', start: 0, duration: 1, type: 'fade' }],
    drawFx: () => {},
    drawTransition: () => { transitionCalls += 1; },
    drawTexts: () => {},
    updateTextHandle: () => {},
    asset: () => null,
    previewFallbackValid: false,
    previewFallback: { width: 0, height: 0 },
    previewFallbackCtx: { drawImage: () => {} },
    canvas: {},
    exportState: {}
  };
  vm.runInNewContext(source, context);
  assert.doesNotThrow(() => context.renderFrame(0.5));
  assert.equal(transitionCalls, 1);
});

test('Preview fallback keeps the last composed frame instead of rendering transient black video frames', () => {
  const start = moduleScript.indexOf('function renderFrame(time=currentTime){');
  const end = moduleScript.indexOf('function updateTextHandle', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const source = moduleScript.slice(start, end);
  let fallbackDraws = 0;
  let effectCalls = 0;
  const context = {
    currentTime: 0.5,
    ctx: {
      setTransform: () => {}, globalAlpha: 1, filter: 'none', fillStyle: '#000', fillRect: () => {},
      drawImage: () => { fallbackDraws += 1; }
    },
    projectWidth: 1080, projectHeight: 1920,
    activeClips: () => [{ id: 'c1', assetId: 'a1', trackId: 't1' }],
    track: () => ({ visible: true }),
    drawClip: () => false,
    asset: () => ({ type: 'video' }),
    special: { fx: { visible: true }, transition: { visible: true }, text: { visible: true } },
    effects: [{ start: 0, duration: 1 }], transitions: [],
    drawFx: () => { effectCalls += 1; }, drawTransition: () => {}, drawTexts: () => {},
    previewFallbackValid: true,
    previewFallback: { width: 320, height: 568 },
    previewFallbackCtx: { drawImage: () => {} },
    exportState: null,
    canvas: {},
    updateTextHandle: () => {}
  };
  vm.runInNewContext(source, context);
  context.renderFrame(0.5);
  assert.equal(fallbackDraws, 1);
  assert.equal(effectCalls, 0, 'effects must not be applied twice to the held fallback frame');
});

test('Offline audio WAV writer produces a valid stereo PCM header', () => {
  const start = moduleScript.indexOf('function audioBufferToWavBlob(buffer){');
  const end = moduleScript.indexOf('function hasRateAudioFxInProject', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const source = moduleScript.slice(start, end);
  const context = { Blob };
  vm.runInNewContext(source, context);
  const left = new Float32Array([0, 0.5, -0.5, 1]);
  const right = new Float32Array([0, -0.5, 0.5, -1]);
  const blob = context.audioBufferToWavBlob({
    numberOfChannels: 2, length: 4, sampleRate: 48000,
    getChannelData: i => i === 0 ? left : right
  });
  assert.equal(blob.type, 'audio/wav');
  assert.equal(blob.size, 44 + 4 * 2 * 2);
});

test('WebCodecs MP4 export recovers from codec inactivity and falls back instead of aborting', () => {
  assert.ok(moduleScript.includes('function isRecoverableWebCodecsError(error)'));
  assert.ok(moduleScript.includes('message.includes("reclaimed")'));
  assert.ok(moduleScript.includes('message.includes("inactivity")'));
  assert.ok(moduleScript.includes('await withExportTimeout('));
  assert.ok(moduleScript.includes('encoder.flush(),'));
  assert.ok(moduleScript.includes('WEB_CODECS_FLUSH_TIMEOUT_MS'));
  assert.ok(moduleScript.includes('forceKeyFrame=encoderFresh||n%keyInterval===0'));
  assert.ok(moduleScript.includes('softwareConfig=softwareConfig||await chooseAvcConfig'));
  assert.ok(moduleScript.includes('const wrapped=new Error("WEB_CODECS_RECLAIMED")'));
  assert.ok(moduleScript.includes('fallbackToRecorder=true'));
  assert.ok(moduleScript.includes('return browserDeterministicExport(settings);'));
});

test('WebCodecs inactivity detector only treats reclaim-style failures as recoverable', () => {
  const start = moduleScript.indexOf('function isRecoverableWebCodecsError(error){');
  const end = moduleScript.indexOf('\nfunction concatByteArrays', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = moduleScript.slice(start, end);
  const context = {};
  vm.runInNewContext(`${block};globalThis.check=isRecoverableWebCodecsError;`, context);
  assert.equal(context.check(new Error('Codec reclaimed due to inactivity.')), true);
  assert.equal(context.check({ name: 'InvalidStateError', message: 'VideoEncoder codec is closed' }), true);
  assert.equal(context.check({ code: 'WEB_CODECS_TIMEOUT', message: 'WebCodecs-flush timeout' }), true);
  assert.equal(context.check(new Error('Out of memory')), false);
  assert.equal(context.check(new Error('Unsupported codec profile')), false);
});

test('final MP4 export uses deterministic frame-sequence server path without WebCodecs or WebM fallback', () => {
  assert.ok(html.includes('async function serverFrameSequenceExportProject(settings)'), 'deterministic frame exporter missing');
  assert.ok(html.includes('exportProject=serverFrameSequenceExportProject;'), 'final exportProject is not bound to deterministic frame exporter');
  const start = moduleScript.indexOf('async function serverFrameSequenceExportProject(settings)');
  const end = moduleScript.indexOf('\nexportProject=serverFrameSequenceExportProject;', start);
  assert.ok(start >= 0 && end > start, 'deterministic export function source missing');
  const source = moduleScript.slice(start, end);
  assert.ok(!source.includes('VideoEncoder'), 'final MP4 exporter must not use WebCodecs');
  const mp4Body = source.slice(source.indexOf('if(exportState)return;'));
  assert.ok(!mp4Body.includes('MediaRecorder'), 'final MP4 branch must not use MediaRecorder/WebM');
  assert.ok(source.includes('/api/frame-exports'), 'final MP4 exporter must use frame-export server API');
  assert.ok(source.includes('syncVideosForDeterministicExport(t)'), 'final MP4 exporter must render exact project-time frames');
  assert.ok(source.includes('canvasToJpegBlob(canvas'), 'final MP4 exporter must stream rendered canvas frames');
});

test('MP4 frame export verifies seek destination and surfaces FFmpeg failures immediately', () => {
  const seekSource = moduleScript.slice(moduleScript.indexOf('function waitForVideoSeek('), moduleScript.indexOf('async function syncVideosForDeterministicExport('));
  assert.match(seekSource, /Math\.abs\(\(v\.currentTime\|\|0\)-wanted\)<=tolerance/);
  assert.match(seekSource, /if\(atTarget\(\)\)finish\(\)/);
  const pollSource = moduleScript.slice(moduleScript.indexOf('async function pollFrameExport('), moduleScript.indexOf('async function cancelFrameExport('));
  assert.match(pollSource, /failure\.code="FRAME_EXPORT_FAILED"/);
  assert.match(pollSource, /error\?\.code==="FRAME_EXPORT_FAILED"/);
});

test('v0.4.2 MOV decoder recovery and visible version marker', () => {
  assert.match(html, /BeatCut Studio v0\.4\.2/);
  assert.match(html, /<small[^>]+>v0\.4\.2<\/small>/);
  assert.match(moduleScript, /videoCache\.delete\(c\.id\)/);
  assert.match(moduleScript, /destroyMedia\(v\)/);
  assert.match(moduleScript, /NETWORK_EMPTY/);
  assert.match(moduleScript, /if\(!cacheVideoFrame\(c,v\)\)/);
});

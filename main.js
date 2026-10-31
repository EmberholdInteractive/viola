// Viola – Hauptprozess: Fenster, Dateidialoge, Engine-Aufrufe (FFmpeg, Scan, Duplikate, Beat-Sync, Video2X).
const { app, BrowserWindow, ipcMain, dialog, protocol, net, shell, Menu } = require('electron');
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const { pathToFileURL } = require('url');
const ff = require('./src/engine/ffmpeg');
const { renderProject, projectDuration, PRESETS, TRANSITIONS, MOTIONS } = require('./src/engine/render');
const { scanFolders, kindOf } = require('./src/engine/scan');
const { findDuplicates } = require('./src/engine/dedupe');
const { groupByYearMonth, buildYearProject } = require('./src/engine/collage');
const { analyzeBeats, snapToBeats } = require('./src/engine/beat');
const v2x = require('./src/engine/video2x');
const projectIO = require('./src/engine/project');

protocol.registerSchemesAsPrivileged([{ scheme: 'viola', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true } }]);

let win = null;
const jobs = new Map();           // laufende Render-/Upscale-/Scan-Jobs (zum Abbrechen)
const send = msg => { if (win && !win.isDestroyed()) win.webContents.send('evt', msg); };
const userFile = n => path.join(app.getPath('userData'), n);
const sha = s => crypto.createHash('sha1').update(s).digest('hex');

function readSettings() { try { return JSON.parse(fs.readFileSync(userFile('settings.json'), 'utf8')); } catch (_) { return {}; } }
function writeSettings(s) { fs.writeFileSync(userFile('settings.json'), JSON.stringify(s, null, 1)); }

function createWindow() {
  win = new BrowserWindow({ width: 1560, height: 940, minWidth: 1100, minHeight: 700, backgroundColor: '#0b0813', title: 'Viola', icon: path.join(__dirname, 'assets', 'icon.ico'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false } });
  win.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));
  win.webContents.on('before-input-event', (e, i) => { if (i.key === 'F12' && i.type === 'keyDown') win.webContents.toggleDevTools(); });
}

if (process.platform === 'win32') app.setAppUserModelId('de.viola.studio');
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle('viola', req => {
    const p = decodeURIComponent(req.url.slice('viola://media/'.length));
    return net.fetch(pathToFileURL(p).toString(), { headers: req.headers });
  });
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { jobs.forEach(j => j.abort()); app.quit(); });

const H = (name, fn) => ipcMain.handle(name, async (_e, ...a) => fn(...a));

// ---------- Einstellungen & Dialoge ----------
H('settings:get', () => Object.assign({ preset: '720p', outDir: path.join(os.homedir(), 'Videos', 'Viola') }, readSettings()));
H('settings:set', s => { const n = Object.assign(readSettings(), s); writeSettings(n); return n; });
H('info', () => ({ presets: PRESETS, transitions: ff.supportedTransitions(TRANSITIONS), motions: MOTIONS, filters: v2x.FILTERS, platform: process.platform, ffmpeg: ff.binaries().ffmpeg }));
H('dialog:files', async kind => {
  const f = { photo: [{ name: 'Bilder', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tif', 'tiff'] }], video: [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'mts', 'm2ts', '3gp', 'wmv', 'webm'] }], audio: [{ name: 'Musik', extensions: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'] }],
    media: [{ name: 'Medien', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'mp4', 'mov', 'avi', 'mkv', 'mts', '3gp', 'mp3', 'wav', 'm4a'] }], exe: [{ name: 'Programm', extensions: ['exe'] }] }[kind || 'media'];
  const r = await dialog.showOpenDialog(win, { properties: kind === 'exe' ? ['openFile'] : ['openFile', 'multiSelections'], filters: f });
  return r.canceled ? [] : r.filePaths;
});
H('dialog:folder', async (multi) => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', ...(multi ? ['multiSelections'] : [])] }); return r.canceled ? [] : r.filePaths; });
H('dialog:saveVideo', async name => { const r = await dialog.showSaveDialog(win, { defaultPath: name || 'Collage.mp4', filters: [{ name: 'MP4-Video', extensions: ['mp4'] }] }); return r.canceled ? null : r.filePath; });
H('dialog:openProject', async () => { const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Viola-Projekt', extensions: ['viola'] }], properties: ['openFile'] }); return r.canceled ? null : r.filePaths[0]; });
H('dialog:saveProject', async name => { const r = await dialog.showSaveDialog(win, { defaultPath: (name || 'Projekt') + '.viola', filters: [{ name: 'Viola-Projekt', extensions: ['viola'] }] }); return r.canceled ? null : r.filePath; });
H('project:save', (file, p) => { try { require('./src/engine/projectsafe').backupBeforeSave(file); } catch (_) {} projectIO.save(file, p); return file; });
H('project:load', file => projectIO.load(file));
H('shell:reveal', p => { shell.showItemInFolder(p); return true; });
H('shell:open', p => shell.openPath(p));

// ---------- Medien ----------
H('media:probe', file => {
  const k = kindOf(file);
  if (k === 'photo') return { kind: k, duration: 0 };
  const j = ff.probe(file); const v = j.streams.find(s => s.codec_type === 'video');
  return { kind: k, duration: parseFloat(j.format.duration) || 0, width: v && v.width, height: v && v.height };
});
const thumbDir = () => { const d = path.join(app.getPath('userData'), 'thumbs'); fs.mkdirSync(d, { recursive: true }); return d; };
H('media:thumb', async (file, size = 240) => {
  let mt = 0; try { mt = fs.statSync(file).mtimeMs; } catch (_) { return null; }
  const out = path.join(thumbDir(), sha(file + size + mt) + '.jpg'); if (fs.existsSync(out)) return out;
  try {
    if (kindOf(file) === 'photo') await require('sharp')(file, { failOn: 'none' }).rotate().resize(size, Math.round(size * 0.5625 * (size > 400 ? 1 : 1.2)), { fit: size > 400 ? 'inside' : 'cover' }).jpeg({ quality: 72 }).toFile(out);
    else await ff.run(['-ss', '1', '-i', file, '-frames:v', '1', '-vf', `scale=${size}:-2`, out]);
    return out;
  } catch (_) { return null; }
});

// ---------- Scan, Duplikate, Collage ----------
H('scan:start', async (id, folders, opts) => {
  const c = new AbortController(); jobs.set(id, c);
  try { return await scanFolders(folders, { signal: c.signal, onProgress: p => send({ type: 'scan', id, ...p }) }); } finally { jobs.delete(id); }
});
H('dedupe:run', async (id, items, opts) => {
  const c = new AbortController(); jobs.set(id, c);
  try { const r = await findDuplicates(items, Object.assign({ signal: c.signal, onProgress: p => send({ type: 'dedupe', id, ...p }) }, opts)); return { dropped: [...r.dropped], groups: r.groups.map(g => g.map(i => i.path)) }; } finally { jobs.delete(id); }
});
H('collage:years', (items, opts) => {
  const y = groupByYearMonth(items, opts); const out = {};
  y.forEach((months, year) => { let n = 0, und = 0; months.forEach((arr, m) => { if (m === -1) und += arr.length; else n += arr.length; }); out[year] = { months: months.size, dated: n, undated: und }; });
  return out;
});
H('collage:build', (items, year, opts) => { const m = groupByYearMonth(items, opts).get(year); return m ? buildYearProject(year, m, opts) : null; });

// ---------- Beat-Sync ----------
H('beat:analyze', file => analyzeBeats(file));
H('beat:snap', (slides, beats, o) => snapToBeats(slides, beats, o));

// ---------- Rendern ----------
H('render:start', async (id, project, outFile) => {
  project = require('./src/engine/tracks').apply(project);
  const c = new AbortController(); jobs.set(id, c);
  try { project = await prerenderScenes(project, v => send({ type: 'render', id, phase: 'scene3d', value: v })); } catch (e) { send({ type: 'render', id, phase: 'error', message: '3D: ' + e.message }); jobs.delete(id); throw e; }
  try { const r = await renderProject(project, outFile, { signal: c.signal, onProgress: p => send({ type: 'render', id, ...p }) }); send({ type: 'render', id, phase: 'finished', ...r }); return r; }
  catch (e) { send({ type: 'render', id, phase: 'error', message: e.message }); throw e; }
  finally { jobs.delete(id); }
});
H('render:concat', async (id, files, outFile) => {
  const c = new AbortController(); jobs.set(id, c);
  try { const tmp = path.join(os.tmpdir(), 'viola-concat-' + Date.now() + '.txt'); fs.writeFileSync(tmp, files.map(ff.concatLine).join(''));
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    await ff.run(['-f', 'concat', '-safe', '0', '-i', tmp, '-c', 'copy', '-movflags', '+faststart', outFile], { signal: c.signal }); fs.unlinkSync(tmp); return { outFile, duration: ff.duration(outFile) }; } finally { jobs.delete(id); }
});
H('job:cancel', id => { const j = jobs.get(id); if (j) j.abort(); return !!j; });
H('project:duration', p => projectDuration(p));

// ---------- Video2X ----------
H('v2x:detect', custom => v2x.detect(custom || readSettings().video2xPath));
H('v2x:run', async (id, items, opts) => {
  const c = new AbortController(); jobs.set(id, c);
  const det = v2x.detect(readSettings().video2xPath); if (!det.found) { jobs.delete(id); throw new Error('Video2X wurde nicht gefunden. Bitte den Pfad zur video2x.exe in den Einstellungen wählen.'); }
  try { return await v2x.upscaleQueue(items, opts, { exe: det.exe, cacheDir: readSettings().upscaleDir, signal: c.signal, onItem: p => send({ type: 'v2x', id, ...p }) }); } finally { jobs.delete(id); }
});

// ---------- Look (LUTs) ----------
const lutDir = () => path.join(app.getPath('userData'), 'luts');
H('fx:catalog', () => { const xo = require('./src/engine/exportopts'); const fxm = require('./src/engine/fx'), afx = require('./src/engine/afx'); const sup = ff.supportedFilters; const ok = c => c.filter(d => (d.needs || []).length === sup(d.needs).length); return { video: ok(fxm.catalog()), audio: ok(afx.catalog()), codecs: Object.fromEntries(Object.entries(xo.CODECS).map(([k, v]) => [k, { label: v.label, containers: v.containers }])), audioCodecs: Object.fromEntries(Object.entries(xo.AUDIO).map(([k, v]) => [k, v.containers])), hardware: xo.hardwareAvailable() }; });
H('looks:list', () => {
  const built = require('./src/engine/look').ensureBuiltinLuts(lutDir()).map(l => ({ id: l.id, label: l.label, file: l.file, builtin: true }));
  const custom = (readSettings().customLuts || []).filter(f => fs.existsSync(f)).map(f => ({ id: 'c:' + f, label: path.basename(f, '.cube'), file: f }));
  return [...built, ...custom];
});
H('looks:addCustom', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: '3D-LUT (.cube)', extensions: ['cube'] }] });
  if (r.canceled) return [];
  const s = readSettings(); s.customLuts = [...new Set([...(s.customLuts || []), ...r.filePaths])]; writeSettings(s); return r.filePaths;
});

// ---------- Audio bereinigen ----------
H('audio:clean', async (id, input, output, opts) => {
  const c = new AbortController(); jobs.set(id, c);
  try { return await require('./src/engine/audioclean').cleanAudio(input, output, Object.assign({ signal: c.signal, onProgress: t => send({ type: 'audio', id, seconds: t }) }, opts)); } finally { jobs.delete(id); }
});
H('dialog:saveAudio', async name => { const r = await dialog.showSaveDialog(win, { defaultPath: name || 'Sprache_bereinigt.m4a', filters: [{ name: 'Audio', extensions: ['m4a', 'wav'] }] }); return r.canceled ? null : r.filePath; });

// ---------- Proxy-Vorschau ----------
const proxyDir = () => path.join(app.getPath('userData'), 'proxies');
H('proxy:make', async (id, items) => {
  const c = new AbortController(); jobs.set(id, c);
  try { return await require('./src/engine/proxy').makeProxies(items, proxyDir(), { signal: c.signal, onProgress: p => send({ type: 'proxy', id, ...p }) }); } finally { jobs.delete(id); }
});
H('proxy:size', () => require('./src/engine/proxy').cacheSize(proxyDir()));
H('proxy:clear', () => { require('./src/engine/proxy').clearCache(proxyDir()); return true; });

// ---------- Untertitel ----------
H('subs:available', () => ({ burn: require('./src/engine/subtitles').hasSubtitleFilter(), whisper: !!(readSettings().whisper && readSettings().whisper.exe) }));
H('subs:transcribe', async (id, file) => {
  const c = new AbortController(); jobs.set(id, c);
  try { return await require('./src/engine/subtitles').transcribe(file, readSettings().whisper, { signal: c.signal, onProgress: p => send({ type: 'subs', id, ...p }) }); } finally { jobs.delete(id); }
});
H('subs:saveSrt', async (segs, suggested) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: suggested || 'Untertitel.srt', filters: [{ name: 'SubRip', extensions: ['srt'] }] });
  if (r.canceled) return null; fs.writeFileSync(r.filePath, require('./src/engine/subtitles').toSrt(segs)); return r.filePath;
});
H('subs:openSrt', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'SubRip', extensions: ['srt'] }] });
  return r.canceled ? null : require('./src/engine/subtitles').parseSrt(fs.readFileSync(r.filePaths[0], 'utf8'));
});

// ---- Projekt-Sicherheit ----
const safe = require('./src/engine/projectsafe');
const autoDir = () => path.join(app.getPath('userData'), 'autosave');
H('safe:autosave', p => { safe.autosave(autoDir(), p); try { fs.writeFileSync(userFile('dirty.flag'), '1'); } catch (_) {} return true; });
H('safe:clean', () => { try { fs.rmSync(userFile('dirty.flag'), { force: true }); } catch (_) {} return true; });
H('safe:recover', () => { if (!fs.existsSync(userFile('dirty.flag'))) return null; const s = safe.snapshots(autoDir())[0]; try { fs.rmSync(userFile('dirty.flag'), { force: true }); return s ? JSON.parse(fs.readFileSync(s.file, 'utf8')) : null; } catch (_) { return null; } });
H('safe:pick', async () => { const r = await dialog.showOpenDialog(win, { defaultPath: autoDir(), filters: [{ name: 'Sicherung', extensions: ['viola'] }], properties: ['openFile'] }); return r.canceled ? null : JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); });
H('safe:missing', p => safe.missing(p));
H('safe:relink', async p => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] }); if (r.canceled) return null; const c = JSON.parse(JSON.stringify(p)); const res = safe.relink(c, r.filePaths[0]); return Object.assign(res, { project: c }); });
H('safe:collect', async p => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], title: 'Zielordner zum Sammeln' }); if (r.canceled) return null; return safe.collect(p, r.filePaths[0], p.name || 'Projekt'); });

// ---- RaLyrics / RaSing ----
H('tools:launch', name => {
  const dir = readSettings().toolsDir || 'E:\\Dev\\whisperx'; const py = path.join(dir, 'venv', 'Scripts', 'pythonw.exe'); const appDir = path.join(dir, 'app');
  const script = path.join(appDir, name === 'rasing' ? 'rasing.py' : 'lyrics_tool.py');
  if (!fs.existsSync(py)) return { ok: false, error: 'Python-Umgebung nicht gefunden: ' + py };
  if (!fs.existsSync(script)) return { ok: false, error: 'Programm nicht gefunden: ' + script };
  try { const c = require('child_process').spawn(py, [script], { cwd: appDir, detached: true, stdio: 'ignore', windowsHide: false }); c.on('error', () => {}); c.unref(); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
});
H('lrc:forMusic', (p, total, o) => require('./src/engine/lrc').forMusic(p, total, o || {}));
H('lrc:open', async () => { const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Lyrics', extensions: ['lrc'] }], properties: ['openFile'] }); if (r.canceled) return null; const f = r.filePaths[0]; return { name: path.basename(f), lines: require('./src/engine/lrc').parse(fs.readFileSync(f, 'utf8')) }; });
H('shell:devtools', () => { if (win) win.webContents.toggleDevTools(); return true; });
// ---- Analyse ----
H('an:scenes', (f, t) => require('./src/engine/analysis').scenes(f, t));
H('an:silence', (f, o) => require('./src/engine/analysis').silence(f, o));
H('an:scope', (f, t, kind) => { try { const out = path.join(os.tmpdir(), 'viola-scope-' + kind + '.png'); return require('./src/engine/analysis').scope(f, t, kind, out); } catch (_) { return null; } });

H('edl:save', async (project) => { const { dialog } = require('electron'); const r = await dialog.showSaveDialog({ defaultPath: (project.name || 'Viola') + '.edl', filters: [{ name: 'EDL', extensions: ['edl'] }] }); if (r.canceled) return null; fs.writeFileSync(r.filePath, require('./src/engine/tracks').toEdl(project, 25)); return r.filePath; });

// Effekt-Vorschaubilder und Bildschirmaufnahme
H('fx:thumb', async id => { const f = await require('./src/engine/fxthumb').thumb(id, {}, path.join(app.getPath('userData'), 'fxthumbs')); return f ? 'data:image/png;base64,' + fs.readFileSync(f).toString('base64') : null; });
H('capture:start', async o => require('./src/engine/capture').start(o || {}, (o && o.dir) || path.join(app.getPath('videos'), 'Viola Aufnahmen')));
H('capture:stop', async () => require('./src/engine/capture').stop());

// ---- Runde 4: Pegel, Untertitel-Prüfung, Versionen, Austauschformate, überwachter Ordner ----
H('an:levels', (file, step) => require('./src/engine/analysis').levels(file, step || 0.1));
H('subs:check', (project, total, opts) => {
  const r = require('./src/engine/lrc').forMusic(project, total || projectDuration(project), {}); const lines = (r.lines || []).map(l => ({ t: l.t != null ? l.t : l.time, text: l.text }));
  return { count: lines.length, missing: r.missing || [], issues: require('./src/engine/subcheck').check(lines, opts || {}) };
});
const verDir = () => path.join(app.getPath('userData'), 'versions');
H('ver:save', (project, note) => require('./src/engine/subcheck').saveVersion(verDir(), project, note));
H('ver:list', name => require('./src/engine/subcheck').listVersions(verDir(), name));
H('ver:load', file => require('./src/engine/subcheck').loadVersion(file));
H('xchg:save', async (project, kind) => {
  const sc = require('./src/engine/subcheck'), tr = require('./src/engine/tracks');
  const f = { edl: ['EDL', 'edl', () => tr.toEdl(project, 25)], fcpxml: ['Final Cut / Premiere / DaVinci (FCPXML)', 'fcpxml', () => sc.toFcpxml(project, 25)], otio: ['OpenTimelineIO', 'otio', () => sc.toOtio(project, 25)] }[kind || 'edl'];
  const r = await dialog.showSaveDialog(win, { defaultPath: (project.name || 'Viola') + '.' + f[1], filters: [{ name: f[0], extensions: [f[1]] }] }); if (r.canceled) return null;
  fs.writeFileSync(r.filePath, f[2]()); return r.filePath;
});
let watcher = null, watchSeen = new Set(), watchTimer = null;
H('watch:set', async dir => {
  if (watcher) { watcher.close(); watcher = null; } watchSeen = new Set(); if (!dir) return null;
  try { fs.readdirSync(dir).forEach(n => watchSeen.add(n)); } catch (e) { throw new Error('Ordner nicht lesbar: ' + e.message); }
  let pend = new Set();
  watcher = fs.watch(dir, (ev, name) => { if (!name || watchSeen.has(name)) return; pend.add(name); clearTimeout(watchTimer); watchTimer = setTimeout(() => {
    const files = [...pend].map(n => path.join(dir, n)).filter(p => { try { return fs.statSync(p).isFile() && kindOf(p); } catch (_) { return false; } }); files.forEach(p => watchSeen.add(path.basename(p))); pend = new Set(); if (files.length) send({ type: 'watch', files }); }, 2500); });
  return dir;
});

// ---------- Viola Pro: Tracking, Multicam, AAF, Plug-ins, 3D, Sprecher/Übersetzung ----------
const pluginDirs = () => { const u = path.join(app.getPath('userData'), 'plugins'); try { fs.mkdirSync(u, { recursive: true }); } catch (_) {} return [u, path.join(__dirname, 'plugins')]; };
let pluginState = { loaded: [], errors: [] };
const loadPlugins = () => { pluginState = require('./src/engine/fx').loadPlugins(pluginDirs()); return pluginState; };
try { loadPlugins(); } catch (e) { pluginState.errors.push(e.message); }
H('plugins:list', () => ({ dirs: pluginDirs(), loaded: pluginState.loaded, errors: pluginState.errors, catalog: require('./src/engine/fx').catalog().filter(x => x.id.startsWith('PLUG.')) }));
H('plugins:reload', () => { const r = loadPlugins(); return { loaded: r.loaded, errors: r.errors, catalog: require('./src/engine/fx').catalog() }; });
H('plugins:openDir', () => require('electron').shell.openPath(pluginDirs()[0]));

H('tracker:run', (file, o) => require('./src/engine/tracker').track(file, o || {}));
H('multicam:sync', (files, o) => require('./src/engine/multicam').sync(files, o || {}));
H('multicam:plan', (cuts, angles, total) => require('./src/engine/multicam').plan(cuts, angles, total));
H('multicam:auto', (n, total, every) => require('./src/engine/multicam').autoCuts(n, total, every));
H('capture:devices', () => require('./src/engine/capture').listAudioDevices());

H('xchg:aaf', async project => {
  const sc = require('./src/engine/subcheck'), aaf = require('./src/engine/aaf');
  const r = await dialog.showSaveDialog(win, { defaultPath: (project.name || 'Viola') + '.aaf', filters: [{ name: 'AAF', extensions: ['aaf'] }] }); if (r.canceled) return null;
  const py = readSettings().python || undefined; if (!aaf.available(py)) throw new Error('AAF braucht Python mit "pip install opentimelineio otio-aaf-adapter pyaaf2" (Einstellung "python" möglich).');
  return aaf.convert(project, r.filePath, { python: py });
});

// 3D-Szene in unsichtbarem Fenster als PNG-Folge (mit Transparenz) rendern
async function renderScene3D(spec, w, h, fps, dur, dir, onProgress) {
  fs.mkdirSync(dir, { recursive: true });
  const bw = new BrowserWindow({ show: false, width: w, height: h, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, offscreen: false, backgroundThrottling: false } });
  try {
    await bw.loadFile(path.join(__dirname, 'src', 'renderer', 'scene3d.html'));
    await bw.webContents.executeJavaScript(`init(${JSON.stringify(spec || {})}, ${w}, ${h})`);
    const n = Math.max(1, Math.ceil(dur * fps));
    for (let i = 0; i < n; i++) {
      const url = await bw.webContents.executeJavaScript(`renderFrame(${i}, ${fps})`);
      fs.writeFileSync(path.join(dir, 'f' + String(i).padStart(5, '0') + '.png'), Buffer.from(url.split(',')[1], 'base64'));
      if (onProgress && i % 5 === 0) onProgress(i / n);
    }
    return { seq: path.join(dir, 'f%05d.png'), frames: n, dir };
  } finally { bw.destroy(); }
}
H('scene3d:render', (spec, w, h, fps, dur) => renderScene3D(spec, Math.round(w) || 1280, Math.round(h) || 720, fps || 25, dur || 3, path.join(app.getPath('temp'), 'viola-3d-' + Date.now())));
// Vor dem Rendern: Overlays vom Typ "scene3d" mit Szene (aber ohne fertige Bildfolge) rendern
async function prerenderScenes(project, onProgress) {
  const list = (project.overlays || []); if (!list.some(o => o && o.type === 'scene3d' && o.scene)) return project;
  const S = project.settings || {}; const W = S.width || 1920, H = S.height || 1080, FPS = S.fps || 25; const out = JSON.parse(JSON.stringify(project));
  for (const o of out.overlays) if (o && o.type === 'scene3d' && o.scene) {
    const w = Math.round(W * Math.max(0.05, Math.min(1, o.w || 1)) / 2) * 2, h = Math.round(w * (H / W) / 2) * 2;
    const r = await renderScene3D(o.scene, w, h, FPS, o.duration || 3, path.join(app.getPath('temp'), 'viola-3d-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)), onProgress);
    o.seq = r.seq; o.fps = FPS;
  }
  return out;
}

// Sprecher-Erkennung und Übersetzung (Python, optional)
function pyPath() { const s = readSettings(); if (s.python) return s.python; const dir = s.toolsDir || 'E:\\Dev\\whisperx'; const v = path.join(dir, 'venv', 'Scripts', 'python.exe'); return fs.existsSync(v) ? v : 'python'; }
function runPy(script, args, input) {
  return new Promise((res, rej) => { const p = require('child_process').spawn(pyPath(), [path.join(__dirname, 'tools', script).replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep), ...args], { windowsHide: true }); let out = '', err = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d); p.on('error', e => rej(new Error('Python nicht startbar: ' + e.message)));
    p.on('close', c => { if (c !== 0) return rej(new Error((err.trim().split('\n').slice(-3).join(' ') || out || 'Fehler ' + c).slice(0, 400))); try { res(JSON.parse(out.trim().split('\n').pop())); } catch (e) { rej(new Error('Ungültige Antwort: ' + out.slice(0, 200))); } });
    if (input != null) p.stdin.end(input); });
}
H('subs:diarize', (audio, o) => { const s = readSettings(); if (!s.hfToken) throw new Error('Hugging-Face-Token fehlt (Einstellungen: hfToken).'); o = o || {}; return runPy('diarize.py', [audio, s.hfToken, o.lang || 'auto', ...(o.min ? [String(o.min)] : []), ...(o.max ? [String(o.max)] : [])]); });
H('subs:translate', async (texts, from, to) => { const r = await runPy('translate.py', [from, to], JSON.stringify(texts || [])); if (r && r.error) throw new Error(r.error); return r; });
H('settings:python', (py, hf) => { const s = readSettings(); if (py != null) s.python = py; if (hf != null) s.hfToken = hf; fs.writeFileSync(userFile('settings.json'), JSON.stringify(s, null, 1)); return { python: s.python || '', hasToken: !!s.hfToken }; });
H('fusion:preview', async (slide, W, Hh) => {
  const fxm = require('./src/engine/fx'), fusion = require('./src/engine/fusion'), ffm = require('./src/engine/ffmpeg');
  if (!slide || !slide.src || !fs.existsSync(slide.src)) throw new Error('Nur Foto- oder Videofolien können getestet werden.');
  W = Math.max(64, Math.round(W / 2) * 2); Hh = Math.max(64, Math.round(Hh / 2) * 2); const out = path.join(app.getPath('temp'), 'viola-fus-' + Date.now() + '.png'); const ctx = { W, H: Hh, supported: n => ffm.supportedFilters(n) };
  const g = fxm.buildGraph((slide.effects || []), 'b', 'c', ctx, 'e'); const comp = slide.comp && !fusion.validate(slide.comp) ? slide.comp : null;
  const st = [`[0:v]scale=${W}:${Hh}:force_original_aspect_ratio=decrease,pad=${W}:${Hh}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[b]`, ...g.stmts, ...(comp ? fusion.compile(comp, 'c', 'v', ctx, 'n') : ['[c]null[v]'])];
  const pre = slide.type === 'video' ? ['-ss', String((+slide.trimStart || 0) + 0.5)] : [];
  await ffm.run([...pre, '-i', slide.src, '-filter_complex', st.join(';'), '-map', '[v]', '-frames:v', '1', out]);
  const d = 'data:image/png;base64,' + fs.readFileSync(out).toString('base64'); try { fs.unlinkSync(out); } catch (_) {} return d;
});

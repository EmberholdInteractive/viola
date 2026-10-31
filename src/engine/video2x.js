// Video2X-Anbindung (Version 6.x, Kommandozeile): Fotos und Videos per KI hochskalieren.
// Befehlsformat laut docs.video2x.org:  video2x -i in -o out -f realesrgan -r 4 -m realesr-animevideov3 [-g GPU] [-c codec] [-e key=value]
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const FILTERS = {
  realesrgan: { label: 'Real-ESRGAN (Fotos & Realfilm)', models: ['realesr-animevideov3', 'realesrgan-plus', 'realesrgan-plus-anime'], scales: [2, 3, 4], useModel: true },
  realcugan:  { label: 'Real-CUGAN (Anime/Zeichentrick)', models: ['models-se', 'models-pro', 'models-nose'], scales: [2, 3, 4], useModel: true },
  libplacebo: { label: 'Anime4K / libplacebo (sehr schnell)', models: ['anime4k-v4-a', 'anime4k-v4-a+a', 'anime4k-v4-b', 'anime4k-v4-c'], scales: [], useModel: false },
};

function candidates() {
  const c = ['video2x'];
  if (process.platform === 'win32') {
    const la = process.env.LOCALAPPDATA, pf = process.env.ProgramFiles;
    if (la) c.push(path.join(la, 'Programs', 'video2x', 'video2x.exe'), path.join(la, 'Programs', 'Video2X', 'video2x.exe'));
    if (pf) c.push(path.join(pf, 'Video2X', 'video2x.exe'), path.join(pf, 'video2x', 'video2x.exe'));
  }
  return c;
}
function detect(custom) {
  for (const exe of [custom, ...candidates()].filter(Boolean)) {
    try { if (path.isAbsolute(exe) && !fs.existsSync(exe)) continue; const r = spawnSync(exe, ['--version'], { encoding: 'utf8', timeout: 8000 }); if (!r.error && (r.status === 0 || (r.stdout || r.stderr))) return { found: true, exe, version: ((r.stdout || r.stderr) || '').trim().split('\n')[0] }; } catch (_) {}
  }
  return { found: false, exe: null };
}

// o: {filter, model, scale, width, height, gpu, codec, crf, extra:[]}
function buildArgs(input, output, o = {}) {
  const f = o.filter || 'realesrgan';
  const a = ['-i', input, '-o', output, '-f', f];
  if (f === 'libplacebo') {
    a.push('-s', o.model || 'anime4k-v4-a+a', '-w', String(o.width || 3840), '-h', String(o.height || 2160));
  } else {
    a.push('-r', String(o.scale || 4)); if (o.model) a.push('-m', o.model);
  }
  if (o.gpu != null && o.gpu !== '') a.push('-g', String(o.gpu));
  const isVideo = /\.(mp4|mkv|mov|avi|webm|mts|3gp)$/i.test(input);
  if (isVideo) { if (o.codec) a.push('-c', o.codec); if (o.crf != null) a.push('-e', 'crf=' + o.crf); }
  (o.extra || []).forEach(e => a.push('-e', e));
  return a;
}

function cacheName(input, o) {
  const st = fs.statSync(input);
  const h = crypto.createHash('sha1').update([input, st.size, st.mtimeMs, o.filter, o.model, o.scale, o.width, o.height].join('|')).digest('hex').slice(0, 16);
  return h + path.extname(input).toLowerCase().replace(/\.(jpeg|bmp|webp|tiff?)$/, '.png');
}

function runOne(exe, input, output, o, { onLine, signal } = {}) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const tmpOut = output.replace(/(\.[^.]+)$/, '.part$1');
    const p = spawn(exe, buildArgs(input, tmpOut, o));
    let log = '';
    const feed = d => { const s = d.toString(); log += s; if (log.length > 8000) log = log.slice(-4000); if (onLine) { const m = s.match(/(\d{1,3}(?:\.\d+)?)\s*%/g); onLine({ text: s.trim().split(/\r|\n/).pop(), percent: m ? parseFloat(m[m.length - 1]) : null }); } };
    p.stdout.on('data', feed); p.stderr.on('data', feed);
    const abort = () => { p.kill(); reject(new Error('abgebrochen')); };
    if (signal) signal.addEventListener('abort', abort, { once: true });
    p.on('error', e => reject(new Error('Video2X konnte nicht gestartet werden: ' + e.message)));
    p.on('close', c => { if (signal) signal.removeEventListener('abort', abort); if (c === 0 && fs.existsSync(tmpOut)) { fs.renameSync(tmpOut, output); resolve(output); } else reject(new Error('Video2X Fehler (' + c + '): ' + log.slice(-500))); });
  });
}

// Warteschlange: items [{path}] -> Ergebnis-Map orig -> hochskalierte Datei. Bereits hochskalierte Dateien (Cache) werden übersprungen.
async function upscaleQueue(items, o, { exe, cacheDir, onItem, signal } = {}) {
  cacheDir = cacheDir || path.join(os.homedir(), 'Viola', 'upscaled');
  const map = {}; let i = 0;
  for (const it of items) {
    if (signal && signal.aborted) throw new Error('abgebrochen');
    const out = path.join(cacheDir, cacheName(it.path, o));
    onItem && onItem({ index: i, total: items.length, input: it.path, state: fs.existsSync(out) ? 'cached' : 'running', percent: 0 });
    if (!fs.existsSync(out)) {
      try { await runOne(exe, it.path, out, o, { signal, onLine: l => onItem && onItem({ index: i, total: items.length, input: it.path, state: 'running', percent: l.percent, text: l.text }) }); }
      catch (e) { if (e.message === 'abgebrochen') throw e; onItem && onItem({ index: i, total: items.length, input: it.path, state: 'error', error: e.message }); i++; continue; }
    }
    map[it.path] = out; onItem && onItem({ index: i, total: items.length, input: it.path, state: 'done', output: out, percent: 100 }); i++;
  }
  return map;
}

// Ersetzt in einem Projekt die Quellen durch hochskalierte Dateien
function applyUpscaled(project, map) {
  const copy = JSON.parse(JSON.stringify(project));
  (copy.slides || []).forEach(s => { if (s.src && map[s.src]) { s.origSrc = s.src; s.src = map[s.src]; } });
  return copy;
}

module.exports = { FILTERS, detect, buildArgs, upscaleQueue, applyUpscaled, runOne, cacheName };

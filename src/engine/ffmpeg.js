// Dünne Hülle um FFmpeg/FFprobe: Pfade finden, Prozesse starten, Fortschritt lesen.
const { spawn, spawnSync } = require('child_process');
const fixAsar = p => (p ? p.replace('app.asar' + require('path').sep, 'app.asar.unpacked' + require('path').sep) : p);
let FFMPEG = 'ffmpeg', FFPROBE = 'ffprobe';
try { const p = require('ffmpeg-static'); if (p) FFMPEG = fixAsar(p); } catch (_) {}
try { const p = require('ffprobe-static'); if (p && p.path) FFPROBE = fixAsar(p.path); } catch (_) {}

function setBinaries({ ffmpeg, ffprobe } = {}) { if (ffmpeg) FFMPEG = ffmpeg; if (ffprobe) FFPROBE = ffprobe; }
function binaries() { return { ffmpeg: FFMPEG, ffprobe: FFPROBE }; }

function run(args, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) return reject(new Error('abgebrochen'));
    const p = spawn(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-nostats', '-progress', 'pipe:1', ...args]);
    let err = '', buf = '';
    p.stderr.on('data', d => { err += d; if (err.length > 20000) err = err.slice(-10000); });
    p.stdout.on('data', d => {
      buf += d; let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (onProgress && l.startsWith('out_time_us=')) { const v = parseInt(l.slice(12), 10); if (v >= 0) onProgress(v / 1e6); }
      }
    });
    const onAbort = () => { p.kill('SIGKILL'); reject(new Error('abgebrochen')); };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    p.on('error', e => reject(new Error('FFmpeg konnte nicht gestartet werden: ' + e.message)));
    p.on('close', c => { if (signal) signal.removeEventListener('abort', onAbort); c === 0 ? resolve() : reject(new Error('FFmpeg-Fehler (' + c + '): ' + err.slice(-900))); });
  });
}

function probe(file) {
  const r = spawnSync(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { encoding: 'utf8', maxBuffer: 1e7 });
  if (r.status !== 0) throw new Error('ffprobe fehlgeschlagen für ' + file + ': ' + (r.stderr || r.error));
  return JSON.parse(r.stdout);
}
function duration(file) { const j = probe(file); return parseFloat(j.format.duration) || 0; }
function hasAudio(file) { return probe(file).streams.some(s => s.codec_type === 'audio'); }
let _tr = null, _trFor = null;
function supportedTransitions(candidates) {
  if (_tr && _trFor === FFMPEG) return candidates ? candidates.filter(c => _tr.has(c)) : [..._tr];
  const r = spawnSync(FFMPEG, ['-hide_banner', '-h', 'filter=xfade'], { encoding: 'utf8' });
  const txt = (r.stdout || '') + (r.stderr || ''); _tr = new Set(['fade']); _trFor = FFMPEG;
  (candidates || ['fade', 'dissolve', 'fadeblack', 'wipeleft', 'wiperight', 'slideleft', 'slideright', 'circleopen', 'radial', 'smoothleft', 'zoomin', 'pixelize']).forEach(c => { if (new RegExp('(^|\\s)' + c + '(\\s|$)', 'm').test(txt)) _tr.add(c); });
  return candidates ? candidates.filter(c => _tr.has(c)) : [..._tr];
}
let _fl = null, _flFor = null;
function supportedFilters(names) {
  if (!_fl || _flFor !== FFMPEG) { const r = spawnSync(FFMPEG, ['-hide_banner', '-filters'], { encoding: 'utf8' }); _fl = (r.stdout || ''); _flFor = FFMPEG; }
  return names.filter(n => new RegExp('\\s' + n + '\\s').test(_fl));
}
const posix = p => p.replace(/\\/g, '/');
const concatLine = p => "file '" + posix(p).replace(/'/g, "'\\''") + "'\n";

module.exports = { supportedFilters, supportedTransitions, run, probe, duration, hasAudio, setBinaries, binaries, posix, concatLine };

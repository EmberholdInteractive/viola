'use strict';
// Analyse: Szenenwechsel, Stille, Scopes (Waveform, Histogramm, Vectorscope) – alles über FFmpeg.
const { spawnSync } = require('child_process');
const fs = require('fs');
const ff = require('./ffmpeg');
const run = args => { const r = spawnSync(ff.binaries().ffmpeg, ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 5e7 }); return (r.stderr || '') + (r.stdout || ''); };

// Zeitpunkte (s), an denen eine neue Szene beginnt
function scenes(file, threshold = 0.3, minGap = 0.5) {
  const t = Math.max(0.05, Math.min(0.95, threshold));
  const out = run(['-i', file, '-an', '-vf', `select='gt(scene,${t})',showinfo`, '-f', 'null', '-']);
  const times = [...out.matchAll(/pts_time:([\d.]+)/g)].map(m => parseFloat(m[1])).filter(Number.isFinite);
  const res = []; for (const x of times) if (!res.length || x - res[res.length - 1] >= minGap) res.push(x);
  return res;
}
// Stille Abschnitte [{start,end}] und die lauten dazwischen
function silence(file, { db = -35, minDur = 0.6 } = {}) {
  const dur = ff.duration(file); const out = run(['-i', file, '-vn', '-af', `silencedetect=noise=${db}dB:d=${minDur}`, '-f', 'null', '-']);
  const quiet = []; let st = null;
  for (const l of out.split('\n')) { let m = /silence_start: (-?[\d.]+)/.exec(l); if (m) st = Math.max(0, parseFloat(m[1])); m = /silence_end: ([\d.]+)/.exec(l); if (m && st != null) { quiet.push({ start: st, end: parseFloat(m[1]) }); st = null; } }
  if (st != null) quiet.push({ start: st, end: dur });
  const loud = []; let c = 0; for (const q of quiet) { if (q.start - c > 0.15) loud.push({ start: c, end: q.start }); c = q.end; } if (dur - c > 0.15) loud.push({ start: c, end: dur });
  return { duration: dur, quiet, loud };
}
// Ein Bild mit Messdarstellung (PNG) – kind: waveform | histogram | vectorscope
const SCOPES = { waveform: 'format=yuv444p,waveform=mode=column:intensity=0.2:graticule=green:scale=digital,scale=640:360', histogram: 'format=yuv444p,histogram=level_height=200:levels_mode=logarithmic,scale=640:360', vectorscope: 'format=yuv444p,vectorscope=mode=color3:graticule=green:intensity=0.015,scale=360:360' };
function scope(file, t, kind, outPng) {
  if (!SCOPES[kind]) throw new Error('Unbekanntes Scope: ' + kind);
  const isImg = /\.(jpe?g|png|webp|bmp|tiff?)$/i.test(file);
  run([...(isImg ? [] : ['-ss', String(Math.max(0, t || 0))]), '-i', file, '-frames:v', '1', '-vf', SCOPES[kind], '-y', outPng]);
  if (!fs.existsSync(outPng)) throw new Error('Scope konnte nicht erzeugt werden'); return outPng;
}
// Pegel (Spitze in dB) alle 'step' Sekunden – für die Mixer-Anzeige
function levels(file, step = 0.1, maxSec = 3600) {
  const n = Math.max(480, Math.round(48000 * step));
  const r = require('child_process').spawnSync(ff.binaries().ffmpeg, ['-hide_banner', '-v', 'error', '-t', String(maxSec), '-i', file, '-vn', '-ac', '1', '-ar', '48000', '-af', `asetnsamples=n=${n}:p=0,astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.Peak_level:file=-`, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const out = []; String(r.stdout || '').split('\n').forEach(l => { const m = l.match(/Peak_level=(-?[\d.]+|-inf|inf)/); if (m) out.push(m[1] === '-inf' ? -90 : Math.max(-90, Math.min(6, +m[1]))); });
  return { step, db: out };
}
module.exports = { scenes, silence, scope, SCOPES, levels };

'use strict';
// Mehrkamera: Synchronisation über den Ton (Kreuzkorrelation per FFT) und Schnittplan aus Kamerawechseln.
const { spawn } = require('child_process');
const ff = require('./ffmpeg');
const RATE = 4000;

function pcm(file, seconds) {
  return new Promise((res, rej) => {
    const p = spawn(ff.binaries().ffmpeg, ['-hide_banner', '-v', 'error', '-t', String(seconds), '-i', file, '-vn', '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-']);
    const ch = []; p.stdout.on('data', c => ch.push(c)); p.on('error', rej);
    p.on('close', () => { const b = Buffer.concat(ch); if (b.length < 8) return rej(new Error('Kein Ton in ' + file)); const n = Math.floor(b.length / 4); const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = b.readFloatLE(i * 4); res(a); });
  });
}
function fft(re, im, inv) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) { const ang = 2 * Math.PI / len * (inv ? -1 : 1), wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const a = i + k, b = a + len / 2; const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr; re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
const norm = a => { let m = 0; for (const v of a) m += v; m /= a.length; const o = new Float32Array(a.length); let e = 0; for (let i = 0; i < a.length; i++) { o[i] = a[i] - m; e += o[i] * o[i]; } e = Math.sqrt(e / a.length) || 1; for (let i = 0; i < o.length; i++) o[i] /= e; return o; };
// Verschiebung in Sekunden: Zeit in b, die der Zeit 0 von a entspricht (negativ, wenn b später beginnt)
function lag(a, b, maxSec) {
  a = norm(a); b = norm(b); let n = 1; while (n < a.length + b.length) n <<= 1;
  const ar = new Float64Array(n), ai = new Float64Array(n), br = new Float64Array(n), bi = new Float64Array(n); ar.set(a); br.set(b);
  fft(ar, ai, false); fft(br, bi, false);
  for (let i = 0; i < n; i++) { const r = br[i] * ar[i] + bi[i] * ai[i], im = bi[i] * ar[i] - br[i] * ai[i]; ar[i] = r; ai[i] = im; }   // B · conj(A)
  fft(ar, ai, true);
  const maxL = Math.min(Math.round(maxSec * RATE), n >> 1); let best = -Infinity, bl = 0;
  for (let l = -maxL; l <= maxL; l++) { const v = ar[(l + n) % n]; if (v > best) { best = v; bl = l; } }
  return { offset: bl / RATE, score: best / Math.min(a.length, b.length) };
}
async function sync(files, { ref = 0, seconds = 180, maxLag = 60 } = {}) {
  const r = await pcm(files[ref], seconds); const out = [];
  for (let i = 0; i < files.length; i++) { if (i === ref) { out.push({ file: files[i], offset: 0, score: 1 }); continue; } const x = await pcm(files[i], seconds); const l = lag(r, x, maxLag); out.push({ file: files[i], offset: +l.offset.toFixed(3), score: +l.score.toFixed(3) }); }
  return out;
}
// cuts: [{ t, angle }] (Zeit auf der Referenzachse, Kamera-Index), total: Gesamtdauer. angles: [{ file, offset }]
function plan(cuts, angles, total) {
  const c = [...cuts].sort((a, b) => a.t - b.t); if (!c.length || c[0].t > 0) c.unshift({ t: 0, angle: c.length ? c[0].angle : 0 }); const slides = [];
  c.forEach((k, i) => { const end = i + 1 < c.length ? c[i + 1].t : total; const d = +(end - k.t).toFixed(3); if (d < 0.1) return; const a = angles[k.angle] || angles[0]; const ts = Math.max(0, +(k.t + a.offset).toFixed(3));
    const prev = slides[slides.length - 1]; if (prev && prev.src === a.file && Math.abs((prev.trimStart + prev.duration) - ts) < 0.05) { prev.duration = +(prev.duration + d).toFixed(3); return; }
    slides.push({ type: 'video', src: a.file, trimStart: ts, duration: d, multicam: true }); });
  return slides;
}
// Automatische Wechsel alle 'every' Sekunden (reihum) – schnelle Vorlage, die man danach von Hand ändern kann
function autoCuts(angleCount, total, every = 6) { const o = []; for (let t = 0, i = 0; t < total; t += every, i++) o.push({ t, angle: i % angleCount }); return o; }
module.exports = { sync, plan, autoCuts, lag, pcm };

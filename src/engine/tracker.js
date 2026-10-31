'use strict';
// Motion-Tracking per Block-Matching (SAD) auf kleinen Graustufen-Bildern. Liefert Pfad [{t, x, y, score}] (x,y = Mitte, 0..1).
const { spawn, spawnSync } = require('child_process');
const ff = require('./ffmpeg');

function dims(file) {
  const r = spawnSync(ff.binaries().ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', file], { encoding: 'utf8' });
  const m = String(r.stdout).trim().match(/^(\d+)x(\d+)/); if (!m) throw new Error('Video nicht lesbar: ' + file); return { w: +m[1], h: +m[2] };
}
function grayFrames(file, t0, dur, fps, W, H) {
  return new Promise((res, rej) => {
    const p = spawn(ff.binaries().ffmpeg, ['-hide_banner', '-v', 'error', '-ss', String(t0), '-t', String(dur), '-i', file, '-an', '-vf', `fps=${fps},scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-']);
    const chunks = []; let err = ''; p.stdout.on('data', c => chunks.push(c)); p.stderr.on('data', d => { err += d; });
    p.on('close', c => { const buf = Buffer.concat(chunks); const n = Math.floor(buf.length / (W * H)); if (c !== 0 && !n) return rej(new Error('Tracking: ' + err.slice(-200))); res(Array.from({ length: n }, (_, i) => buf.subarray(i * W * H, (i + 1) * W * H))); });
    p.on('error', rej);
  });
}
// box = { x, y, w, h } Mitte und Größe als Anteil (0..1) im ersten Bild (bei t0)
async function track(file, { t0 = 0, duration = 5, box, fps = 15, width = 320, search = 0.12, update = 0.02 } = {}) {
  const d = dims(file); const W = width, H = Math.max(16, Math.round(width * d.h / d.w / 2) * 2);
  const frames = await grayFrames(file, t0, duration, fps, W, H); if (frames.length < 2) throw new Error('Zu wenige Bilder zum Tracken');
  const bw = Math.max(8, Math.round(box.w * W)), bh = Math.max(8, Math.round(box.h * H)); const R = Math.max(6, Math.round(search * W));
  let cx = Math.round(box.x * W), cy = Math.round(box.y * H);
  const clampX = v => Math.max(bw >> 1, Math.min(W - (bw >> 1) - 1, v)), clampY = v => Math.max(bh >> 1, Math.min(H - (bh >> 1) - 1, v)); cx = clampX(cx); cy = clampY(cy);
  const cut = (f, x, y) => { const t = new Float32Array(bw * bh); for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) t[j * bw + i] = f[(y - (bh >> 1) + j) * W + (x - (bw >> 1) + i)]; return t; };
  let tpl = cut(frames[0], cx, cy); const path = [{ t: 0, x: cx / W, y: cy / H, score: 0 }];
  for (let k = 1; k < frames.length; k++) {
    const f = frames[k]; let best = Infinity, bx = cx, by = cy;
    for (let dy = -R; dy <= R; dy++) { const y = cy + dy; if (y < (bh >> 1) || y > H - (bh >> 1) - 1) continue;
      for (let dx = -R; dx <= R; dx++) { const x = cx + dx; if (x < (bw >> 1) || x > W - (bw >> 1) - 1) continue; let s = 0;
        for (let j = 0; j < bh && s < best; j += 1) { const row = (y - (bh >> 1) + j) * W + (x - (bw >> 1)); const tr = j * bw; for (let i = 0; i < bw; i += 1) s += Math.abs(f[row + i] - tpl[tr + i]); }
        if (s < best) { best = s; bx = x; by = y; } } }
    cx = bx; cy = by; const nt = cut(f, cx, cy); for (let i = 0; i < tpl.length; i++) tpl[i] = tpl[i] * (1 - update) + nt[i] * update;
    path.push({ t: k / fps, x: cx / W, y: cy / H, score: best / (bw * bh) });
  }
  return path;
}
// Ausdruck für ffmpeg: stückweise linear über t (Sekunden relativ zum Pfadstart); key = 'x' | 'y'
function pathExpr(path, key, tvar = 't', add = 0) {
  const p = path.filter(q => isFinite(q.t) && isFinite(q[key])); if (!p.length) return '0.5'; const f = n => (+n).toFixed(5);
  let e = f(p[p.length - 1][key] + add);
  for (let i = p.length - 2; i >= 0; i--) { const a = p[i], b = p[i + 1]; const dt = Math.max(1e-6, b.t - a.t); e = `if(lt(${tvar},${f(b.t)}),${f(a[key] + add)}+(${f(b[key] - a[key])})*(${tvar}-${f(a.t)})/${f(dt)},${e})`; }
  return e;
}
// Pfad ausdünnen (maximal n Punkte), damit Ausdrücke kurz bleiben
function thin(path, n = 40) { if (path.length <= n) return path; const out = []; for (let i = 0; i < n; i++) out.push(path[Math.round(i * (path.length - 1) / (n - 1))]); return out; }
module.exports = { track, pathExpr, thin };

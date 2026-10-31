'use strict';
// Overlay-Spuren (V2, V3, …): Titel, Bilder, Videos und 3D-Szenen, die zeitgenau über der Hauptspur liegen.
// Overlay: { id, track (1..), type: 'title'|'photo'|'video'|'scene3d', text, src, start (s), duration (s), x, y (0..1, Mitte), w (Anteil der Breite 0.05..1),
//            opacity (0..1), fadeIn, fadeOut (s), color, size (Anteil der Höhe), trimStart,
//            blend: 'normal'|'screen'|'multiply'|…, path: [{t (s ab Overlay-Start), x, y}] (Tracking: Position folgt dem Pfad),
//            seq: 'ordner/f%05d.png' + fps (3D-Bildfolge, type 'scene3d') }
const fs = require('fs'), path = require('path');
const sharp = require('sharp');
const ff = require('./ffmpeg');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const clamp = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };
// Mischmodi: ffmpeg-Name und neutrale Farbe (verändert das Bild dort nicht, wo das Overlay nichts zeichnet)
const BLEND = { normal: null, screen: ['screen', 'black'], add: ['addition', 'black'], lighten: ['lighten', 'black'], difference: ['difference', 'black'], multiply: ['multiply', 'white'], darken: ['darken', 'white'], overlay: ['overlay', '0x808080'], softlight: ['softlight', '0x808080'], hardlight: ['hardlight', '0x808080'] };
const TYPES = ['title', 'photo', 'video', 'scene3d'];

function normalize(o) {
  const t = TYPES.includes(o.type) ? o.type : 'title';
  const path_ = Array.isArray(o.path) ? o.path.map(p => ({ t: Number(p.t), x: Number(p.x), y: Number(p.y) })).filter(p => [p.t, p.x, p.y].every(Number.isFinite)).sort((a, b) => a.t - b.t).slice(0, 400) : [];
  return { id: o.id, track: Math.max(1, Math.round(o.track || 1)), type: t, text: String(o.text || ''), src: o.src, color: /^#[0-9a-f]{6}$/i.test(o.color || '') ? o.color : '#ffffff',
    start: clamp(o.start, 0, 86400, 0), duration: clamp(o.duration, 0.1, 3600, 3), x: clamp(o.x, 0, 1, 0.5), y: clamp(o.y, 0, 1, t === 'title' ? 0.85 : 0.5), w: clamp(o.w, 0.05, 1, t === 'title' ? 0.8 : (t === 'scene3d' ? 1 : 0.3)),
    opacity: clamp(o.opacity, 0, 1, 1), fadeIn: clamp(o.fadeIn, 0, 10, 0.4), fadeOut: clamp(o.fadeOut, 0, 10, 0.4), size: clamp(o.size, 0.02, 0.4, 0.08), trimStart: clamp(o.trimStart, 0, 86400, 0), subtitle: String(o.subtitle || ''),
    blend: Object.prototype.hasOwnProperty.call(BLEND, o.blend) ? o.blend : 'normal', path: path_, seq: o.seq ? String(o.seq) : '', fps: clamp(o.fps, 1, 120, 25) };
}
async function textPng(o, W, H, file) {
  const fs_ = Math.round(H * o.size); const lines = o.text.split('\n'); const h = Math.round(fs_ * (lines.length * 1.25 + 0.6)); const w = Math.round(W * o.w);
  const body = lines.map((l, i) => `<text x="50%" y="${Math.round(fs_ * (1.0 + i * 1.25))}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fs_}" font-weight="bold" fill="${o.color}" stroke="#000" stroke-opacity=".5" stroke-width="${Math.max(1, fs_ / 18)}" paint-order="stroke">${esc(l)}</text>`).join('');
  await sharp(Buffer.from(`<svg width="${w}" height="${h}">${body}</svg>`)).png().toFile(file); return file;
}
const f5 = n => (+n).toFixed(5);
// Ausdruck für eine Koordinate (Tracking-Pfad, Zeit ab Overlay-Start -> absolute Zeit)
function pathExpr(pth, key, start) {
  let e = f5(pth[pth.length - 1][key]);
  for (let i = pth.length - 2; i >= 0; i--) { const a = pth[i], b = pth[i + 1]; const dt = Math.max(1e-6, b.t - a.t); e = `if(lt(t,${f5(start + b.t)}),${f5(a[key])}+(${f5(b[key] - a[key])})*(t-${f5(start + a.t)})/${f5(dt)},${e})`; }
  return e;
}
const usable = o => (o.type === 'title' ? o.text : o.type === 'scene3d' ? (o.seq && fs.existsSync(o.seq.replace(/%0?\d*d/, '00000'))) : (o.src && fs.existsSync(o.src)));
async function apply(input, list, S, tmp, out, { signal } = {}) {
  const ovs = (list || []).map(normalize).filter(usable);
  if (!ovs.length) return input;
  ovs.sort((a, b) => a.track - b.track || a.start - b.start);
  const args = ['-i', input]; const fc = []; let last = '[0:v]'; const W = S.width, H = S.height, FPS = S.fps || 25; let idx = 0;
  for (let i = 0; i < ovs.length; i++) {
    const o = ovs[i]; let src = o.src, pre; const bl = BLEND[o.blend];
    if (o.type === 'title') { src = await textPng(o, W, H, path.join(tmp, `ov${i}.png`)); }
    if (o.type === 'video') pre = ['-ss', String(o.trimStart), '-t', o.duration.toFixed(3), '-i', src];
    else if (o.type === 'scene3d') pre = ['-framerate', String(o.fps), '-start_number', '0', '-t', o.duration.toFixed(3), '-i', o.seq];
    else pre = ['-loop', '1', '-framerate', String(FPS), '-t', o.duration.toFixed(3), '-i', src];
    args.push(...pre); idx++; const inIdx = idx;
    const fi = Math.min(o.fadeIn, o.duration / 2), fo = Math.min(o.fadeOut, o.duration / 2);
    let chain = `[${inIdx}:v]` + (o.type === 'title' ? '' : `scale=${Math.max(2, Math.round(W * o.w / 2) * 2)}:-2,`) + `format=rgba` + (o.opacity < 1 ? `,colorchannelmixer=aa=${o.opacity.toFixed(3)}` : '')
      + (fi > 0 ? `,fade=t=in:st=0:d=${fi.toFixed(3)}:alpha=1` : '') + (fo > 0 ? `,fade=t=out:st=${(o.duration - fo).toFixed(3)}:d=${fo.toFixed(3)}:alpha=1` : '') + `,setpts=PTS-STARTPTS+${o.start.toFixed(3)}/TB[o${i}]`;
    fc.push(chain);
    const e = (o.start + o.duration).toFixed(3);
    const xe = o.path.length ? pathExpr(o.path, 'x', o.start) : f5(o.x), ye = o.path.length ? pathExpr(o.path, 'y', o.start) : f5(o.y);
    const pos = `x='(${xe})*W-w/2':y='(${ye})*H-h/2'`;
    if (!bl) { fc.push(`${last}[o${i}]overlay=${pos}:enable='between(t,${o.start.toFixed(3)},${e})':eof_action=pass:format=auto[m${i}]`); }
    else {
      // Mischmodus: Overlay auf neutrale Fläche legen, dann mit blend verrechnen
      args.push('-f', 'lavfi', '-t', (o.start + o.duration + 0.5).toFixed(3), '-i', `color=c=${bl[1]}:s=${W}x${H}:r=${FPS}`); idx++;
      fc.push(`[${idx}:v]format=rgba[cv${i}]`, `[cv${i}][o${i}]overlay=${pos}:eof_action=pass:format=auto,format=yuv420p[cb${i}]`,
        `${last}format=yuv420p[lb${i}]`, `[lb${i}][cb${i}]blend=all_mode=${bl[0]}:enable='between(t,${o.start.toFixed(3)},${e})'[m${i}]`);
    }
    last = `[m${i}]`;
  }
  args.push('-filter_complex', fc.join(';'), '-map', last, '-map', '0:a?', '-c:v', 'libx264', '-crf', String(Math.max(12, Math.min(28, S.crf || 20))), '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', out);
  await ff.run(args, { signal }); return out;
}
module.exports = { normalize, apply, BLEND, pathExpr };

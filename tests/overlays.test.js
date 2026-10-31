const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const sharp = require('sharp'); const ff = require('../src/engine/ffmpeg'); const ov = require('../src/engine/overlays'); const { renderProject } = require('../src/engine/render');
const ok = m => console.log('OK  ', m);
(async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-'));
  const img = path.join(d, 'a.jpg'); await sharp({ create: { width: 640, height: 360, channels: 3, background: '#2a6' } }).jpeg().toFile(img);
  const logo = path.join(d, 'l.png'); await sharp({ create: { width: 200, height: 100, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.8 } } }).png().toFile(logo);
  const vid = path.join(d, 'v.mp4'); await ff.run(['-f', 'lavfi', '-i', 'testsrc2=duration=3:size=320x180:rate=25', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', vid]);
  const n = ov.normalize({ type: 'title', text: 'x', start: -5, duration: 99999, w: 7, opacity: 2, color: 'red;evil' }); assert(n.start === 0 && n.duration === 3600 && n.w === 1 && n.opacity === 1 && n.color === '#ffffff'); ok('Werte werden begrenzt, Farbe bereinigt');
  const base = { settings: { preset: 'klein', width: 320, height: 180, transitionDur: 0.5 }, slides: [{ type: 'photo', src: img, duration: 3 }, { type: 'photo', src: img, duration: 3 }] };
  const r0 = await renderProject(base, path.join(d, 'base.mp4'));
  const p = Object.assign({}, base, { overlays: [
    { type: 'title', text: 'Hallo\nWelt', start: 0.5, duration: 2, track: 2 },
    { type: 'photo', src: logo, start: 1, duration: 3, x: 0.9, y: 0.12, w: 0.2, opacity: 0.8 },
    { type: 'video', src: vid, start: 2, duration: 2, x: 0.25, y: 0.6, w: 0.3, track: 3 },
    { type: 'photo', src: '/nicht/da.png', start: 0, duration: 1 }] });
  const r = await renderProject(p, path.join(d, 'ov.mp4')); assert(Math.abs(r.duration - r0.duration) < 0.3, 'Länge bleibt gleich'); ok(`Titel, Bild und Video als Overlay (${r.duration.toFixed(1)} s, fehlende Datei übersprungen)`);
  // Pixelprobe: bei t=1.5 muss sich das Bild im Overlay-Video von der Basis unterscheiden
  const fa = path.join(d, 'a.png'), fb = path.join(d, 'b.png');
  await ff.run(['-ss', '1.5', '-i', r0.outFile, '-frames:v', '1', fa]); await ff.run(['-ss', '1.5', '-i', r.outFile, '-frames:v', '1', fb]);
  const A = await sharp(fa).raw().toBuffer(), B = await sharp(fb).raw().toBuffer(); let diff = 0; for (let i = 0; i < A.length; i++) if (Math.abs(A[i] - B[i]) > 20) diff++; assert(diff > 200, 'Overlay sichtbar: ' + diff);
  await ff.run(['-ss', '5.4', '-i', r0.outFile, '-frames:v', '1', fa]); await ff.run(['-ss', '5.4', '-i', r.outFile, '-frames:v', '1', fb]);
  const A2 = await sharp(fa).raw().toBuffer(), B2 = await sharp(fb).raw().toBuffer(); let d2 = 0; for (let i = 0; i < A2.length; i++) if (Math.abs(A2[i] - B2[i]) > 20) d2++; assert(d2 < 50, 'Nach dem Ende kein Overlay mehr: ' + d2); ok('Overlay erscheint zur richtigen Zeit und verschwindet wieder');
  console.log('\nOVERLAY-TESTS BESTANDEN');
})().catch(e => { console.log('FEHLER:', e.stack || e.message); process.exit(1); });

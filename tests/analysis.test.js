const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const ff = require('../src/engine/ffmpeg'); const an = require('../src/engine/analysis'); const fx = require('../src/engine/fx'); const { renderProject } = require('../src/engine/render'); const sharp = require('sharp');
const ok = m => console.log('OK  ', m);
(async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'an-'));
  const v = path.join(d, 'v.mp4');
  await ff.run(['-f', 'lavfi', '-i', 'color=c=red:s=320x180:r=25:d=2', '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=25:d=2', '-f', 'lavfi', '-i', 'sine=frequency=440:d=1', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono:d=2', '-f', 'lavfi', '-i', 'sine=frequency=440:d=1',
    '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v];[2:a][3:a][4:a]concat=n=3:v=0:a=1[a]', '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', v]);
  const sc = an.scenes(v); assert(sc.length === 1 && Math.abs(sc[0] - 2) < 0.2, JSON.stringify(sc)); ok('Szenenwechsel bei ' + sc[0].toFixed(2) + ' s erkannt');
  const si = an.silence(v, { db: -40, minDur: 0.5 }); assert(si.quiet.length === 1 && Math.abs(si.quiet[0].start - 1) < 0.2 && Math.abs(si.quiet[0].end - 3) < 0.25, JSON.stringify(si.quiet)); assert(si.loud.length === 2, JSON.stringify(si.loud)); ok('Stille erkannt: ' + si.quiet[0].start.toFixed(1) + '–' + si.quiet[0].end.toFixed(1) + ' s');
  for (const k of Object.keys(an.SCOPES)) { const f = an.scope(v, 1, k, path.join(d, k + '.png')); const m = await sharp(f).metadata(); assert(m.width > 100); } ok('Scopes: Waveform, Histogramm, Vectorscope');
  const sup = n => ff.supportedFilters(n);
  const stab = fx.create('FX.TRANSFORM.STABILIZE'); const key = fx.create('FX.KEY.CHROMA', { color: '0000ff', similarity: 0.3 });
  const green = path.join(d, 'g.mp4'); await ff.run(['-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=25:d=2', '-vf', 'drawbox=x=100:y=60:w=60:h=60:color=red:t=fill', '-pix_fmt', 'yuv420p', green]);
  const img = path.join(d, 'a.jpg'); await sharp({ create: { width: 320, height: 180, channels: 3, background: '#222' } }).jpeg().toFile(img);
  const r = await renderProject({ settings: { preset: 'klein', width: 320, height: 180, effects: [stab] }, slides: [{ type: 'video', src: green, duration: 2, effects: [key] }, { type: 'photo', src: img, duration: 2 }] }, path.join(d, 'o.mp4')); assert(r.duration > 2); ok('Stabilisieren und Chroma-Key im Render (' + r.duration.toFixed(1) + ' s)');
  const fa = path.join(d, 'f.png'); await ff.run(['-ss', '0.8', '-i', r.outFile, '-frames:v', '1', fa]); const raw = await sharp(fa).raw().toBuffer({ resolveWithObject: true }); const px = (x, y) => { const i = (y * raw.info.width + x) * raw.info.channels; return [raw.data[i], raw.data[i + 1], raw.data[i + 2]]; };
  const blue = px(20, 20), red = px(130, 90); assert(blue[2] < 80, 'Blau wurde ausgeblendet: ' + blue); assert(red[0] > 150, 'Rot bleibt: ' + red); ok('Keying entfernt Blau, Vordergrund bleibt');
  console.log('\nANALYSE-TESTS BESTANDEN');
})().catch(e => { console.log('FEHLER:', e.stack || e.message); process.exit(1); });

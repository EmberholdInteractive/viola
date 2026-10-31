// Selbsttest der Engine: erzeugt Testmaterial, rendert ein Projekt und prüft Länge, Audio, Beat-Sync, Duplikate, Video2X-Befehle.
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const sharp = require('sharp');
const ff = require('../src/engine/ffmpeg');
const { renderProject, projectDuration } = require('../src/engine/render');
const { analyzeBeats, snapToBeats } = require('../src/engine/beat');
const { findDuplicates } = require('../src/engine/dedupe');
const { groupByYearMonth, buildYearProject } = require('../src/engine/collage');
const v2x = require('../src/engine/video2x');
const { scanFolders } = require('../src/engine/scan');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-test-')); const ok = m => console.log('OK  ', m);
  // Testbilder
  const cols = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#16a085', '#d35400', '#2c3e50', '#7f8c8d', '#e84393', '#00b894', '#6c5ce7', '#fdcb6e', '#0984e3'];
  const photos = [];
  for (let i = 0; i < 14; i++) {
    const w = i % 5 === 0 ? 900 : 1600, h = i % 5 === 0 ? 1600 : 1000; const f = path.join(dir, `IMG_2019${String(1 + (i % 12)).padStart(2, '0')}15_${i}.jpg`);
    let seed = i * 7919 + 13; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; let rects = ''; for (let k = 0; k < 14; k++) rects += `<rect x="${rnd() * w * 0.8}" y="${rnd() * h * 0.8}" width="${40 + rnd() * w * 0.4}" height="${40 + rnd() * h * 0.4}" fill="hsl(${Math.floor(rnd() * 360)},70%,${25 + Math.floor(rnd() * 50)}%)"/>`;
    const svg = `<svg width="${w}" height="${h}"><rect width="100%" height="100%" fill="${cols[i]}"/>${rects}<text x="50%" y="${h / 2 + 30}" text-anchor="middle" font-size="90" fill="#fff">${i}</text></svg>`;
    await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toFile(f); photos.push(f);
  }
  const vid = path.join(dir, 'clip.mp4'); await ff.run(['-f', 'lavfi', '-i', 'testsrc=duration=4:size=640x360:rate=30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', vid]);
  const a1 = path.join(dir, 'a1.mp3'), a2 = path.join(dir, 'a2.mp3');
  await ff.run(['-f', 'lavfi', '-i', 'sine=frequency=220:duration=20', '-af', 'volume=0.2', a1]);
  await ff.run(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=20', '-af', 'volume=0.8', a2]);
  // Klick-Spur 120 BPM
  const click = path.join(dir, 'click.wav');
  await ff.run(['-f', 'lavfi', '-i', 'aevalsrc=0.9*sin(2*PI*1000*t)*lt(mod(t\\,0.5)\\,0.03):s=44100:d=40', click]);
  ok('Testmaterial erzeugt');

  // Beat-Erkennung
  const bt = await analyzeBeats(click); assert(Math.abs(bt.bpm - 120) < 1, 'BPM ' + bt.bpm); const off = bt.beats.slice(0, 60).map(b => Math.abs(b / 0.5 - Math.round(b / 0.5)) * 0.5); assert(Math.max(...off) < 0.06, 'Beat-Drift ' + Math.max(...off)); assert(bt.beats[bt.beats.length - 1] > 35); ok(`Beat-Erkennung: ${bt.bpm} BPM (erwartet 120)`);
  const slides0 = Array.from({ length: 8 }, (_, i) => ({ type: 'photo', src: photos[i], duration: 3.3 + (i % 3) * 0.4 }));
  const snapped = snapToBeats(slides0, bt.beats, { every: 2, transitionDur: 0.5 });
  let acc = 0; const F = 0.5; let maxErr = 0;
  for (let i = 0; i < snapped.length - 1; i++) { acc += snapped[i].duration; const mid = acc - (i + 1) * F + F / 2; const nearest = bt.beats.filter((_, k) => k % 2 === 0).reduce((p, c) => Math.abs(c - mid) < Math.abs(p - mid) ? c : p); maxErr = Math.max(maxErr, Math.abs(nearest - mid)); }
  assert(maxErr < 0.12, 'Beat-Snap Fehler ' + maxErr); ok(`Beat-Sync: Wechsel liegen auf dem Takt (max. Abweichung ${maxErr.toFixed(3)} s)`);

  // Duplikate
  fs.copyFileSync(photos[2], path.join(dir, 'kopie.jpg'));
  await sharp(photos[3]).resize(800).jpeg({ quality: 70 }).toFile(path.join(dir, 'klein.jpg'));
  const items = [...photos, path.join(dir, 'kopie.jpg'), path.join(dir, 'klein.jpg')].map(p => ({ path: p, size: fs.statSync(p).size, date: '2019-01-01' }));
  const dd = await findDuplicates(items); assert(dd.dropped.size === 2, 'Duplikate: ' + dd.dropped.size); ok('Duplikat-Suche: exakte Kopie + verkleinerte Version gefunden, 14 Originale behalten');

  // Scan + Collage
  const scanned = await scanFolders([dir]); const ph = scanned.filter(s => s.kind === 'photo');
  assert(ph.length >= 16); const gm = groupByYearMonth(scanned.map(s => Object.assign({}, s, { size: 200000 })));
  assert(gm.has(2019)); const proj = buildYearProject(2019, gm.get(2019), { photoSeconds: 2, audio: [{ src: a1 }, { src: a2 }] });
  assert(proj.slides.filter(s => s.type === 'title').length >= 2); ok(`Scan + Auto-Collage: ${proj.slides.length} Folien für 2019 geplant (Datum aus Dateiname)`);

  // Video2X-Befehle
  const A = v2x.buildArgs('a.mp4', 'b.mp4', { filter: 'realesrgan', scale: 4, model: 'realesr-animevideov3' }).join(' ');
  assert.strictEqual(A, '-i a.mp4 -o b.mp4 -f realesrgan -r 4 -m realesr-animevideov3');
  const B = v2x.buildArgs('a.mp4', 'b.mp4', { filter: 'libplacebo', model: 'anime4k-v4-a+a', width: 3840, height: 2160 }).join(' ');
  assert.strictEqual(B, '-i a.mp4 -o b.mp4 -f libplacebo -s anime4k-v4-a+a -w 3840 -h 2160'); ok('Video2X-Befehle entsprechen der Doku');

  // Render
  const slides = [{ type: 'title', text: '2019', subtitle: 'Test & "Umlaute" äöü', duration: 3 }];
  photos.slice(0, 6).forEach((p, i) => slides.push({ type: 'photo', src: p, duration: 3, transition: 'random', motion: ['none', 'zoomin', 'panleft', 'zoomout', 'panright', 'none'][i], caption: i === 1 ? 'Bildunterschrift' : undefined }));
  slides.push({ type: 'video', src: vid, duration: 3, trimStart: 0.5 });
  slides.push({ type: 'title', text: 'Mai', subtitle: '2019', duration: 3 });
  photos.slice(6, 14).forEach(p => slides.push({ type: 'photo', src: p, duration: 3 }));
  const project = { settings: { preset: 'klein', transitionDur: 0.5, chunk: 5, fps: 25, motion: 'none' }, slides, audio: [{ src: a1 }, { src: a2 }], music: { cross: 3, fadeOut: 3 } };
  const expect = projectDuration(project); const out = path.join(dir, 'out', 'test.mp4'); const prog = [];
  const r = await renderProject(project, out, { onProgress: p => prog.push(p.phase) });
  const j = ff.probe(out); const dur = parseFloat(j.format.duration);
  assert(Math.abs(dur - expect) < 0.8, `Länge ${dur} statt ${expect}`);
  assert(j.streams.some(s => s.codec_type === 'audio') && j.streams.some(s => s.codec_type === 'video'));
  const v = j.streams.find(s => s.codec_type === 'video'); assert.strictEqual(v.width, 1280);
  ok(`Render: ${r.slides} Folien, ${dur.toFixed(1)} s (erwartet ${expect.toFixed(1)} s), ${(fs.statSync(out).size / 1e6).toFixed(2)} MB, Audio vorhanden`);
  // Lautstärke-Angleichung: zwei Quellen mit sehr verschiedenem Pegel sollen ähnlich laut sein
  const lv = async f => { const { spawnSync } = require('child_process'); const x = spawnSync(ff.binaries().ffmpeg, ['-nostats', '-i', f, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' }); const m = x.stderr.match(/I:\s+(-?\d+\.\d) LUFS/g); return parseFloat(m[m.length - 1].replace(/[^\d.-]/g, '')); };
  const l = await lv(out); assert(l > -18 && l < -9, 'LUFS ' + l); ok(`Lautstärke normalisiert: ${l} LUFS`);
  // Abbruch
  const ctl = new AbortController(); setTimeout(() => ctl.abort(), 300);
  let aborted = false; try { await renderProject(project, path.join(dir, 'x.mp4'), { signal: ctl.signal }); } catch (e) { aborted = /abgebrochen/.test(e.message); }
  assert(aborted); ok('Abbrechen funktioniert');
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('\nALLE TESTS BESTANDEN');
})().catch(e => { console.error('FEHLER:', e.stack || e); process.exit(1); });

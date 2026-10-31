// Tests der neuen Funktionen: Looks/LUTs, Keyframes, Hochformat-Zuschnitt, Audio bereinigen, Proxy, Untertitel, Sprache, Presets/Codecs.
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const sharp = require('sharp');
const ff = require('../src/engine/ffmpeg');
const look = require('../src/engine/look');
const { keyframeExpr } = require('../src/engine/keyframes');
const reframe = require('../src/engine/reframe');
const { cleanAudio, cleanChain } = require('../src/engine/audioclean');
const proxy = require('../src/engine/proxy');
const subs = require('../src/engine/subtitles');
const { renderProject, PRESETS } = require('../src/engine/render');
const ok = m => console.log('OK  ', m);

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'viola-ft-'));
  const img = path.join(dir, 'a.jpg');
  await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#556' } }).composite([{ input: Buffer.from('<svg width="1600" height="900"><circle cx="1400" cy="420" r="150" fill="#ff2200"/><circle cx="1400" cy="420" r="60" fill="#ffee00"/></svg>') }]).jpeg().toFile(img);
  const vid = path.join(dir, 'v.mp4'); await ff.run(['-f', 'lavfi', '-i', 'testsrc=duration=3:size=640x360:rate=25', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', vid]);

  // Looks
  const luts = look.ensureBuiltinLuts(path.join(dir, 'luts')); assert(luts.length >= 6);
  assert(/LUT_3D_SIZE 17/.test(fs.readFileSync(luts[1].file, 'utf8')));
  for (const l of luts) await ff.run(['-i', vid, '-t', '0.5', '-vf', look.colorChain({ exposure: 0.2, contrast: 0.2, saturation: 0.3, temperature: 0.4 }, l.file), '-f', 'null', '-']);
  ok(`${luts.length} Looks als .cube erzeugt und mit ffmpeg angewendet`);

  // Keyframes
  const kx = keyframeExpr([{ t: 0, zoom: 1, x: 0.5, y: 0.5 }, { t: 0.5, zoom: 2, x: 0.8, y: 0.3 }, { t: 1, zoom: 1.2, x: 0.5, y: 0.5 }], 50, 0);
  await ff.run(['-loop', '1', '-framerate', '25', '-t', '2', '-i', img, '-vf', `scale=3200:1800,zoompan=z='${kx.z}':x='${kx.x}':y='${kx.y}':d=50:s=320x180:fps=25`, '-f', 'null', '-']);
  ok('Keyframe-Ausdrücke laufen in zoompan');

  // Hochformat-Zuschnitt
  const f = await reframe.focusPoint(img, 1080, 1920); assert(f.fx > 0.6, 'Fokus rechts erwartet, war ' + f.fx);
  const crop = path.join(dir, 'crop.mp4'); await ff.run(['-i', vid, '-vf', reframe.cropFilter(1080, 1920, f.fx, f.fy), '-frames:v', '5', crop]);
  const cs = ff.probe(crop).streams.find(s => s.codec_type === 'video'); assert.strictEqual(cs.width, 1080); assert.strictEqual(cs.height, 1920);
  ok(`Intelligenter Zuschnitt 9:16 (Fokus x=${f.fx.toFixed(2)})`);

  // Audio bereinigen
  const noisy = path.join(dir, 'noisy.wav');
  await ff.run(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-f', 'lavfi', '-i', 'anoisesrc=color=white:amplitude=0.05:duration=3', '-filter_complex', '[0:a]volume=0.3[a];[a][1:a]amix=inputs=2:normalize=0', noisy]);
  const clean = path.join(dir, 'clean.wav'); await cleanAudio(noisy, clean, { level: 'mittel' });
  const jc = ff.probe(clean); assert(jc.streams.some(s => s.codec_type === 'audio')); assert(Math.abs(parseFloat(jc.format.duration) - 3) < 0.3);
  assert(/afftdn/.test(cleanChain('stark')));
  ok('Audio bereinigen (Rauschen, Lautheit) läuft');

  // Proxy
  const pdir = path.join(dir, 'proxy'); const p1 = await proxy.makeProxy(vid, 'video', pdir); const p2 = await proxy.makeProxy(vid, 'video', pdir); assert.strictEqual(p1, p2);
  const p3 = await proxy.makeProxy(img, 'photo', pdir); assert((await sharp(p3).metadata()).height <= 540); assert(proxy.cacheSize(pdir) > 0);
  ok('Proxy-Dateien erzeugt und zwischengespeichert');

  // Untertitel
  const segs = [{ start: 0.5, end: 2.2, text: 'Hallo und willkommen zu unserem Urlaubsvideo aus dem Sommer' }, { start: 2.4, end: 2.9, text: 'Ende.' }];
  const srt = subs.toSrt(segs); const back = subs.parseSrt(srt); assert.strictEqual(back.length, 2); assert(Math.abs(back[0].start - 0.5) < 0.01); assert(/\n/.test(subs.wrap(segs[0].text, 30)));
  assert(subs.splitLong([{ start: 0, end: 20, text: 'a b c d e f g h i j k l' }]).length >= 3);
  if (subs.hasSubtitleFilter()) { const sf = path.join(dir, 's.srt'); fs.writeFileSync(sf, srt); const bo = path.join(dir, 'burn.mp4'); await subs.burnIn(vid, sf, bo); assert(ff.duration(bo) > 2.5); ok('Untertitel lesen, schreiben, einbrennen'); } else ok('Untertitel lesen/schreiben (ffmpeg ohne libass: Einbrennen übersprungen)');
  if (process.platform !== 'win32') {
    const fake = path.join(dir, 'whisper-fake.sh');
    fs.writeFileSync(fake, '#!/bin/sh\nwhile [ $# -gt 0 ]; do [ "$1" = "-of" ] && OF="$2"; shift; done\nprintf "1\\n00:00:00,000 --> 00:00:01,500\\nTest Satz eins\\n\\n2\\n00:00:01,600 --> 00:00:02,800\\nTest Satz zwei\\n" > "$OF.srt"\n', { mode: 0o755 });
    const got = await subs.transcribe(vid, { engine: 'cpp', exe: fake, model: 'x.bin', language: 'de' }); assert.strictEqual(got.length, 2); assert.strictEqual(got[1].text, 'Test Satz zwei');
    ok('Whisper-Anbindung (whisper.cpp-Aufruf) liefert Segmente');
  }

  // Presets, Codecs, Sprache, Untertitel im Render
  const slides = [{ type: 'title', text: 'Test', duration: 2 }, { type: 'photo', src: img, duration: 2, keyframes: [{ t: 0, zoom: 1 }, { t: 1, zoom: 1.5, x: 0.8 }], lut: luts[3].file, color: { saturation: 0.2 } }, { type: 'video', src: vid, duration: 2 }, { type: 'photo', src: img, duration: 2 }];
  const base = { slides, voice: [{ src: vid, start: 0.5, level: 'leicht' }], subtitles: { segments: segs } };
  const small = { transitionDur: 0.5, chunk: 3, fps: 25, width: 540, height: 960 };
  const r1 = await renderProject(Object.assign({ settings: Object.assign({ preset: 'reels' }, small) }, base), path.join(dir, 'reels.mp4'));
  const v1 = ff.probe(r1.outFile).streams.find(s => s.codec_type === 'video'); assert.strictEqual(v1.width, 540); assert.strictEqual(v1.height, 960); assert(ff.hasAudio(r1.outFile));
  ok('Reels-Preset (9:16, intelligenter Zuschnitt, Sprache, Untertitel, Look, Keyframes)');
  const r2 = await renderProject(Object.assign({ settings: Object.assign({ preset: 'hevc1080' }, small, { width: 640, height: 360 }) }, base), path.join(dir, 'hevc.mp4'));
  assert.strictEqual(ff.probe(r2.outFile).streams.find(s => s.codec_type === 'video').codec_name, 'hevc'); ok('H.265-Export');
  const r3 = await renderProject(Object.assign({ settings: Object.assign({ preset: 'prores' }, small, { width: 640, height: 360 }) }, base), path.join(dir, 'pro.mp4'));
  assert(/\.mov$/.test(r3.outFile)); assert.strictEqual(ff.probe(r3.outFile).streams.find(s => s.codec_type === 'video').codec_name, 'prores'); ok('ProRes-Export (.mov)');
  assert(Object.keys(PRESETS).length >= 10);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('\nALLE NEUEN TESTS BESTANDEN');
})().catch(e => { console.error('FEHLER:', e.stack || e); process.exit(1); });

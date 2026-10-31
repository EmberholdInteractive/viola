// Welle 1: Effektsystem, Audio-Effekte, Zeitwerkzeuge, Export-Parameter.
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const sharp = require('sharp');
const ff = require('../src/engine/ffmpeg');
const fx = require('../src/engine/fx'), afx = require('../src/engine/afx'), xo = require('../src/engine/exportopts');
const { renderProject } = require('../src/engine/render');
const ok = m => console.log('OK  ', m);

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'viola-w1-'));
  const vid = path.join(dir, 'v.mp4'); await ff.run(['-f', 'lavfi', '-i', 'testsrc2=duration=4:size=640x360:rate=25', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', vid]);
  const img = path.join(dir, 'a.jpg'); await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#4a6' } }).jpeg().toFile(img);
  const sup = n => ff.supportedFilters(n);

  // 1) Jeder Videoeffekt (Standardwerte und Grenzwerte, mit und ohne Mix)
  let ran = 0; const skipped = [], fails = [];
  for (const [id, d] of Object.entries(fx.FX)) {
    if (sup(d.needs).length !== d.needs.length) { skipped.push(id); continue; }
    const lo = {}, hi = {}; for (const [k, s] of Object.entries(d.params)) { if (s.min != null) { lo[k] = s.min; hi[k] = s.max; } }
    for (const [label, ef] of [['std', fx.create(id)], ['min', fx.create(id, lo)], ['max', fx.create(id, hi)], ['mix', Object.assign(fx.create(id), { mix: 0.5 })]]) {
      const g = fx.buildGraph([ef], 'b0', 'v0', { W: 640, H: 360, supported: sup }, 't');
      try { await ff.run(['-i', vid, '-t', '0.6', '-filter_complex', `[0:v]format=yuv420p[b0];${g.stmts.join(';')}`, '-map', '[v0]', '-f', 'null', '-']); ran++; }
      catch (e) { fails.push(`${id} (${label}): ${e.message.split('\n')[0]} | ${g.stmts.join(';').slice(0, 300)}`); }
    }
  }
  assert(!fails.length, 'Effekte schlagen fehl:\n' + fails.join('\n'));
  ok(`${Object.keys(fx.FX).length - skipped.length} Videoeffekte × 4 Varianten laufen (${ran} Läufe)${skipped.length ? '; ohne passenden Filter übersprungen: ' + skipped.join(', ') : ''}`);
  const v = fx.validate('FX.BLUR.GAUSSIAN', { radius: 99999 }); assert.strictEqual(v.radius, 200);
  assert(!/['\\;]/.test(fx.validate('FX.COLOR.CURVES', { master: "0/0 1/1';evil" }).master));
  const stack = fx.buildGraph([fx.create('FX.BLUR.GAUSSIAN'), Object.assign(fx.create('FX.ANALOG.GRAIN'), { bypass: true }), Object.assign(fx.create('FX.STYLIZE.SEPIA'), { enabled: false })], 'b0', 'v0', { W: 640, H: 360 }, 'u'); assert.strictEqual(stack.stmts.length, 1); ok('Bypass/Aus werden übersprungen, Werte begrenzt, Strings bereinigt');

  // 2) Audio-Effekte
  let aran = 0; const askipped = [], afails = [];
  for (const [id, d] of Object.entries(afx.AFX)) {
    if (sup(d.needs).length !== d.needs.length) { askipped.push(id); continue; }
    const c = afx.chain([afx.create(id)], sup).chain; try { await ff.run(['-f', 'lavfi', '-i', 'sine=frequency=300:duration=1.5', '-af', c, '-f', 'null', '-']); aran++; } catch (e) { afails.push(id + ': ' + e.message.split('\n')[0] + ' | ' + c); }
  }
  assert(!afails.length, 'Audio-Effekte schlagen fehl:\n' + afails.join('\n'));
  ok(`${aran} Audio-Effekte laufen${askipped.length ? '; übersprungen: ' + askipped.join(', ') : ''}`);

  // 3) Zeitwerkzeuge im Render (jede Variante muss genau 3 s ergeben)
  const variants = { 'Tempo 200 %': { speed: 200 }, 'Tempo 50 %': { speed: 50 }, 'Rückwärts': { reverse: true }, 'Ping-Pong': { pingpong: true }, 'Standbild am Ende': { freeze: 1 }, 'Speed Ramp 50→200': { rampFrom: 50, rampTo: 200 }, 'Loop': { loop: 2, trimStart: 2.5 } };
  for (const [name, t] of Object.entries(variants)) {
    const r = await renderProject({ settings: { preset: 'klein', width: 320, height: 180, transitionDur: 0.5 }, slides: [Object.assign({ type: 'video', src: vid, duration: 3 }, t)] }, path.join(dir, 'tw_' + Object.keys(variants).indexOf(name) + '.mp4'));
    assert(Math.abs(r.duration - 3) < 0.5, `${name}: ${r.duration}`);
  }
  ok('Tempo, Rückwärts, Ping-Pong, Standbild, Loop liefern die richtige Länge');

  // 4) Render mit Effekten (global + pro Folie), Sprecher- und Musik-Effekten
  const proj = { settings: { preset: 'klein', width: 320, height: 180, transitionDur: 0.5, chunk: 3, effects: [fx.create('FX.LIGHT.VIGNETTE')] },
    slides: [{ type: 'photo', src: img, duration: 2, effects: [fx.create('FX.ANALOG.VHS'), Object.assign(fx.create('FX.BLUR.GAUSSIAN'), { mix: 0.4 })] }, { type: 'video', src: vid, duration: 2, effects: [fx.create('FX.STYLIZE.PIXELATE')] }, { type: 'photo', src: img, duration: 2, effects: [fx.create('FX.LIGHT.GLOW')] }],
    audio: [{ src: vid, effects: [afx.create('AFX.FX.REVERB')] }], music: { cross: 1, effects: [afx.create('AFX.DYN.COMPRESSOR')] }, voice: [{ src: vid, start: 0.5, effects: [afx.create('AFX.EQ.HIGHPASS'), afx.create('AFX.DYN.GATE')] }] };
  const r = await renderProject(proj, path.join(dir, 'fx.mp4')); assert(ff.hasAudio(r.outFile)); ok(`Render mit Effekten auf Folien, global, Sprecher und Musik (${r.duration.toFixed(1)} s)`);

  // 5) Export-Parameter
  const base = { settings: { preset: 'klein', width: 320, height: 180, transitionDur: 0.5 }, slides: [{ type: 'photo', src: img, duration: 3 }, { type: 'video', src: vid, duration: 3 }] };
  const exp = async (name, e, extra) => renderProject(Object.assign({}, base, extra || {}, { export: e }), path.join(dir, name));
  const sv = r2 => ff.probe(r2.outFile).streams;
  let r1 = await exp('h264cbr.mp4', { codec: 'h264', rc: 'cbr', bitrate: 600, gop: 25, bframes: 2, profile: 'high' }); const br = parseInt(ff.probe(r1.outFile).format.bit_rate) / 1000; assert(br > 300 && br < 1500, 'CBR ' + br); ok(`H.264 CBR 600 kbit/s → ${br.toFixed(0)} kbit/s`);
  r1 = await exp('vp9.webm', { codec: 'vp9', container: 'webm', crf: 40 }, { audio: [{ src: vid }], music: { cross: 1 } }); assert(/\.webm$/.test(r1.outFile)); assert(sv(r1).some(s => s.codec_name === 'vp9') && sv(r1).some(s => s.codec_name === 'opus')); ok('VP9 + Opus in WebM');
  r1 = await exp('bad.webm', { codec: 'h264', container: 'webm' }); assert(!/\.webm$/.test(r1.outFile)); ok('Ungültige Kombination H.264 + WebM wird zu einem gültigen Container korrigiert (' + path.extname(r1.outFile) + ')');
  if (xo.encoders().has('libsvtav1') || xo.encoders().has('libaom-av1')) { r1 = await exp('av1.mkv', { codec: 'av1', container: 'mkv', crf: 45 }); assert(sv(r1).some(s => s.codec_name === 'av1')); ok('AV1 in MKV'); }
  r1 = await exp('dnx.mov', { codec: 'dnxhr', profile: 'sq' }); assert(sv(r1).some(s => s.codec_name === 'dnxhd')); ok('DNxHR in MOV');
  const segs = [{ start: 0.5, end: 2, text: 'Hallo Welt' }];
  r1 = await exp('subs.mkv', { codec: 'h264', container: 'mkv', embedSubs: true, sidecarSubs: true }, { subtitles: { segments: segs, burn: false } }); assert(sv(r1).some(s => s.codec_type === 'subtitle')); assert(fs.existsSync(r1.outFile.replace(/\.mkv$/, '.srt'))); ok('Untertitel eingebettet (MKV) und als SRT daneben gespeichert');
  const wm = path.join(dir, 'wm.png'); await sharp({ create: { width: 200, height: 80, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toFile(wm);
  r1 = await exp('wm.mp4', { codec: 'h264', watermark: { file: wm, pos: 'tr', scale: 0.2, opacity: 0.6 } }); assert(ff.duration(r1.outFile) > 4.5); ok('Wasserzeichen eingebrannt');
  const ra = await exp('aud.mp4', { codec: 'h264' }, { audio: [{ src: vid }], music: { cross: 1 } });
  await xo.exportAudioOnly(ra.outFile, path.join(dir, 'ton.wav'), { codec: 'wav' }); assert(ff.probe(path.join(dir, 'ton.wav')).streams[0].codec_name === 'pcm_s16le');
  await xo.exportAudioOnly(ra.outFile, path.join(dir, 'ton.flac'), { codec: 'flac', lufs: -16 });
  await xo.exportImageSequence(r1.outFile, path.join(dir, 'frames'), { format: 'jpg', every: 25 }); assert(fs.readdirSync(path.join(dir, 'frames')).length >= 3); ok('Nur Ton (WAV, FLAC) und Bildfolge (JPG)');
  console.log('hardware:', JSON.stringify(xo.hardwareAvailable()));
  fs.rmSync(dir, { recursive: true, force: true }); console.log('\nWELLE-1-TESTS BESTANDEN');
})().catch(e => { console.error('FEHLER:', e.stack || e); process.exit(1); });

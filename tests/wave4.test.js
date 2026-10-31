const assert = require('assert'), path = require('path'), os = require('os'), fs = require('fs'), cp = require('child_process');
const fxm = require('../src/engine/fx'), ff = require('../src/engine/ffmpeg'), thumb = require('../src/engine/fxthumb'), tw = require('../src/engine/timewarp');
const sc = require('../src/engine/subcheck'), an = require('../src/engine/analysis');
const { renderProject } = require('../src/engine/render');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w4-')); const ok = m => console.log('OK  ', m);
  const vid = path.join(dir, 'v.mp4'); cp.spawnSync(ff.binaries().ffmpeg, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=25:d=8', '-f', 'lavfi', '-i', 'sine=f=440:d=8', '-shortest', '-pix_fmt', 'yuv420p', vid]);
  // Time-Remap: Länge, Quellbedarf
  const p = tw.plan({ curve: [{ t: 0, speed: 100 }, { t: 0.5, speed: 200 }, { t: 1, speed: 50 }] }, 4);
  assert(p.speedPts.includes('sqrt') && p.speed > 1 && p.speed < 2, 'Kurvenplan'); ok('Time-Remap-Plan (Ø-Tempo ' + p.speed.toFixed(2) + ')');
  for (const [name, t] of Object.entries({ 'Remap 3 Punkte': { curve: [{ t: 0, speed: 100 }, { t: 0.5, speed: 300 }, { t: 1, speed: 50 }] }, 'Remap konstant': { curve: [{ t: 0, speed: 200 }, { t: 1, speed: 200 }] } })) {
    const r = await renderProject({ settings: { preset: 'klein', width: 320, height: 180, transitionDur: 0.5 }, slides: [Object.assign({ type: 'video', src: vid, duration: 3 }, t)] }, path.join(dir, name.replace(/\W/g, '') + '.mp4'));
    assert(Math.abs(r.duration - 3) < 0.5, name + ' ' + r.duration);
  } ok('Time-Remap rendert mit richtiger Länge');
  // HSL
  const t = await thumb.thumb('FX.COLOR.HSL', { hr: 40, sb: -0.5, lg: 0.3 }, dir); assert(t); ok('HSL nach Farbbereich rendert');
  // Pan
  const r = await renderProject({ settings: { preset: 'klein', width: 320, height: 180, transitionDur: 0.5 }, slides: [{ type: 'video', src: vid, duration: 3 }], audio: [{ src: vid, volume: 1, duration: 8, pan: -0.8 }], music: { cross: 1, normalize: false } }, path.join(dir, 'pan.mp4')); assert(r.duration > 2); ok('Pan pro Spur rendert');
  // Pegel
  const lv = an.levels(vid, 0.1); assert(lv.db.length > 60 && lv.db.some(x => x > -30), 'Pegel ' + lv.db.length); ok('Pegelverlauf (' + lv.db.length + ' Werte)');
  // Untertitel-Prüfung
  const iss = sc.check([{ t: 0, text: 'x'.repeat(60) }, { t: 0.5, text: 'a\nb\nc' }, { t: 2, text: 'Hallo Welt, das ist ein sehr langer Text mit vielen Zeichen drin' }, { t: 3, text: 'ok' }, { t: 12, text: 'spät' }]);
  const kinds = new Set(iss.map(i => i.kind)); ['zeichen', 'zeilen', 'tempo', 'kurz', 'lang'].forEach(k => assert(kinds.has(k), 'fehlt ' + k)); ok('Untertitel-Prüfung: ' + [...kinds].join(', '));
  // Versionen, Austausch
  const vd = path.join(dir, 'ver'); const f = sc.saveVersion(vd, { name: 'P', slides: [] }, 'Test'); assert(sc.listVersions(vd, 'P').length === 1 && sc.loadVersion(f).name === 'P'); ok('Versionsstände');
  const proj = { name: 'X', slides: [{ type: 'photo', src: 'C:\\a\\b.jpg', duration: 4 }, { type: 'title', text: 'Hi', duration: 2 }] };
  const x = sc.toFcpxml(proj); assert(x.includes('<fcpxml') && x.includes('asset-clip') && x.includes('b.jpg')); const o = JSON.parse(sc.toOtio(proj)); assert(o.tracks.children[0].children.length === 2); ok('FCPXML- und OTIO-Export');
  console.log('WELLE-4-TESTS BESTANDEN');
})().catch(e => { console.error('FEHLER', e); process.exit(1); });

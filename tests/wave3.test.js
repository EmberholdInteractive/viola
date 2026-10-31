const assert = require('assert'), path = require('path'), os = require('os'), fs = require('fs');
const fxm = require('../src/engine/fx'), ff = require('../src/engine/ffmpeg'), thumb = require('../src/engine/fxthumb'), cap = require('../src/engine/capture');
const { renderProject } = require('../src/engine/render');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w3-')); const ok = m => console.log('OK  ', m);
  const png = await thumb.thumb('FX.MASK.SHAPE', {}, dir); assert(png && fs.statSync(png).size > 200, 'Maske-Thumbnail'); ok('Maske (Ellipse) rendert');
  for (const p of [{ shape: 'rect', invert: true, outside: 'dark' }, { outside: 'bw', feather: 0 }]) { const t = await thumb.thumb('FX.MASK.SHAPE', p, dir); assert(t, 'Maske ' + JSON.stringify(p)); } ok('Maske: Rechteck, invertiert, Außerhalb-Varianten');
  const cat = fxm.catalog().filter(d => (d.needs || []).length === ff.supportedFilters(d.needs).length); let n = 0, bad = [];
  for (const d of cat) { const t = await thumb.thumb(d.id, {}, dir); t ? n++ : bad.push(d.id); } assert(!bad.length, 'Thumbnails fehlen: ' + bad); ok(n + ' Effekt-Vorschaubilder');
  assert(cap.args({ source: 'test' }, 'x.mp4').includes('lavfi')); assert(cap.args({}, 'x.mp4', 'win32').includes('gdigrab')); ok('Aufnahme-Argumente (gdigrab)');
  cap.start({ source: 'test', fps: 15 }, dir); await new Promise(r => setTimeout(r, 1500)); const r = await cap.stop(); assert(r.seconds > 1 && Math.abs(ff.duration(r.file) - r.seconds) < 1.5, 'Dauer ' + ff.duration(r.file)); ok('Aufnahme-Ablauf (Testquelle, ' + ff.duration(r.file).toFixed(1) + ' s)');
  console.log('WELLE-3-TESTS BESTANDEN');
})().catch(e => { console.error('FEHLER', e); process.exit(1); });

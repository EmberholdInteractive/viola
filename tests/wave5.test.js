const assert = require('assert'), path = require('path'), os = require('os'), fs = require('fs'), cp = require('child_process');
const fxm = require('../src/engine/fx'), ff = require('../src/engine/ffmpeg'), sharp = require('sharp');
const tracker = require('../src/engine/tracker'), mc = require('../src/engine/multicam'), aaf = require('../src/engine/aaf'), cap = require('../src/engine/capture'), fusion = require('../src/engine/fusion'), plugins = require('../src/engine/plugins'), buses = require('../src/engine/buses');
const ov = require('../src/engine/overlays'), afx = require('../src/engine/afx');
const { renderProject } = require('../src/engine/render');
const FF = () => ff.binaries().ffmpeg;
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w5-')); const ok = m => console.log('OK  ', m);
  const W = 320, H = 180;
  const vid = path.join(dir, 'v.mp4'); cp.spawnSync(FF(), ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=25:d=6', '-f', 'lavfi', '-i', 'sine=f=440:d=6', '-shortest', '-pix_fmt', 'yuv420p', vid]);
  // Einzelbild als Graustufen holen: wendet Effektliste auf vid an, Bild bei Zeit t
  function grab(effects, t, src = vid) {
    const g = fxm.buildGraph(effects, 'in', 'out', { W, H, supported: n => ff.supportedFilters(n) }, 'q');
    const fc = `[0:v]format=yuv420p[in];${g.stmts.join(';')};[out]scale=${W}:${H},format=gray[g]`;
    const r = cp.spawnSync(FF(), ['-y', '-v', 'error', '-i', src, '-filter_complex', fc, '-map', '[g]', '-ss', String(t), '-frames:v', '1', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 });
    assert(r.status === 0, 'ffmpeg: ' + String(r.stderr).slice(0, 400)); return r.stdout;
  }
  const px = (buf, x, y) => buf[y * W + x];
  const base0 = grab([], 0), base2 = grab([], 2);

  // ---- Tracking ----
  const mv = path.join(dir, 'mv.mp4'); cp.spawnSync(FF(), ['-y', '-v', 'error', '-filter_complex', "color=black:s=320x180:d=4:r=25[b];color=white:s=30x30:d=4:r=25[w];[b][w]overlay=x='20+60*t':y=80,format=yuv420p", '-t', '4', mv]);
  const tp = await tracker.track(mv, { t0: 0, duration: 3.5, box: { x: 35 / 320, y: 95 / 180, w: 0.12, h: 0.2 }, fps: 15 });
  const a = tp[2], z = tp[tp.length - 1]; assert(tp.length > 40, 'Pfadlänge ' + tp.length);
  const slope = (z.x - a.x) / (z.t - a.t); assert(Math.abs(slope - 60 / 320) < 0.03, 'Steigung ' + slope); assert(Math.abs(z.y - 95 / 180) < 0.04, 'y ' + z.y);
  ok('Motion-Tracking folgt dem Objekt (Steigung ' + slope.toFixed(3) + ' statt ' + (60 / 320).toFixed(3) + ')');
  const ex = tracker.pathExpr(tracker.thin(tp, 10), 'x', 't'); assert(ex.includes('if(lt(t,')); ok('Pfad-Ausdruck');

  // ---- Rotoskopie (animiertes Polygon) ----
  assert(px(base0, 100, 60) > 25 && px(base2, 100, 60) > 25, 'Testpixel zu dunkel: ' + px(base0, 100, 60));
  const roto = fxm.create('FX.MASK.POLYGON', { keys: '0 0.4 0.4 0.6 0.4 0.6 0.6 0.4 0.6|2 0.1 0.1 0.9 0.1 0.9 0.9 0.1 0.9', feather: 0, outside: 'black' });
  const r0 = grab([roto], 0), r2 = grab([roto], 2);
  assert(px(r0, 100, 60) < 15, 'außerhalb bei t=0: ' + px(r0, 100, 60)); assert(Math.abs(px(r0, 160, 90) - px(base0, 160, 90)) < 14, 'innen bei t=0');
  assert(Math.abs(px(r2, 100, 60) - px(base2, 100, 60)) < 14, 'innen bei t=2: ' + px(r2, 100, 60)); ok('Rotoskopie: Maske wächst von t=0 zu t=2');
  const inv = grab([fxm.create('FX.MASK.POLYGON', { keys: '0 0.4 0.4 0.6 0.4 0.6 0.6 0.4 0.6', feather: 0, invert: true, outside: 'black' })], 0); assert(px(inv, 160, 90) < 15 && Math.abs(px(inv, 100, 60) - px(base0, 100, 60)) < 14); ok('Rotoskopie invertiert');

  // ---- Delogo ----
  const dl = grab([fxm.create('FX.RESTORE.DELOGO', { x: 0.4, y: 0.4, w: 0.2, h: 0.2 })], 1), b1 = grab([], 1);
  let din = 0, dout = 0; for (let y = 82; y < 98; y++) for (let x = 130; x < 190; x++) din += Math.abs(px(dl, x, y) - px(b1, x, y)); for (let y = 5; y < 25; y++) for (let x = 5; x < 60; x++) dout += Math.abs(px(dl, x, y) - px(b1, x, y));
  assert(din / (16 * 60) > 0.8 && dout === 0, 'delogo innen ' + din / 960 + ' außen ' + dout); ok('Objekt/Logo entfernen verändert nur die Fläche');

  // ---- Perspektive ----
  const pe = grab([fxm.create('FX.TRANSFORM.PERSPECTIVE3D', { yaw: 35, pitch: 10 })], 1); let dd = 0; for (let k = 0; k < W * H; k++) dd += Math.abs(pe[k] - b1[k]); assert(dd / (W * H) > 12, 'Perspektive Unterschied ' + dd / (W * H)); ok('3D-Perspektive kippt das Bild');

  // ---- Overlays: Blend, Pfad, 3D-Bildfolge ----
  const png = path.join(dir, 'red.png'); await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toFile(png);
  const S = { width: W, height: H, fps: 25, crf: 24 };
  const seqDir = path.join(dir, 'seq'); fs.mkdirSync(seqDir); for (let i = 0; i < 25; i++) await sharp({ create: { width: 160, height: 90, channels: 4, background: { r: 0, g: 255, b: 0, alpha: i < 12 ? 1 : 0.5 } } }).png().toFile(path.join(seqDir, 'f' + String(i).padStart(5, '0') + '.png'));
  const rgb = (file, t) => { const r = cp.spawnSync(FF(), ['-y', '-v', 'error', '-i', file, '-ss', String(t), '-frames:v', '1', '-vf', `scale=${W}:${H}`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 }); return (x, y) => [r.stdout[(y * W + x) * 3], r.stdout[(y * W + x) * 3 + 1], r.stdout[(y * W + x) * 3 + 2]]; };
  const o1 = await ov.apply(vid, [{ type: 'photo', src: png, start: 1, duration: 3, x: 0.5, y: 0.5, w: 0.3, fadeIn: 0, fadeOut: 0, blend: 'screen' }], S, dir, path.join(dir, 'o1.mp4'));
  const c0 = rgb(vid, 2)(160, 90), c1 = rgb(o1, 2)(160, 90); assert(c1[0] >= 250 && c1[0] > c0[0], 'screen ' + c0 + ' -> ' + c1); ok('Mischmodus Screen');
  const o2 = await ov.apply(vid, [{ type: 'photo', src: png, start: 0, duration: 4, x: 0.2, y: 0.5, w: 0.2, fadeIn: 0, fadeOut: 0, path: [{ t: 0, x: 0.2, y: 0.5 }, { t: 4, x: 0.8, y: 0.5 }] }], S, dir, path.join(dir, 'o2.mp4'));
  const e1 = rgb(o2, 0.2), e2 = rgb(o2, 3.5); assert(e1(70, 90)[0] > 240 && e1(70, 90)[1] < 40, 'Pfad Start'); assert(e2(250, 90)[0] > 240 && e2(250, 90)[1] < 40 && !(e2(70, 90)[0] > 240 && e2(70, 90)[1] < 40), 'Pfad Ende'); ok('Overlay folgt Tracking-Pfad');
  const o3 = await ov.apply(vid, [{ type: 'scene3d', seq: path.join(seqDir, 'f%05d.png'), fps: 25, start: 1, duration: 1, x: 0.5, y: 0.5, w: 0.5, fadeIn: 0, fadeOut: 0 }], S, dir, path.join(dir, 'o3.mp4'));
  const g3 = rgb(o3, 1.2)(160, 90); assert(g3[1] > 200 && g3[0] < 90, '3D-Folge ' + g3); ok('3D-Bildfolge als Overlay');

  // ---- Busse / Sends ----
  const bs = buses.stmts('a', 'b', [{ bus: 'h', level: 0.5 }], [{ id: 'h', name: 'Hall', volume: 1, effects: [afx.create ? afx.create('AFX.FX.REVERB') : { id: 'AFX.FX.REVERB', params: {} }] }], e => afx.chain(e, n => ff.supportedFilters(n)).chain, 't');
  assert(bs.join(';').includes('asplit=2') && bs.join(';').includes('amix=inputs=2')); ok('Bus-Graph');
  const rb = await renderProject({ settings: { preset: 'klein', width: 320, height: 180, transitionDur: 0.5 }, slides: [{ type: 'video', src: vid, duration: 3 }], audio: [{ src: vid, volume: 1, duration: 6 }], music: { cross: 1, normalize: false },
    buses: [{ id: 'h', name: 'Hall', volume: 1, effects: [afx.create ? afx.create('AFX.FX.REVERB') : { id: 'AFX.FX.REVERB', params: {} }] }], sends: { music: [{ bus: 'h', level: 0.6 }] } }, path.join(dir, 'bus.mp4'));
  assert(Math.abs(rb.duration - 3) < 0.6 && ff.hasAudio(path.join(dir, 'bus.mp4'))); ok('Render mit Bus/Send');

  // ---- Fusion-Graph ----
  const comp = { nodes: [{ id: 'in', type: 'in' }, { id: 'f1', type: 'fx', fx: { id: 'FX.COLOR.HSL', params: {} } }, { id: 'f2', type: 'fx', fx: fxm.create('FX.TRANSFORM.FLIP', { h: true }) }, { id: 'm', type: 'merge', mode: 'screen', opacity: 0.5 }, { id: 'out', type: 'out' }],
    edges: [{ from: 'in', to: 'f2', port: 'in' }, { from: 'in', to: 'm', port: 'bg' }, { from: 'f2', to: 'm', port: 'fg' }, { from: 'm', to: 'out', port: 'in' }] };
  assert(fusion.validate(comp) === null, String(fusion.validate(comp)));
  const rf = await renderProject({ settings: { preset: 'klein', width: 320, height: 180, transitionDur: 0.5 }, slides: [{ type: 'video', src: vid, duration: 3, comp }] }, path.join(dir, 'fus.mp4')); assert(Math.abs(rf.duration - 3) < 0.6); ok('Fusion-Knotengraph rendert');
  const bad = JSON.parse(JSON.stringify(comp)); bad.edges.push({ from: 'out', to: 'in', port: 'in' }); assert(fusion.validate(bad), 'Zyklus'); ok('Fusion erkennt Zyklen');

  // ---- Plug-ins ----
  const pd = path.join(dir, 'plug'); fs.mkdirSync(pd); fs.writeFileSync(path.join(pd, 'p.json'), JSON.stringify({ id: 'PLUG.TEST.HUE', name: 'Test-Farbton', params: { h: { type: 'float', label: 'Farbton', def: 90, min: -180, max: 180, step: 1 } }, filter: 'hue=h={h}' }));
  fs.writeFileSync(path.join(pd, 'bad.json'), JSON.stringify({ id: 'kaputt', name: 'x', filter: 'null' }));
  const copy = {}; const rep = plugins.load(copy, [pd]); assert(rep.loaded.includes('PLUG.TEST.HUE') && rep.errors.length === 1); ok('Plug-ins laden (1 gut, 1 abgelehnt)');
  const rp = fxm.loadPlugins([pd]); assert(fxm.FX['PLUG.TEST.HUE']); const pg = grab([fxm.create('PLUG.TEST.HUE', { h: 120 })], 1); assert(pg.length === W * H); ok('Plug-in läuft im Filtergraph');

  // ---- Multicam ----
  const A = path.join(dir, 'A.wav'), B = path.join(dir, 'B.wav');
  cp.spawnSync(FF(), ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'anoisesrc=d=14:c=pink:r=16000:seed=7', '-ac', '1', A]);
  cp.spawnSync(FF(), ['-y', '-v', 'error', '-i', A, '-af', 'atrim=start=3,asetpts=PTS-STARTPTS', B]);
  const sy = await mc.sync([A, B], { seconds: 14, maxLag: 10 }); assert(Math.abs(sy[1].offset - (-3)) < 0.05 || Math.abs(sy[1].offset - 3) < 0.05, 'Versatz ' + sy[1].offset); ok('Multicam-Sync: Versatz ' + sy[1].offset + ' s (Güte ' + sy[1].score + ')');
  const pl = mc.plan([{ t: 0, angle: 0 }, { t: 4, angle: 1 }, { t: 8, angle: 0 }], sy.map(s => ({ file: s.file, offset: s.offset })), 12); assert(pl.length === 3 && pl[1].src === B && Math.abs(pl[0].duration - 4) < 0.01); ok('Multicam-Schnittplan (' + pl.length + ' Folien)');

  // ---- AAF ----
  if (aaf.available()) { const out = path.join(dir, 'x.aaf'); const r = await aaf.convert({ name: 'T', slides: [{ type: 'photo', src: png, duration: 2 }, { type: 'photo', src: png, duration: 3 }] }, out); assert(fs.existsSync(out) && fs.statSync(out).size > 500, JSON.stringify(r)); ok('AAF-Export (' + fs.statSync(out).size + ' Bytes)'); }
  else console.log('SKIP AAF (Python mit opentimelineio/aaf2 fehlt)');

  // ---- Aufnahme (Ton, Testquelle) ----
  const cd = path.join(dir, 'cap'); const t0 = Date.now(); const of = cap.start({ source: 'test', kind: 'audio' }, cd); await new Promise(r => setTimeout(r, 1800)); const cr = await cap.stop();
  assert(of.endsWith('.wav') && ff.duration(cr.file) > 0.8 && ff.duration(cr.file) < (Date.now() - t0) / 1000 + 0.5, 'Tonaufnahme ' + ff.duration(cr.file)); ok('Mikrofon-/Ton-Aufnahme (Testquelle ' + ff.duration(cr.file).toFixed(1) + ' s)');
  console.log('WELLE-5-TESTS BESTANDEN');
})().catch(e => { console.error('FEHLER', e); process.exit(1); });

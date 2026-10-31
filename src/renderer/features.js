'use strict';
// Viola – Erweiterungen der Oberfläche: Look/LUT, Farbe, Keyframes, Format-Vorschau, Proxy-Vorschau.
const lutId = f => (f ? String(f).split(/[\\/]/).pop().replace(/\.cube$/i, '') : '');
const CSS_LOOKS = {
  warm: 'sepia(.15) hue-rotate(-8deg) saturate(1.1)', kalt: 'hue-rotate(12deg) saturate(.95)', kino: 'contrast(1.15) saturate(1.15) hue-rotate(-6deg)',
  sw: 'grayscale(1) contrast(1.1)', vintage: 'sepia(.35) contrast(.9) brightness(1.05)', lebendig: 'saturate(1.4)',
};
function cssFilter(color, lut) {
  const c = color || {}; const f = [];
  if (c.exposure) f.push(`brightness(${(1 + c.exposure * 0.3).toFixed(2)})`);
  if (c.contrast) f.push(`contrast(${(1 + c.contrast * 0.6).toFixed(2)})`);
  if (c.saturation) f.push(`saturate(${(1 + c.saturation).toFixed(2)})`);
  if (c.temperature) f.push(`sepia(${Math.abs(c.temperature * 0.2).toFixed(2)}) hue-rotate(${(c.temperature > 0 ? -10 : 14) * Math.abs(c.temperature)}deg)`);
  if (lut && CSS_LOOKS[lutId(lut)]) f.push(CSS_LOOKS[lutId(lut)]);
  return f.length ? f.join(' ') : 'none';
}
// Vorschau: Seitenverhältnis des gewählten Formats und Look der Folie
const _drawSlide = drawSlide;
drawSlide = function (s, p, a) { const st = P().settings; cx.filter = s.type === 'title' ? 'none' : cssFilter(Object.assign({}, st.color, s.color), s.lut || st.lut); try { _drawSlide(s, p, a); } finally { cx.filter = 'none'; } };
const _drawPreview = drawPreview;
drawPreview = function () {
  const pr = (App.info.presets || {})[P().settings.preset] || {}; const W = P().settings.width || pr.width || 1280, H = P().settings.height || pr.height || 720; const a = W / H;
  const cw = a >= 1 ? 1280 : Math.round(720 * a), ch = a >= 1 ? Math.round(1280 / a) : 720;
  if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; cv.style.aspectRatio = `${W}/${H}`; }
  _drawPreview();
};

const range = (v, min, max, step, onchange) => el('input', { type: 'range', min, max, step, value: v == null ? 0 : v, onchange: e => onchange(parseFloat(e.target.value)) });
const COLORS = [['exposure', 'Belichtung'], ['contrast', 'Kontrast'], ['saturation', 'Sättigung'], ['temperature', 'Temperatur (kalt ↔ warm)']];

function lookControls(get, set) {
  const out = [];
  out.push(rowOf('Look (LUT)', el('div', { style: { display: 'flex', gap: '6px' } },
    sel([['', 'Kein Look'], ...App.looks.map(l => [l.file, l.label])], get('lut') || '', v => set('lut', v || undefined)),
    btn('+', async () => { const f = await App.api.invoke('looks:addCustom'); if (f.length) { App.looks = await App.api.invoke('looks:list'); renderAll(); toast(f.length + ' LUT(s) hinzugefügt'); } }, 'small')), 'Eigene .cube-Dateien (z. B. von DaVinci Resolve) mit „+"'));
  const col = get('color') || {};
  COLORS.forEach(([k, l]) => out.push(rowOf(l, range(col[k] || 0, -1, 1, 0.05, v => set('color', Object.assign({}, get('color') || {}, { [k]: v }))))));
  out.push(el('div', { class: 'row' }, btn('Farbe zurücksetzen', () => { set('color', undefined); set('lut', undefined); }, 'small')));
  return out;
}
const KF_PRESETS = {
  'Sanft heranzoomen': [{ t: 0, zoom: 1, x: 0.5, y: 0.5 }, { t: 1, zoom: 1.25, x: 0.5, y: 0.5 }],
  'Schwenk links nach rechts': [{ t: 0, zoom: 1.3, x: 0.3, y: 0.5 }, { t: 1, zoom: 1.3, x: 0.7, y: 0.5 }],
  'Heranzoomen und ausblenden zur Mitte': [{ t: 0, zoom: 1, x: 0.5, y: 0.5 }, { t: 0.6, zoom: 1.5, x: 0.6, y: 0.45 }, { t: 1, zoom: 1.4, x: 0.6, y: 0.45 }],
};
function keyframeEditor(s, each) {
  const list = s.keyframes || []; const box = el('div', { class: 'card' }, el('div', { class: 'muted', style: { color: '#d9c8ff', marginBottom: '6px' } }, 'Keyframes (Zoom und Schwenk)'));
  const upd = i => (k, scale) => v => { const n = list.map(x => Object.assign({}, x)); n[i][k] = v / (scale || 1); each('keyframes', n); };
  list.forEach((k, i) => box.append(el('div', { class: 'row', style: { gap: '4px' } },
    el('span', { class: 'hint', style: { flex: '0 0 18px' } }, i + 1),
    num(Math.round(k.t * 100), 5, 0, upd(i)('t', 100)), num(k.zoom, 0.05, 1, upd(i)('zoom')), num(Math.round((k.x == null ? 0.5 : k.x) * 100), 5, 0, upd(i)('x', 100)), num(Math.round((k.y == null ? 0.5 : k.y) * 100), 5, 0, upd(i)('y', 100)),
    btn('✕', () => each('keyframes', list.filter((_, j) => j !== i)), 'small'))));
  if (list.length) box.append(el('div', { class: 'hint' }, 'Spalten: Zeit % · Zoom · Mitte X % · Mitte Y %'));
  box.append(el('div', { class: 'row' }, btn('+ Keyframe', () => each('keyframes', [...list, { t: list.length ? 1 : 0, zoom: 1.2, x: 0.5, y: 0.5 }]), 'small'), list.length ? btn('Entfernen', () => each('keyframes', undefined), 'small') : null));
  box.append(sel([['', 'Vorlage wählen …'], ...Object.keys(KF_PRESETS).map(k => [k, k])], '', v => { if (v) each('keyframes', KF_PRESETS[v].map(k => Object.assign({}, k))); }));
  return box;
}
const _renderInspector = renderInspector;
renderInspector = function () {
  _renderInspector();
  const box = $('#inspector'); const sl = P().slides.filter(s => S().selected.has(s.id));
  if (!sl.length) {
    const st = P().settings; const get = k => st[k]; const set = (k, v) => { snap(); st[k] = v; renderAll(); };
    box.append(el('h2', { style: { marginTop: '18px' } }, 'Look (alle Folien)'), ...lookControls(get, set));
    return;
  }
  if (sl.every(s => s.type === 'title')) return;
  const tgt = sl.filter(s => s.type !== 'title'); const first = tgt[0];
  const get = k => first[k]; const set = (k, v) => { snap(); tgt.forEach(s => { if (v === undefined) delete s[k]; else s[k] = v; }); renderAll(); };
  box.append(el('h2', { style: { marginTop: '18px' } }, 'Look und Farbe'), ...lookControls(get, set));
  if (sl.length === 1 && first.type === 'photo') box.append(el('h2', { style: { marginTop: '18px' } }, 'Bewegung'), keyframeEditor(first, set));
};

// Proxy-Vorschau im Medien-Reiter
const _mediaBuild = App.tabs.media.build;
App.tabs.media.build = function (p) {
  _mediaBuild.call(this, p);
  const info = el('div', { class: 'hint' }); const prog = el('div', { class: 'hint' }); const b = bar();
  const upd = async () => { const n = await App.api.invoke('proxy:size'); info.textContent = `Zwischenspeicher: ${(n / 1e6).toFixed(0)} MB`; }; upd();
  p.append(step('Schnelle Vorschau (Proxy)',
    el('div', { class: 'hint' }, 'Erzeugt kleine Kopien großer Fotos und Videos nur für die Vorschau. Gerendert wird immer aus dem Original.'),
    el('div', { class: 'row' }, btn('Proxys erzeugen', async () => {
      const items = S().media.map(m => ({ path: m.path, kind: m.kind })); if (!items.length) return toast('Erst Medien hinzufügen.');
      const id = 'proxy-' + uid(); const stop = App.onEvent(m => { if (m.type === 'proxy' && m.id === id) { prog.textContent = `${m.done} / ${m.total}`; b.set(m.done / m.total); } });
      try { const map = await App.api.invoke('proxy:make', id, items); App.proxies = Object.assign(App.proxies || {}, map); toast(Object.keys(map).length + ' Proxys fertig'); } catch (e) { toast(e.message, true); } finally { stop(); upd(); }
    }, 'small'), btn('Leeren', async () => { await App.api.invoke('proxy:clear'); App.proxies = {}; upd(); }, 'small')), b, prog, info));
};

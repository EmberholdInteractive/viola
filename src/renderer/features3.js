'use strict';
// Viola – Welle 1 Oberfläche: Effekt-Browser/Inspektor (aus dem Katalog erzeugt), Tempo und Zeit, erweitertes Export-Panel.
App.fxCat = { video: [], audio: [], codecs: {}, audioCodecs: {}, hardware: {} };
const fxName = (cat, id) => (cat.find(d => d.id === id) || {}).name || id;
const GROUPS = { Color: 'Farbkorrektur', Blur: 'Weichzeichnung', Distort: 'Verzerrung', Sharpen: 'Schärfen', Light: 'Licht und Schatten', Stylize: 'Stilisieren', Analog: 'Film und Analog', Time: 'Zeit' };
const grp = g => GROUPS[g] || g;

function paramControl(spec, value, onchange) {
  const v = value == null ? spec.def : value;
  if (spec.type === 'bool') return el('input', { type: 'checkbox', checked: !!v, onchange: e => onchange(e.target.checked) });
  if (spec.type === 'enum') return sel(spec.options.map(o => [o, o]), v, onchange);
  if (spec.type === 'string') return txt(v, onchange);
  const r = el('input', { type: 'range', min: spec.min, max: spec.max, step: spec.step, value: v });
  const out = el('span', { class: 'hint', style: { flex: '0 0 54px', textAlign: 'right' } }, v + (spec.unit || ''));
  r.oninput = () => { out.textContent = r.value + (spec.unit || ''); };
  r.onchange = () => onchange(spec.type === 'int' ? parseInt(r.value, 10) : parseFloat(r.value));
  return el('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', flex: '1 1 auto' } }, r, out);
}

// Effektliste bearbeiten: list = Array von Effektinstanzen, apply(neueListe), cat = Katalog (video|audio)
function fxStack(title, list, apply, cat) {
  list = list || []; const box = el('div', { class: 'card' }, el('div', { class: 'muted', style: { color: '#d9c8ff', marginBottom: '6px' } }, title));
  const upd = (i, patch) => apply(list.map((e, j) => j === i ? Object.assign({}, e, patch) : e));
  list.forEach((e, i) => {
    const d = cat.find(c => c.id === e.id); if (!d) return;
    const head = el('div', { class: 'row', style: { gap: '4px' } },
      el('input', { type: 'checkbox', checked: e.enabled !== false, title: 'An/Aus', onchange: ev => upd(i, { enabled: ev.target.checked }) }),
      el('b', { style: { flex: '1 1 auto', fontWeight: 600 } }, d.name),
      btn('↑', () => { if (i) { const n = [...list]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; apply(n); } }, 'small'),
      btn('↓', () => { if (i < list.length - 1) { const n = [...list]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; apply(n); } }, 'small'),
      btn('✕', () => apply(list.filter((_, j) => j !== i)), 'small'));
    const body = el('div', { style: { marginLeft: '6px' } });
    Object.entries(d.params).forEach(([k, spec]) => body.append(rowOf(spec.label || k, paramControl(spec, (e.params || {})[k], v => upd(i, { params: Object.assign({}, e.params, { [k]: v }) })))));
    body.append(rowOf('Stärke (Mix)', paramControl({ type: 'float', min: 0, max: 1, step: 0.05, def: 1, unit: '' }, e.mix == null ? 1 : e.mix, v => upd(i, { mix: v }))));
    box.append(el('div', { style: { borderTop: '1px solid var(--line, #2b2342)', paddingTop: '6px', marginTop: '6px' } }, head, body));
  });
  // Browser: nach Gruppen sortierte Auswahl
  const groups = [...new Set(cat.map(d => d.group))];
  const picker = el('select', { onchange: ev => { const id = ev.target.value; if (!id) return; apply([...list, { id, version: 1, enabled: true, bypass: false, mix: 1, params: Object.fromEntries(Object.entries(cat.find(c => c.id === id).params).map(([k, s]) => [k, s.def])) }]); } },
    el('option', { value: '' }, '+ Effekt hinzufügen …'));
  groups.forEach(g => { const og = el('optgroup', { label: grp(g) }); cat.filter(d => d.group === g).forEach(d => og.append(el('option', { value: d.id }, d.name))); picker.append(og); });
  box.append(el('div', { class: 'row', style: { marginTop: '8px' } }, picker));
  return box;
}

// Tempo und Zeit für Videoclips
function timeControls(s, set) {
  const c = el('div', { class: 'card' });
  c.append(rowOf('Tempo (%)', el('div', { style: { display: 'flex', gap: '6px' } }, num(s.speed || 100, 5, 10, v => set('speed', Math.max(10, Math.min(1000, v)))),
    ...[[25, '¼'], [50, '½'], [100, '1×'], [200, '2×']].map(([v, l]) => btn(l, () => set('speed', v), 'small')))));
  c.append(rowOf('Speed Ramp (% → %)', el('div', { style: { display: 'flex', gap: '6px' } }, num(s.rampFrom || 100, 10, 10, v => set('rampFrom', v === 100 && !s.rampTo ? undefined : Math.max(10, Math.min(1000, v)))), num(s.rampTo || 100, 10, 10, v => set('rampTo', v === 100 && !s.rampFrom ? undefined : Math.max(10, Math.min(1000, v)))), btn('aus', () => { set('rampFrom', undefined); set('rampTo', undefined); }, 'small'))));
  { const cv_ = s.curve || []; const put = n => set('curve', n.length >= 2 ? n : undefined);
    c.append(el('div', { class: 'muted', style: { margin: '8px 0 4px' } }, 'Time Remap (Tempo-Kurve)'));
    cv_.forEach((k, i) => c.append(el('div', { class: 'row' }, el('input', { type: 'number', min: 0, max: 100, step: 5, value: Math.round(k.t * 100), title: 'Position im Clip (%)', onchange: e => { const n = cv_.map(x => Object.assign({}, x)); n[i].t = Math.max(0, Math.min(1, +e.target.value / 100)); put(n); } }), el('span', { class: 'muted', style: { flex: '0 0 auto' } }, '% →'), el('input', { type: 'number', min: 10, max: 1000, step: 10, value: k.speed, title: 'Tempo (%)', onchange: e => { const n = cv_.map(x => Object.assign({}, x)); n[i].speed = Math.max(10, Math.min(1000, +e.target.value)); put(n); } }), btn('✕', () => put(cv_.filter((_, j) => j !== i)), 'small'))));
    c.append(el('div', { class: 'row' }, btn('+ Punkt', () => put([...cv_, cv_.length ? { t: 1, speed: 100 } : { t: 0, speed: 100 }].concat(cv_.length ? [] : [{ t: 1, speed: 100 }])), 'small'), cv_.length ? btn('Kurve löschen', () => set('curve', undefined), 'small') : null)); }
  const chk = (k, l) => el('div', { class: 'row' }, el('label', { style: { flex: '1 1 auto' } }, l), el('input', { type: 'checkbox', checked: !!s[k], onchange: e => set(k, e.target.checked || undefined) }));
  c.append(chk('reverse', 'Rückwärts'), chk('pingpong', 'Ping-Pong (vor und zurück)'));
  c.append(rowOf('Standbild am Ende (s)', num(s.freeze || 0, 0.5, 0, v => set('freeze', v || undefined))));
  c.append(rowOf('Wiederholen (×)', num(s.loop || 0, 1, 0, v => set('loop', v || undefined))));
  c.append(rowOf('Start im Clip (s)', num(s.trimStart || 0, 0.5, 0, v => set('trimStart', v || undefined))));
  return c;
}

const _ri3 = renderInspector;
renderInspector = function () {
  _ri3();
  const box = $('#inspector'); const sl = P().slides.filter(s => S().selected.has(s.id)); const st = P().settings;
  if (!sl.length) {
    box.append(el('h2', { style: { marginTop: '18px' } }, 'Effekte (alle Folien)'), fxStack('Videoeffekte', st.effects, l => { snap(); st.effects = l.length ? l : undefined; renderAll(); }, App.fxCat.video));
    const m = P().music || (P().music = {});
    box.append(el('h2', { style: { marginTop: '18px' } }, 'Audioeffekte (Musik gesamt)'), fxStack('Audioeffekte', m.effects, l => { snap(); m.effects = l.length ? l : undefined; renderAll(); }, App.fxCat.audio));
    return;
  }
  const tgt = sl.filter(s => s.type !== 'title'); if (!tgt.length) return; const first = tgt[0];
  const set = (k, v) => { snap(); tgt.forEach(s => { if (v === undefined) delete s[k]; else s[k] = v; }); renderAll(); };
  box.append(el('h2', { style: { marginTop: '18px' } }, 'Effekte'), fxStack('Videoeffekte der Auswahl', first.effects, l => set('effects', l.length ? l : undefined), App.fxCat.video));
  if (tgt.every(s => s.type === 'video')) box.append(el('h2', { style: { marginTop: '18px' } }, 'Tempo und Zeit'), timeControls(first, set));
};

// Erweitertes Export-Panel
const _expBuild = App.tabs.export.build;
App.tabs.export.build = function (p) {
  _expBuild.call(this, p);
  const X = () => P().export || (P().export = {}); const setX = (k, v) => { snap(); if (v === '' || v === undefined) delete X()[k]; else X()[k] = v; this.rebuildAdv(); };
  const holder = el('div'); this.adv = holder; this.rebuildAdv = () => {
    holder.replaceChildren(); const x = X(); const C = App.fxCat; const codec = x.codec || 'h264'; const conts = (C.codecs[codec] || { containers: ['mp4'] }).containers; const hw = C.hardware || {};
    const body = el('div');
    body.append(rowOf('Video-Codec', sel(Object.entries(C.codecs).map(([k, v]) => [k, v.label]), codec, v => { setX('codec', v); setX('container', undefined); })),
      rowOf('Container', sel(conts.map(c => [c, c.toUpperCase()]), x.container && conts.includes(x.container) ? x.container : conts[0], v => setX('container', v))));
    if (!['prores', 'dnxhr'].includes(codec)) body.append(
      rowOf('Ratensteuerung', sel([['crf', 'Konstante Qualität (CRF)'], ['vbr', 'Variable Bitrate'], ['cbr', 'Konstante Bitrate']], x.rc || 'crf', v => setX('rc', v))),
      (x.rc || 'crf') === 'crf' ? rowOf('Qualität (CRF)', num(x.crf == null ? 23 : x.crf, 1, 0, v => setX('crf', v)), 'Kleiner = besser und größer (18–23 üblich)') : rowOf('Bitrate (kbit/s)', num(x.bitrate || 8000, 500, 100, v => setX('bitrate', v))),
      rowOf('GOP-Länge (Bilder, 0 = auto)', num(x.gop || 0, 1, 0, v => setX('gop', v))), rowOf('B-Frames (-1 = auto)', num(x.bframes == null ? -1 : x.bframes, 1, -1, v => setX('bframes', v))),
      rowOf('Hardware-Encoder', sel([['cpu', 'Nur Prozessor'], ['auto', 'Automatisch (GPU wenn möglich)'], ...['nvenc', 'qsv', 'amf'].filter(k => hw[k]).map(k => [k, { nvenc: 'NVIDIA NVENC', qsv: 'Intel Quick Sync', amf: 'AMD AMF' }[k]])], x.hw || 'cpu', v => setX('hw', v))),
      el('div', { class: 'row' }, el('label', { style: { flex: '1 1 auto' } }, '10 Bit Farbtiefe'), el('input', { type: 'checkbox', checked: !!x.tenBit, onchange: e => setX('tenBit', e.target.checked || undefined) })));
    else body.append(rowOf('Profil', sel(codec === 'prores' ? [['proxy', 'Proxy'], ['lt', 'LT'], ['standard', 'Standard'], ['hq', 'HQ']] : [['lb', 'LB'], ['sq', 'SQ'], ['hq', 'HQ']], x.profile || (codec === 'prores' ? 'standard' : 'hq'), v => setX('profile', v))));
    const a = x.audio || {}; const setA = (k, v) => { const n = Object.assign({}, a, { [k]: v }); setX('audio', n); };
    body.append(rowOf('Audio-Codec', sel([['', 'Automatisch'], ...Object.keys(C.audioCodecs).map(k => [k, k.toUpperCase()])], a.codec || '', v => setA('codec', v || undefined))),
      rowOf('Audio-Bitrate (kbit/s)', num(a.bitrate || 192, 32, 32, v => setA('bitrate', v))));
    const wm = x.watermark || {}; const setW = (k, v) => setX('watermark', Object.assign({}, wm, { [k]: v }));
    body.append(el('h3', {}, 'Wasserzeichen'), rowOf('Bilddatei (PNG)', el('div', { style: { display: 'flex', gap: '6px' } }, el('span', { class: 'hint', style: { flex: '1 1 auto' } }, wm.file ? wm.file.split(/[\\/]/).pop() : 'keine'),
      btn('Wählen', async () => { const f = await App.api.invoke('dialog:files', 'photo'); if (f && f[0]) setW('file', f[0]); }, 'small'), wm.file ? btn('✕', () => setX('watermark', undefined), 'small') : null)),
      rowOf('Position', sel([['br', 'Unten rechts'], ['bl', 'Unten links'], ['tr', 'Oben rechts'], ['tl', 'Oben links'], ['center', 'Mitte']], wm.pos || 'br', v => setW('pos', v))),
      rowOf('Größe (% der Breite)', num(Math.round((wm.scale || 0.15) * 100), 1, 2, v => setW('scale', v / 100))), rowOf('Deckkraft (%)', num(Math.round((wm.opacity == null ? 0.7 : wm.opacity) * 100), 5, 5, v => setW('opacity', v / 100))));
    body.append(el('h3', {}, 'Untertitel'),
      el('div', { class: 'row' }, el('label', { style: { flex: '1 1 auto' } }, 'In die Datei einbetten (MP4, MOV, MKV)'), el('input', { type: 'checkbox', checked: !!x.embedSubs, onchange: e => setX('embedSubs', e.target.checked || undefined) })),
      el('div', { class: 'row' }, el('label', { style: { flex: '1 1 auto' } }, 'Zusätzlich als .srt neben das Video'), el('input', { type: 'checkbox', checked: !!x.sidecarSubs, onchange: e => setX('sidecarSubs', e.target.checked || undefined) })));
    holder.append(step('Erweiterter Export', body));
  };
  p.insertBefore(holder, p.querySelector('h3'));
  this.rebuildAdv();
};

(async () => { try { App.fxCat = await App.api.invoke('fx:catalog') || App.fxCat; renderAll(); } catch (_) {} })();

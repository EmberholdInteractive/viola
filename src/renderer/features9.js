// Studio-Oberfläche: Mehrspur-Köpfe, Marker, Farbpanel, Effekt-Browser, vier Docks, Befehlspalette, Medien-Verwaltung
(function () {
  const app = document.getElementById('app');
  ['colorp:aside', 'fxp:aside', 'docks:section'].forEach(s => { const [id, tag] = s.split(':'); if (!document.getElementById(id)) { const e = document.createElement(tag); e.id = id; app.appendChild(e); } });
  const $$ = s => document.querySelector(s);
  const cl = o => JSON.parse(JSON.stringify(o));
  const TN = ['V3', 'V2', 'V1', 'A1', 'A2', 'A3'];
  const TF = n => (P().tracks || (P().tracks = {}))[n] || ((P().tracks[n]) = {});
  const flag = (n, k) => !!((P().tracks || {})[n] || {})[k];
  const anySolo = k => TN.some(n => n[0] === k && flag(n, 'solo'));
  const visible = n => !flag(n, 'hide') && (!anySolo('V') || flag(n, 'solo'));
  const audible = n => !flag(n, 'mute') && (!anySolo('A') || flag(n, 'solo'));

  // ---------- Tabs (oben) ----------
  Object.assign(ICONS, {
    effects: '<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/>', transitions: '<rect x="3" y="6" width="8" height="12" rx="1"/><rect x="13" y="6" width="8" height="12" rx="1"/><path d="M11 12h2"/>',
    titles: '<path d="M5 6h14M12 6v13M9 19h6"/>', templates: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>', ai: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/><circle cx="12" cy="12" r="3"/>',
    color: '<circle cx="9" cy="9" r="5"/><circle cx="15" cy="9" r="5"/><circle cx="12" cy="15" r="5"/>'
  });
  App.railTabs.length = 0;
  [['media', 'Medien'], ['effects', 'Effekte'], ['transitions', 'Übergänge'], ['titles', 'Titel'], ['music', 'Audio'], ['templates', 'Vorlagen'], ['ai', 'KI-Tools'], ['color', 'Farbe'], ['lyrics', 'Lyrics'], ['collage', 'Collage'], ['upscale', 'Upscaler'], ['export', 'Export']].forEach(t => App.railTabs.push(t));
  const flash = id => { const e = document.getElementById(id); if (!e) return; e.classList.add('flash'); setTimeout(() => e.classList.remove('flash'), 900); };

  // ---------- Effekt-Helfer ----------
  const DEF = {
    'FX.COLOR.EQ': { brightness: 0, contrast: 1, saturation: 1, gamma: 1 }, 'FX.COLOR.HUE': { hue: 0, sat: 1 }, 'FX.COLOR.TEMP': { temperature: 6500 }, 'FX.COLOR.VIBRANCE': { intensity: 0 },
    'FX.COLOR.LEVELS': { black: 0, white: 1, gamma: 1 }, 'FX.COLOR.HSL': Object.fromEntries(['r', 'y', 'g', 'c', 'b', 'm'].flatMap(k => [['h' + k, 0], ['s' + k, 0], ['l' + k, 0]])), 'FX.COLOR.LUT': { file: '' }, 'FX.COLOR.CURVES': { preset: 'none', master: '', red: '', green: '', blue: '' },
    'FX.COLOR.BALANCE': Object.fromEntries(['s', 'm', 'h'].flatMap(k => ['r', 'g', 'b'].map(c => [k + c, 0])))
  };
  const targets = () => { const s = P().slides.filter(x => S().selected.has(x.id)); return s.length ? s : null; };
  const targetLabel = () => { const t = targets(); return t ? `${t.length} Folie(n)` : 'Alle Folien'; };
  const listOf = () => { const t = targets(); return t ? (t[0].effects || []) : (P().settings.effects || []); };
  function editFx(fn) {
    const t = targets();
    if (t) t.forEach(s => { const l = fn(cl(s.effects || [])); s.effects = l.length ? l : undefined; });
    else { const l = fn(cl(P().settings.effects || [])); P().settings.effects = l.length ? l : undefined; }
  }
  const same = (a, b) => Object.keys(b).every(k => String(a[k]) === String(b[k]));
  function setParam(id, key, val) {
    editFx(list => {
      let e = list.find(x => x.id === id);
      if (!e) { e = { id, version: 1, enabled: true, bypass: false, mix: 1, params: Object.assign({}, DEF[id]) }; list.push(e); }
      e.params = Object.assign({}, e.params, { [key]: val });
      return same(e.params, DEF[id]) ? list.filter(x => x !== e) : list;
    });
  }
  const getParam = (id, key) => { const e = listOf().find(x => x.id === id); return e && e.params && e.params[key] != null ? e.params[key] : DEF[id][key]; };
  function setParams(id, obj) { Object.entries(obj).forEach(([k, v]) => setParam(id, k, v)); }
  const hasFx = id => App.fxCat.video.some(d => d.id === id);
  function addFx(id) {
    const d = App.fxCat.video.find(c => c.id === id); if (!d) return;
    snap(); const params = Object.fromEntries(Object.entries(d.params).map(([k, s]) => [k, s.def]));
    editFx(list => [...list, { id, version: 1, enabled: true, bypass: false, mix: 1, params }]); renderAll(); toast(`„${d.name}" → ${targetLabel()}`);
  }

  // ---------- Farbpanel ----------
  let cTab = 'Basis', cuCh = 'master';
  function slider(label, id, key, min, max, step, scale) {
    const v = +getParam(id, key); const out = el('span', { class: 'sv' }, (+v).toFixed(step < 1 ? 2 : 0));
    const inp = el('input', { type: 'range', min, max, step, value: v, onpointerdown: () => snap(), oninput: e => { setParam(id, key, +e.target.value); out.textContent = (+e.target.value).toFixed(step < 1 ? 2 : 0); previewFilter(); }, ondblclick: e => { snap(); setParam(id, key, DEF[id][key]); e.target.value = DEF[id][key]; out.textContent = String(DEF[id][key]); previewFilter(); } });
    return el('div', { class: 'cs' }, el('label', {}, label), inp, out);
  }
  function wheel(title, k, ui) {
    const c = el('canvas', { width: 96, height: 96, class: 'wheel' }); const g = c.getContext('2d');
    const pos = () => (((P().wheels || {})[k]) || [0, 0]);
    const draw = () => {
      g.clearRect(0, 0, 96, 96); const r = 44; const cg = g.createConicGradient ? g.createConicGradient(0, 48, 48) : null;
      if (cg) { ['#f00', '#ff0', '#0f0', '#0ff', '#00f', '#f0f', '#f00'].forEach((col, i) => cg.addColorStop(i / 6, col)); g.fillStyle = cg; } else g.fillStyle = '#888';
      g.beginPath(); g.arc(48, 48, r, 0, 7); g.fill(); g.fillStyle = '#120e1d'; g.beginPath(); g.arc(48, 48, r - 6, 0, 7); g.fill();
      const [x, y] = pos(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(48 + x * r, 48 + y * r, 5, 0, 7); g.stroke();
    };
    const apply = (x, y) => {
      const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } (P().wheels = P().wheels || {})[k] = [x, y];
      const mag = Math.min(1, m) * 0.5, a = Math.atan2(-y, x); const rgb = [Math.cos(a), Math.cos(a - 2.0944), Math.cos(a + 2.0944)].map(v => +(v * mag).toFixed(3));
      setParams('FX.COLOR.BALANCE', { [ui + 'r']: m < 0.02 ? 0 : rgb[0], [ui + 'g']: m < 0.02 ? 0 : rgb[1], [ui + 'b']: m < 0.02 ? 0 : rgb[2] }); draw();
    };
    const ev = e => { const b = c.getBoundingClientRect(); apply((e.clientX - b.left) / b.width * 2 - 1, (e.clientY - b.top) / b.height * 2 - 1); };
    c.onpointerdown = e => { snap(); c.setPointerCapture(e.pointerId); ev(e); c.onpointermove = ev; }; c.onpointerup = () => { c.onpointermove = null; }; c.ondblclick = () => { snap(); apply(0, 0); };
    draw(); return el('div', { class: 'wh' }, c, el('div', { class: 'muted' }, title));
  }
  const parsePts = s => { const p = String(s || '').trim().split(/\s+/).filter(Boolean).map(v => v.split('/').map(Number)).filter(a => a.length === 2 && a.every(isFinite)); return p.length ? p : [[0, 0], [1, 1]]; };
  function curveEditor() {
    const key = cuCh; const c = el('canvas', { width: 200, height: 200, class: 'curve' }); const g = c.getContext('2d'); let pts = parsePts(getParam('FX.COLOR.CURVES', key)); let drag = -1;
    const col = { master: '#ddd', red: '#f66', green: '#6f6', blue: '#69f' }[key];
    const draw = () => {
      g.fillStyle = '#0d0a16'; g.fillRect(0, 0, 200, 200); g.strokeStyle = '#2b2342'; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * 50, 0); g.lineTo(i * 50, 200); g.moveTo(0, i * 50); g.lineTo(200, i * 50); g.stroke(); }
      g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x * 200, 200 - y * 200) : g.moveTo(x * 200, 200 - y * 200)); g.stroke(); g.fillStyle = col; pts.forEach(([x, y]) => { g.beginPath(); g.arc(x * 200, 200 - y * 200, 4, 0, 7); g.fill(); });
    };
    const save = () => { const ident = pts.length === 2 && pts[0][0] === 0 && pts[0][1] === 0 && pts[1][0] === 1 && pts[1][1] === 1; setParam('FX.COLOR.CURVES', key, ident ? '' : pts.map(p => p[0].toFixed(3) + '/' + p[1].toFixed(3)).join(' ')); };
    const xy = e => { const b = c.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)), Math.max(0, Math.min(1, 1 - (e.clientY - b.top) / b.height))]; };
    c.onpointerdown = e => { snap(); const [x, y] = xy(e); drag = pts.findIndex(p => Math.hypot(p[0] - x, p[1] - y) < 0.06); if (drag < 0) { pts.push([x, y]); pts.sort((a, b) => a[0] - b[0]); drag = pts.findIndex(p => p[0] === x); save(); } c.setPointerCapture(e.pointerId); draw(); };
    c.onpointermove = e => { if (drag < 0) return; let [x, y] = xy(e); const lo = drag ? pts[drag - 1][0] + 0.01 : 0, hi = drag < pts.length - 1 ? pts[drag + 1][0] - 0.01 : 1; if (drag === 0) x = 0; else if (drag === pts.length - 1) x = 1; else x = Math.max(lo, Math.min(hi, x)); pts[drag] = [x, y]; save(); draw(); };
    c.onpointerup = () => { drag = -1; }; c.ondblclick = e => { const [x, y] = xy(e); const i = pts.findIndex(p => Math.hypot(p[0] - x, p[1] - y) < 0.06); if (i > 0 && i < pts.length - 1) { snap(); pts.splice(i, 1); save(); draw(); } };
    draw(); return c;
  }
  let hCol = 'r';
  const HC = [['r', 'Rot', '#f55'], ['y', 'Gelb', '#fd4'], ['g', 'Grün', '#5d6'], ['c', 'Cyan', '#4dd'], ['b', 'Blau', '#58f'], ['m', 'Magenta', '#e5e']];
  function hslTab(body) {
    body.append(el('div', { class: 'chs' }, ...HC.map(([k, n, col]) => el('button', { class: k === hCol ? 'on' : '', style: { borderColor: col }, onclick: () => { hCol = k; renderColor(); } }, n))));
    if (hasFx('FX.COLOR.HSL')) body.append(slider('Farbton', 'FX.COLOR.HSL', 'h' + hCol, -180, 180, 1), slider('Sättigung', 'FX.COLOR.HSL', 's' + hCol, -1, 1, 0.05), slider('Helligkeit', 'FX.COLOR.HSL', 'l' + hCol, -1, 1, 0.05));
    else body.append(el('div', { class: 'hint' }, 'Farbbereiche brauchen FFmpeg 5.1 oder neuer.'));
    body.append(el('div', { class: 'hint', style: { marginTop: '8px' } }, 'Gesamtes Bild:'), slider('Farbton', 'FX.COLOR.HUE', 'hue', -180, 180, 1), slider('Sättigung', 'FX.COLOR.HUE', 'sat', 0, 3, 0.05));
  }
  function histCanvas() { const c = el('canvas', { id: 'hist', width: 260, height: 48, class: 'hist' }); setTimeout(drawHist, 0); return c; }
  let histBusy = false;
  function drawHist() {
    const c = document.getElementById('hist'); if (!c || histBusy) return; histBusy = true;
    requestAnimationFrame(() => { histBusy = false; const g = c.getContext('2d'); g.fillStyle = '#0d0a16'; g.fillRect(0, 0, c.width, c.height);
      try { const w = 160, h = 90, t = document.createElement('canvas'); t.width = w; t.height = h; const tg = t.getContext('2d'); tg.drawImage(cv, 0, 0, w, h); const d = tg.getImageData(0, 0, w, h).data; const bins = [new Array(64).fill(0), new Array(64).fill(0), new Array(64).fill(0)];
        for (let i = 0; i < d.length; i += 4) { bins[0][d[i] >> 2]++; bins[1][d[i + 1] >> 2]++; bins[2][d[i + 2] >> 2]++; } const mx = Math.max(1, ...bins.flat().map(v => v)) * 0.6;
        ['rgba(255,80,80,.55)', 'rgba(80,255,80,.45)', 'rgba(90,140,255,.55)'].forEach((col, k) => { g.fillStyle = col; bins[k].forEach((v, i) => { const bh = Math.min(1, v / mx) * c.height; g.fillRect(i * c.width / 64, c.height - bh, c.width / 64 + 0.5, bh); }); });
      } catch (e) { g.fillStyle = '#6d5a94'; g.font = '11px sans-serif'; g.fillText('Histogramm nicht verfügbar', 8, 28); } });
  }
  function renderColor() {
    const box = $$('#colorp'); if (!box) return; box.replaceChildren();
    const tabs = ['Basis', 'HSL', 'Kurven', 'Grading', 'LUTs'];
    box.append(el('div', { class: 'ph' }, el('b', {}, 'Farbe'), el('span', { class: 'muted' }, targetLabel()), el('span', { style: { flex: 1 } }), btn('Zurücksetzen', () => { snap(); editFx(l => l.filter(e => !/^FX\.COLOR\.(EQ|HUE|TEMP|VIBRANCE|LEVELS|CURVES|BALANCE|LUT)$/.test(e.id))); P().wheels = {}; renderAll(); }, 'small')));
    box.append(el('div', { class: 'ptabs' }, ...tabs.map(t => el('button', { class: t === cTab ? 'on' : '', onclick: () => { cTab = t; renderColor(); } }, t))));
    const body = el('div', { class: 'pbody' }); box.append(body);
    if (cTab === 'Basis') {
      body.append(histCanvas());
      body.append(el('div', { class: 'wheels' }, wheel('Schatten', 'lift', 's'), wheel('Mitten', 'gam', 'm'), wheel('Lichter', 'gain', 'h')));
      body.append(slider('Belichtung', 'FX.COLOR.EQ', 'brightness', -0.5, 0.5, 0.01), slider('Kontrast', 'FX.COLOR.EQ', 'contrast', 0.5, 2, 0.01), slider('Sättigung', 'FX.COLOR.EQ', 'saturation', 0, 2.5, 0.01), slider('Gamma', 'FX.COLOR.EQ', 'gamma', 0.5, 2, 0.01),
        slider('Dynamik', 'FX.COLOR.VIBRANCE', 'intensity', -1, 2, 0.05), slider('Schwarzpunkt', 'FX.COLOR.LEVELS', 'black', 0, 0.4, 0.01), slider('Weißpunkt', 'FX.COLOR.LEVELS', 'white', 0.6, 1, 0.01));
      if (hasFx('FX.COLOR.TEMP')) body.append(slider('Temperatur (K)', 'FX.COLOR.TEMP', 'temperature', 2500, 10000, 100));
    } else if (cTab === 'HSL') hslTab(body);
    else if (cTab === 'Kurven') {
      body.append(histCanvas());
      body.append(el('div', { class: 'chs' }, ...[['master', 'RGB'], ['red', 'R'], ['green', 'G'], ['blue', 'B']].map(([k, l]) => el('button', { class: k === cuCh ? 'on' : '', onclick: () => { cuCh = k; renderColor(); } }, l))), curveEditor(), el('div', { class: 'hint' }, 'Klick = Punkt, ziehen = verschieben, Doppelklick = löschen.'));
    } else if (cTab === 'Grading') body.append(el('div', { class: 'wheels' }, wheel('Schatten (Lift)', 'lift', 's'), wheel('Mitten (Gamma)', 'gam', 'm'), wheel('Lichter (Gain)', 'gain', 'h')), el('div', { class: 'hint' }, 'Doppelklick auf ein Rad setzt es zurück.'));
    else {
      const cur = getParam('FX.COLOR.LUT', 'file'); const inp = el('input', { type: 'text', value: cur, placeholder: 'C:\\LUTs\\look.cube', onchange: e => { snap(); setParam('FX.COLOR.LUT', 'file', e.target.value.trim()); renderColor(); } });
      body.append(el('div', { class: 'row' }, inp), el('div', { class: 'row' }, btn('LUT-Datei wählen …', async () => { const f = await App.api.invoke('dialog:files', 'lut'); if (f && f[0]) { snap(); setParam('FX.COLOR.LUT', 'file', f[0]); renderColor(); } }, 'small'), btn('Entfernen', () => { snap(); setParam('FX.COLOR.LUT', 'file', ''); renderColor(); }, 'small')), el('div', { class: 'hint' }, 'Unterstützt .cube, .3dl, .dat, .m3d, .csp.'));
    }
  }
  // Näherung der Farbkorrektur in der Vorschau (CSS-Filter)
  function previewFilter() {
    const f = []; const l = (() => { const { L } = layout(); const cur = L.filter(x => x.start <= S().t).pop(); return [...(P().settings.effects || []), ...((cur && cur.s.effects) || [])]; })();
    const g = (id, k) => { const e = l.filter(x => x.id === id && x.enabled !== false).pop(); return e && e.params && e.params[k] != null ? +e.params[k] : DEF[id][k]; };
    const b = g('FX.COLOR.EQ', 'brightness'), c = g('FX.COLOR.EQ', 'contrast'), s = g('FX.COLOR.EQ', 'saturation') * g('FX.COLOR.HUE', 'sat'), h = g('FX.COLOR.HUE', 'hue');
    if (b || c !== 1 || s !== 1 || h) cv.style.filter = `brightness(${1 + b}) contrast(${c}) saturate(${s}) hue-rotate(${h}deg)`; else cv.style.filter = '';
  }
  const _dp = drawPreview; drawPreview = function () {
    const p = P(), ov = p.overlays; if (ov && p.tracks) p.overlays = ov.filter(o => visible('V' + ((o.track || 1) + 1)));
    try { _dp(); } finally { p.overlays = ov; } previewFilter(); drawHist();
  };

  // ---------- Effekt-Browser (rechts unten) ----------
  const GDE = { Alle: 'Videoeffekte', Color: 'Farbkorrektur', 'Blur/Sharpen': 'Weichzeichnung & Schärfen', Light: 'Licht & Schatten', Analog: 'Film-Looks', Stylize: 'Stylize', Distortion: 'Verzerrung', Transform: 'Transformation', Restoration: 'Restaurierung', Key: 'Keying', Time: 'Zeit', Mask: 'Masken' };
  const gde = g => GDE[g] || g;
  let fxCat = 'Alle', fxQ = '';
  const GRAD = { Color: ['#f59e0b', '#ec4899'], Blur: ['#38bdf8', '#6366f1'], Light: ['#fde68a', '#f97316'], Analog: ['#a3a3a3', '#78350f'], Stylize: ['#a78bfa', '#ec4899'], Distortion: ['#34d399', '#0ea5e9'], Transform: ['#60a5fa', '#8b5cf6'], Restoration: ['#2dd4bf', '#0f766e'], Key: ['#22c55e', '#064e3b'], Time: ['#f472b6', '#7c3aed'] };
  const grad = g => { const k = Object.keys(GRAD).find(x => (g || '').startsWith(x)); const c = GRAD[k] || ['#8b5cf6', '#3b2a6b']; return `linear-gradient(135deg,${c[0]},${c[1]})`; };
  const thumbs = new Map(); let thumbChain = Promise.resolve();
  const thumbFor = id => { if (!thumbs.has(id)) thumbs.set(id, new Promise(res => { thumbChain = thumbChain.then(() => App.api.invoke('fx:thumb', id).then(res, () => res(null))); })); return thumbs.get(id); };
  function renderFxp() {
    const box = $$('#fxp'); if (!box) return; const prevQ = box.querySelector('input'); const had = prevQ && document.activeElement === prevQ; box.replaceChildren();
    const cat = App.fxCat.video; const groups = ['Alle', ...new Set(cat.map(d => d.group))];
    const q = el('input', { type: 'text', placeholder: 'Suchen …', value: fxQ, oninput: e => { fxQ = e.target.value; renderFxp(); } });
    box.append(el('div', { class: 'ph' }, el('b', {}, 'Effekte'), el('span', { style: { flex: 1 } }), q));
    const side = el('div', { class: 'fxside' }, ...groups.map(g => el('button', { class: g === fxCat ? 'on' : '', onclick: () => { fxCat = g; renderFxp(); } }, '📁 ' + gde(g))));
    const grid = el('div', { class: 'fxgrid' });
    cat.filter(d => (fxCat === 'Alle' || d.group === fxCat) && (!fxQ || d.name.toLowerCase().includes(fxQ.toLowerCase()))).forEach(d => { const sw = el('div', { class: 'sw', style: { background: grad(d.group) } }); grid.append(el('div', { class: 'fxtile', title: d.name + ' → ' + targetLabel(), onclick: () => addFx(d.id) }, sw, el('span', {}, d.name))); thumbFor(d.id).then(u => { if (u) { sw.style.background = `center/cover url(${u})`; } }); }); 
    box.append(el('div', { class: 'fxwrap' }, side, grid)); if (had) { const n = box.querySelector('input'); n.focus(); n.setSelectionRange(fxQ.length, fxQ.length); }
  }

  // ---------- Docks ----------
  let dTab = 'Parameter', eTab = 'Video';
  const fader = (label, get, set, tn, getPan, setPan) => {
    const v = el('input', { type: 'range', min: 0, max: 1.5, step: 0.01, value: get(), class: 'fd', onpointerdown: () => snap(), oninput: e => { set(+e.target.value); db.textContent = e.target.value > 0 ? (20 * Math.log10(e.target.value)).toFixed(1) + ' dB' : '−∞'; } });
    const db = el('div', { class: 'muted' }, get() > 0 ? (20 * Math.log10(get())).toFixed(1) + ' dB' : '−∞');
    const mb = (t, k, ti) => el('button', { class: 'tb' + (flag(tn, k) ? ' on' : ''), title: ti, onclick: () => { snap(); TF(tn)[k] = !flag(tn, k); renderAll(); } }, t);
    const pan = el('input', { type: 'range', min: -1, max: 1, step: 0.05, value: getPan ? getPan() : 0, class: 'pan', title: 'Pan (Doppelklick = Mitte)', onpointerdown: () => snap(), oninput: e => setPan && setPan(+e.target.value), ondblclick: e => { setPan && setPan(0); e.target.value = 0; } });
    return el('div', { class: 'strip', 'data-tn': tn }, el('div', { class: 'meter' }, el('i', { style: { height: '0%' } })), v, db, pan, el('div', { class: 'sb' }, mb('M', 'mute', 'Stumm'), mb('S', 'solo', 'Solo')), el('b', {}, label));
  };
  function dockMixer() {
    const d = el('div', { class: 'dock' }, el('div', { class: 'ph' }, el('b', {}, 'Audio-Mixer'), el('span', { class: 'muted' }, '(Detailansicht)')));
    const avg = a => a.length ? a.reduce((s, x) => s + (x.volume == null ? 1 : x.volume), 0) / a.length : 1;
    const m = P().music = P().music || {};
    d.append(el('div', { class: 'strips' },
      fader('Musik (A1)', () => avg(P().audio), v => P().audio.forEach(a => { a.volume = v; }), 'A1', () => (P().audio[0] || {}).pan || 0, v => P().audio.forEach(a => { a.pan = v || undefined; })),
      fader('Sprecher (A2)', () => avg(P().voice || []), v => (P().voice || []).forEach(a => { a.volume = v; }), 'A2', () => ((P().voice || [])[0] || {}).pan || 0, v => (P().voice || []).forEach(a => { a.pan = v || undefined; })),
      el('div', { class: 'mfx' }, el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: m.normalize !== false, onchange: e => { snap(); m.normalize = e.target.checked; } }), 'Lautheit angleichen'),
        rowOf('Ziel (LUFS)', num(m.lufs == null ? -14 : m.lufs, 1, -30, v => { m.lufs = Math.max(-30, Math.min(-6, v)); })),
        typeof fxStack === 'function' ? fxStack('Audioeffekte', m.effects, l => { snap(); m.effects = l.length ? l : undefined; renderAll(); }, App.fxCat.audio) : null)));
    return d;
  }
  function dockEdit() {
    const d = el('div', { class: 'dock' }); const tabs = ['Parameter', 'Keyframes', 'Schnitt', 'Marker'];
    d.append(el('div', { class: 'ptabs' }, ...tabs.map(t => el('button', { class: t === dTab ? 'on' : '', onclick: () => { dTab = t; renderDocks(); } }, t))));
    const body = el('div', { class: 'pbody' }); d.append(body); const t = targets();
    if (dTab === 'Parameter') body.append(typeof fxStack === 'function' ? fxStack('Effekte: ' + targetLabel(), listOf(), l => { snap(); const tg = targets(); if (tg) tg.forEach(s => { s.effects = l.length ? cl(l) : undefined; }); else P().settings.effects = l.length ? l : undefined; renderAll(); }, App.fxCat.video) : el('div'));
    else if (dTab === 'Keyframes') {
      if (!t || t[0].type === 'title') body.append(el('div', { class: 'hint' }, 'Eine Foto-Folie auswählen, um Zoom- und Schwenk-Keyframes zu bearbeiten.'));
      else { const s = t[0]; const kf = s.keyframes || []; const put = n => { snap(); t.forEach(x => { x.keyframes = n.length ? cl(n) : undefined; }); renderAll(); };
        kf.forEach((k, i) => body.append(el('div', { class: 'row' }, el('b', { style: { flex: '0 0 22px' } }, i + 1), ...[['t', 'Zeit 0–1', 0, 1, 0.05], ['zoom', 'Zoom', 1, 4, 0.05], ['x', 'X', 0, 1, 0.05], ['y', 'Y', 0, 1, 0.05]].map(([f, ti, mn, mx, st]) => el('input', { type: 'number', title: ti, min: mn, max: mx, step: st, value: k[f], style: { width: '56px' }, onchange: e => { const n = cl(kf); n[i][f] = +e.target.value; put(n); } })), btn('✕', () => put(kf.filter((_, j) => j !== i)), 'small'))));
        body.append(el('div', { class: 'row' }, btn('+ Keyframe', () => put([...kf, { t: kf.length ? 1 : 0, zoom: 1.2, x: 0.5, y: 0.5 }]), 'small'), kf.length ? btn('Alle löschen', () => put([]), 'small') : null)); }
    } else if (dTab === 'Schnitt') {
      const sl = P().slides.filter(x => S().selected.has(x.id));
      body.append(el('div', { class: 'hint' }, sl.length ? sl.length + ' Folie(n) ausgewählt' : 'Erst eine Folie in der Zeitleiste auswählen.'));
      const pair = (label, fn) => el('div', { class: 'row' }, el('label', {}, label), btn('−1 s', () => fn(-1), 'small'), btn('−0,1', () => fn(-0.1), 'small'), btn('+0,1', () => fn(0.1), 'small'), btn('+1 s', () => fn(1), 'small'));
      body.append(pair('Slip (Ausschnitt)', d => { const v = sl.filter(x => x.type === 'video'); if (!v.length) return toast('Slip geht nur bei Video-Folien.'); snap(); v.forEach(x => { x.trimStart = Math.max(0, +((x.trimStart || 0) + d).toFixed(2)); }); renderAll(); }),
        pair('Roll (Schnittkante)', d => { const i = P().slides.findIndex(x => x.id === (sl[sl.length - 1] || {}).id); const a = P().slides[i], b = P().slides[i + 1]; if (!a || !b) return toast('Roll braucht eine Folie mit Nachfolger.'); if (a.duration + d < 0.5 || b.duration - d < 0.5) return toast('Zu kurz.'); snap(); a.duration = +(a.duration + d).toFixed(2); b.duration = +(b.duration - d).toFixed(2); if (b.type === 'video') b.trimStart = Math.max(0, +((b.trimStart || 0) + d).toFixed(2)); renderAll(); }),
        el('div', { class: 'row' }, btn('Ripple-Löschen (Overlays & Marker rücken nach)', () => rippleDelete(), 'small')), el('div', { class: 'hint' }, 'Slide (Clip verschieben): in der Zeitleiste ziehen.'));
    } else {
      const mk = P().markers || []; body.append(el('div', { class: 'row' }, btn('+ Marker hier (M)', () => addMarker(), 'small')));
      mk.forEach(m => body.append(el('div', { class: 'row' }, el('a', { class: 'lnk', onclick: () => seek(m.t) }, fmt(m.t)), el('input', { type: 'text', value: m.name, onchange: e => { snap(); m.name = e.target.value; renderTimeline(); } }), btn('✕', () => { snap(); P().markers = mk.filter(x => x !== m); renderAll(); }, 'small'))));
      if (!mk.length) body.append(el('div', { class: 'hint' }, 'Noch keine Marker.'));
    }
    return d;
  }
  function dockAi() {
    const tile = (ic, t, s, fn) => el('div', { class: 'aitile', onclick: fn }, el('div', { class: 'ic' }, ic), el('b', {}, t), el('span', { class: 'muted' }, s));
    return el('div', { class: 'dock' }, el('div', { class: 'ph' }, el('b', {}, 'KI-Tools'), el('span', { class: 'muted' }, '(Detailansicht)')), el('div', { class: 'aigrid' },
      tile('🎬', 'Szenen erkennen', 'Inspektor → Analyse', () => toast('Video-Folie wählen, rechts im Inspektor „Analyse" öffnen.')),
      tile('🔇', 'Stille entfernen', 'Inspektor → Analyse', () => toast('Video-Folie wählen, rechts im Inspektor „Analyse" öffnen.')),
      tile('🎤', 'RaLyrics', 'Songtext & Timing', () => App.api.invoke('tools:launch', 'ralyrics').catch(e => toast(e.message, true))),
      tile('🎵', 'RaSing', 'Gesang / Karaoke', () => App.api.invoke('tools:launch', 'rasing').catch(e => toast(e.message, true))),
      tile('🔍', 'Upscaler', 'Video2X', () => App.showTab('upscale')),
      tile('📝', 'Lyrics-Untertitel', 'LRC → Video', () => App.showTab('lyrics')),
      tile('✅', 'Untertitel prüfen', 'Tempo, Länge, Zeilen', () => window.Studio2 && Studio2.checkSubs())));
  }
  function dockExport() {
    const d = el('div', { class: 'dock' }); const tabs = ['Video', 'Audio', 'Social Media', 'Benutzerdefiniert'];
    d.append(el('div', { class: 'ptabs' }, ...tabs.map(t => el('button', { class: t === eTab ? 'on' : '', onclick: () => { eTab = t; renderDocks(); } }, t))));
    const body = el('div', { class: 'pbody' }); d.append(body); const st = P().settings; const pr = (App.info && App.info.presets) || {}; const { total } = layout();
    const list = Object.entries(pr).filter(([, v]) => eTab === 'Social Media' ? v.group === 'Plattformen' : eTab === 'Video' ? v.group !== 'Plattformen' : true);
    if (eTab === 'Audio') { const ex = P().export = P().export || {}; body.append(rowOf('Nur Audio', el('input', { type: 'checkbox', checked: !!ex.audioOnly, onchange: e => { snap(); ex.audioOnly = e.target.checked; } })), el('div', { class: 'hint' }, 'Weitere Audio-Optionen (Codec, Kanäle, Stems) im Tab „Export".'));
    } else if (eTab === 'Benutzerdefiniert') body.append(el('div', { class: 'hint' }, 'Codec, Bitrate, Container, Hardware-Encoder und mehr im Tab „Export".'), btn('Erweiterte Optionen …', () => App.showTab('export'), 'small'));
    else body.append(rowOf('Voreinstellung', sel(list.map(([k, v]) => [k, v.label]), st.preset, v => { snap(); st.preset = v; renderDocks(); })));
    const p = pr[st.preset] || {}; const mb = total * ({ klein: 0.28, '720p': 0.45, '1080p': 0.9, '4k': 2.8 }[st.preset] || 0.5) / 8;
    body.append(el('div', { class: 'est' }, el('span', {}, `Auflösung ${p.width || '–'}×${p.height || '–'}`), el('span', {}, `Dauer ${fmt(total)}`), el('span', {}, `≈ ${mb.toFixed(0)} MB`)), el('div', { class: 'row' }, btn('Export starten', () => App.showTab('export'), 'primary'), btn('Zur Warteschlange hinzufügen', () => { App.showTab('export'); toast('Im Export-Tab „Zur Warteschlange" wählen.'); }, 'small')));
    return d;
  }
  function renderDocks() { const b = $$('#docks'); if (!b) return; b.replaceChildren(dockMixer(), dockEdit(), dockAi(), dockExport()); }

  // ---------- Neue Tabs ----------
  const TRN = [['fade', 'Überblenden'], ['dissolve', 'Dissolve'], ['fadeblack', 'Via Schwarz'], ['wipeleft', 'Wischen links'], ['wiperight', 'Wischen rechts'], ['slideleft', 'Schieben links'], ['slideright', 'Schieben rechts'], ['circleopen', 'Kreis öffnen'], ['radial', 'Radial'], ['smoothleft', 'Weich links'], ['zoomin', 'Zoom'], ['pixelize', 'Pixeln'], ['random', 'Zufall']];
  App.tabs.effects = { build(p) { p.append(el('h2', {}, 'Effekte'), el('div', { class: 'hint' }, 'Rechts unten einen Effekt anklicken.'), el('div', { class: 'hint' }, targetLabel()), typeof fxStack === 'function' ? fxStack('Videoeffekte', listOf(), l => { snap(); const tg = targets(); if (tg) tg.forEach(s => { s.effects = l.length ? cl(l) : undefined; }); else P().settings.effects = l.length ? l : undefined; renderAll(); App.showTab('effects'); }, App.fxCat.video) : null); flash('fxp'); } };
  App.tabs.color = { build(p) { p.append(el('h2', {}, 'Farbe'), el('div', { class: 'hint' }, 'Basis, HSL, Kurven, Grading und LUTs findest du im Farbpanel neben dem Monitor. Es wirkt auf die Auswahl, ohne Auswahl auf alle Folien.')); flash('colorp'); } };
  App.tabs.transitions = { build(p) {
    const t = targets(); const cur = t ? (t[0].transition || '') : (P().settings.transition || 'fade');
    p.append(el('h2', {}, 'Übergänge'), el('div', { class: 'hint' }, t ? 'Gilt für die ausgewählten Folien.' : 'Gilt für alle Folien (ohne Auswahl).'));
    const g = el('div', { class: 'grid' }); TRN.forEach(([k, l]) => g.append(el('div', { class: 'thumb' + (cur === k ? ' sel' : ''), style: { height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: '12px', background: 'linear-gradient(135deg,#2a1f4a,#16102a)' }, onclick: () => { snap(); if (t) t.forEach(s => { s.transition = k; }); else P().settings.transition = k; renderAll(); App.showTab('transitions'); } }, l))); p.append(g);
    p.append(rowOf('Dauer (s)', num(P().settings.transitionDur || 1, 0.1, 0.1, v => { snap(); P().settings.transitionDur = Math.max(0.1, v); renderAll(); }))); } };
  const TITLES = [['Lower Third', { x: 0.2, y: 0.82, size: 0.06, text: 'Name\nFunktion' }], ['Großer Titel', { x: 0.5, y: 0.5, size: 0.14, text: 'Titel' }], ['Untertitel-Zeile', { x: 0.5, y: 0.9, size: 0.05, text: 'Untertitel' }], ['Abspann', { x: 0.5, y: 0.5, size: 0.07, text: 'Danke fürs Zuschauen', duration: 5 }], ['Datum / Ort', { x: 0.85, y: 0.08, size: 0.045, text: new Date().toLocaleDateString('de-DE') }]];
  App.tabs.titles = { build(p) {
    p.append(el('h2', {}, 'Titel'), el('div', { class: 'row' }, btn('Titel-Folie einfügen', addTitle, 'primary')), el('h3', {}, 'Overlay-Vorlagen am Abspielkopf'));
    TITLES.forEach(([n, o]) => p.append(el('div', { class: 'row' }, btn(n, () => { snap(); (P().overlays = P().overlays || []).push(Object.assign({ id: uid(), type: 'title', start: Math.round(S().t * 10) / 10, duration: 4, track: 1, fadeIn: 0.5, fadeOut: 0.5, color: '#ffffff' }, cl(o))); renderAll(); toast(n + ' eingefügt (Spur V2)'); }))));
  } };
  const TPL = [['YouTube 1080p', { preset: 'youtube', defaultSlide: 5, transition: 'fade' }], ['Reel / Short (9:16)', { preset: 'reels', defaultSlide: 3, transition: 'slideleft', transitionDur: 0.5 }], ['Jahresrückblick', { preset: '1080p', defaultSlide: 4, transition: 'dissolve', motion: 'zoomin' }], ['4K Familie', { preset: '4k', defaultSlide: 6, transition: 'fade' }], ['Klein / Teilen', { preset: 'klein', defaultSlide: 4, transition: 'fade' }]];
  App.tabs.templates = { build(p) {
    p.append(el('h2', {}, 'Vorlagen'), el('div', { class: 'hint' }, 'Projekt-Voreinstellungen. Medien bleiben erhalten.'));
    TPL.forEach(([n, o]) => p.append(el('div', { class: 'row' }, btn(n, () => { snap(); Object.assign(P().settings, o); renderAll(); toast('Vorlage „' + n + '" angewendet'); }))));
    p.append(el('h3', {}, 'Projekt'), el('div', { class: 'row' }, btn('Neues leeres Projekt', newProject), btn('EDL exportieren', exportEdl)));
  } };
  App.tabs.ai = { build(p) { p.append(el('h2', {}, 'KI-Tools'), el('div', { class: 'hint' }, 'Kacheln unten rechts. Lokal, ohne Cloud.'), el('div', { class: 'row' }, btn('RaLyrics starten', () => App.api.invoke('tools:launch', 'ralyrics').catch(e => toast(e.message, true))), btn('RaSing starten', () => App.api.invoke('tools:launch', 'rasing').catch(e => toast(e.message, true)))), el('div', { class: 'row' }, btn('Upscaler öffnen', () => App.showTab('upscale')))); flash('docks'); } };
  async function exportEdl() { try { const f = await App.api.invoke('edl:save', P()); if (f) toast('EDL gespeichert: ' + f); } catch (e) { toast(e.message, true); } }

  function rippleDelete() {
    const { L } = layout(); const hit = L.filter(x => S().selected.has(x.s.id)); if (!hit.length) return toast('Erst Folien auswählen.');
    snap(); const cut = hit.map(x => [x.start, x.end]); const shift = t => cut.reduce((a, [s0, e0]) => a + (t >= e0 - 1e-6 ? e0 - s0 : 0), 0);
    (P().overlays || []).forEach(o => { o.start = Math.max(0, +((o.start || 0) - shift(o.start || 0)).toFixed(2)); }); (P().markers || []).forEach(m => { m.t = Math.max(0, +(m.t - shift(m.t)).toFixed(2)); });
    P().slides = P().slides.filter(x => !S().selected.has(x.id)); S().selected.clear(); renderAll();
  }
  // ---------- Marker ----------
  function addMarker() { snap(); (P().markers = P().markers || []).push({ id: uid(), t: Math.round(S().t * 100) / 100, name: 'Marker ' + ((P().markers || []).length + 1), color: '#a78bfa' }); P().markers.sort((a, b) => a.t - b.t); renderAll(); }

  // ---------- Zeitleiste: Spurköpfe, Marker ----------
  function chip(name, row) {
    const mk = (t, k, ti) => el('button', { class: 'tb' + (flag(name, k) ? ' on' : ''), title: ti, onclick: e => { e.stopPropagation(); snap(); TF(name)[k] = !flag(name, k); renderAll(); } }, t);
    const isA = name[0] === 'A';
    row.querySelectorAll(':scope > .trchip, :scope > .hint').forEach(x => x.remove());
    row.insertBefore(el('div', { class: 'trchip' }, el('b', {}, name), el('i', {}, ({ V3: 'Overlay', V2: 'Overlay', V1: 'Video', A1: 'Musik', A2: 'Sprecher', A3: 'SFX' })[name] || ''), mk('🔒', 'lock', 'Sperren'), isA ? mk('M', 'mute', 'Stumm') : mk('👁', 'hide', 'Ausblenden'), isA ? mk('S', 'solo', 'Solo') : null), row.firstChild);
    row.classList.toggle('locked', flag(name, 'lock')); row.classList.toggle('off', isA ? !audible(name) : !visible(name));
  }
  function ensureRow(id, after) { let r = document.getElementById(id); if (!r) { r = el('div', { class: 'tl-row music', id, style: { height: '34px' } }); after.parentNode.insertBefore(r, after.nextSibling); } return r; }
  const _rt = renderTimeline; renderTimeline = function () {
    _rt(); const z = S().zoom;
    document.querySelectorAll('#ovRows .ovrow').forEach(r => chip('V' + ((+r.dataset.track || 1) + 1), r));
    const box = document.getElementById('ovRows'); if (box) { box.style.display = 'flex'; box.style.flexDirection = 'column-reverse'; }
    chip('V1', $$('#rowSlides')); const a1 = $$('#rowMusic'); chip('A1', a1);
    const a2 = ensureRow('rowVoice', a1); a2.querySelectorAll(':scope > .blk').forEach(x => x.remove());
    (P().voice || []).forEach(v => a2.append(el('div', { class: 'blk photo', style: { left: (v.start || 0) * z + 'px', width: Math.max(10, (v.duration || 5) * z) + 'px', height: '26px', top: '4px' }, title: v.src }, el('div', { class: 'lbl', style: { position: 'static', padding: '3px 6px', fontSize: '11px' } }, base(v.src || '')))));
    chip('A2', a2); const a3 = ensureRow('rowA3', a2); chip('A3', a3);
    const ruler = $$('#tlRuler'); (P().markers || []).forEach(m => { const f = el('div', { class: 'mk', title: m.name + ' · ' + fmt(m.t), style: { left: m.t * z + 'px' }, onclick: e => { e.stopPropagation(); seek(m.t); }, oncontextmenu: e => { e.preventDefault(); snap(); P().markers = P().markers.filter(x => x !== m); renderAll(); } }, el('span', {}, m.name)); ruler.append(f); });
  };
  const bar = $$('.tl-bar'); if (bar && !$$('#tlMark')) { const z = $$('#tlZoom'); const b1 = el('button', { class: 'btn small', id: 'tlMark', title: 'Marker setzen (M)', onclick: addMarker }, '⚑ Marker'); const b2 = el('button', { class: 'btn small', title: 'Befehlspalette (Strg+K)', onclick: () => palette() }, '⌘ Befehle'); bar.insertBefore(b1, bar.querySelector('.sep')); bar.insertBefore(b2, bar.querySelector('.sep')); }

  // ---------- Medien: Favoriten, Bewertung, Tags ----------
  const meta = p => { const m = P().mediaMeta || (P().mediaMeta = {}); return m[p] || (m[p] = {}); };
  let mFilter = 'Alle', mTag = '';
  const mt = App.tabs.media; const _mr = mt.refresh, _mb = mt.build;
  let recBtn = null;
  async function toggleRec() {
    try {
      if (!recBtn || !recBtn.recording) { await App.api.invoke('capture:start', { fps: 30 }); toast('Aufnahme läuft …'); window.__rec = true; }
      else { const r = await App.api.invoke('capture:stop'); window.__rec = false; toast(`Aufnahme gespeichert (${r.seconds.toFixed(0)} s)`); await mt.importPaths([r.file]); }
      if (recBtn) { recBtn.recording = window.__rec; recBtn.textContent = window.__rec ? '■ Aufnahme beenden' : '● Bildschirm aufnehmen'; }
    } catch (e) { toast(e.message, true); window.__rec = false; if (recBtn) { recBtn.recording = false; recBtn.textContent = '● Bildschirm aufnehmen'; } }
  }
  function projectTree() {
    const ov = P().overlays || [], mk = P().markers || [], d = (t, n, kids) => el('details', { open: true, class: 'tree' }, el('summary', {}, t + ' (' + n + ')'), ...kids);
    const fo = P().slides.slice(0, 200).map((x, i) => el('div', { class: 'tn' + (S().selected.has(x.id) ? ' on' : ''), onclick: () => { S().selected = new Set([x.id]); renderAll(); const it = layout().L[i]; if (it) seek(it.start); } }, (i + 1) + '. ' + (x.type === 'title' ? (x.text || 'Titel') : base(x.src))));
    return el('div', { class: 'card', style: { maxHeight: '170px', overflow: 'auto' } }, el('b', {}, P().name || 'Projekt'), d('Folien (V1)', P().slides.length, fo), d('Overlays', ov.length, ov.map(o => el('div', { class: 'tn', onclick: () => { S().selOv = o.id; renderAll(); } }, (o.type === 'title' ? o.text || 'Titel' : base(o.src || '')).split('\n')[0]))), d('Musik', P().audio.length, P().audio.map(a => el('div', { class: 'tn' }, base(a.src)))), d('Marker', mk.length, mk.map(m => el('div', { class: 'tn', onclick: () => seek(m.t) }, fmt(m.t) + ' ' + m.name))));
  }
  mt.build = function (p) {
    _mb.call(this, p);
    recBtn = btn(window.__rec ? '■ Aufnahme beenden' : '● Bildschirm aufnehmen', toggleRec, 'small'); recBtn.recording = !!window.__rec; p.insertBefore(el('div', { class: 'row' }, recBtn), this.grid); { const t = projectTree(); t.id = 'ptree'; p.insertBefore(t, this.grid); }
    const f = el('div', { class: 'row' }, sel(['Alle', 'Favoriten', '★ 3+', 'Fotos', 'Videos'].map(x => [x, x]), mFilter, v => { mFilter = v; this.refresh(); }), el('input', { type: 'text', placeholder: 'Tag …', value: mTag, oninput: e => { mTag = e.target.value.trim().toLowerCase(); this.refresh(); } }), btn('Tag →', () => { const t = mTag; if (!t) return toast('Erst Tag eintippen.'); const ms = S().media.filter(x => this.sel.has(x.id)); if (!ms.length) return toast('Erst Dateien markieren.'); ms.forEach(x => { const m = meta(x.path); m.tags = [...new Set([...(m.tags || []), t])]; }); toast(ms.length + ' Datei(en) getaggt'); }, 'small'));
    p.insertBefore(f, this.grid);
  };
  mt.refresh = function () {
    const all = S().media; const ok = m => { const x = (P().mediaMeta || {})[m.path] || {}; return (mFilter === 'Alle' || (mFilter === 'Favoriten' && x.fav) || (mFilter === '★ 3+' && (x.rating || 0) >= 3) || (mFilter === 'Fotos' && m.kind === 'photo') || (mFilter === 'Videos' && m.kind === 'video')) && (!mTag || (x.tags || []).some(t => t.includes(mTag))); };
    const vis = all.filter(ok); S().media = vis; try { _mr.call(this); } finally { S().media = all; }
    if (!this.grid) return; [...this.grid.querySelectorAll('.thumb')].forEach((t, i) => { const m = vis[i]; if (!m) return; const x = (P().mediaMeta || {})[m.path] || {};
      t.append(el('div', { class: 'mstar', title: 'Favorit / Bewertung (Rechtsklick)', onclick: e => { e.stopPropagation(); snap(); const mm = meta(m.path); mm.fav = !mm.fav; this.refresh(); }, oncontextmenu: e => { e.preventDefault(); e.stopPropagation(); const mm = meta(m.path); mm.rating = ((mm.rating || 0) + 1) % 6; this.refresh(); } }, (x.fav ? '★' : '☆') + (x.rating ? ' ' + x.rating : ''))); });
  };

  // ---------- Befehlspalette ----------
  function palette() {
    if ($$('#pal')) return $$('#pal').remove();
    const cmds = [
      ...(window.StudioCmds || []),
      ...App.railTabs.map(([k, l]) => ['Reiter: ' + l, () => App.showTab(k)]),
      ['Teilen am Abspielkopf', splitAtPlayhead], ['Auswahl löschen', deleteSelected], ['Auswahl duplizieren', duplicateSelected], ['Rückgängig', undo], ['Wiederholen', redo],
      ['Speichern', () => saveProject(false)], ['Projekt öffnen', openProject], ['Neues Projekt', newProject], ['Marker setzen', addMarker], ['Titel-Folie einfügen', addTitle], ['EDL exportieren', exportEdl],
      ['Sprache DE/EN wechseln', () => window.I18n && I18n.toggle()], ['Alle Spuren einblenden', () => { snap(); P().tracks = {}; renderAll(); }], ['Zum Anfang', () => seek(0)], ['Abspielen / Pause', play],
      ['Bildschirm aufnehmen / beenden', toggleRec], ['Ripple-Löschen', rippleDelete], ['Export öffnen', () => App.showTab('export')], ['Farbe zurücksetzen', () => { snap(); editFx(l => l.filter(e => !/^FX\.COLOR\./.test(e.id))); renderAll(); }]];
    window.StudioAllCmds = cmds; let idx = 0, shown = cmds; const list = el('div', { class: 'plist' });
    const draw = () => { list.replaceChildren(...shown.map(([n, f], i) => el('div', { class: 'pit' + (i === idx ? ' on' : ''), onclick: () => run(f) }, n))); };
    const run = f => { box.remove(); const cc = cmds.find(x => x[1] === f); if (cc) (window.StudioHist = window.StudioHist || []).push(cc[0]); try { f(); } catch (e) { toast(e.message, true); } };
    const inp = el('input', { type: 'text', placeholder: 'Befehl eingeben …', oninput: e => { const q = e.target.value.toLowerCase(); shown = cmds.filter(c => c[0].toLowerCase().includes(q)); idx = 0; draw(); }, onkeydown: e => { if (e.key === 'Escape') box.remove(); else if (e.key === 'ArrowDown') { idx = Math.min(shown.length - 1, idx + 1); draw(); e.preventDefault(); } else if (e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); draw(); e.preventDefault(); } else if (e.key === 'Enter' && shown[idx]) run(shown[idx][1]); } });
    const box = el('div', { id: 'pal', onclick: e => { if (e.target === box) box.remove(); } }, el('div', { class: 'pbox' }, inp, list)); document.body.append(box); draw(); inp.focus();
  }
  addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey; if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); return palette(); }
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || mod) return; const k = e.key.toLowerCase();
    if (k === 'm') addMarker(); else if (k === 'j') seek(S().t - 5); else if (k === 'k') { if (S().playing) play(); } else if (k === 'l') { if (!S().playing) play(); else seek(S().t + 5); }
  });

  // ---------- Verdrahtung ----------
  const _ra = renderAll; renderAll = function () { _ra(); renderColor(); renderFxp(); renderDocks(); const pt = document.getElementById('ptree'); if (pt && pt.isConnected) { const n = projectTree(); n.id = 'ptree'; pt.replaceWith(n); } };
  window.Studio = { setParam, addMarker, palette, editFx, rippleDelete, projectTree, docks: { mixer: dockMixer, edit: dockEdit, ai: dockAi, export: dockExport, fader } };
  window.addEventListener('load', () => setTimeout(() => { renderColor(); renderFxp(); renderDocks(); }, 400));
})();

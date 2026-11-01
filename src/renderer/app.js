'use strict';
// Viola – Kern der Oberfläche: Zustand, Zeitleiste, Vorschau, Inspektor, Verlauf (Rückgängig/Wiederholen).
const $ = (s, r = document) => r.querySelector(s);
function el(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') e.className = v; else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v;
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat(2).forEach(c => { if (c == null || c === false) return; e.append(c.nodeType ? c : document.createTextNode(c)); });
  return e;
}
const fmt = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const uid = () => Math.random().toString(36).slice(2, 9);
const base = p => String(p).split(/[\\/]/).pop();
function toast(msg, err) { const t = el('div', { class: 'toast' + (err ? ' err' : '') }, msg); $('#toasts').append(t); setTimeout(() => t.remove(), err ? 9000 : 4500); }
const blankProject = () => ({ name: 'Neues Projekt', settings: { preset: '720p', transitionDur: 1, defaultSlide: 5, transition: 'fade', motion: 'none', chunk: 12, encoderPreset: 'veryfast' }, slides: [], audio: [], music: { normalize: true, lufs: -14, fadeIn: 2, fadeOut: 5, cross: 4 } });

const App = {
  api: window.api, info: null, settings: {}, tabs: {}, listeners: [],
  state: { project: blankProject(), selected: new Set(), last: null, t: 0, playing: false, zoom: 22, media: [], history: [], future: [], file: null, tab: 'media' },
  onEvent(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter(f => f !== fn); }; },
};
App.railTabs = [['media', 'Medien'], ['collage', 'Collage'], ['music', 'Musik'], ['upscale', 'Upscaler'], ['export', 'Export']];
const S = () => App.state, P = () => App.state.project;

// ---------- Verlauf ----------
function snap() { S().history.push(JSON.stringify(P())); if (S().history.length > 120) S().history.shift(); S().future = []; }
function commit(fn) { snap(); fn(); renderAll(); }
function undo() { if (!S().history.length) return; S().future.push(JSON.stringify(P())); App.state.project = JSON.parse(S().history.pop()); S().selected.clear(); renderAll(); }
function redo() { if (!S().future.length) return; S().history.push(JSON.stringify(P())); App.state.project = JSON.parse(S().future.pop()); S().selected.clear(); renderAll(); }

// ---------- Layout der Zeitleiste ----------
function layout() {
  const F = +P().settings.transitionDur || 1; let acc = 0; const L = [];
  P().slides.forEach((s, i) => { const d = Math.max(+s.duration || +P().settings.defaultSlide || 5, 2 * F + 0.1); const start = i === 0 ? 0 : acc - i * F; L.push({ s, i, d, start, end: start + d }); acc += d; });
  return { L, total: L.length ? L[L.length - 1].end : 0, F };
}

// ---------- Vorschaubilder ----------
const thumbCache = new Map();
function thumbUrl(path, size = 240) {
  const k = path + '|' + size; if (!thumbCache.has(k)) thumbCache.set(k, App.api.invoke('media:thumb', path, size).then(p => p ? App.api.mediaUrl(p) : null).catch(() => null));
  return thumbCache.get(k);
}

// ---------- Zeitleiste ----------
function renderTimeline() {
  const { L, total } = layout(); const z = S().zoom; const sc = $('#tlScroll'); const inner = $('#tlInner');
  inner.style.width = Math.max(total * z + 320, sc.clientWidth) + 'px';
  const ruler = $('#tlRuler'); ruler.replaceChildren();
  const step = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600].find(s => s * z >= 70) || 3600;
  for (let t = 0; t <= total + step; t += step) ruler.append(el('div', { class: 'tick', style: { left: t * z + 'px' } }, fmt(t)));
  const row = $('#rowSlides'); row.replaceChildren();
  const x0 = sc.scrollLeft - 300, x1 = sc.scrollLeft + sc.clientWidth + 300;
  for (const it of L) {
    const l = it.start * z, w = it.d * z; if (l + w < x0 || l > x1) continue;
    const s = it.s;
    const b = el('div', { class: 'blk ' + s.type + (S().selected.has(s.id) ? ' sel' : ''), style: { left: l + 'px', width: Math.max(6, w - 2) + 'px' }, 'data-i': it.i });
    if (s.type === 'title') b.append(el('div', { class: 'ttl' }, s.text || 'Titel', s.subtitle ? el('small', {}, s.subtitle) : null));
    else { thumbUrl(s.src).then(u => { if (u) b.style.backgroundImage = `url("${u}")`; }); b.append(el('div', { class: 'lbl' }, base(s.src))); }
    const tags = [s.type === 'video' ? '🎞' : '', s.upscale ? '⬆ KI' : '', s.motion && s.motion !== 'none' ? '⤢' : ''].filter(Boolean).join(' ');
    if (tags) b.append(el('div', { class: 'badge' }, tags));
    b.append(el('div', { class: 'hnd', 'data-h': '1' }));
    row.append(b);
  }
  const mrow = $('#rowMusic'); mrow.replaceChildren(); let mt = 0;
  P().audio.forEach(a => { const d = a.duration || 180; mrow.append(el('div', { class: 'mblk', style: { left: mt * z + 'px', width: Math.max(8, d * z - 2) + 'px' } }, '♪ ' + base(a.src).replace(/\.[^.]+$/, ''))); mt += d - (P().music.cross || 4); });
  $('#tlStats').textContent = `${P().slides.length} Folien · ${fmt(total)}`;
  updatePlayhead();
}
function updatePlayhead() { $('#playhead').style.left = S().t * S().zoom + 'px'; }
function selectSlide(id, ev) {
  const ids = P().slides.map(s => s.id);
  if (ev && ev.shiftKey && S().last) { const a = ids.indexOf(S().last), b = ids.indexOf(id); const [lo, hi] = a < b ? [a, b] : [b, a]; ids.slice(lo, hi + 1).forEach(i => S().selected.add(i)); }
  else if (ev && (ev.ctrlKey || ev.metaKey)) { S().selected.has(id) ? S().selected.delete(id) : S().selected.add(id); }
  else { S().selected = new Set([id]); }
  S().last = id; renderTimeline(); renderInspector();
}
function initTimeline() {
  const sc = $('#tlScroll'); let raf = 0; sc.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderTimeline(); }); });
  $('#tlZoom').addEventListener('input', e => { S().zoom = +e.target.value; renderTimeline(); });
  $('#tlRuler').addEventListener('mousedown', e => { const r = $('#tlInner').getBoundingClientRect(); seek((e.clientX - r.left) / S().zoom); const mv = ev => seek((ev.clientX - r.left) / S().zoom); const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); }; addEventListener('mousemove', mv); addEventListener('mouseup', up); });
  $('#rowSlides').addEventListener('mousedown', e => {
    const b = e.target.closest('.blk'); if (!b) { S().selected.clear(); renderTimeline(); renderInspector(); return; }
    const i = +b.dataset.i, s = P().slides[i]; const startX = e.clientX; const z = S().zoom;
    if (e.target.dataset.h) {
      snap(); const d0 = +s.duration || +P().settings.defaultSlide; S().selected = new Set([s.id]);
      const mv = ev => { s.duration = Math.max(0.5, Math.round((d0 + (ev.clientX - startX) / z) * 10) / 10); renderTimeline(); };
      const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); renderAll(); }; addEventListener('mousemove', mv); addEventListener('mouseup', up); return;
    }
    if (!S().selected.has(s.id) || e.shiftKey || e.ctrlKey) selectSlide(s.id, e);
    let drag = false; const inner = $('#tlInner').getBoundingClientRect(); const ind = el('div', { style: { position: 'absolute', top: '-4px', bottom: '-4px', width: '3px', background: '#d9b8ff', boxShadow: '0 0 8px #b68cf5', zIndex: 5 } });
    const mv = ev => { if (!drag && Math.abs(ev.clientX - startX) > 6) { drag = true; $('#rowSlides').append(ind); } if (drag) ind.style.left = insertX((ev.clientX - inner.left) / z) * z + 'px'; };
    const up = ev => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); ind.remove(); if (drag) moveSelected(insertIndex((ev.clientX - inner.left) / z)); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  });
  $('#rowSlides').addEventListener('dblclick', e => { const b = e.target.closest('.blk'); if (b) seek(layout().L[+b.dataset.i].start); });
}
function insertIndex(t) { const { L } = layout(); for (const it of L) if ((it.start + it.d / 2) > t) return it.i; return L.length; }
function insertX(t) { const { L } = layout(); const i = insertIndex(t); return i >= L.length ? (L.length ? L[L.length - 1].end : 0) : L[i].start; }
function moveSelected(idx) {
  const sel = P().slides.filter(s => S().selected.has(s.id)); if (!sel.length) return;
  commit(() => { const before = P().slides.slice(0, idx).filter(s => !S().selected.has(s.id)); const after = P().slides.slice(idx).filter(s => !S().selected.has(s.id)); P().slides = [...before, ...sel, ...after]; });
}
function deleteSelected() { if (!S().selected.size) return; commit(() => { P().slides = P().slides.filter(s => !S().selected.has(s.id)); S().selected.clear(); }); }
function duplicateSelected() { if (!S().selected.size) return; commit(() => { const out = []; P().slides.forEach(s => { out.push(s); if (S().selected.has(s.id)) out.push(Object.assign(JSON.parse(JSON.stringify(s)), { id: uid() })); }); P().slides = out; }); }
function splitAtPlayhead() {
  const { L } = layout(); const it = L.find(x => S().selected.has(x.s.id) && x.s.type === 'video' && S().t > x.start + 0.3 && S().t < x.end - 0.3);
  if (!it) return toast('Zum Teilen: ein Video auswählen und den Abspielkopf hineinsetzen.');
  const local = S().t - it.start; commit(() => { const a = it.s; const b = Object.assign(JSON.parse(JSON.stringify(a)), { id: uid(), trimStart: (a.trimStart || 0) + local, duration: it.d - local }); a.duration = local; P().slides.splice(it.i + 1, 0, b); });
}
function newSlide(item) {
  const d = +P().settings.defaultSlide || 5;
  if (item.kind === 'video') return { id: uid(), type: 'video', src: item.path, duration: Math.max(1, +item.duration || d), trimStart: 0 };
  return { id: uid(), type: 'photo', src: item.path, duration: d };
}
function addSlides(items, at) {
  const arr = items.map(newSlide); commit(() => { const i = at == null ? P().slides.length : at; P().slides.splice(i, 0, ...arr); S().selected = new Set(arr.map(s => s.id)); });
}
function addTitle() { const sel = P().slides.findIndex(s => S().selected.has(s.id)); const i = sel >= 0 ? sel : P().slides.length; const s = { id: uid(), type: 'title', text: 'Titel', subtitle: '', duration: 4 }; commit(() => { P().slides.splice(i, 0, s); S().selected = new Set([s.id]); }); }

// ---------- Vorschau ----------
const cv = $('#cv'), cx = cv.getContext('2d'); const imgs = new Map();
function getImg(path) {
  let e = imgs.get(path);
  if (!e) { e = { img: new Image(), ok: false }; imgs.set(path, e); App.api.invoke('media:thumb', path, 960).then(p => { if (p) { e.img.onload = () => { e.ok = true; drawPreview(); }; e.img.src = App.api.mediaUrl(p); } }); if (imgs.size > 80) imgs.delete(imgs.keys().next().value); }
  return e.ok ? e.img : null;
}
function drawSlide(s, prog, alpha) {
  const W = cv.width, H = cv.height; cx.globalAlpha = alpha;
  if (s.type === 'title') {
    const g = cx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2a1245'); g.addColorStop(1, '#6b3fa0'); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    cx.textAlign = 'center'; cx.fillStyle = '#fff'; cx.font = `bold ${Math.round(H * .14)}px Georgia, serif`; cx.fillText(s.text || '', W / 2, s.subtitle ? H * .5 : H * .54);
    if (s.subtitle) { cx.fillStyle = '#d9c4f5'; cx.font = `${Math.round(H * .055)}px Arial`; cx.fillText(s.subtitle, W / 2, H * .5 + H * .1); }
  } else {
    const im = getImg(s.src);
    if (!im) { cx.fillStyle = '#1d1032'; cx.fillRect(0, 0, W, H); }
    else {
      const cover = Math.max(W / im.width, H / im.height); cx.filter = 'blur(18px) brightness(.45)'; cx.drawImage(im, (W - im.width * cover) / 2, (H - im.height * cover) / 2, im.width * cover, im.height * cover); cx.filter = 'none';
      const mo = s.motion && s.motion !== 'none' ? s.motion : (P().settings.motion || 'none'); let k = 1, dx = 0;
      if (mo === 'zoomin') k = 1 + .15 * prog; else if (mo === 'zoomout') k = 1.15 - .15 * prog; else if (mo === 'panleft') { k = 1.15; dx = (.5 - prog) * W * .13; } else if (mo === 'panright') { k = 1.15; dx = (prog - .5) * W * .13; }
      const sc = Math.min(W * .97 / im.width, H * .95 / im.height) * k; cx.drawImage(im, (W - im.width * sc) / 2 + dx, (H - im.height * sc) / 2, im.width * sc, im.height * sc);
      if (s.caption) { cx.fillStyle = 'rgba(26,10,46,.6)'; cx.fillRect(0, H - H * .1, W, H * .1); cx.fillStyle = '#fff'; cx.font = `${Math.round(H * .045)}px Arial`; cx.textAlign = 'center'; cx.fillText(s.caption, W / 2, H - H * .035); }
    }
  }
  cx.globalAlpha = 1;
}
function drawPreview() {
  cx.fillStyle = '#000'; cx.fillRect(0, 0, cv.width, cv.height);
  const { L, total, F } = layout(); const t = Math.min(S().t, total);
  if (!L.length) { cx.fillStyle = '#6d5a94'; cx.font = '34px Segoe UI, Arial'; cx.textAlign = 'center'; cx.fillText(window.I18n ? I18n.t('Füge links Fotos, Videos oder Titel hinzu') : 'Füge links Fotos, Videos oder Titel hinzu', cv.width / 2, cv.height / 2); $('#screenInfo').textContent = ''; return; }
  const cur = L.filter(x => x.start <= t + 1e-6 && t < x.end).pop() || L[L.length - 1];
  if (cur.i > 0 && t < cur.start + F) { const pv = L[cur.i - 1]; drawSlide(pv.s, Math.min(1, (t - pv.start) / pv.d), 1); drawSlide(cur.s, 0, (t - cur.start) / F); }
  else drawSlide(cur.s, Math.min(1, (t - cur.start) / cur.d), 1);
  $('#screenInfo').textContent = `Folie ${cur.i + 1} / ${L.length} · ${cur.s.type === 'title' ? 'Titel' : base(cur.s.src)}`;
}
function seek(t) { const { total } = layout(); S().t = Math.max(0, Math.min(total, t)); updateTransport(); drawPreview(); if (S().playing) startAudio(); }
function updateTransport() {
  const { total } = layout(); $('#tTime').textContent = `${fmt(S().t)} / ${fmt(total)}`; $('#tSeek').value = total ? Math.round(S().t / total * 1000) : 0; updatePlayhead();
  const sc = $('#tlScroll'); const x = S().t * S().zoom; if (S().playing && (x > sc.scrollLeft + sc.clientWidth - 80 || x < sc.scrollLeft)) sc.scrollLeft = Math.max(0, x - 120);
}
function startAudio() {
  const a = $('#aud'); a.pause(); if (!$('#tMusic').checked || !P().audio.length || !S().playing) return;
  let off = 0; const cross = P().music.cross || 4; let idx = -1, loc = 0;
  for (let i = 0; i < P().audio.length; i++) { const d = P().audio[i].duration || 180; if (S().t < off + d) { idx = i; loc = S().t - off; break; } off += d - cross; }
  if (idx < 0) return; const tr = P().audio[idx]; a.src = App.api.mediaUrl(tr.src); a.volume = Math.min(1, tr.volume == null ? 1 : tr.volume); a.currentTime = loc;
  a.onended = () => { if (S().playing && idx + 1 < P().audio.length) { a.src = App.api.mediaUrl(P().audio[idx + 1].src); a.play().catch(() => {}); } }; a.play().catch(() => {});
}
function play() {
  if (S().playing) return pause(); const { total } = layout(); if (!total) return; if (S().t >= total - 0.05) S().t = 0;
  S().playing = true; $('#tPlay').textContent = '⏸'; startAudio(); let last = performance.now();
  const loop = now => { if (!S().playing) return; S().t += (now - last) / 1000; last = now; if (S().t >= total) { S().t = total; pause(); } updateTransport(); drawPreview(); if (S().playing) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
function pause() { S().playing = false; $('#tPlay').textContent = '▶'; $('#aud').pause(); }

// ---------- Inspektor ----------
const rowOf = (label, ctl, hint) => el('div', {}, el('div', { class: 'row' }, el('label', {}, label), ctl), hint ? el('div', { class: 'hint' }, hint) : null);
function sel(options, value, onchange) { const s = el('select', { onchange: e => onchange(e.target.value) }); options.forEach(([v, l]) => s.append(el('option', { value: v, selected: String(v) === String(value) }, l))); return s; }
function num(value, step, min, onchange) { return el('input', { type: 'number', value, step, min, onchange: e => onchange(parseFloat(e.target.value)) }); }
function txt(value, onchange, ph) { return el('input', { type: 'text', value: value || '', placeholder: ph || '', onchange: e => onchange(e.target.value) }); }
function renderInspector() {
  const box = $('#inspector'); box.replaceChildren(); const sl = P().slides.filter(s => S().selected.has(s.id)); const cfg = App.info || { transitions: ['fade'], motions: ['none'], presets: {} };
  const TR = [['random', 'Zufällig'], ...cfg.transitions.map(t => [t, t])]; const MO = [['none', 'Keine'], ['zoomin', 'Heranzoomen'], ['zoomout', 'Herauszoomen'], ['panleft', 'Schwenk links'], ['panright', 'Schwenk rechts']];
  if (!sl.length) {
    box.append(el('h2', {}, 'Projekt-Einstellungen'));
    const c = P().settings; const set = (k, v) => { snap(); c[k] = v; renderAll(); };
    box.append(
      rowOf('Qualität', sel(Object.entries(cfg.presets).map(([k, v]) => [k, (v.group ? v.group + " · " : "") + v.label]), c.preset, v => set('preset', v))),
      rowOf('Standarddauer', num(c.defaultSlide, 0.5, 1, v => set('defaultSlide', v || 5)), 'Sekunden pro Foto (neue Folien)'),
      rowOf('Überblendung', num(c.transitionDur, 0.1, 0.2, v => set('transitionDur', v || 1)), 'Sekunden'),
      rowOf('Übergang', sel(TR, c.transition, v => set('transition', v))),
      rowOf('Bewegung', sel(MO, c.motion, v => set('motion', v)), 'Ken-Burns-Effekt für alle Fotos'),
      rowOf('Bildanpassung', sel([['blur', 'Ganz zeigen (unscharfer Rand)'], ['cover', 'Füllen (Mitte zuschneiden)'], ['smart', 'Intelligent zuschneiden (Hochformat)']], c.fit, v => set('fit', v))),
      rowOf('Kodierung', sel([['ultrafast', 'Sehr schnell, größer'], ['veryfast', 'Schnell (empfohlen)'], ['medium', 'Langsam, kleiner'], ['slow', 'Sehr langsam, am kleinsten']], c.encoderPreset, v => set('encoderPreset', v))),
      el('h2', { style: { marginTop: '18px' } }, 'Musik'),
      rowOf('Lautstärke angleichen', el('input', { type: 'checkbox', checked: !!P().music.normalize, onchange: e => { snap(); P().music.normalize = e.target.checked; } }), 'Alle Lieder gleich laut'),
      rowOf('Ziel (LUFS)', num(P().music.lufs, 1, -30, v => { snap(); P().music.lufs = v; }), '−14 = wie Streaming, höher = lauter'),
      rowOf('Einblenden (s)', num(P().music.fadeIn, 0.5, 0, v => { snap(); P().music.fadeIn = v; })),
      rowOf('Ausblenden (s)', num(P().music.fadeOut, 0.5, 0, v => { snap(); P().music.fadeOut = v; })),
      el('p', { class: 'hint', style: { marginTop: '14px' } }, 'Tipp: Folien in der Zeitleiste anklicken (Strg/Umschalt = mehrere), um Dauer, Übergang, Bewegung und Text zu ändern.'));
    return;
  }
  box.append(el('h2', {}, sl.length === 1 ? (sl[0].type === 'title' ? 'Titel' : sl[0].type === 'video' ? 'Video' : 'Foto') : sl.length + ' Folien ausgewählt'));
  const each = (k, v) => { snap(); sl.forEach(s => { s[k] = v; }); renderAll(); };
  const first = sl[0];
  box.append(rowOf('Dauer (s)', num(first.duration, 0.5, 0.5, v => each('duration', v || 5))));
  box.append(rowOf('Übergang davor', sel(TR, first.transition || P().settings.transition, v => each('transition', v))));
  if (sl.every(s => s.type === 'photo')) box.append(rowOf('Bewegung', sel(MO, first.motion || 'none', v => each('motion', v))), rowOf('Bildtext', txt(first.caption, v => each('caption', v), 'Unterzeile im Bild')));
  if (sl.every(s => s.type === 'title')) box.append(rowOf('Titel', txt(first.text, v => each('text', v))), rowOf('Untertitel', txt(first.subtitle, v => each('subtitle', v))));
  if (sl.length === 1 && first.type === 'video') box.append(rowOf('Start im Video (s)', num(first.trimStart || 0, 0.5, 0, v => each('trimStart', v || 0))));
  if (sl.every(s => s.type !== 'title')) box.append(rowOf('KI-Hochskalieren', el('input', { type: 'checkbox', checked: sl.every(s => s.upscale), onchange: e => each('upscale', e.target.checked) }), 'Mit Video2X vor dem Rendern verbessern (Reiter „Upscaler")'));
  box.append(el('div', { class: 'row', style: { marginTop: '14px' } }, el('button', { class: 'btn small', onclick: () => { S().selected.clear(); renderAll(); } }, 'Auswahl aufheben')));
  if (first.src) box.append(el('p', { class: 'hint' }, first.src));
}

// ---------- Projekt ----------
function renderAll() { renderTimeline(); renderInspector(); updateTransport(); drawPreview(); if (App.tabs[S().tab] && App.tabs[S().tab].refresh) App.tabs[S().tab].refresh(); $('#projName').value = P().name || ''; }
async function saveProject(as) {
  let f = S().file; if (!f || as) f = await App.api.invoke('dialog:saveProject', P().name); if (!f) return;
  await App.api.invoke('project:save', f, P()); S().file = f; toast('Projekt gespeichert: ' + base(f));
}
async function openProject() {
  const f = await App.api.invoke('dialog:openProject'); if (!f) return;
  try { App.state.project = Object.assign(blankProject(), await App.api.invoke('project:load', f)); P().slides.forEach(s => { if (!s.id) s.id = uid(); }); S().file = f; S().selected.clear(); S().history = []; S().t = 0; renderAll(); toast('Projekt geöffnet: ' + base(f)); }
  catch (e) { toast('Konnte nicht öffnen: ' + e.message, true); }
}
function newProject() { if (P().slides.length && !confirm('Aktuelles Projekt verwerfen?')) return; App.state.project = blankProject(); S().file = null; S().selected.clear(); S().history = []; S().t = 0; renderAll(); }

const ICONS = { media: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>', collage: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>', music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>', upscale: '<path d="M4 20h16M12 16V4M6 10l6-6 6 6"/>', export: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/>' };
App.init = async function () {
  App.info = await App.api.invoke('info'); App.settings = await App.api.invoke('settings:get');
  const rail = $('#rail');
  App.railTabs.forEach(([k, l]) => rail.append(el('button', { class: 'rail-btn', 'data-tab': k, onclick: () => App.showTab(k) }, el('span', { html: `<svg viewBox="0 0 24 24">${ICONS[k]}</svg>` }), l)));
  initTimeline(); App.api.on(m => App.listeners.forEach(f => f(m)));
  $('#bNew').onclick = newProject; $('#bOpen').onclick = openProject; $('#bSave').onclick = () => saveProject(false); $('#bUndo').onclick = undo; $('#bRedo').onclick = redo; $('#bExport').onclick = () => App.showTab('export');
  $('#projName').onchange = e => { P().name = e.target.value; };
  $('#tPlay').onclick = play; $('#tStart').onclick = () => seek(0); $('#tSeek').oninput = e => seek(+e.target.value / 1000 * layout().total); $('#tMusic').onchange = () => S().playing && startAudio();
  $('#tlDel').onclick = deleteSelected; $('#tlDup').onclick = duplicateSelected; $('#tlSplit').onclick = splitAtPlayhead;
  addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && e.key !== 'Escape') return;
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (e.code === 'Space') { e.preventDefault(); play(); } else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
    else if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } else if (mod && k === 'y') { e.preventDefault(); redo(); }
    else if (mod && k === 's') { e.preventDefault(); saveProject(e.shiftKey); } else if (mod && k === 'd') { e.preventDefault(); duplicateSelected(); }
    else if (k === 's') splitAtPlayhead(); else if (e.key === 'ArrowRight') seek(S().t + (e.shiftKey ? 5 : 1)); else if (e.key === 'ArrowLeft') seek(S().t - (e.shiftKey ? 5 : 1));
  });
  addEventListener('resize', renderTimeline);
  App.showTab('media'); renderAll();
};
App.showTab = function (k) {
  S().tab = k; document.querySelectorAll('.rail-btn').forEach(b => b.classList.toggle('on', b.dataset.tab === k));
  const p = $('#panel'); p.replaceChildren(); if (App.tabs[k]) App.tabs[k].build(p);
};

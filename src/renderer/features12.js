'use strict';
// Viola Pro – Seiten (Schnitt, Farbe, Effekte, Audio, Fusion, 3D, KI), Mixer mit Bussen/Sends/Master, Scopes, Untertitel-Editor, Plug-ins, Warteschlangen-Prioritäten
(function () {
  const app = document.getElementById('app'); const q = (s, r = document) => r.querySelector(s);
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };
  const selSlides = () => P().slides.filter(s => S().selected.has(s.id));
  function dlg(title, body, buttons, wide) {
    return new Promise(res => {
      const done = v => { m.remove(); res(v); };
      const m = el('div', { class: 'modal', onclick: e => { if (e.target === m) done(null); } }, el('div', { class: 'mbox', style: wide ? { width: 'min(920px,92vw)', maxWidth: '92vw' } : {} }, el('h2', {}, title), body, el('div', { class: 'row', style: { marginTop: '12px', justifyContent: 'flex-end' } }, ...buttons(done))));
      document.body.append(m); return m;
    });
  }
  const ph = (t, sub, ...extra) => el('div', { class: 'ph' }, el('b', {}, t), sub ? el('span', { class: 'muted' }, sub) : null, el('span', { style: { flex: 1 } }), ...extra);

  // ---------- Warteschlange: Prioritäten ----------
  const Q = App.queue; Q.defaultPrio = 1; const PR = ['niedrig', 'normal', 'hoch'];
  Q.addRender = function ({ title, project, outFile, prio }) { const j = { id: 'job-' + uid(), kind: 'render', title, project: JSON.parse(JSON.stringify(project)), outFile, state: 'wartet', frac: 0, phase: 'wartet', prio: prio == null ? this.defaultPrio : prio }; this.jobs.push(j); this.refreshUI(); this.pump(); return j; };
  const _pump = Q.pump;
  Q.pump = function () {
    if (!this.running) { const w = this.jobs.filter(x => x.state === 'wartet'); if (w.length > 1) { const best = w.reduce((a, b) => (b.prio || 1) > (a.prio || 1) ? b : a, w[0]); if (best !== w[0]) { this.jobs.splice(this.jobs.indexOf(best), 1); this.jobs.splice(this.jobs.indexOf(w[0]), 0, best); } } }
    return _pump.call(this);
  };
  const setPrio = (j, v) => { j.prio = Math.max(0, Math.min(2, v)); Q.refreshUI(); };
  const toFront = j => { Q.jobs.splice(Q.jobs.indexOf(j), 1); const i = Q.jobs.findIndex(x => x.state === 'wartet'); Q.jobs.splice(i < 0 ? Q.jobs.length : i, 0, j); j.prio = 2; Q.refreshUI(); };
  App.tabs.export.renderQueue = function () {
    if (!this.qbox) return; this.qbox.replaceChildren(); const jobs = App.queue.jobs;
    if (!jobs.length) { this.qbox.append(el('div', { class: 'empty' }, 'Noch keine Aufträge.')); return; }
    jobs.forEach(j => {
      const b = bar(); b.set(j.frac); const cls = j.state === 'fertig' ? 'ok' : j.state === 'Fehler' ? 'err' : j.state === 'läuft' ? '' : 'warn'; const waiting = j.state === 'wartet';
      this.qbox.append(el('div', { class: 'job' }, el('div', { class: 'top' }, el('b', {}, j.title), el('span', {}, waiting ? el('span', { class: 'tag prio' + (j.prio == null ? 1 : j.prio) }, 'Priorität: ' + PR[j.prio == null ? 1 : j.prio]) : null, ' ', el('span', { class: 'tag ' + cls }, j.state))), b, el('div', { class: 'hint' }, j.phase || ''),
        el('div', { class: 'row', style: { marginTop: '6px' } },
          waiting ? btn('▲ wichtiger', () => setPrio(j, (j.prio == null ? 1 : j.prio) + 1), 'small') : null, waiting ? btn('▼ unwichtiger', () => setPrio(j, (j.prio == null ? 1 : j.prio) - 1), 'small') : null, waiting ? btn('Als Nächstes', () => toFront(j), 'small') : null,
          j.state === 'fertig' ? btn('Im Ordner zeigen', () => App.api.invoke('shell:reveal', j.outFile), 'small') : null, j.state === 'fertig' ? btn('Öffnen', () => App.api.invoke('shell:open', j.outFile), 'small') : null,
          (j.state === 'läuft' || j.state === 'wartet') ? btn('Abbrechen', () => App.queue.cancel(j), 'small danger') : btn('Entfernen', () => { App.queue.jobs = App.queue.jobs.filter(x => x !== j); this.renderQueue(); }, 'small'))));
    });
  };
  const _eb = App.tabs.export.build;
  App.tabs.export.build = function (p) { _eb.call(this, p); const h = [...p.children].find(c => c.tagName === 'H3' && c.textContent === 'Warteschlange'); const row = rowOf('Priorität neuer Aufträge', sel(PR.map((n, i) => [String(i), n]), String(Q.defaultPrio), v => { Q.defaultPrio = +v; })); if (h) p.insertBefore(row, h); else p.append(row); };

  // ---------- Seiten ----------
  const PAGES = {
    Schnitt: { docks: null },
    Farbe: { vars: { '--c3': '560px', '--rd': '250px' }, hide: ['fxp'], docks: ['scopes', 'edit'], cols: '1.6fr 1fr' },
    Effekte: { vars: { '--c4': '430px', '--c3': '0px', '--rd': '250px' }, hide: ['colorp'], docks: ['edit', 'plugins'], cols: '1.4fr 1fr' },
    Audio: { vars: { '--rd': '330px', '--c3': '0px' }, hide: ['colorp', 'fxp'], docks: ['mixer2', 'edit'], cols: '2fr 1fr' },
    Fusion: { vars: { '--rd': '400px', '--c3': '0px' }, hide: ['colorp', 'fxp'], docks: ['fusion', 'edit'], cols: '2.2fr 1fr' },
    '3D': { vars: { '--rd': '430px', '--c3': '0px' }, hide: ['colorp', 'fxp'], docks: ['d3'], cols: '1fr' },
    KI: { vars: { '--rd': '300px', '--c3': '0px' }, hide: ['colorp', 'fxp'], docks: ['ai2', 'subs', 'export'], cols: '1fr 1.5fr 1fr' },
  };
  const BUILD = {}; let cur = 'Schnitt'; const VARS = ['--c1', '--c3', '--c4', '--rd'];
  function renderPage() {
    const d = q('#docks'); const pg = PAGES[cur]; if (!d || !pg) return;
    if (!pg.docks) { d.style.gridTemplateColumns = ''; const D = Studio.docks; if (d.children.length !== 4 || !d.querySelector('.aigrid')) d.replaceChildren(D.mixer(), D.edit(), D.ai(), D.export()); return; }
    d.style.gridTemplateColumns = pg.cols; const kids = pg.docks.map(k => { try { return BUILD[k] ? BUILD[k]() : null; } catch (e) { return el('div', { class: 'dock' }, el('div', { class: 'empty' }, 'Fehler: ' + e.message)); } }).filter(Boolean); d.replaceChildren(...kids); drawScopes(true);
  }
  function setPage(name, silent) {
    const pg = PAGES[name]; if (!pg) return; cur = name; LS.set('viola.page', name);
    if (window.Studio2) Studio2.applyWs('Standard', true);
    Object.entries(pg.vars || {}).forEach(([k, v]) => app.style.setProperty(k, v)); (pg.hide || []).forEach(h => app.classList.add('hide-' + h));
    [...document.querySelectorAll('#pagebar button')].forEach(b => b.classList.toggle('on', b.dataset.page === name));
    renderPage(); window.dispatchEvent(new Event('resize')); if (!silent) toast('Seite: ' + name);
  }
  const bar_ = el('div', { id: 'pagebar' }, ...Object.keys(PAGES).map((n, i) => el('button', { 'data-page': n, title: 'Seite ' + n + ' (Alt+' + (i + 1) + ')', onclick: () => setPage(n) }, n)));
  const head = q('#head'); const sp = head && head.querySelector('.spacer'); if (head) head.insertBefore(bar_, sp || null);
  window.addEventListener('keydown', e => { if (e.altKey && !e.ctrlKey && /^[1-7]$/.test(e.key)) { e.preventDefault(); setPage(Object.keys(PAGES)[+e.key - 1]); } });
  const _ra = renderAll; renderAll = function () { _ra(); if (PAGES[cur] && PAGES[cur].docks) renderPage(); };

  // ---------- Mixer: Busse, Sends, Master ----------
  const defEffect = id => { const d = (App.fxCat.audio || []).find(x => x.id === id); return { id, version: 1, enabled: true, bypass: false, mix: 1, params: d ? Object.fromEntries(Object.entries(d.params).map(([k, v]) => [k, v.def])) : {} }; };
  const db = v => v > 0 ? (20 * Math.log10(v)).toFixed(1) + ' dB' : '−∞';
  const buses = () => (P().buses = P().buses || []); const sends = () => (P().sends = P().sends || {});
  function mixer2() {
    const D = Studio.docks; const addBus = () => { snap(); buses().push({ id: uid(), name: buses().length ? 'Bus ' + (buses().length + 1) : 'Hall', volume: 1, effects: [defEffect('AFX.FX.REVERB')] }); renderAll(); };
    const d = el('div', { class: 'dock' }, ph('Audio-Mixer', 'Busse · Sends · Master', btn('+ Bus', addBus, 'small')));
    const avg = a => a.length ? a.reduce((s, x) => s + (x.volume == null ? 1 : x.volume), 0) / a.length : 1;
    const strips = el('div', { class: 'strips' },
      D.fader('Musik (A1)', () => avg(P().audio), v => P().audio.forEach(a => { a.volume = v; }), 'A1', () => (P().audio[0] || {}).pan || 0, v => P().audio.forEach(a => { a.pan = v || undefined; })),
      D.fader('Sprecher (A2)', () => avg(P().voice || []), v => (P().voice || []).forEach(a => { a.volume = v; }), 'A2', () => ((P().voice || [])[0] || {}).pan || 0, v => (P().voice || []).forEach(a => { a.pan = v || undefined; })));
    buses().forEach(b => {
      const lab = el('div', { class: 'muted' }, db(b.volume == null ? 1 : b.volume));
      strips.append(el('div', { class: 'strip bus' }, el('input', { type: 'text', class: 'bname', value: b.name, onchange: e => { snap(); b.name = e.target.value.slice(0, 24); renderAll(); } }),
        el('input', { type: 'range', min: 0, max: 1.5, step: 0.01, value: b.volume == null ? 1 : b.volume, class: 'fd', onpointerdown: () => snap(), oninput: e => { b.volume = +e.target.value; lab.textContent = db(b.volume); } }), lab,
        btn('✕', () => { snap(); P().buses = buses().filter(x => x !== b); ['music', 'voice'].forEach(k => { if (sends()[k]) sends()[k] = sends()[k].filter(s => s.bus !== b.id); }); renderAll(); }, 'small'),
        typeof fxStack === 'function' ? fxStack('Bus-Effekte', b.effects, l => { snap(); b.effects = l; renderAll(); }, App.fxCat.audio) : null));
    });
    const mv = () => (P().master && P().master.volume != null ? P().master.volume : 1); const mlab = el('div', { class: 'muted' }, db(mv()));
    strips.append(el('div', { class: 'strip master' }, el('div', { class: 'meter' }, el('i', { id: 'mmeter', style: { height: '0%' } })), el('input', { type: 'range', min: 0, max: 1.5, step: 0.01, value: mv(), class: 'fd', onpointerdown: () => snap(), oninput: e => { P().master = { volume: +e.target.value }; mlab.textContent = db(+e.target.value); } }), mlab, el('b', {}, 'Master')));
    d.append(strips);
    if (buses().length) {
      const g = el('div', { class: 'sendgrid' }, el('b', {}, 'Sends'), ...[['music', 'Musik'], ['voice', 'Sprecher']].flatMap(([k, n]) => buses().map(b => {
        const cur_ = ((sends()[k] || []).find(s => s.bus === b.id) || {}).level || 0;
        return el('div', { class: 'cs' }, el('label', {}, n + ' → ' + b.name), el('input', { type: 'range', min: 0, max: 1, step: 0.01, value: cur_, onpointerdown: () => snap(), oninput: e => { const L = (sends()[k] = sends()[k] || []); let s = L.find(x => x.bus === b.id); if (!s) { s = { bus: b.id, level: 0 }; L.push(s); } s.level = +e.target.value; } }), el('span', { class: 'sv' }, Math.round(cur_ * 100) + ' %'));
      })));
      // Wert-Anzeige verbinden (sv liegt als letztes Kind der Zeile)
      g.querySelectorAll('.cs').forEach(l => { const inp = l.querySelector('input'), s = l.querySelector('.sv'); inp.addEventListener('input', () => { s.textContent = Math.round(inp.value * 100) + ' %'; }); });
      d.append(g);
    } else d.append(el('div', { class: 'hint', style: { padding: '8px 10px' } }, 'Mit „+ Bus" entsteht z. B. ein Hall-Bus. Musik und Sprecher schicken dann per Send einen Teil ihres Signals dorthin.'));
    return d;
  }
  BUILD.mixer2 = mixer2; BUILD.edit = () => Studio.docks.edit(); BUILD.export = () => Studio.docks.export();
  setInterval(() => { const m = q('#mmeter'); if (!m) return; const a = q('#docks .strip[data-tn="A1"] .meter i'), b = q('#docks .strip[data-tn="A2"] .meter i'); const h = Math.max(a ? parseFloat(a.style.height) || 0 : 0, b ? parseFloat(b.style.height) || 0 : 0); m.style.height = h + '%'; }, 120);

  // ---------- Scopes ----------
  let scT = 0, scN = null; const off = document.createElement('canvas'); off.width = 128; off.height = 72; const octx = off.getContext('2d', { willReadFrequently: true });
  function scopesDock() {
    const mk = t => { const c = el('canvas', { width: 256, height: 128, class: 'scope' }); return el('div', { class: 'scbox' }, c, el('span', { class: 'muted' }, t)); };
    const h = mk('Histogramm'), p = mk('RGB-Parade'), v = mk('Vektorskop'); scN = { h: h.firstChild, p: p.firstChild, v: v.firstChild };
    return el('div', { class: 'dock' }, ph('Scopes', 'live aus der Vorschau'), el('div', { class: 'scopes' }, h, p, v));
  }
  BUILD.scopes = scopesDock;
  function drawScopes(force) {
    if (!scN || !scN.h.isConnected) return; const now = performance.now(); if (!force && now - scT < 140) return; scT = now;
    let img; try { octx.drawImage(document.getElementById('cv'), 0, 0, 128, 72); img = octx.getImageData(0, 0, 128, 72).data; } catch (_) { return; }
    const H = scN.h.getContext('2d'), Pc = scN.p.getContext('2d'), V = scN.v.getContext('2d'); [H, Pc, V].forEach(c => { c.fillStyle = '#0b0813'; c.fillRect(0, 0, 256, 128); });
    const bins = [new Array(64).fill(0), new Array(64).fill(0), new Array(64).fill(0)];
    for (let i = 0; i < img.length; i += 4) { for (let k = 0; k < 3; k++) bins[k][img[i + k] >> 2]++; }
    const mx = Math.max(1, ...bins.flat()) ** 0.8; const cols = ['rgba(255,70,70,.55)', 'rgba(70,255,90,.55)', 'rgba(80,120,255,.6)'];
    H.globalCompositeOperation = 'lighter'; bins.forEach((b, k) => { H.fillStyle = cols[k]; b.forEach((n, x) => { const hh = Math.round(120 * Math.pow(n, 0.8) / mx); H.fillRect(x * 4, 128 - hh, 4, hh); }); }); H.globalCompositeOperation = 'source-over';
    Pc.globalCompositeOperation = 'lighter'; const sw = 256 / 3;
    for (let y = 0; y < 72; y += 1) for (let x = 0; x < 128; x++) { const i = (y * 128 + x) * 4; for (let k = 0; k < 3; k++) { Pc.fillStyle = ['rgba(255,60,60,.28)', 'rgba(60,255,80,.28)', 'rgba(80,110,255,.32)'][k]; Pc.fillRect(k * sw + x * sw / 128, 127 - img[i + k] / 255 * 126, 1.6, 1.4); } }
    Pc.globalCompositeOperation = 'source-over'; Pc.strokeStyle = 'rgba(255,255,255,.12)'; [0, 1, 2, 3].forEach(i => { Pc.beginPath(); Pc.moveTo(0, 2 + i * 41); Pc.lineTo(256, 2 + i * 41); Pc.stroke(); });
    V.strokeStyle = 'rgba(255,255,255,.18)'; V.beginPath(); V.arc(128, 64, 60, 0, 7); V.stroke(); V.beginPath(); V.arc(128, 64, 30, 0, 7); V.stroke(); V.beginPath(); V.moveTo(68, 64); V.lineTo(188, 64); V.moveTo(128, 4); V.lineTo(128, 124); V.stroke();
    V.globalCompositeOperation = 'lighter';
    for (let i = 0; i < img.length; i += 8) { const r = img[i], g = img[i + 1], b = img[i + 2]; const u = (-0.169 * r - 0.331 * g + 0.5 * b) / 128, vv = (0.5 * r - 0.419 * g - 0.081 * b) / 128; V.fillStyle = `rgba(${r},${g},${b},.55)`; V.fillRect(128 + u * 60 * 1.6 * 0.9 + 60 * 0 - 0.5, 64 - vv * 60 * 1.6 * 0.9 - 0.5, 1.6, 1.6); }
    V.globalCompositeOperation = 'source-over';
  }
  const _dp = drawPreview; drawPreview = function () { _dp(); drawScopes(); miniUpdate(); };
  const _ut = updateTransport; updateTransport = function () { _ut(); drawScopes(); miniUpdate(); };

  // ---------- Plug-ins ----------
  async function pluginsDock() {
    const d = el('div', { class: 'dock' }, ph('Plug-ins', 'JSON-/JS-Effekte', btn('Neu laden', async () => { try { const r = await App.api.invoke('plugins:reload'); App.fxCat = await App.api.invoke('fx:catalog') || App.fxCat; toast(r.loaded.length + ' Plug-ins geladen' + (r.errors.length ? ', ' + r.errors.length + ' Fehler' : ''), !!r.errors.length); renderPage(); } catch (e) { toast(e.message, true); } }, 'small'), btn('Ordner öffnen', () => App.api.invoke('plugins:openDir'), 'small')));
    const body = el('div', { class: 'pbody' }, el('div', { class: 'hint' }, 'Lade …')); d.append(body);
    try { const r = await App.api.invoke('plugins:list'); body.replaceChildren(el('div', { class: 'hint' }, 'Ordner: ' + r.dirs[0]), el('div', { class: 'hint' }, 'Eine .json-Datei pro Effekt: id (PLUG.NAME), name, params, filter mit {Parameter}. Beispiel liegt im Programmordner „plugins".'),
      ...(r.catalog.length ? r.catalog.map(c => el('div', { class: 'card', style: { padding: '6px 8px' } }, el('b', {}, c.name), ' ', el('span', { class: 'muted' }, c.id + ' · ' + Object.keys(c.params).length + ' Parameter'))) : [el('div', { class: 'empty' }, 'Keine Plug-ins geladen.')]),
      ...r.errors.map(e => el('div', { class: 'hint', style: { color: '#ff9aa8' } }, 'Fehler: ' + e)));
    } catch (e) { body.replaceChildren(el('div', { class: 'hint' }, e.message)); }
    return d;
  }
  BUILD.plugins = () => { const holder = el('div', { style: { display: 'contents' } }); pluginsDock().then(d => holder.replaceWith(d)); return holder; };

  // ---------- KI-Tools (erweitert) ----------
  function ai2() {
    const tile = (ic, t, s, fn) => el('div', { class: 'aitile', onclick: () => { try { fn(); } catch (e) { toast(e.message, true); } } }, el('div', { class: 'ic' }, ic), el('b', {}, t), el('span', { class: 'muted' }, s));
    const S3 = k => () => (window.Studio3 && Studio3[k] ? Studio3[k]() : toast('Noch nicht geladen.', true));
    return el('div', { class: 'dock' }, ph('KI-Tools & Automatik', 'lokal'), el('div', { class: 'aigrid' },
      tile('🎯', 'Motion-Tracking', 'Overlay folgt einem Objekt', S3('tracking')), tile('✂️', 'Rotoskopie', 'Polygon-Maske, animiert', S3('roto')), tile('🧽', 'Objekt entfernen', 'Fläche überblenden (kein KI-Inpainting)', S3('remove')),
      tile('🎥', 'Multicam', 'Ton-Sync + Kamerawechsel', S3('multicam')), tile('🗣️', 'Sprecher erkennen', 'WhisperX/pyannote (Python)', S3('diarize')), tile('🌐', 'Untertitel übersetzen', 'offline (argostranslate)', S3('translate')),
      tile('🎙️', 'Sprecher aufnehmen', 'Mikrofon (DirectShow)', S3('mic')), tile('📦', 'AAF exportieren', 'für Avid / Pro Tools', S3('aaf')), tile('🔌', 'Plug-ins', 'eigene Effekte', () => setPage('Effekte')),
      tile('🎤', 'RaLyrics', 'Songtext & Timing', () => App.api.invoke('tools:launch', 'ralyrics').catch(e => toast(e.message, true))), tile('🎵', 'RaSing', 'Gesang / Karaoke', () => App.api.invoke('tools:launch', 'rasing').catch(e => toast(e.message, true))), tile('🔍', 'Upscaler', 'Video2X', () => App.showTab('upscale'))));
  }
  BUILD.ai2 = ai2;

  // ---------- Untertitel-Editor ----------
  let mini = null;
  const sb = () => (P().subtitles = P().subtitles || { segments: [], burn: true, style: {} });
  const tcf = t => { t = Math.max(0, t); const m = Math.floor(t / 60), s = (t % 60).toFixed(2); return String(m).padStart(2, '0') + ':' + s.padStart(5, '0'); };
  function subsDock() {
    const segs = sb().segments; const rows = el('div', { class: 'subtbl' });
    rows.append(el('div', { class: 'sr head' }, el('span', {}, '#'), el('span', {}, 'Start'), el('span', {}, 'Ende'), el('span', {}, 'Text'), el('span', {}, '')));
    segs.slice(0, 200).forEach((s, i) => rows.append(el('div', { class: 'sr' + (S().t >= s.start && S().t < s.end ? ' now' : '') },
      el('span', { class: 'muted', title: s.speaker ? 'Sprecher: ' + s.speaker : '' }, String(i + 1) + (s.speaker ? ' ·' + String(s.speaker).replace(/\D+/g, '') : '')),
      el('input', { type: 'number', step: 0.1, min: 0, value: +s.start.toFixed(2), title: tcf(s.start), onchange: e => { snap(); s.start = Math.max(0, +e.target.value || 0); if (s.end <= s.start) s.end = s.start + 0.5; renderAll(); } }),
      el('input', { type: 'number', step: 0.1, min: 0, value: +s.end.toFixed(2), title: tcf(s.end), onchange: e => { snap(); s.end = Math.max(s.start + 0.1, +e.target.value || 0); renderAll(); } }),
      el('input', { type: 'text', value: s.text, onchange: e => { snap(); s.text = e.target.value; miniUpdate(); } }), btn('✕', () => { snap(); segs.splice(i, 1); renderAll(); }, 'small'))));
    if (!segs.length) rows.append(el('div', { class: 'empty' }, 'Noch keine Untertitel – im Reiter „Untertitel" erzeugen, SRT öffnen oder hier „+ Zeile" nehmen.'));
    const mc = el('canvas', { width: 320, height: 180 }), mt = el('div', { class: 'minisub' }); mini = { c: mc, t: mt };
    const bodyEl = el('div', { class: 'subwrap' }, rows, el('div', { class: 'minimon' }, el('div', { class: 'mm' }, mc, mt), el('div', { class: 'muted' }, 'Vorschau an der Abspielposition')));
    const d = el('div', { class: 'dock' }, ph('Untertitel-Editor', segs.length + ' Zeilen', btn('+ Zeile', () => { snap(); const t = Math.round(S().t * 10) / 10; segs.push({ start: t, end: t + 2, text: 'Neuer Text' }); segs.sort((a, b) => a.start - b.start); renderAll(); }, 'small'),
      btn('Prüfen', () => window.Studio2 && Studio2.checkSubs(), 'small'), btn('Sprecher', () => Studio3.diarize(), 'small'), btn('Übersetzen', () => Studio3.translate(), 'small')), bodyEl);
    setTimeout(miniUpdate, 0); return d;
  }
  BUILD.subs = subsDock;
  function miniUpdate() {
    if (!mini || !mini.c.isConnected) return; try { const x = mini.c.getContext('2d'); x.drawImage(document.getElementById('cv'), 0, 0, 320, 180); } catch (_) {}
    const s = sb().segments.find(z => S().t >= z.start && S().t < z.end); mini.t.textContent = s ? s.text : '';
  }

  window.Studio3 = Object.assign(window.Studio3 || {}, { dlg, selSlides, setPage, PAGES, BUILD, ph, renderPage });
  window.addEventListener('load', () => setTimeout(() => setPage(LS.get('viola.page') && PAGES[LS.get('viola.page')] ? LS.get('viola.page') : 'Schnitt', true), 600));
})();

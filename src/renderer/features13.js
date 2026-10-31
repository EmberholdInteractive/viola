'use strict';
// Viola Pro – Node-Editor (Fusion), 3D-Szenen, Tracking, Rotoskopie, Objekt entfernen, Multicam, Sprecher, Übersetzung, Mikrofon, AAF
(function () {
  const q = (s, r = document) => r.querySelector(s);
  const T = () => window.Studio3; const dlg = (...a) => T().dlg(...a); const ph = (...a) => T().ph(...a);
  const sel1 = () => { const s = T().selSlides(); return s.length === 1 ? s[0] : null; };
  const numf = (v, d = 3) => +(+v).toFixed(d);
  const imgOf = src => new Promise(res => { thumbUrl(src, 960).then(u => { if (!u) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = u; }); });
  const slideStart = s => { const L = layout().L.find(x => x.s === s); return L ? L.start : 0; };

  // ---------- Bild-Auswahl (Rahmen oder Polygon über einem Standbild) ----------
  async function framePicker(slide, opt) {
    const im = await imgOf(slide.src); const W = 640, H = im ? Math.round(W * im.naturalHeight / im.naturalWidth) : 360; const c = el('canvas', { width: W, height: H, class: 'pickcv' });
    const st = { box: opt.box || { x: 0.5, y: 0.5, w: 0.2, h: 0.2 }, pts: opt.pts || [], drag: null, drawing: null };
    const draw = () => {
      const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); if (im) x.drawImage(im, 0, 0, W, H);
      if (opt.mode === 'box') { const b = st.box; x.strokeStyle = '#a78bfa'; x.lineWidth = 2; x.fillStyle = 'rgba(167,139,250,.2)'; x.fillRect((b.x - b.w / 2) * W, (b.y - b.h / 2) * H, b.w * W, b.h * H); x.strokeRect((b.x - b.w / 2) * W, (b.y - b.h / 2) * H, b.w * W, b.h * H); }
      else { const p = st.pts; if (p.length) { x.beginPath(); p.forEach(([a, b], i) => i ? x.lineTo(a * W, b * H) : x.moveTo(a * W, b * H)); if (p.length > 2) x.closePath(); x.fillStyle = 'rgba(167,139,250,.25)'; if (p.length > 2) x.fill(); x.strokeStyle = '#a78bfa'; x.lineWidth = 2; x.stroke(); p.forEach(([a, b], i) => { x.fillStyle = i === 0 ? '#ffe066' : '#fff'; x.beginPath(); x.arc(a * W, b * H, 5, 0, 7); x.fill(); x.strokeStyle = '#000'; x.lineWidth = 1; x.stroke(); }); } }
    };
    const pos = e => { const r = c.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
    c.onpointerdown = e => {
      const [a, b] = pos(e); c.setPointerCapture(e.pointerId);
      if (opt.mode === 'box') { st.drag = { a, b }; st.box = { x: a, y: b, w: 0.02, h: 0.02 }; }
      else { const hit = st.pts.findIndex(([x, y]) => Math.hypot((x - a) * W, (y - b) * H) < 9); if (e.button === 2) { if (hit >= 0 && st.pts.length > 3) st.pts.splice(hit, 1); } else if (hit >= 0) st.drag = { i: hit }; else if (st.pts.length < 12) { st.pts.push([numf(a, 4), numf(b, 4)]); st.drag = { i: st.pts.length - 1 }; } if (opt.onChange) opt.onChange(st); }
      draw();
    };
    c.onpointermove = e => { if (!st.drag) return; const [a, b] = pos(e); if (opt.mode === 'box') { st.box = { x: (st.drag.a + a) / 2, y: (st.drag.b + b) / 2, w: Math.max(0.02, Math.abs(a - st.drag.a)), h: Math.max(0.02, Math.abs(b - st.drag.b)) }; } else { st.pts[st.drag.i] = [numf(a, 4), numf(b, 4)]; if (opt.onChange) opt.onChange(st); } draw(); };
    c.onpointerup = () => { st.drag = null; if (opt.onChange) opt.onChange(st); };
    c.oncontextmenu = e => e.preventDefault(); draw(); st.el = c; st.redraw = draw; return st;
  }
  const needVid = () => { const s = sel1(); if (!s || s.type === 'title' || !s.src) { toast('Erst eine einzelne Foto- oder Video-Folie in der Zeitleiste auswählen.', true); return null; } return s; };

  // ---------- Tracking ----------
  async function tracking(forOv) {
    const s = needVid(); if (!s) return; const ovs = P().overlays || []; if (!ovs.length) return toast('Zuerst ein Overlay (Titel/Bild) anlegen – es soll dem Objekt folgen.', true);
    let target = ovs.find(o => o.id === (forOv || S().selOv)) || ovs[0]; const st = await framePicker(s, { mode: 'box', box: { x: 0.5, y: 0.5, w: 0.16, h: 0.2 } });
    const status = el('div', { class: 'hint' }, 'Ziehe einen Rahmen um das Objekt, das verfolgt werden soll (möglichst kontrastreich).'); let keep = false; const dur = el('input', { type: 'number', value: Math.min(10, +s.duration || 5), min: 1, max: 60, step: 0.5 });
    const body = el('div', {}, rowOf('Overlay, das folgen soll', sel(ovs.map(o => [o.id, (o.type === 'title' ? o.text.split('\n')[0] : base(o.src || o.type)) + ' (V' + ((o.track || 1) + 1) + ')']), target.id, v => { target = ovs.find(o => o.id === v); })), st.el,
      rowOf('Dauer (s)', dur), el('label', { class: 'chk' }, el('input', { type: 'checkbox', onchange: e => { keep = e.target.checked; } }), 'Abstand zum Objekt beibehalten'), status);
    const run = async done => {
      status.textContent = 'Verfolge … (kann einige Sekunden dauern)'; try {
        const t0 = +s.trimStart || 0; const r = await App.api.invoke('tracker:run', s.src, { t0, duration: Math.min(+dur.value || 5, +s.duration || 5), box: st.box, fps: 15 });
        const thin = r.length > 40 ? Array.from({ length: 40 }, (_, i) => r[Math.round(i * (r.length - 1) / 39)]) : r; const base0 = slideStart(s); const dx = keep ? (target.x == null ? 0.5 : target.x) - thin[0].x : 0, dy = keep ? (target.y == null ? 0.5 : target.y) - thin[0].y : 0;
        snap(); target.path = thin.map(p => ({ t: numf(base0 + p.t - (target.start || 0), 3), x: numf(Math.max(0, Math.min(1, p.x + dx)), 4), y: numf(Math.max(0, Math.min(1, p.y + dy)), 4) })); renderAll(); toast('Pfad gespeichert (' + thin.length + ' Punkte)'); done(true);
      } catch (e) { status.textContent = 'Fehler: ' + e.message; }
    };
    dlg('Motion-Tracking', body, d => [btn('Abbrechen', () => d(null)), btn('Verfolgen', () => run(d), 'primary')], true);
  }

  // ---------- Rotoskopie ----------
  async function roto() {
    const s = needVid(); if (!s) return; const D = Math.max(0.5, +s.duration || 5); let keys = []; let t = 0; let outside = 'black', feather = 6, invert = false; let timeLab;
    const interp = tt => { if (!keys.length) return []; if (keys.length === 1 || tt <= keys[0].t) return keys[0].pts.map(p => p.slice()); const l = keys[keys.length - 1]; if (tt >= l.t) return l.pts.map(p => p.slice()); const i = keys.findIndex(k => k.t > tt); const A = keys[i - 1], B = keys[i]; const f = (tt - A.t) / (B.t - A.t); return A.pts.map((p, j) => [p[0] + (B.pts[j][0] - p[0]) * f, p[1] + (B.pts[j][1] - p[1]) * f]); };
    const st = await framePicker(s, { mode: 'poly', pts: [] }); const klist = el('div', { class: 'hint' }); const status = el('div', { class: 'hint' }, 'Klicke Punkte um das Objekt (Rechtsklick löscht, Ziehen verschiebt). Dann Zeit verschieben, Punkte anpassen und „Schlüsselbild setzen".');
    const refresh = () => { klist.textContent = keys.length ? 'Schlüsselbilder: ' + keys.map(k => k.t.toFixed(1) + ' s').join(' · ') : 'Noch keine Schlüsselbilder.'; if (timeLab) timeLab.textContent = t.toFixed(1) + ' s'; };
    const slider = el('input', { type: 'range', min: 0, max: D, step: 0.1, value: 0, oninput: e => { t = +e.target.value; if (keys.length) { st.pts = interp(t).map(p => [numf(p[0], 4), numf(p[1], 4)]); st.redraw(); } refresh(); } }); timeLab = el('b', {}, '0.0 s');
    const setKey = () => { if (st.pts.length < 3) return toast('Mindestens 3 Punkte.', true); if (keys.length && keys[0].pts.length !== st.pts.length) return toast('Alle Schlüsselbilder brauchen gleich viele Punkte (' + keys[0].pts.length + ').', true); const k = { t: numf(t, 2), pts: st.pts.map(p => p.slice()) }; keys = keys.filter(x => Math.abs(x.t - k.t) > 0.05); keys.push(k); keys.sort((a, b) => a.t - b.t); refresh(); };
    const body = el('div', {}, st.el, rowOf('Zeit', el('div', { class: 'row', style: { margin: 0, flex: 1 } }, slider, timeLab)), el('div', { class: 'row' }, btn('Schlüsselbild setzen', setKey, 'small'), btn('Schlüsselbild löschen', () => { keys = keys.filter(x => Math.abs(x.t - t) > 0.05); refresh(); }, 'small'), btn('Punkte löschen', () => { st.pts.length = 0; keys = []; st.redraw(); refresh(); }, 'small danger')), klist,
      rowOf('Außerhalb', sel([['black', 'schwarz'], ['blur', 'unscharf'], ['dark', 'dunkel'], ['bw', 'schwarzweiß'], ['light', 'hell']], outside, v => { outside = v; })), rowOf('Weiche Kante (px)', num(feather, 1, 0, v => { feather = Math.max(0, Math.min(200, v)); })),
      el('label', { class: 'chk' }, el('input', { type: 'checkbox', onchange: e => { invert = e.target.checked; } }), 'Invertieren (Innen ausblenden)'), status); refresh();
    const apply = done => { if (!keys.length) setKey(); if (!keys.length) return; const str = keys.map(k => [k.t, ...k.pts.flat().map(v => numf(v, 4))].join(' ')).join('|'); if (str.length > 1990) return toast('Zu viele Punkte/Schlüsselbilder.', true); snap(); s.effects = (s.effects || []).filter(e => e.id !== 'FX.MASK.POLYGON'); s.effects.push({ id: 'FX.MASK.POLYGON', version: 1, enabled: true, bypass: false, mix: 1, params: { keys: str, feather, invert, outside } }); renderAll(); toast('Rotoskopie-Maske als Effekt hinzugefügt'); done(true); };
    dlg('Rotoskopie – animierte Polygon-Maske', body, d => [btn('Abbrechen', () => d(null)), btn('Als Effekt anwenden', () => apply(d), 'primary')], true);
  }

  // ---------- Objekt entfernen ----------
  async function remove() {
    const s = needVid(); if (!s) return; const st = await framePicker(s, { mode: 'box', box: { x: 0.85, y: 0.1, w: 0.15, h: 0.1 } }); let from = 0, to = 86400;
    const body = el('div', {}, el('div', { class: 'hint' }, 'Markiere den Bereich (Logo, Wasserzeichen, kleines Objekt). Viola überblendet ihn mit der Umgebung. Das ist kein KI-Inpainting – bei großen oder bewegten Objekten bleibt es sichtbar.'), st.el, rowOf('Von (s)', num(0, 0.1, 0, v => { from = v; })), rowOf('Bis (s, leer = Ende)', num(0, 0.1, 0, v => { to = v > 0 ? v : 86400; })));
    dlg('Objekt entfernen', body, d => [btn('Abbrechen', () => d(null)), btn('Anwenden', () => { const b = st.box; snap(); s.effects = (s.effects || []).concat({ id: 'FX.RESTORE.DELOGO', version: 1, enabled: true, bypass: false, mix: 1, params: { x: numf(b.x - b.w / 2, 3), y: numf(b.y - b.h / 2, 3), w: numf(b.w, 3), h: numf(b.h, 3), start: from, end: to } }); renderAll(); toast('Effekt „Objekt entfernen" hinzugefügt'); d(true); }, 'primary')], true);
  }

  // ---------- Multicam ----------
  async function multicam() {
    let files = []; let offs = null; let every = 6, total = 60, manual = '';
    const list = el('div', { class: 'hint' }, 'Noch keine Kameras.'); const status = el('div', { class: 'hint' });
    const showList = () => { list.replaceChildren(...(files.length ? files.map((f, i) => el('div', { class: 'card', style: { padding: '5px 8px' } }, el('b', {}, 'Kamera ' + (i + 1) + (i === 0 ? ' (Referenz)' : '')), ' ', base(f), offs ? el('span', { class: 'muted' }, '  Versatz ' + offs[i].offset.toFixed(2) + ' s · Güte ' + offs[i].score.toFixed(2)) : null)) : [el('div', { class: 'hint' }, 'Noch keine Kameras.')])); };
    const body = el('div', {}, el('div', { class: 'hint' }, 'Mehrere Aufnahmen desselben Ereignisses: Viola gleicht sie über den Ton ab und baut einen Schnitt mit Kamerawechseln. Bei sehr leisem oder fehlendem Ton klappt der Abgleich nicht.'), list,
      el('div', { class: 'row' }, btn('Kameras hinzufügen …', async () => { const f = await App.api.invoke('dialog:files', 'media'); if (f && f.length) { files = files.concat(f); offs = null; if (files[0] && !total) total = 60; showList(); } }, 'small'), btn('Ton abgleichen', async () => { if (files.length < 2) return toast('Mindestens zwei Kameras.', true); status.textContent = 'Gleiche ab …'; try { offs = await App.api.invoke('multicam:sync', files, { ref: 0 }); const bad = offs.filter(o => o.score < 0.15); status.textContent = bad.length ? 'Achtung: schwacher Abgleich bei ' + bad.length + ' Kamera(s).' : 'Abgeglichen.'; try { const pr = await App.api.invoke('media:probe', files[0]); if (pr.duration) { total = Math.floor(pr.duration); tin.value = total; } } catch (_) {} showList(); } catch (e) { status.textContent = 'Fehler: ' + e.message; } }, 'primary small')),
      rowOf('Wechsel alle (s)', num(every, 1, 1, v => { every = Math.max(1, v); })), rowOf('Gesamtdauer (s)', (window.__tin = el('input', { type: 'number', value: total, min: 1, onchange: e => { total = +e.target.value; } }))),
      rowOf('Eigene Wechsel', el('textarea', { rows: 3, placeholder: 'Pro Zeile: Sekunde Kamera, z. B. "12 2"', onchange: e => { manual = e.target.value; } })), status);
    const tin = window.__tin;
    dlg('Multicam', body, d => [btn('Abbrechen', () => d(null)), btn('Am Ende einfügen', async () => {
      if (!offs) return toast('Erst „Ton abgleichen".', true); try {
        let cuts = manual.trim() ? manual.trim().split(/\n+/).map(l => { const [t, a] = l.trim().split(/\s+/).map(Number); return { t, angle: (a || 1) - 1 }; }).filter(c => Number.isFinite(c.t) && c.angle >= 0 && c.angle < files.length) : await App.api.invoke('multicam:auto', files.length, total, every);
        const slides = await App.api.invoke('multicam:plan', cuts, offs.map(o => ({ file: o.file, offset: o.offset })), total); snap(); slides.forEach(sl => P().slides.push(Object.assign({ id: uid() }, sl))); renderAll(); toast(slides.length + ' Folien eingefügt'); d(true);
      } catch (e) { toast(e.message, true); } }, 'primary')], true);
  }

  // ---------- Python-Einstellungen, Sprecher, Übersetzung ----------
  function pySettings() {
    const py = el('input', { type: 'text', placeholder: 'python (leer = automatisch)' }), hf = el('input', { type: 'password', placeholder: 'Hugging-Face-Token (hf_…)' });
    return dlg('Python & Token', el('div', {}, el('div', { class: 'hint' }, 'Für „Sprecher erkennen": pip install whisperx, Hugging-Face-Token mit akzeptierten pyannote-Bedingungen. Für „Übersetzen": pip install argostranslate. Für AAF: pip install opentimelineio otio-aaf-adapter pyaaf2.'), rowOf('Python', py), rowOf('Token', hf)),
      d => [btn('Abbrechen', () => d(null)), btn('Speichern', async () => { await App.api.invoke('settings:python', py.value.trim() || null, hf.value.trim() || null); toast('Gespeichert'); d(true); }, 'primary')]);
  }
  async function diarize() {
    let src = (sel1() && sel1().src) || ((P().voice || [])[0] || {}).src; if (!src) { const f = await App.api.invoke('dialog:files', 'media'); src = f && f[0]; } if (!src) return;
    toast('Erkenne Sprecher … das dauert (Modelle laden, ggf. mehrere Minuten)'); try { const r = await App.api.invoke('subs:diarize', src, {}); snap(); (P().subtitles = P().subtitles || { segments: [], burn: true, style: {} }).segments = r.map(x => ({ start: x.start, end: x.end, text: x.text, speaker: x.speaker })); renderAll(); toast(r.length + ' Abschnitte, ' + new Set(r.map(x => x.speaker)).size + ' Sprecher'); }
    catch (e) { toast(e.message, true); if (/Token|Python|nicht startbar|whisperx|No module/i.test(e.message)) pySettings(); }
  }
  async function translate() {
    const segs = ((P().subtitles || {}).segments) || []; if (!segs.length) return toast('Erst Untertitel erzeugen oder laden.', true);
    const L = [['de', 'Deutsch'], ['en', 'Englisch'], ['fr', 'Französisch'], ['es', 'Spanisch'], ['it', 'Italienisch'], ['pt', 'Portugiesisch'], ['nl', 'Niederländisch'], ['pl', 'Polnisch'], ['ru', 'Russisch'], ['tr', 'Türkisch'], ['ja', 'Japanisch'], ['zh', 'Chinesisch']]; let a = 'de', b = 'en';
    dlg('Untertitel übersetzen', el('div', {}, el('div', { class: 'hint' }, 'Läuft offline (argostranslate). Beim ersten Mal wird das Sprachpaket heruntergeladen.'), rowOf('Von', sel(L, a, v => { a = v; })), rowOf('Nach', sel(L, b, v => { b = v; }))), d => [btn('Abbrechen', () => d(null)), btn('Übersetzen', async () => {
      d(true); toast('Übersetze …'); try { const r = await App.api.invoke('subs:translate', segs.map(x => x.text), a, b); snap(); segs.forEach((x, i) => { x.text = r[i] || x.text; }); renderAll(); toast('Übersetzt (' + a + ' → ' + b + ')'); } catch (e) { toast(e.message, true); if (/Python|nicht startbar|argos|No module/i.test(e.message)) pySettings(); } }, 'primary')]);
  }

  // ---------- Mikrofon / AAF ----------
  async function mic() {
    let devs = []; try { devs = await App.api.invoke('capture:devices'); } catch (_) {} let dev = devs[0] || ''; let rec = false; const status = el('div', { class: 'hint' }, devs.length ? 'Bereit.' : 'Keine Aufnahmegeräte gefunden (nur unter Windows; ASIO-Treiber werden von FFmpeg nicht unterstützt – nimm das DirectShow-/WASAPI-Gerät deiner Karte).');
    const rb = btn('● Aufnahme starten', async () => {
      try { if (!rec) { await App.api.invoke('capture:start', { kind: 'audio', audio: dev }); rec = true; rb.textContent = '■ Beenden und einfügen'; status.textContent = 'Nimmt auf …'; }
        else { const r = await App.api.invoke('capture:stop'); rec = false; rb.textContent = '● Aufnahme starten'; snap(); (P().voice = P().voice || []).push({ src: r.file, start: Math.round(S().t * 10) / 10, volume: 1, clean: true, level: 'mittel' }); renderAll(); status.textContent = 'Als Sprecher-Spur eingefügt (' + r.seconds.toFixed(1) + ' s)'; } } catch (e) { status.textContent = 'Fehler: ' + e.message; rec = false; rb.textContent = '● Aufnahme starten'; } }, 'primary');
    dlg('Sprecher aufnehmen', el('div', {}, devs.length ? rowOf('Gerät', sel(devs.map(x => [x, x]), dev, v => { dev = v; })) : null, rb, status), d => [btn('Schließen', () => d(true))]);
  }
  async function aaf() { try { const f = await App.api.invoke('xchg:aaf', P()); if (f) toast('AAF gespeichert: ' + base(f)); } catch (e) { toast(e.message, true); if (/Python|pip/.test(e.message)) pySettings(); } }

  // ---------- Node-Editor (Fusion) ----------
  const NW = 128, NH = 36, MH = 52; let fsel = null, fcache = null, fprev = null;
  const defComp = () => ({ nodes: [{ id: 'in', type: 'in', x: 20, y: 60 }, { id: 'out', type: 'out', x: 520, y: 60 }], edges: [{ from: 'in', to: 'out', port: 'in' }] });
  const hasCycle = (comp, from, to) => { const seen = new Set(); const go = id => { if (id === from) return true; if (seen.has(id)) return false; seen.add(id); return comp.edges.filter(e => e.from === id).some(e => go(e.to)); }; return go(to); };
  const nh = n => n.type === 'merge' ? MH : NH;
  const inPos = (n, port) => [n.x, n.y + (n.type === 'merge' ? (port === 'fg' ? 40 : 13) : NH / 2)], outPos = n => [n.x + NW, n.y + nh(n) / 2];
  const fxName = n => { const d = (App.fxCat.video || []).find(x => x.id === (n.fx && n.fx.id)); return d ? d.name : 'Effekt'; };
  const nlabel = n => ({ in: 'Medien-Eingang', out: 'Medien-Ausgang', merge: 'Merge · ' + (n.mode || 'normal'), matte: 'Maske' }[n.type] || fxName(n));
  function paramRow(spec, val, on) {
    if (spec.type === 'bool') return el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: !!val, onchange: e => on(e.target.checked) }), spec.label);
    if (spec.type === 'enum') return rowOf(spec.label, sel(spec.options.map(o => [o, o]), val, on));
    if (spec.type === 'string') return rowOf(spec.label, el('input', { type: 'text', value: val, onchange: e => on(e.target.value) }));
    const v = el('span', { class: 'sv' }, numf(val, 2)); return el('div', { class: 'cs' }, el('label', {}, spec.label), el('input', { type: 'range', min: spec.min, max: spec.max, step: spec.step, value: val, oninput: e => { v.textContent = numf(e.target.value, 2); on(+e.target.value); } }), v);
  }
  function fusionDock() {
    if (fcache && fcache.isConnected) return fcache; const root = el('div', { class: 'dock fusion' }); fcache = root; draw(); return root;
    function draw() {
      const s = sel1(); root.replaceChildren(ph('Node-Editor (Fusion)', s ? 'Folie: ' + base(s.src || s.text || 'Titel') : 'keine Folie gewählt'));
      if (!s) { root.append(el('div', { class: 'empty' }, 'Wähle in der Zeitleiste eine einzelne Folie. Der Graph gilt für diese Folie: Medien-Eingang → Knoten → Medien-Ausgang.')); return; }
      const comp = s.comp; const mk = () => { snap(); s.comp = defComp(); draw(); };
      if (!comp) { root.append(el('div', { class: 'empty' }, 'Diese Folie hat noch keinen Node-Graph.', el('div', {}, btn('Node-Graph anlegen', mk, 'primary')))); return; }
      const add = n => { snap(); comp.nodes.push(Object.assign({ id: uid(), x: 200 + (comp.nodes.length % 4) * 30, y: 20 + (comp.nodes.length % 5) * 44 }, n)); fsel = comp.nodes[comp.nodes.length - 1].id; draw(); };
      const fxSel = el('select', { onchange: e => { if (!e.target.value) return; const d = App.fxCat.video.find(x => x.id === e.target.value); add({ type: 'fx', fx: { id: d.id, version: 1, enabled: true, bypass: false, mix: 1, params: Object.fromEntries(Object.entries(d.params).map(([k, v]) => [k, v.def])) } }); } }, el('option', { value: '' }, '+ Effekt …'), ...(App.fxCat.video || []).map(d => el('option', { value: d.id }, d.name)));
      const tb = el('div', { class: 'row fusbar' }, fxSel, btn('+ Merge', () => add({ type: 'merge', mode: 'screen', opacity: 1 }), 'small'), btn('+ Maske', () => add({ type: 'matte', shape: 'ellipse', cx: 0.5, cy: 0.5, w: 0.5, h: 0.5, feather: 20, invert: false }), 'small'), btn('Knoten löschen', () => { const n = comp.nodes.find(x => x.id === fsel); if (!n || n.type === 'in' || n.type === 'out') return; snap(); comp.nodes = comp.nodes.filter(x => x !== n); comp.edges = comp.edges.filter(e => e.from !== n.id && e.to !== n.id); fsel = null; draw(); }, 'small'),
        btn('Bild testen', async () => { prev.textContent = 'Rechne …'; try { const u = await App.api.invoke('fusion:preview', s, 640, 360); prev.replaceChildren(el('img', { src: u })); } catch (e) { prev.textContent = 'Fehler: ' + e.message; } }, 'small primary'), btn('Graph entfernen', () => { snap(); delete s.comp; draw(); }, 'small danger'));
      const stage = el('div', { class: 'fusstage' }); const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'fussvg'); stage.append(svg);
      const prev = el('div', { class: 'fusprev' }, el('div', { class: 'hint' }, 'Testbild: „Bild testen" rechnet ein Standbild durch den Graphen.')); fprev = prev;
      const edgePath = (a, b) => { const dx = Math.max(30, Math.abs(b[0] - a[0]) / 2); return `M${a[0]},${a[1]} C${a[0] + dx},${a[1]} ${b[0] - dx},${b[1]} ${b[0]},${b[1]}`; };
      const redrawEdges = (tmp) => { svg.replaceChildren(); comp.edges.forEach(e => { const f = comp.nodes.find(n => n.id === e.from), t = comp.nodes.find(n => n.id === e.to); if (!f || !t) return; const p = document.createElementNS(svg.namespaceURI, 'path'); p.setAttribute('d', edgePath(outPos(f), inPos(t, e.port || 'in'))); p.setAttribute('class', 'fedge'); p.onclick = () => { snap(); comp.edges = comp.edges.filter(x => x !== e); draw(); }; const ti = document.createElementNS(svg.namespaceURI, 'title'); ti.textContent = 'Klicken zum Löschen'; p.append(ti); svg.append(p); });
        if (tmp) { const p = document.createElementNS(svg.namespaceURI, 'path'); p.setAttribute('d', edgePath(tmp[0], tmp[1])); p.setAttribute('class', 'fedge tmp'); svg.append(p); } };
      const nodeEls = new Map();
      comp.nodes.forEach(n => {
        const portIn = (port, y) => el('i', { class: 'port in', 'data-node': n.id, 'data-port': port, style: { top: y + 'px' } }); const ins = n.type === 'in' ? [] : n.type === 'merge' ? [portIn('bg', 6), portIn('fg', 33)] : [portIn('in', NH / 2 - 7)];
        const outp = n.type === 'out' ? null : el('i', { class: 'port out', style: { top: (nh(n) / 2 - 7) + 'px' } });
        const d = el('div', { class: 'fnode ' + n.type + (fsel === n.id ? ' sel' : ''), style: { left: n.x + 'px', top: n.y + 'px', width: NW + 'px', height: nh(n) + 'px' } }, ...ins, outp, el('span', {}, nlabel(n)));
        d.onpointerdown = e => { if (e.target.classList.contains('port')) return; fsel = n.id; stage.querySelectorAll('.fnode').forEach(x => x.classList.remove('sel')); d.classList.add('sel'); sideDraw(); const x0 = e.clientX, y0 = e.clientY, nx = n.x, ny = n.y; let mv = false; d.setPointerCapture(e.pointerId);
          d.onpointermove = ev => { if (!mv) { snap(); mv = true; } n.x = Math.max(0, Math.round(nx + ev.clientX - x0)); n.y = Math.max(0, Math.round(ny + ev.clientY - y0)); d.style.left = n.x + 'px'; d.style.top = n.y + 'px'; redrawEdges(); }; d.onpointerup = () => { d.onpointermove = null; }; };
        if (outp) outp.onpointerdown = e => { e.stopPropagation(); outp.setPointerCapture(e.pointerId); const sr = stage.getBoundingClientRect(); outp.onpointermove = ev => redrawEdges([outPos(n), [ev.clientX - sr.left + stage.scrollLeft, ev.clientY - sr.top + stage.scrollTop]]);
          outp.onpointerup = ev => { outp.onpointermove = null; outp.onpointerup = null; const t = document.elementFromPoint(ev.clientX, ev.clientY); if (t && t.classList.contains('port') && t.classList.contains('in')) { const to = t.dataset.node, port = t.dataset.port; if (to !== n.id && !hasCycle(comp, n.id, to)) { snap(); comp.edges = comp.edges.filter(x => !(x.to === to && (x.port || 'in') === port)); comp.edges.push({ from: n.id, to, port }); } else toast('Das wäre eine Schleife.', true); } draw(); }; };
        nodeEls.set(n.id, d); stage.append(d);
      });
      redrawEdges();
      const side = el('div', { class: 'fusside' }); const sideDraw = () => {
        side.replaceChildren(); const n = comp.nodes.find(x => x.id === fsel); if (!n) { side.append(el('div', { class: 'hint' }, 'Knoten anklicken, um Werte zu ändern. Von einem Ausgang (rechter Punkt) auf einen Eingang ziehen, um zu verbinden; eine Linie anklicken löscht sie.')); return; }
        side.append(el('b', {}, nlabel(n)));
        if (n.type === 'fx') { const d = (App.fxCat.video || []).find(x => x.id === n.fx.id); if (d) Object.entries(d.params).forEach(([k, spec]) => side.append(paramRow(spec, n.fx.params[k] == null ? spec.def : n.fx.params[k], v => { n.fx.params[k] = v; }))); side.append(paramRow({ type: 'float', label: 'Mischung', min: 0, max: 1, step: 0.01 }, n.fx.mix == null ? 1 : n.fx.mix, v => { n.fx.mix = v; })); }
        if (n.type === 'merge') side.append(rowOf('Mischmodus', sel(['normal', 'screen', 'multiply', 'overlay', 'add', 'lighten', 'darken', 'difference', 'softlight', 'hardlight'].map(m => [m, m]), n.mode || 'normal', v => { n.mode = v; stage.querySelector('.fnode.sel span').textContent = nlabel(n); })), paramRow({ type: 'float', label: 'Deckkraft', min: 0, max: 1, step: 0.01 }, n.opacity == null ? 1 : n.opacity, v => { n.opacity = v; }));
        if (n.type === 'matte') { side.append(rowOf('Form', sel([['ellipse', 'Ellipse'], ['rect', 'Rechteck']], n.shape || 'ellipse', v => { n.shape = v; })), ...[['cx', 'Mitte X', 0, 1], ['cy', 'Mitte Y', 0, 1], ['w', 'Breite', 0.02, 1], ['h', 'Höhe', 0.02, 1], ['feather', 'Weiche Kante', 0, 200]].map(([k, l, a, b]) => paramRow({ type: 'float', label: l, min: a, max: b, step: b > 5 ? 1 : 0.01 }, n[k] == null ? 0.5 : n[k], v => { n[k] = v; })), paramRow({ type: 'bool', label: 'Invertieren' }, !!n.invert, v => { n.invert = v; })); }
        side.querySelectorAll('input,select').forEach(i => i.addEventListener('pointerdown', () => { if (!side._snapped) { snap(); side._snapped = true; setTimeout(() => { side._snapped = false; }, 800); } }));
      }; sideDraw();
      root.append(tb, el('div', { class: 'fusbody' }, stage, side, prev));
    }
  }

  // ---------- 3D ----------
  const SPEC0 = () => ({ fov: 40, ambient: 0.6, sun: { intensity: 1, pos: [3, 4, 5] }, bg: 'transparent', camera: { pos: [0, 1.2, 6], target: [0, 0, 0], orbit: 0 }, objects: [{ id: uid(), kind: 'cube', color: '#8b5cf6', size: 1.4, pos: [0, 0, 0], rot: [20, 30, 0], spin: [0, 40, 0] }] });
  let spec3 = SPEC0(), s3sel = null, s3 = null, s3dock = null, s3anim = null, s3load = Promise.resolve(), s3t = 0, s3play = true, s3ovId = null;
  const KINDS = [['cube', 'Würfel'], ['sphere', 'Kugel'], ['torus', 'Torus'], ['cylinder', 'Zylinder'], ['cone', 'Kegel'], ['plane', 'Fläche'], ['text', 'Text'], ['image', 'Bild']];
  const reload = () => { if (!s3) return; s3load = s3load.then(() => s3.load(JSON.parse(JSON.stringify(spec3)))).catch(e => toast('3D: ' + e.message, true)); };
  function d3dock() {
    if (s3dock && s3dock.isConnected) return s3dock; const root = el('div', { class: 'dock d3' }); s3dock = root; build(); return root;
    function build() {
      root.replaceChildren(ph('3D-Szene', 'three.js · als Overlay renderbar', btn('Neu', () => { spec3 = SPEC0(); s3sel = null; s3ovId = null; reload(); build(); }, 'small'), btn(s3play ? '❚❚' : '▶', () => { s3play = !s3play; build(); }, 'small')));
      const cvs = el('canvas', { width: 480, height: 270, class: 'd3cv' }); const left = el('div', { class: 'd3left' }, el('div', { class: 'row' }, ...KINDS.map(([k, n]) => btn('+ ' + n, async () => { snap(); let image; if (k === 'image') { const f = await App.api.invoke('dialog:files', 'media'); if (!f || !f[0]) return; image = App.api.mediaUrl(f[0]); } const o = { id: uid(), kind: k, color: '#8b5cf6', size: 1, pos: [0, 0, 0], rot: [0, 0, 0], spin: [0, 30, 0], text: k === 'text' ? 'Viola' : undefined, image }; spec3.objects.push(o); s3sel = o.id; reload(); build(); }, 'small'))), cvs);
      const list = el('div', { class: 'd3list' }, ...spec3.objects.map((o, i) => el('div', { class: 'd3item' + (s3sel === o.id ? ' on' : ''), onclick: () => { s3sel = o.id; build(); } }, (KINDS.find(k => k[0] === o.kind) || [0, o.kind])[1] + ' ' + (i + 1), btn('✕', e => { spec3.objects = spec3.objects.filter(x => x !== o); if (s3sel === o.id) s3sel = null; reload(); build(); }, 'small'))), el('div', { class: 'd3item cam' + (s3sel === 'cam' ? ' on' : ''), onclick: () => { s3sel = 'cam'; build(); } }, 'Kamera & Licht'));
      const props = el('div', { class: 'd3props' }); const pr = (l, a, b, st, get, set) => paramRow({ type: 'float', label: l, min: a, max: b, step: st }, get(), v => { set(v); reload(); });
      const vec = (l, arr, a, b, st) => ['X', 'Y', 'Z'].map((ax, i) => pr(l + ' ' + ax, a, b, st, () => arr[i], v => { arr[i] = v; }));
      const o = spec3.objects.find(x => x.id === s3sel);
      if (s3sel === 'cam') { const c = spec3.camera; props.append(pr('Sichtfeld', 15, 90, 1, () => spec3.fov, v => { spec3.fov = v; }), ...vec('Kamera', c.pos, -15, 15, 0.1), pr('Umkreisen (°/s)', -90, 90, 1, () => c.orbit || 0, v => { c.orbit = v; }), pr('Umgebungslicht', 0, 2, 0.05, () => spec3.ambient, v => { spec3.ambient = v; }), pr('Sonnenlicht', 0, 3, 0.05, () => spec3.sun.intensity, v => { spec3.sun.intensity = v; })); }
      else if (o) { props.append(rowOf('Farbe', el('input', { type: 'color', value: o.color || '#8b5cf6', oninput: e => { o.color = e.target.value; reload(); } })), pr('Größe', 0.1, 4, 0.05, () => o.size, v => { o.size = v; }), ...(o.kind === 'text' ? [rowOf('Text', el('input', { type: 'text', value: o.text || '', onchange: e => { o.text = e.target.value.slice(0, 40); reload(); } }))] : []), ...vec('Position', o.pos, -6, 6, 0.1), ...vec('Drehung °', o.rot, -180, 180, 1), ...vec('Drehen °/s', o.spin, -360, 360, 1), pr('Schweben', 0, 2, 0.05, () => o.bob || 0, v => { o.bob = v; }), pr('Deckkraft', 0.1, 1, 0.05, () => o.opacity == null ? 1 : o.opacity, v => { o.opacity = v; }), paramRow({ type: 'bool', label: 'Drahtgitter' }, !!o.wire, v => { o.wire = v; reload(); })); }
      else props.append(el('div', { class: 'hint' }, 'Objekt wählen oder neu hinzufügen. Hinweis: „Text" ist ein gestapelter Flächen-Text, kein echter 3D-Schriftkörper.'));
      props.querySelectorAll('input,select').forEach(i => i.addEventListener('pointerdown', () => { if (!props._sn) { snap(); props._sn = true; setTimeout(() => { props._sn = false; }, 800); } }));
      const dur = el('input', { type: 'number', value: 4, min: 0.5, max: 60, step: 0.5, style: { width: '64px' } });
      const ovSel = (P().overlays || []).find(x => x.id === (s3ovId || S().selOv) && x.type === 'scene3d');
      const acts = el('div', { class: 'row d3act' }, 'Dauer (s)', dur, btn(ovSel ? 'Overlay aktualisieren' : 'Als Overlay einfügen', () => { snap(); const sc = JSON.parse(JSON.stringify(spec3)); if (ovSel) { ovSel.scene = sc; ovSel.duration = +dur.value || ovSel.duration; } else { const o2 = { id: uid(), type: 'scene3d', track: 1, start: Math.round(S().t * 10) / 10, duration: +dur.value || 4, x: 0.5, y: 0.5, w: 1, scene: sc, fadeIn: 0, fadeOut: 0 }; (P().overlays = P().overlays || []).push(o2); S().selOv = o2.id; s3ovId = o2.id; } renderAll(); toast('3D-Szene ist jetzt ein Overlay (wird beim Export gerendert)'); }, 'primary small'),
        btn('Gewähltes 3D-Overlay laden', () => { const o2 = (P().overlays || []).find(x => x.id === S().selOv && x.type === 'scene3d'); if (!o2 || !o2.scene) return toast('Erst ein 3D-Overlay in der Zeitleiste anklicken.', true); spec3 = JSON.parse(JSON.stringify(o2.scene)); s3ovId = o2.id; s3sel = null; reload(); build(); }, 'small'));
      root.append(el('div', { class: 'd3body' }, left, list, props), acts);
      if (window.THREE && window.Scene3D) { try { s3 = Scene3D.create(THREE, cvs, 480, 270); reload(); } catch (e) { cvs.replaceWith(el('div', { class: 'hint' }, '3D nicht verfügbar: ' + e.message)); } } else cvs.replaceWith(el('div', { class: 'hint' }, '3D-Bibliothek nicht geladen.'));
      cancelAnimationFrame(s3anim); const tick = () => { if (!root.isConnected) { s3anim = null; return; } if (s3 && s3play) { s3t += 1 / 30; s3load.then(() => { try { s3.setTime(s3t % 8); } catch (_) {} }); } s3anim = requestAnimationFrame(tick); }; s3anim = requestAnimationFrame(tick);
    }
  }

  // ---------- Inspektor: Overlay-Mischmodus / Folien-Werkzeuge ----------
  const BL = [['normal', 'Normal'], ['screen', 'Aufhellen (Screen)'], ['add', 'Addieren'], ['lighten', 'Heller'], ['multiply', 'Multiplizieren'], ['darken', 'Dunkler'], ['overlay', 'Überlagern'], ['softlight', 'Weiches Licht'], ['hardlight', 'Hartes Licht'], ['difference', 'Differenz']];
  const _ri = renderInspector;
  renderInspector = function () {
    _ri(); const box = document.getElementById('inspector'); if (!box) return;
    const o = (P().overlays || []).find(x => x.id === S().selOv);
    if (o && !S().selected.size) {
      const c = el('div', { class: 'card' }, el('b', {}, 'Compositing'), rowOf('Mischmodus', sel(BL, o.blend || 'normal', v => { snap(); o.blend = v === 'normal' ? undefined : v; renderAll(); })));
      if (o.path && o.path.length) c.append(el('div', { class: 'hint' }, 'Folgt einem Tracking-Pfad (' + o.path.length + ' Punkte).'), btn('Pfad löschen', () => { snap(); delete o.path; renderAll(); }, 'small danger'));
      c.append(btn('Tracking …', () => tracking(o.id), 'small'));
      if (o.type === 'scene3d') c.append(btn('3D bearbeiten', () => { T().setPage('3D'); setTimeout(() => { s3ovId = o.id; if (o.scene) { spec3 = JSON.parse(JSON.stringify(o.scene)); s3sel = null; reload(); } if (s3dock) { s3dock.remove(); } T().renderPage(); }, 80); }, 'small primary'));
      box.append(c);
    } else if (!o && sel1() && sel1().type !== 'title') {
      box.append(el('div', { class: 'card' }, el('b', {}, 'Viola Pro'), el('div', { class: 'row' }, btn('Node-Graph', () => T().setPage('Fusion'), 'small'), btn('Rotoskopie …', roto, 'small'), btn('Objekt entfernen …', remove, 'small'), btn('Tracking …', () => tracking(), 'small'))));
    }
  };
  const _dpv = drawPreview; drawPreview = function () { _dpv(); try { const c = document.getElementById('cv'), x = c.getContext('2d'); (P().overlays || []).filter(o => o.type === 'scene3d' && S().t >= (o.start || 0) && S().t < (o.start || 0) + (o.duration || 3)).forEach(o => { x.save(); x.setLineDash([10, 8]); x.strokeStyle = 'rgba(167,139,250,.9)'; x.lineWidth = 3; x.strokeRect(c.width * 0.04, c.height * 0.06, c.width * 0.92, c.height * 0.88); x.fillStyle = 'rgba(167,139,250,.9)'; x.font = `bold ${Math.round(c.height / 18)}px Arial`; x.fillText('3D-Szene (erscheint beim Export)', c.width * 0.06, c.height * 0.13); x.restore(); }); } catch (_) {} };

  if (window.Studio3 && window.Studio3.BUILD) { window.Studio3.BUILD.fusion = fusionDock; window.Studio3.BUILD.d3 = d3dock; }
  window.Studio3 = Object.assign(window.Studio3 || {}, { tracking, roto, remove, multicam, diarize, translate, mic, aaf, pySettings, fusionDock, d3dock });
})();

'use strict';
// Viola – Feinschliff nach Referenz: vollständige Menüleiste, Programm-Monitor-Kopf, Transportleiste, Inspektor-Modulliste
(function () {
  const bar = document.querySelector('.menubar');
  const cl = o => JSON.parse(JSON.stringify(o));
  const addFxTo = id => { const d = App.fxCat.video.find(c => c.id === id); if (!d) return toast('Dieser Effekt ist in dieser FFmpeg-Version nicht verfügbar.', true); const params = Object.fromEntries(Object.entries(d.params).map(([k, s]) => [k, s.def])); snap(); const t = P().slides.filter(x => S().selected.has(x.id)); const e = () => ({ id, version: 1, enabled: true, bypass: false, mix: 1, params: cl(params) }); if (t.length) t.forEach(s => { s.effects = [...(s.effects || []), e()]; }); else P().settings.effects = [...(P().settings.effects || []), e()]; renderAll(); toast(d.name + ' hinzugefügt'); };
  // ----- Menüs -----
  const mk = (name, items, before) => {
    const mi = el('div', { class: 'mi' }, el('div', { class: 'mt' }, name)); const dd = el('div', { class: 'dd' });
    items.forEach(it => dd.append(it ? el('div', { class: 'it', onclick: () => { mi.classList.remove('open'); it[2](); } }, el('span', {}, it[0]), el('small', {}, it[1])) : el('div', { class: 'sp' })));
    mi.append(dd); mi.firstChild.onclick = e => { e.stopPropagation(); const was = mi.classList.contains('open'); bar.querySelectorAll('.mi').forEach(x => x.classList.remove('open')); if (!was) mi.classList.add('open'); };
    mi.firstChild.onmouseenter = () => { if (bar.querySelector('.mi.open') && !mi.classList.contains('open')) { bar.querySelectorAll('.mi').forEach(x => x.classList.remove('open')); mi.classList.add('open'); } };
    const ref = [...bar.children].find(c => c.firstChild.textContent === before); bar.insertBefore(mi, ref || null);
  };
  const fx = id => () => addFxTo(id);
  if (bar) {
    mk('Clip', [['Teilen', 'S', () => splitAtPlayhead()], ['Duplizieren', 'Strg+D', () => duplicateSelected()], ['Entfernen', 'Entf', () => deleteSelected()], null, ['Stabilisieren', '', fx('FX.TRANSFORM.STABILIZE')], ['Zuschneiden', '', fx('FX.TRANSFORM.CROP')], ['Spiegeln', '', fx('FX.TRANSFORM.FLIP')]], 'Ansicht');
    mk('Timeline', [['Marker setzen', 'M', () => Studio.addMarker()], ['Ripple-Löschen', '', () => Studio.rippleDelete()], ['Zum Anfang', '', () => seek(0)], ['Abspielen / Pause', 'Leertaste', () => play()], null, ['Alle Spuren einblenden', '', () => { snap(); P().tracks = {}; renderAll(); }], ['EDL exportieren …', '', () => App.api.invoke('edl:save', P())]], 'Ansicht');
    mk('Effekte', [['Effekt-Browser', '', () => App.showTab('effects')], ['Übergänge', '', () => App.showTab('transitions')], null, ['Vignette', '', fx('FX.LIGHT.VIGNETTE')], ['Filmkorn', '', fx('FX.ANALOG.GRAIN')], ['Glow / Bloom', '', fx('FX.LIGHT.GLOW')], ['Maske (Ellipse)', '', fx('FX.MASK.SHAPE')]], 'Ansicht');
    mk('Farbe', [['Farbpanel', '', () => App.showTab('color')], ['LUT anwenden', '', fx('FX.COLOR.LUT')], ['HDR → SDR', '', fx('FX.COLOR.TONEMAP')], ['Kurven', '', fx('FX.COLOR.CURVES')]], 'Ansicht');
    mk('Audio', [['Audio-Reiter', '', () => App.showTab('music')], ['Sprecher-Spur', '', () => App.showTab('audio')], ['Lyrics & Karaoke', '', () => App.showTab('lyrics')]], 'Ansicht');
    mk('Fenster', [['Befehlspalette', 'Strg+K', () => Studio.palette()], ['Vollbild', 'F11', () => document.documentElement.requestFullscreen && document.documentElement.requestFullscreen()]], 'Hilfe');
  }
  // ----- Programm-Monitor-Kopf -----
  const stage = document.getElementById('stage'); const scr = stage.querySelector('.screen');
  if (stage && scr && !document.getElementById('prog')) {
    const head = el('div', { id: 'prog' }, el('b', { id: 'progName' }, ''), el('span', { style: { flex: 1 } }), el('select', { id: 'progRes', title: 'Auflösung' }), el('select', { id: 'progFps', title: 'Bildrate', onchange: e => { snap(); P().settings.fps = +e.target.value || undefined; } }, ...[24, 25, 30, 50, 60].map(f => el('option', { value: f }, f + ' fps'))), el('span', { class: 'muted' }, 'Volle Auflösung'), el('button', { class: 'btn ghost small', title: 'Vollbild', onclick: () => scr.requestFullscreen && scr.requestFullscreen() }, '⛶'));
    stage.insertBefore(head, scr);
    const resel = head.querySelector('#progRes'); const fill = () => { const pr = (App.info && App.info.presets) || {}; resel.replaceChildren(...Object.entries(pr).map(([k, v]) => el('option', { value: k }, v.width >= 3000 ? '4K' : v.width < v.height ? v.width + '×' + v.height : v.height + 'p'))); resel.value = P().settings.preset; head.querySelector('#progFps').value = P().settings.fps || 25; document.getElementById('progName').textContent = 'Programm: ' + (P().name || ''); };
    resel.onchange = e => { snap(); P().settings.preset = e.target.value; renderAll(); };
    const _ra = renderAll; renderAll = function () { _ra(); fill(); }; setTimeout(fill, 600);
    // Transportleiste: Start, Bild zurück, Abspielen, Bild vor, Ende + Zeitcodes links/rechts
    const tr = stage.querySelector('.transport'); const tt = document.getElementById('tTime');
    const t1 = el('span', { id: 'tcNow', class: 'tc' }, '0:00'), t2 = el('span', { id: 'tcTot', class: 'tc muted' }, '0:00');
    const upd = () => { const { total } = layout(); t1.textContent = fmt(S().t); t2.textContent = fmt(total); };
    const _ut = updateTransport; updateTransport = function () { _ut(); upd(); };
    const nb = (t, ti, fn) => el('button', { class: 'btn ghost small', title: ti, onclick: fn }, t);
    tr.insertBefore(t1, tr.firstChild); tr.insertBefore(nb('◀|', 'Bild zurück', () => seek(S().t - 0.04)), document.getElementById('tPlay'));
    const playB = document.getElementById('tPlay'); playB.after(nb('|▶', 'Bild vor', () => seek(S().t + 0.04)), nb('▶▶', 'Zum Ende', () => seek(layout().total)));
    tr.insertBefore(t2, document.getElementById('tMusic').parentNode); tt.style.display = 'none'; upd();
  }
  // ----- Inspektor: Modulliste wie in der Referenz -----
  const MODS = [['⌗', 'Transformieren', 'FX.TRANSFORM.ROTATE'], ['⛶', 'Zuschneiden', 'FX.TRANSFORM.CROP'], ['✦', 'Dynamik', 'FX.COLOR.VIBRANCE'], ['◎', 'Stabilisierung', 'FX.TRANSFORM.STABILIZE'], ['⫶', 'Rauschreduzierung', 'FX.RESTORE.DENOISE'], ['✎', 'Objektentfernung (KI)', null], ['☺', 'Hautton', 'FX.COLOR.HUE'], ['◐', 'Look-Entwicklung', 'FX.COLOR.CURVES'], ['□', 'Vignette', 'FX.LIGHT.VIGNETTE'], ['▨', 'Körnung', 'FX.ANALOG.GRAIN'], ['✧', 'Kreativ-Looks', 'FX.STYLIZE.POSTERIZE'], ['▣', 'LUT anwenden', 'FX.COLOR.LUT']];
  const _ri = renderInspector; renderInspector = function () {
    _ri(); const box = document.getElementById('inspector'); if (!box) return;
    box.append(el('h2', { style: { marginTop: '16px' } }, 'Schnell-Module'), el('div', { class: 'mods' }, ...MODS.map(([ic, n, id]) => el('div', { class: 'mod', onclick: () => id ? addFxTo(id) : toast('Objektentfernung per KI ist nicht eingebaut (braucht ein ONNX-/GPU-Modell).', true) }, el('span', { class: 'mi2' }, ic), el('span', {}, n)))));
  };
})();

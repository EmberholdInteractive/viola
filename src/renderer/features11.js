'use strict';
// Viola – Arbeitsbereiche + Splitter, Mixer-Pegel, Versionen, Austauschformate, überwachter Ordner, Makros, Untertitel-Prüfung
(function () {
  const app = document.getElementById('app');
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };
  const cl = o => JSON.parse(JSON.stringify(o));

  // ----- kleine Dialoge (window.prompt gibt es in Electron nicht) -----
  function modal(title, body, buttons) {
    return new Promise(res => {
      const done = v => { m.remove(); res(v); };
      const m = el('div', { class: 'modal', onclick: e => { if (e.target === m) done(null); } }, el('div', { class: 'mbox' }, el('h2', {}, title), body, el('div', { class: 'row', style: { marginTop: '12px', justifyContent: 'flex-end' } }, ...buttons(done))));
      document.body.append(m); const i = m.querySelector('input'); if (i) i.focus();
    });
  }
  const ask = (title, def) => { const inp = el('input', { type: 'text', value: def || '' }); inp.onkeydown = e => { if (e.key === 'Enter') inp.closest('.modal').querySelector('.btn.primary').click(); }; return modal(title, inp, d => [btn('Abbrechen', () => d(null)), btn('OK', () => d(inp.value), 'primary')]); };
  const info = (title, body) => modal(title, body, d => [btn('Schließen', () => d(true), 'primary')]);

  // ----- Arbeitsbereiche -----
  const WS = {
    Standard: {}, Farbe: { '--c3': '520px', '--rd': '150px', hide: ['fxp'] }, Audio: { '--rd': '340px', '--c3': '240px', hide: ['fxp'] }, Effekte: { '--c4': '420px', '--c3': '0px', hide: ['colorp'] },
    Minimal: { '--c1': '0px', '--c3': '0px', '--c4': '0px', '--rd': '0px', hide: ['colorp', 'insp', 'docks', 'panel', 'fxp'] }
  };
  const VARS = ['--c1', '--c3', '--c4', '--rd']; let curWs = 'Standard';
  const applyWs = (name, silent) => {
    const w = WS[name] || WS.Standard; curWs = name; VARS.forEach(v => app.style.removeProperty(v));
    ['colorp', 'fxp', 'insp', 'docks', 'panel'].forEach(h => app.classList.remove('hide-' + h));
    Object.entries(w).forEach(([k, v]) => { if (k === 'hide') v.forEach(h => app.classList.add('hide-' + h)); else app.style.setProperty(k, v); });
    LS.set('viola.ws', name); LS.set('viola.wsvars', '{}'); if (!silent) toast('Arbeitsbereich: ' + name); window.dispatchEvent(new Event('resize'));
  };
  const toggle = h => () => { app.classList.toggle('hide-' + h); window.dispatchEvent(new Event('resize')); };
  // Splitter: Breite der linken Leiste, Höhe der Docks (wird gemerkt)
  const mkSplit = (id, onmove) => { const s = el('div', { id }); app.append(s); s.onpointerdown = e => { s.setPointerCapture(e.pointerId); s.onpointermove = onmove; }; s.onpointerup = () => { s.onpointermove = null; saveVars(); window.dispatchEvent(new Event('resize')); }; return s; };
  const saveVars = () => { const o = {}; VARS.forEach(v => { const x = app.style.getPropertyValue(v); if (x) o[v] = x; }); LS.set('viola.wsvars', JSON.stringify(o)); };
  mkSplit('spV', e => { app.style.setProperty('--c1', Math.max(200, Math.min(700, e.clientX - 6)) + 'px'); });
  mkSplit('spD', e => { app.style.setProperty('--rd', Math.max(90, Math.min(520, innerHeight - e.clientY - 6)) + 'px'); });
  applyWs(LS.get('viola.ws') && WS[LS.get('viola.ws')] ? LS.get('viola.ws') : 'Standard', true);
  try { Object.entries(JSON.parse(LS.get('viola.wsvars') || '{}')).forEach(([k, v]) => app.style.setProperty(k, v)); } catch (_) {}

  // ----- Mixer-Pegel (aus ffmpeg-Pegelverlauf, läuft mit der Wiedergabe) -----
  const lv = new Map();
  const want = src => { if (!src || lv.has(src)) return; lv.set(src, null); App.api.invoke('an:levels', src, 0.1).then(r => lv.set(src, r), () => lv.set(src, { step: 0.1, db: [] })); };
  const pctOf = db => Math.max(0, Math.min(100, (db + 60) / 66 * 100));
  const levelAt = (src, t) => { const r = lv.get(src); if (!r || !r.db.length) return null; const i = Math.floor(t / r.step); return r.db[Math.max(0, Math.min(r.db.length - 1, i))]; };
  function musicAt(t) { const A = P().audio || []; const cross = (P().music && P().music.cross) || 4; let off = 0; for (const tr of A) { const d = tr.duration || 180; if (t < off + d) return { src: tr.src, t: t - off, vol: tr.volume == null ? 1 : tr.volume }; off += d - cross; } return null; }
  function meters() {
    const A = document.querySelector('#docks .strip[data-tn="A1"] .meter i'), B = document.querySelector('#docks .strip[data-tn="A2"] .meter i'); const t = S().t;
    const m = musicAt(t); if (m) want(m.src); const v = (P().voice || []).find(x => t >= (x.start || 0) && t < (x.start || 0) + (x.duration || 9999)); if (v) want(v.src);
    const set = (e, db) => { if (e) e.style.height = (db == null || !S().playing ? 0 : pctOf(db)) + '%'; };
    if (m) { const db = levelAt(m.src, m.t); set(A, db == null ? null : db + 20 * Math.log10(Math.max(0.001, m.vol)) - (P().music && P().music.normalize !== false ? 4 : 0)); } else set(A, null);
    if (v) { const db = levelAt(v.src, t - (v.start || 0)); set(B, db == null ? null : db + 20 * Math.log10(Math.max(0.001, v.volume == null ? 1 : v.volume))); } else set(B, null);
  }
  const _ut = updateTransport; updateTransport = function () { _ut(); meters(); };
  const _pause = pause; pause = function () { _pause(); setTimeout(meters, 30); };

  // ----- Versionen -----
  async function saveVersion() { const n = await ask('Notiz zur Version', ''); if (n == null) return; await App.api.invoke('ver:save', P(), n || 'Stand'); toast('Version gespeichert'); }
  async function showVersions() {
    const list = await App.api.invoke('ver:list', P().name); const box = el('div');
    if (!list.length) box.append(el('div', { class: 'hint' }, 'Noch keine Versionen.'));
    list.forEach(v => box.append(el('div', { class: 'row' }, el('span', { style: { flex: 1 } }, v.label), btn('Wiederherstellen', async () => { if (!confirm('Version wiederherstellen? Das aktuelle Projekt wird ersetzt.')) return; snap(); App.state.project = await App.api.invoke('ver:load', v.file); S().selected.clear(); renderAll(); document.querySelector('.modal') && document.querySelector('.modal').remove(); }, 'small'))));
    await info('Versionen …', box);
  }
  // ----- Austausch -----
  const xchg = kind => async () => { try { const f = await App.api.invoke('xchg:save', P(), kind); if (f) toast('Gespeichert: ' + f); } catch (e) { toast(e.message, true); } };
  // ----- Überwachter Ordner -----
  let watching = null;
  async function watchFolder() { const f = await App.api.invoke('dialog:folder', true); if (!f || !f.length) return; try { watching = await App.api.invoke('watch:set', f[0]); toast('Überwachter Ordner: ' + watching); } catch (e) { toast(e.message, true); } }
  async function unwatch() { await App.api.invoke('watch:set', null); watching = null; toast('Überwachung beendet'); }
  App.onEvent(m => { if (m && m.type === 'watch' && m.files) { App.tabs.media.importPaths(m.files).then(() => toast('Neue Datei(en) importiert: ' + m.files.length)); } });
  // ----- Untertitel prüfen -----
  async function checkSubs() {
    try {
      const r = await App.api.invoke('subs:check', P(), layout().total); const box = el('div');
      if (!r.count) { box.append(el('div', { class: 'hint' }, 'Keine Lyrics zur Projektmusik gefunden (Reiter „Lyrics").')); }
      else if (!r.issues.length) box.append(el('div', {}, 'Keine Probleme gefunden in ' + r.count + ' Zeilen.'));
      else { box.append(el('div', { class: 'muted' }, r.issues.length + ' Problem(e) in ' + r.count + ' Zeilen')); r.issues.slice(0, 200).forEach(i => box.append(el('div', { class: 'iss' }, el('b', {}, i.at), i.msg))); }
      info('Untertitel-Prüfung', box);
    } catch (e) { toast(e.message, true); }
  }
  // ----- Makros (letzte Befehle der Befehlspalette) -----
  const getMacro = () => { try { return JSON.parse(LS.get('viola.macro') || '[]'); } catch (_) { return []; } };
  function saveMacro() { const h = (window.StudioHist || []).filter(n => !/^Makro/.test(n)).slice(-5); if (!h.length) return toast('Erst Befehle in der Befehlspalette ausführen.', true); LS.set('viola.macro', JSON.stringify(h)); toast('Makro gespeichert: ' + h.join(' → ')); }
  async function playMacro() {
    const names = getMacro(); if (!names.length) return toast('Kein Makro gespeichert.', true);
    if (!window.StudioAllCmds) { Studio.palette(); const p = document.getElementById('pal'); if (p) p.remove(); }
    for (const n of names) { const c = (window.StudioAllCmds || []).find(x => x[0] === n); if (c) { await c[1](); await new Promise(r => setTimeout(r, 150)); } }
  }

  // ----- Befehle und Menüs -----
  window.StudioCmds = [
    ...Object.keys(WS).map(n => ['Arbeitsbereich: ' + n, () => applyWs(n)]),
    ['Farbpanel ein/aus', toggle('colorp')], ['Effekt-Browser ein/aus', toggle('fxp')], ['Docks ein/aus', toggle('docks')], ['Inspektor ein/aus', toggle('insp')], ['Linke Leiste ein/aus', toggle('panel')],
    ['Version speichern …', saveVersion], ['Versionen …', showVersions], ['Exportieren als FCPXML …', xchg('fcpxml')], ['Exportieren als OTIO …', xchg('otio')], ['EDL exportieren', xchg('edl')],
    ['Ordner überwachen …', watchFolder], ['Überwachung beenden', unwatch], ['Untertitel prüfen', checkSubs], ['Makro speichern (letzte 5 Befehle)', saveMacro], ['Makro abspielen', playMacro]
  ];
  window.Studio2 = { checkSubs, applyWs, saveVersion, showVersions, ask };
  const bar = document.querySelector('.menubar');
  if (bar) {
    const add = (name, items, before) => { // vorhandenes Menü erweitern oder neu anlegen
      let mi = [...bar.children].find(c => c.firstChild.textContent === name);
      if (!mi) { mi = el('div', { class: 'mi' }, el('div', { class: 'mt' }, name), el('div', { class: 'dd' })); mi.firstChild.onclick = e => { e.stopPropagation(); const was = mi.classList.contains('open'); bar.querySelectorAll('.mi').forEach(x => x.classList.remove('open')); if (!was) mi.classList.add('open'); }; bar.insertBefore(mi, [...bar.children].find(c => c.firstChild.textContent === before) || null); }
      const dd = mi.querySelector('.dd'); items.forEach(it => dd.append(it ? el('div', { class: 'it', onclick: () => { mi.classList.remove('open'); it[1](); } }, el('span', {}, it[0]), el('small', {}, it[2] || '')) : el('div', { class: 'sp' })));
    };
    add('Datei', [null, ['Version speichern …', saveVersion], ['Versionen …', showVersions], null, ['Exportieren als FCPXML …', xchg('fcpxml')], ['Exportieren als OTIO …', xchg('otio')], ['Exportieren als EDL …', xchg('edl')], null, ['Ordner überwachen …', watchFolder], ['Überwachung beenden', unwatch]]);
    add('Fenster', [null, ...Object.keys(WS).map(n => [n + '-Arbeitsbereich', () => applyWs(n)]), null, ['Farbpanel ein/aus', toggle('colorp')], ['Effekt-Browser ein/aus', toggle('fxp')], ['Docks ein/aus', toggle('docks')], ['Inspektor ein/aus', toggle('insp')]]);
  }
})();

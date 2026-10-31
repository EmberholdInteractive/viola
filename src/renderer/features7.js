'use strict';
// Viola – Menüleiste (Datei, Bearbeiten, Ansicht, Hilfe) im Kopfbereich.
(function () {
  const head = $('#head'); const logo = head.querySelector('.logo'); const bar = el('div', { class: 'menubar' });
  const T = s => (window.I18n ? I18n.t(s) : s);
  const click = id => () => { const b = document.getElementById(id); if (b) b.click(); };
  const M = [
    ['Datei', [['Neues Projekt', 'Strg+N', click('bNew')], ['Öffnen …', 'Strg+O', click('bOpen')], ['Speichern', 'Strg+S', click('bSave')], ['Speichern unter …', 'Strg+Umschalt+S', () => saveProject(true)], null, ['Exportieren …', '', () => App.showTab('export')]]],
    ['Bearbeiten', [['Rückgängig', 'Strg+Z', click('bUndo')], ['Wiederholen', 'Strg+Y', click('bRedo')], null, ['Teilen', 'S', click('tlSplit')], ['Duplizieren', 'Strg+D', click('tlDup')], ['Entfernen', 'Entf', click('tlDel')]]],
    ['Ansicht', [['Medien', '', () => App.showTab('media')], ['Effekte & Zeitleiste', '', () => { S().selected.clear(); renderAll(); }], ['Lyrics', '', () => App.showTab('lyrics')], null, ['Sprache: Deutsch', '', () => I18n.set('de')], ['Language: English', '', () => I18n.set('en')]]],
    ['Hilfe', [['Tutorial', 'F1', () => window.Studio3 && Studio3.tutorial && Studio3.tutorial()], null, ['Entwicklerwerkzeuge', 'F12', () => App.api.invoke('shell:devtools')], ['Über Viola', '', () => toast('Viola 0.3 – Videostudio mit Amethyst-Design')]]],
  ];
  M.forEach(([name, items]) => {
    const mi = el('div', { class: 'mi' }, el('div', { class: 'mt' }, name)); const dd = el('div', { class: 'dd' });
    items.forEach(it => dd.append(it ? el('div', { class: 'it', onclick: () => { mi.classList.remove('open'); it[2](); } }, el('span', {}, it[0]), el('small', {}, it[1])) : el('div', { class: 'sp' })));
    mi.append(dd); mi.firstChild.onclick = e => { e.stopPropagation(); const was = mi.classList.contains('open'); bar.querySelectorAll('.mi').forEach(x => x.classList.remove('open')); if (!was) mi.classList.add('open'); };
    mi.firstChild.onmouseenter = () => { if (bar.querySelector('.mi.open') && !mi.classList.contains('open')) { bar.querySelectorAll('.mi').forEach(x => x.classList.remove('open')); mi.classList.add('open'); } };
    bar.append(mi);
  });
  document.addEventListener('click', () => bar.querySelectorAll('.mi').forEach(x => x.classList.remove('open')));
  logo.after(bar);
})();

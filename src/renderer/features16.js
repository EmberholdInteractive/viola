'use strict';
// Viola – Update-Hinweis: zeigt in der Fensterleiste, wenn ein neues Update gefunden, geladen oder bereit ist
(function () {
  const tb = document.getElementById('taskbar') || document.body; const tctl = tb.querySelector('.tctl') || tb;
  const bar = el('span', { id: 'updbar' }); tctl.prepend(bar);
  const T = s => (window.I18n ? I18n.t(s) : s);
  let lastToast = '';
  function show(st) {
    bar.replaceChildren(); bar.classList.remove('on'); if (!st) return;
    if (st.state === 'downloading') { bar.classList.add('on'); bar.append(T('Update') + ' ' + (st.version || '') + ': ' + T('wird geladen') + ' ' + (st.percent || 0) + ' %'); if (lastToast !== 'd' + st.version) { lastToast = 'd' + st.version; toast(T('Update gefunden') + ' (' + (st.version || '') + ') – ' + T('wird automatisch geladen')); } }
    else if (st.state === 'ready') { bar.classList.add('on'); bar.append(T('Update') + ' ' + (st.version || '') + ' ' + T('bereit'), el('button', { onclick: () => App.api.invoke('update:install') }, T('Neu starten und installieren'))); if (lastToast !== 'r' + st.version) { lastToast = 'r' + st.version; toast(T('Update bereit') + ' (' + (st.version || '') + ') – ' + T('wird beim nächsten Beenden installiert')); } }
    else if (st.state === 'none' && manual) { toast(T('Viola ist aktuell')); manual = false; }
    else if (st.state === 'error' && manual) { toast(T('Update-Suche fehlgeschlagen')); manual = false; }
  }
  let manual = false;
  App.listeners.push(m => { if (m && m.type === 'update') show(m); });
  App.api.invoke('update:state').then(st => { if (st) { window.__violaVersion = st.version; show(st); } }).catch(() => {});
  window.Studio3 = Object.assign(window.Studio3 || {}, { checkUpdate: () => { manual = true; App.api.invoke('update:check').then(ok => { if (!ok) toast(T('Updates gibt es nur in der installierten Version')); }).catch(() => toast(T('Updates gibt es nur in der installierten Version'))); } });
})();

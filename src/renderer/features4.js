'use strict';
// Viola – Projekt-Sicherheit in der Oberfläche: Autosave, Wiederherstellung, fehlende Medien, Projekt sammeln.
(function () {
  let last = '';
  const snapshot = () => { try { return JSON.stringify(P()); } catch (_) { return ''; } };
  setInterval(async () => { const s = snapshot(); if (s && s !== last && P().slides.length) { last = s; try { await App.api.invoke('safe:autosave', P()); } catch (_) {} } }, 45000);
  async function checkMissing(offer) {
    const miss = await App.api.invoke('safe:missing', P());
    if (!miss.length) { if (offer) toast('Alle Dateien sind vorhanden.'); return; }
    if (!confirm(`${miss.length} Datei(en) fehlen (z. B. ${miss[0].split(/[\\/]/).pop()}).\nOrdner wählen, in dem sie jetzt liegen?`)) return;
    const r = await App.api.invoke('safe:relink', P()); if (!r) return;
    snap(); App.state.project = Object.assign(App.state.project, r.project); renderAll(); toast(`${r.fixed} neu verknüpft, ${r.left} nicht gefunden`, r.left > 0);
  }
  const _open = openProject; openProject = async function () { await _open(); setTimeout(() => checkMissing(false), 400); };
  const _tab = App.tabs.media.build;
  App.tabs.media.build = function (p) {
    _tab.call(this, p);
    p.append(step('Projekt-Sicherheit',
      el('div', { class: 'hint' }, 'Alle 45 Sekunden wird automatisch gesichert. Beim Speichern bleiben die letzten fünf Fassungen als .bak erhalten.'),
      el('div', { class: 'row' }, btn('Fehlende Medien prüfen', () => checkMissing(true), 'small'),
        btn('Projekt sammeln …', async () => { const r = await App.api.invoke('safe:collect', P()); if (r) toast(`${r.files} Dateien gesammelt (${(r.bytes / 1e6).toFixed(0)} MB)${r.skipped.length ? ', ' + r.skipped.length + ' fehlten' : ''}`, r.skipped.length > 0); }, 'small')),
      el('div', { class: 'row' }, btn('Gesicherte Fassung laden …', async () => { const r = await App.api.invoke('safe:pick'); if (r) { snap(); App.state.project = Object.assign(blankProject(), r); P().slides.forEach(s => { if (!s.id) s.id = uid(); }); renderAll(); toast('Fassung geladen'); } }, 'small'))));
  };
  window.addEventListener('beforeunload', () => { try { App.api.invoke('safe:clean'); } catch (_) {} });
  // Beim Start: unsauberes Beenden erkennen
  setTimeout(async () => { try { const r = await App.api.invoke('safe:recover'); if (r && confirm('Viola wurde nicht sauber beendet. Die letzte automatische Sicherung wiederherstellen?')) { App.state.project = Object.assign(blankProject(), r); P().slides.forEach(s => { if (!s.id) s.id = uid(); }); renderAll(); toast('Sicherung wiederhergestellt'); } } catch (_) {} }, 1200);
})();

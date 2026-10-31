'use strict';
// Viola – Analyse im Inspektor: Szenen erkennen, Stille entfernen, Scopes (Waveform, Histogramm, Vectorscope).
(function () {
  const replaceSlide = (s, parts) => { snap(); const arr = P().slides; const i = arr.indexOf(s); arr.splice(i, 1, ...parts.map(p => Object.assign({}, s, p, { id: uid() }))); S().selected = new Set(parts.length ? [arr[i].id] : []); renderAll(); };
  const clipRange = s => { const a = s.trimStart || 0; return [a, a + (s.duration || 5)]; };
  let scopeKind = 'waveform'; const scopeImg = el('img', { style: { width: '100%', borderRadius: '8px', background: '#000', display: 'none' } });
  async function showScope(s) {
    const t = Math.max(0, (S().t || 0) - ((layout().L.find(x => x.s === s) || { start: 0 }).start)) + (s.trimStart || 0);
    const r = await App.api.invoke('an:scope', s.src, t, scopeKind); if (r) { scopeImg.src = App.api.mediaUrl(r) + '?' + Date.now(); scopeImg.style.display = 'block'; }
  }
  const _ri = renderInspector;
  renderInspector = function () {
    _ri(); const sl = P().slides.filter(s => S().selected.has(s.id)); if (sl.length !== 1 || sl[0].type === 'title') return; const s = sl[0]; const box = $('#inspector'); const stat = el('div', { class: 'hint' });
    const card = el('div', { class: 'card' }, el('div', { class: 'muted', style: { color: '#d9c8ff', marginBottom: '6px' } }, 'Scopes (Messdarstellung)'),
      rowOf('Art', sel([['waveform', 'Waveform (Helligkeit)'], ['histogram', 'Histogramm'], ['vectorscope', 'Vectorscope (Farbe)']], scopeKind, v => { scopeKind = v; showScope(s); })),
      el('div', { class: 'row' }, btn('Aktuelles Bild messen', () => showScope(s), 'small')), scopeImg);
    box.append(el('h2', { style: { marginTop: '18px' } }, 'Analyse'));
    if (s.type === 'video') box.append(el('div', { class: 'card' },
      el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } },
        btn('Szenen erkennen und teilen', async () => {
          stat.textContent = 'Analysiere …'; const [a, b] = clipRange(s); const ts = (await App.api.invoke('an:scenes', s.src, 0.3)).filter(t => t > a + 0.4 && t < b - 0.4);
          if (!ts.length) { stat.textContent = 'Keine Szenenwechsel gefunden.'; return; } const cuts = [a, ...ts, b];
          replaceSlide(s, cuts.slice(0, -1).map((c, i) => ({ trimStart: c, duration: Math.round((cuts[i + 1] - c) * 100) / 100 }))); toast((ts.length + 1) + ' Szenen');
        }, 'small'),
        btn('Stille entfernen', async () => {
          stat.textContent = 'Analysiere …'; const [a, b] = clipRange(s); const r = await App.api.invoke('an:silence', s.src, { db: -35, minDur: 0.6 });
          const loud = r.loud.map(x => ({ start: Math.max(x.start, a), end: Math.min(x.end, b) })).filter(x => x.end - x.start > 0.3);
          if (!loud.length || (loud.length === 1 && loud[0].start <= a + 0.05 && loud[0].end >= b - 0.05)) { stat.textContent = 'Keine Stille gefunden.'; return; }
          replaceSlide(s, loud.map(x => ({ trimStart: Math.round(x.start * 100) / 100, duration: Math.round((x.end - x.start) * 100) / 100 }))); toast(`${r.quiet.length} Pausen entfernt`);
        }, 'small')), stat));
    box.append(card);
  };
})();

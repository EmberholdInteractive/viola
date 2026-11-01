'use strict';
// Viola – Fensterleiste: untere Fenster (Docks) minimieren in die Taskleiste, wiederherstellen, vergrößern und in der Breite/Höhe ziehen
(function () {
  const app = document.getElementById('app'), docks = document.getElementById('docks'); if (!app || !docks) return;
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };
  let st = { min: [], w: {}, max: null, rd: null }; try { Object.assign(st, JSON.parse(LS.get('viola.docks') || '{}')); } catch (_) {}
  const save = () => LS.set('viola.docks', JSON.stringify(st));
  const NAMES = { Video: 'Export', Parameter: 'Parameter' };
  const nameOf = d => { const b = d.querySelector(':scope > .ph b'); if (b) return b.textContent.trim(); const t = d.querySelector(':scope > .ptabs button'); if (t) { const x = t.textContent.trim(); return NAMES[x] || x; } return d.dataset.name || 'Fenster'; };

  const bar = el('footer', { id: 'taskbar' }); app.append(bar);
  const chips = el('div', { class: 'tchips' }); const ctl = el('div', { class: 'tctl' });
  bar.append(el('span', { class: 'tlabel' }, 'Fenster'), chips, ctl);
  const allBtn = el('button', { class: 'tbtn', title: 'Alle unteren Fenster minimieren oder zeigen' }, 'Alle minimieren'); ctl.append(allBtn);

  const isMin = n => st.min.includes(n);
  function setMin(n, v) { st.min = st.min.filter(x => x !== n); if (v) st.min.push(n); if (v && st.max === n) st.max = null; save(); layout(); }

  let busy = false, orig = null, mine = null;
  function layout() {
    if (busy) return; busy = true;
    try {
      const kids = [...docks.children].filter(k => k.classList.contains('dock'));
      // Ursprüngliche Spaltenbreiten der Seite merken (wird von der Seitenlogik gesetzt)
      const cur = docks.style.gridTemplateColumns; if (cur !== mine) orig = cur || null;
      const base = (orig || '').split(/\s+/).filter(Boolean).map(x => parseFloat(x) || 1);
      chips.replaceChildren(); let nvis = 0; const vis = [];
      kids.forEach((k, i) => {
        const n = nameOf(k); k.dataset.name = n; const m = isMin(n); k.classList.toggle('dock-min', m);
        if (!m) { nvis++; vis.push({ k, n, w: st.w[n] || base[i] || 1 }); }
        if (!k.querySelector(':scope .dockctl')) addCtl(k, n);
        const mx = k.querySelector('.dockctl .dmax'); if (mx) mx.textContent = st.max === n ? '⤡' : '⤢';
        chips.append(el('button', { class: 'chip' + (m ? ' off' : ''), title: m ? 'Fenster wiederherstellen' : 'Fenster minimieren', onclick: () => setMin(n, !m) }, el('i', {}), n));
      });
      allBtn.textContent = kids.length && nvis === 0 ? 'Alle zeigen' : 'Alle minimieren';
      allBtn.onclick = () => { st.min = nvis === 0 ? [] : kids.map(nameOf); save(); layout(); };
      app.classList.toggle('docks-allmin', kids.length > 0 && nvis === 0);
      bar.classList.toggle('empty', kids.length === 0);
      if (vis.length) { const ws = vis.map(v => st.max && st.max === v.n ? 8 : (st.max ? 0.35 : v.w)); mine = ws.map(w => w + 'fr').join(' '); docks.style.gridTemplateColumns = mine; } else mine = docks.style.gridTemplateColumns;
      handles(vis);
      if (st.rd) app.style.setProperty('--rd', st.rd + 'px');
      window.dispatchEvent(new Event('resize'));
    } finally { busy = false; }
  }
  function addCtl(k, n) {
    const c = el('span', { class: 'dockctl' }, el('button', { class: 'dmin', title: 'Minimieren (in die Fensterleiste)', onclick: e => { e.stopPropagation(); setMin(n, true); } }, '–'),
      el('button', { class: 'dmax', title: 'Vergrößern / zurücksetzen (Doppelklick auf die Titelzeile)', onclick: e => { e.stopPropagation(); st.max = st.max === n ? null : n; save(); layout(); } }, '⤢'));
    const host = k.querySelector(':scope > .ph') || k.querySelector(':scope > .ptabs');
    if (host) host.append(c); else { const s = el('div', { class: 'dockstrip' }, el('b', {}, n), c); k.prepend(s); }
    const hd = k.querySelector(':scope > .ph') || k.querySelector(':scope > .ptabs') || k.querySelector(':scope > .dockstrip');
    if (hd) hd.ondblclick = e => { if (e.target.closest('button,input,select')) return; st.max = st.max === n ? null : n; save(); layout(); };
  }
  // Trennbalken zwischen sichtbaren Fenstern (Breite ziehen)
  function handles(vis) {
    docks.querySelectorAll(':scope > .dsplit').forEach(h => h.remove());
    if (st.max) return;
    for (let i = 0; i < vis.length - 1; i++) {
      const a = vis[i], b = vis[i + 1], h = el('div', { class: 'dsplit', title: 'Ziehen: Breite ändern' });
      const place = () => { const ra = a.k.getBoundingClientRect(), rd = docks.getBoundingClientRect(); h.style.left = (ra.right - rd.left + 0) + 'px'; };
      docks.append(h); place();
      h.onpointerdown = e => { e.preventDefault(); h.setPointerCapture(e.pointerId); const x0 = e.clientX, wa = a.k.getBoundingClientRect().width, wb = b.k.getBoundingClientRect().width, tot = a.w + b.w;
        h.onpointermove = ev => { const dx = Math.max(-wa + 90, Math.min(wb - 90, ev.clientX - x0)); const na = (wa + dx) / (wa + wb) * tot, nb = tot - na; st.w[a.n] = +na.toFixed(3); st.w[b.n] = +nb.toFixed(3); a.w = na; b.w = nb; mine = vis.map(v => v.w + 'fr').join(' '); docks.style.gridTemplateColumns = mine; place(); };
        h.onpointerup = () => { h.onpointermove = null; save(); layout(); }; };
    }
  }
  // Höhe der unteren Fenster: vorhandenen Griff an die neue Leiste anpassen
  const sp = document.getElementById('spD');
  if (sp) { sp.onpointerdown = e => { sp.setPointerCapture(e.pointerId); sp.onpointermove = ev => { const h = Math.max(90, Math.min(560, innerHeight - ev.clientY - 6 - 34 - 6)); st.rd = h; app.style.setProperty('--rd', h + 'px'); }; }; sp.onpointerup = () => { sp.onpointermove = null; save(); window.dispatchEvent(new Event('resize')); }; }

  let t = 0; const later = () => { cancelAnimationFrame(t); t = requestAnimationFrame(layout); };
  new MutationObserver(ms => { if (busy) return; if (ms.some(m => [...m.addedNodes, ...m.removedNodes].some(n => !(n.classList && n.classList.contains('dsplit'))))) later(); }).observe(docks, { childList: true });
  window.addEventListener('resize', () => { if (!busy) later(); });
  window.Studio3 = Object.assign(window.Studio3 || {}, { dockMin: setMin, dockState: st });
  layout();
})();

'use strict';
// Viola – Overlay-Spuren in der Zeitleiste (V1, V2, … über der Hauptspur): Titel, Bilder, Videos; Verschieben, Kürzen, Bearbeiten, Vorschau.
(function () {
  const OV = () => P().overlays || (P().overlays = []);
  const tracksOf = () => Math.max(2, ...OV().map(o => o.track || 1)) ;
  const imgCache = new Map();
  const img = src => { if (!imgCache.has(src)) { const i = new Image(); i.src = App.api.mediaUrl(src); i.onload = () => drawPreview(); imgCache.set(src, i); } return imgCache.get(src); };

  const _rt = renderTimeline;
  renderTimeline = function () {
    _rt();
    const inner = $('#tlInner'); let box = $('#ovRows'); if (!box) { box = el('div', { id: 'ovRows' }); inner.insertBefore(box, $('#rowSlides')); } box.replaceChildren();
    const z = S().zoom; const n = tracksOf();
    for (let t = n; t >= 1; t--) {
      const row = el('div', { class: 'tl-row ovrow', 'data-track': t, style: { height: '34px', margin: '4px 0 0', background: 'rgba(139,92,246,.05)', borderTop: '1px solid rgba(139,92,246,.15)' } }, el('span', { class: 'hint', style: { position: 'sticky', left: '4px', zIndex: 2, fontSize: '10px' } }, 'V' + (t + 1)));
      OV().filter(o => (o.track || 1) === t).forEach(o => {
        const b = el('div', { class: 'blk ' + (o.type === 'title' ? 'title' : 'photo') + (S().selOv === o.id ? ' sel' : ''), style: { left: (o.start || 0) * z + 'px', width: Math.max(8, (o.duration || 3) * z - 2) + 'px', top: '2px', height: '30px', position: 'absolute' } },
          el('div', { class: 'lbl', style: { position: 'static', padding: '3px 6px', fontSize: '11px' } }, o.type === 'title' ? (o.text || 'Titel').split('\n')[0] : base(o.src || '')), el('div', { class: 'hnd', 'data-h': '1' }));
        b.addEventListener('mousedown', e => {
          e.stopPropagation(); S().selOv = o.id; S().selected.clear(); const handle = !!e.target.closest('.hnd'); const x0 = e.clientX, s0 = o.start || 0, d0 = o.duration || 3; let moved = false; snap();
          const mv = ev => { moved = true; const dx = (ev.clientX - x0) / S().zoom; if (handle) o.duration = Math.max(0.2, Math.round((d0 + dx) * 10) / 10); else o.start = Math.max(0, Math.round((s0 + dx) * 10) / 10); renderTimeline(); };
          const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); renderAll(); }; addEventListener('mousemove', mv); addEventListener('mouseup', up); renderAll();
        });
        row.append(b);
      });
      box.append(row);
    }
  };

  // Hinzufügen
  const bar = $('.tl-bar'); const addBtn = (label, fn) => { const b = btn(label, fn, 'small'); bar.insertBefore(b, $('#tlSplit')); return b; };
  const addOv = o => { snap(); const free = o.track || 1; OV().push(Object.assign({ id: uid(), start: Math.round(S().t * 10) / 10, duration: 3, track: free }, o)); S().selOv = OV()[OV().length - 1].id; renderAll(); };
  addBtn('+ Titel (Overlay)', () => addOv({ type: 'title', text: 'Neuer Titel' }));
  addBtn('+ Bild/Video (Overlay)', async () => { const f = await App.api.invoke('dialog:files', 'media'); if (!f || !f[0]) return; const vid = /\.(mp4|mov|avi|mkv|webm|mts)$/i.test(f[0]); addOv({ type: vid ? 'video' : 'photo', src: f[0], x: 0.5, y: 0.5, w: 0.3 }); });

  // Inspektor
  const _ri = renderInspector;
  renderInspector = function () {
    _ri(); const o = OV().find(x => x.id === S().selOv); if (!o || S().selected.size) return;
    const box = $('#inspector'); box.replaceChildren();
    const set = (k, v) => { snap(); o[k] = v; renderAll(); };
    const slider = (k, l, min, max, step, def) => rowOf(l, el('input', { type: 'range', min, max, step, value: o[k] == null ? def : o[k], onchange: e => set(k, parseFloat(e.target.value)) }));
    box.append(el('h2', {}, o.type === 'title' ? 'Titel-Overlay' : 'Bild/Video-Overlay'));
    if (o.type === 'title') box.append(rowOf('Text', el('textarea', { rows: 3, onchange: e => set('text', e.target.value) }, o.text || '')), rowOf('Farbe', el('input', { type: 'color', value: o.color || '#ffffff', onchange: e => set('color', e.target.value) })), slider('size', 'Schriftgröße', 0.03, 0.2, 0.01, 0.08));
    box.append(rowOf('Spur (V2 = 1)', num(o.track || 1, 1, 1, v => set('track', Math.max(1, Math.round(v))))), rowOf('Startet bei (s)', num(o.start || 0, 0.1, 0, v => set('start', Math.max(0, v)))), rowOf('Dauer (s)', num(o.duration || 3, 0.1, 0.2, v => set('duration', Math.max(0.2, v)))),
      slider('x', 'Position waagerecht', 0, 1, 0.01, 0.5), slider('y', 'Position senkrecht', 0, 1, 0.01, o.type === 'title' ? 0.85 : 0.5), slider('w', 'Größe (Breite)', 0.05, 1, 0.01, o.type === 'title' ? 0.8 : 0.3), slider('opacity', 'Deckkraft', 0, 1, 0.05, 1),
      rowOf('Einblenden (s)', num(o.fadeIn == null ? 0.4 : o.fadeIn, 0.1, 0, v => set('fadeIn', v))), rowOf('Ausblenden (s)', num(o.fadeOut == null ? 0.4 : o.fadeOut, 0.1, 0, v => set('fadeOut', v))),
      el('div', { class: 'row' }, btn('Overlay entfernen', () => { snap(); P().overlays = OV().filter(x => x.id !== o.id); S().selOv = null; renderAll(); }, 'danger small')));
  };
  // Vorschau
  const _dp = drawPreview;
  drawPreview = function () {
    _dp(); const t = S().t; const W = cv.width, H = cv.height;
    OV().filter(o => t >= (o.start || 0) && t <= (o.start || 0) + (o.duration || 3)).sort((a, b) => (a.track || 1) - (b.track || 1)).forEach(o => {
      const fi = Math.min(o.fadeIn == null ? 0.4 : o.fadeIn, (o.duration || 3) / 2), fo = Math.min(o.fadeOut == null ? 0.4 : o.fadeOut, (o.duration || 3) / 2); const lt = t - (o.start || 0);
      let a = (o.opacity == null ? 1 : o.opacity); if (fi && lt < fi) a *= lt / fi; if (fo && (o.duration || 3) - lt < fo) a *= Math.max(0, ((o.duration || 3) - lt) / fo);
      cx.save(); cx.globalAlpha = a; const x = (o.x == null ? 0.5 : o.x) * W, y = (o.y == null ? (o.type === 'title' ? 0.85 : 0.5) : o.y) * H;
      if (o.type === 'title') { const fs = Math.round(H * (o.size || 0.08)); cx.font = `bold ${fs}px Arial`; cx.textAlign = 'center'; cx.lineWidth = Math.max(1, fs / 18); cx.strokeStyle = 'rgba(0,0,0,.5)'; cx.fillStyle = o.color || '#fff'; (o.text || '').split('\n').forEach((l, i, arr) => { const yy = y + (i - (arr.length - 1) / 2) * fs * 1.25 + fs * 0.35; cx.strokeText(l, x, yy); cx.fillText(l, x, yy); }); }
      else if (o.type === 'photo' && o.src) { const im = img(o.src); if (im.complete && im.naturalWidth) { const w = W * (o.w || 0.3), h = w * im.naturalHeight / im.naturalWidth; cx.drawImage(im, x - w / 2, y - h / 2, w, h); } }
      else if (o.type === 'video') { cx.fillStyle = 'rgba(139,92,246,.5)'; const w = W * (o.w || 0.3), h = w * 9 / 16; cx.fillRect(x - w / 2, y - h / 2, w, h); cx.fillStyle = '#fff'; cx.font = `${Math.round(H * 0.04)}px Arial`; cx.textAlign = 'center'; cx.fillText('▶ ' + base(o.src || ''), x, y); }
      cx.restore();
    });
  };
  // Klick auf Hauptspur hebt Overlay-Auswahl auf
  $('#rowSlides').addEventListener('mousedown', () => { if (S().selOv) { S().selOv = null; } }, true);
})();

// Auto-Collage: gescannte Medien -> Projekt je Jahr (Titelkarte Jahr, Titelkarte je Monat, Fotos nach Datum).
const path = require('path');
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

// Zuordnung: Aufnahmedatum zählt, wenn es zum Jahresordner passt (±1 Jahr, wegen Silvester/Reisen).
// Sonst gilt der Jahresordner; der Monat kommt dann aus dem Ordnernamen, andernfalls "Weitere Fotos" (m = -1).
function groupByYearMonth(items, { includeUndated = true, minSize = 80000 } = {}) {
  const years = new Map();
  for (const it of items) {
    if (it.kind !== 'photo' && it.kind !== 'video') continue;
    if (it.kind === 'photo' && it.size < minSize) continue; // Vorschaubilder
    let y = null, m = null; const d = it.date ? new Date(it.date) : null; const fy = it.folderYear || null;
    if (d && (fy == null || Math.abs(d.getFullYear() - fy) <= 1)) { y = d.getFullYear(); m = d.getMonth(); }
    else if (fy != null) { y = fy; m = it.folderMonth != null ? it.folderMonth : -1; }
    if (y == null) continue;
    if (m === -1 && !includeUndated) continue;
    if (!years.has(y)) years.set(y, new Map());
    const ym = years.get(y); if (!ym.has(m)) ym.set(m, []); ym.get(m).push(it);
  }
  return years;
}

// opts: perMonth (0 = alle), photoSeconds, videos (bool), titleSeconds, yearTitle (bool), motion, transition
function buildYearProject(year, monthsMap, opts = {}) {
  const o = Object.assign({ perMonth: 0, photoSeconds: 2.5, videos: false, titleSeconds: 3.5, yearTitle: true, motion: 'none', transition: 'fade', monthTitles: true }, opts);
  const slides = [];
  if (o.yearTitle) slides.push({ type: 'title', text: String(year), subtitle: 'Fotos aus dem Jahr', duration: 4.5 });
  const keys = [...monthsMap.keys()].sort((a, b) => (a === -1 ? 99 : a) - (b === -1 ? 99 : b));
  for (const m of keys) {
    let arr = monthsMap.get(m).filter(i => o.videos || i.kind === 'photo').sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.path.localeCompare(b.path));
    if (!arr.length) continue;
    if (o.perMonth > 0 && arr.length > o.perMonth) { const n = arr.length; arr = Array.from({ length: o.perMonth }, (_, i) => arr[Math.floor(i * n / o.perMonth + n / o.perMonth / 2)]); }
    if (o.monthTitles) slides.push({ type: 'title', text: m === -1 ? 'Weitere Fotos' : MON[m], subtitle: String(year), duration: o.titleSeconds });
    for (const it of arr) slides.push(it.kind === 'video' ? { type: 'video', src: it.path, duration: o.photoSeconds * 2, transition: o.transition } : { type: 'photo', src: it.path, duration: o.photoSeconds, transition: o.transition, motion: o.motion });
  }
  return { name: `Jahr ${year}`, settings: { preset: o.preset || '720p', transition: o.transition, motion: o.motion, transitionDur: o.transitionDur || 0.5, defaultSlide: o.photoSeconds }, slides, audio: o.audio || [], music: o.music || {} };
}

module.exports = { groupByYearMonth, buildYearProject, MON };

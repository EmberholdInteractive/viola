'use strict';
// Projekt-Sicherheit: Autosave mit Schnappschüssen, Wiederherstellung, Sicherungskopien beim Speichern,
// fehlende Medien finden und neu verknüpfen, Projekt sammeln (alle Dateien in einen Ordner kopieren).
const fs = require('fs'), path = require('path');

const mediaRefs = p => {
  const refs = [];
  (p.slides || []).forEach((s, i) => { if (s.src) refs.push({ get: () => s.src, set: v => { s.src = v; }, where: 'slides.' + i }); });
  (p.audio || []).forEach((a, i) => { if (a.src) refs.push({ get: () => a.src, set: v => { a.src = v; }, where: 'audio.' + i }); });
  (p.voice || []).forEach((a, i) => { if (a.src) refs.push({ get: () => a.src, set: v => { a.src = v; }, where: 'voice.' + i }); });
  (p.overlays || []).forEach((a, i) => { if (a.src) refs.push({ get: () => a.src, set: v => { a.src = v; }, where: 'overlays.' + i }); });
  const wm = p.export && p.export.watermark; if (wm && wm.file) refs.push({ get: () => wm.file, set: v => { wm.file = v; }, where: 'export.watermark' });
  return refs;
};
const missing = p => [...new Set(mediaRefs(p).map(r => r.get()).filter(f => !fs.existsSync(f)))];

// Neu verknüpfen: gleicher Dateiname in einem neuen Ordner (rekursiv bis Tiefe 4)
function index(dir, depth = 4, out = new Map()) {
  let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
  for (const e of ents) { const f = path.join(dir, e.name); if (e.isDirectory()) { if (depth > 0) index(f, depth - 1, out); } else if (!out.has(e.name.toLowerCase())) out.set(e.name.toLowerCase(), f); }
  return out;
}
function relink(p, folder) {
  const idx = index(folder); let fixed = 0, left = 0;
  for (const r of mediaRefs(p)) {
    const f = r.get(); if (fs.existsSync(f)) continue;
    const hit = idx.get(path.basename(f.replace(/\\/g, '/')).toLowerCase());
    if (hit) { r.set(hit); fixed++; } else left++;
  }
  return { fixed, left };
}

// Projekt sammeln: Medien in <dir>/Medien kopieren, Pfade im Projekt ersetzen, Projektdatei daneben speichern
function collect(p, dir, name = 'Projekt') {
  const mdir = path.join(dir, 'Medien'); fs.mkdirSync(mdir, { recursive: true });
  const copy = Object.assign({}, JSON.parse(JSON.stringify(p))); const map = new Map(); let n = 0, bytes = 0, skipped = [];
  for (const r of mediaRefs(copy)) {
    const f = r.get(); if (!fs.existsSync(f)) { skipped.push(f); continue; }
    if (!map.has(f)) {
      let base = path.basename(f.replace(/\\/g, '/')), t = path.join(mdir, base), k = 1;
      while (fs.existsSync(t)) { const e = path.extname(base); t = path.join(mdir, path.basename(base, e) + '_' + (++k) + e); }
      fs.copyFileSync(f, t); bytes += fs.statSync(t).size; map.set(f, t); n++;
    }
    r.set(map.get(f));
  }
  const file = path.join(dir, name.replace(/[\\/:*?"<>|]/g, '_') + '.viola');
  fs.writeFileSync(file, JSON.stringify(Object.assign({ version: 1 }, copy), null, 1));
  return { file, files: n, bytes, skipped };
}

// Autosave: rollierende Schnappschüsse
function autosave(dir, p, keep = 20) {
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'auto-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + String(process.hrtime.bigint() % 1000000n) + '.viola');
  fs.writeFileSync(f + '.tmp', JSON.stringify(p)); fs.renameSync(f + '.tmp', f);
  const all = snapshots(dir); all.slice(keep).forEach(s => { try { fs.unlinkSync(s.file); } catch (_) {} });
  return f;
}
function snapshots(dir) {
  try { return fs.readdirSync(dir).filter(n => /^auto-.*\.viola$/.test(n)).map(n => ({ file: path.join(dir, n), time: fs.statSync(path.join(dir, n)).mtimeMs, name: n })).sort((a, b) => b.time - a.time); } catch (_) { return []; }
}
// Beim Speichern die vorige Fassung als .bak1, .bak2, … behalten
function backupBeforeSave(file, keep = 5) {
  if (!fs.existsSync(file)) return null;
  for (let i = keep - 1; i >= 1; i--) { const a = file + '.bak' + i; if (fs.existsSync(a)) fs.renameSync(a, file + '.bak' + (i + 1)); }
  fs.copyFileSync(file, file + '.bak1'); return file + '.bak1';
}
module.exports = { mediaRefs, missing, relink, collect, autosave, snapshots, backupBeforeSave };

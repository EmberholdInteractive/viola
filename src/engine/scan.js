// Ordner einlesen: Fotos/Videos finden, Aufnahmedatum bestimmen (EXIF > Dateiname > Ordnername > Änderungsdatum).
const fs = require('fs');
const path = require('path');
const IMG = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff']);
const VID = new Set(['.mp4', '.mov', '.avi', '.mkv', '.mts', '.m2ts', '.3gp', '.wmv', '.webm']);
const AUD = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg']);
const MONTHS = ['januar', 'februar', 'märz', 'maerz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];

function kindOf(f) { const e = path.extname(f).toLowerCase(); return IMG.has(e) ? 'photo' : VID.has(e) ? 'video' : AUD.has(e) ? 'audio' : null; }

function dateFromName(name) {
  let m = name.match(/(?:^|[^0-9])((?:19|20)\d\d)[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?:[^0-9]|$)/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}
function yearFromPath(dir) {
  const parts = dir.split(/[\\/]/).reverse();
  for (const seg of parts) { const m = seg.match(/(?:^|[^0-9])((?:19|20)\d\d)(?:[^0-9]|$)/); if (m) return +m[1]; }
  return null;
}
function monthFromFolder(p) {
  const low = p.toLowerCase();
  for (let i = 0; i < MONTHS.length; i++) {
    if (new RegExp('(^|[^a-zäöü])' + MONTHS[i] + '([^a-zäöü]|$|[0-9])').test(low)) return i === 3 ? 2 : i > 3 ? i - 1 : i;
  }
  return null;
}

async function scanFolders(folders, { onProgress, exif = true, signal } = {}) {
  let exifr = null; if (exif) { try { exifr = require('exifr'); } catch (_) {} }
  const files = [];
  const walk = d => { let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of es) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { const k = kindOf(e.name); if (k) files.push({ p, k }); } } };
  folders.forEach(walk);
  const items = []; let n = 0;
  for (const f of files) {
    if (signal && signal.aborted) throw new Error('abgebrochen');
    let st; try { st = fs.statSync(f.p); } catch (_) { continue; }
    let date = null, src = 'none';
    if (f.k === 'photo' && exifr && /\.(jpe?g|tiff?)$/i.test(f.p)) {
      try { const t = await exifr.parse(f.p, { pick: ['DateTimeOriginal', 'CreateDate'] }); const d = t && (t.DateTimeOriginal || t.CreateDate); if (d instanceof Date && !isNaN(d)) { date = d; src = 'exif'; } } catch (_) {}
    }
    if (!date && f.k !== 'audio') { const d = dateFromName(path.basename(f.p)); if (d) { date = d; src = 'name'; } }
    if (!date && f.k !== 'audio') { const d = st.mtime; if (d.getFullYear() >= 1995) { date = d; src = 'mtime'; } }
    items.push({ path: f.p, kind: f.k, size: st.size, date: date ? date.toISOString() : null, dateSource: src, folderMonth: monthFromFolder(path.dirname(f.p)), folderYear: yearFromPath(path.dirname(f.p)) });
    if (onProgress && ++n % 200 === 0) onProgress({ done: n, total: files.length });
  }
  onProgress && onProgress({ done: files.length, total: files.length });
  return items;
}

module.exports = { scanFolders, kindOf, IMG, VID, AUD };

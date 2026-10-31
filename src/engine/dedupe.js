// Duplikate: exakte Kopien (Größe + Hash des Anfangs) und fast-gleiche Bilder (dHash, Hamming-Abstand).
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');

async function dHash(file) {
  const buf = await sharp(file, { failOn: 'none', sequentialRead: true }).rotate().greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let bits = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits = (bits << 1n) | (buf[y * 9 + x] > buf[y * 9 + x + 1] ? 1n : 0n);
  return bits;
}
const popcount = x => { let c = 0; while (x) { c += Number(x & 1n); x >>= 1n; } return c; };
const ham = (a, b) => { let x = a ^ b, c = 0; while (x) { c += Number(x & 1n); x >>= 1n; } return c; };
function quickHash(file, size) {
  const fd = fs.openSync(file, 'r'); const b = Buffer.alloc(Math.min(65536, size)); fs.readSync(fd, b, 0, b.length, 0); fs.closeSync(fd);
  return crypto.createHash('sha1').update(b).update(String(size)).digest('hex');
}

// items: [{path,size,date}], sortiert nach Datum. Liefert {groups:[[keep, dup, dup...]], dropped:Set(paths)}
async function findDuplicates(items, { threshold = 5, window = 40, concurrency = 4, onProgress, signal } = {}) {
  const sorted = items.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.path.localeCompare(b.path));
  const exact = new Map(); const dropped = new Set(); const groups = []; const rest = [];
  for (const it of sorted) {
    let h; try { h = quickHash(it.path, it.size); } catch (_) { continue; }
    if (exact.has(h)) { const g = exact.get(h); g.push(it); dropped.add(it.path); } else { exact.set(h, [it]); rest.push(it); }
  }
  exact.forEach(g => { if (g.length > 1) groups.push(g); });
  const hashes = new Array(rest.length); let next = 0, done = 0;
  async function worker() { while (next < rest.length) { const i = next++; if (signal && signal.aborted) throw new Error('abgebrochen'); try { const h = await dHash(rest[i].path); const pc = popcount(h); hashes[i] = (pc < 8 || pc > 56) ? null : h; } catch (_) { hashes[i] = null; } if (onProgress && ++done % 100 === 0) onProgress({ done, total: rest.length }); } }
  await Promise.all(Array.from({ length: concurrency }, worker));
  const near = [];
  for (let i = 0; i < rest.length; i++) {
    if (dropped.has(rest[i].path) || hashes[i] == null) continue;
    for (let j = Math.max(0, i - window); j < i; j++) {
      if (dropped.has(rest[j].path) || hashes[j] == null) continue;
      if (ham(hashes[i], hashes[j]) <= threshold) { const keepFirst = rest[j].size >= rest[i].size; const drop = keepFirst ? rest[i] : rest[j]; const keep = keepFirst ? rest[j] : rest[i]; dropped.add(drop.path); near.push([keep, drop]); break; }
    }
  }
  near.forEach(g => groups.push(g));
  onProgress && onProgress({ done: rest.length, total: rest.length });
  return { groups, dropped, kept: sorted.filter(i => !dropped.has(i.path)) };
}

module.exports = { findDuplicates, dHash, ham };

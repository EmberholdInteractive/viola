// Proxy-Dateien: kleine, schnell ladbare Kopien für die Vorschau bei 4K-Material. Gerendert wird immer aus dem Original.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const sharp = require('sharp');
const ff = require('./ffmpeg');

const key = file => { const st = fs.statSync(file); return crypto.createHash('sha1').update(file + '|' + st.size + '|' + st.mtimeMs).digest('hex').slice(0, 16); };
function proxyPath(dir, file, kind) { return path.join(dir, key(file) + (kind === 'video' ? '.mp4' : '.jpg')); }

async function makeProxy(file, kind, dir, { height = 540, signal } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const out = proxyPath(dir, file, kind);
  if (fs.existsSync(out) && fs.statSync(out).size > 0) return out;
  const part = out + '.part';
  if (kind === 'video') {
    // kurze Schlüsselbild-Abstände -> flüssiges Springen in der Zeitleiste
    await ff.run(['-i', file, '-vf', `scale=-2:${height}`, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-g', '12', '-pix_fmt', 'yuv420p', '-an', '-f', 'mp4', part], { signal });
  } else {
    await sharp(file, { failOn: 'none' }).rotate().resize({ height, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(part);
  }
  fs.renameSync(part, out); return out;
}
// Viele Dateien nacheinander; Fortschritt pro Datei
async function makeProxies(items, dir, { onProgress, signal, minPixels = 1920 * 1080 } = {}) {
  const map = {}; let done = 0;
  for (const it of items) {
    if (signal && signal.aborted) break;
    try { map[it.path] = await makeProxy(it.path, it.kind, dir, { signal }); } catch (_) { /* Original behalten */ }
    onProgress && onProgress({ done: ++done, total: items.length });
  }
  return map;
}
function cacheSize(dir) { try { return fs.readdirSync(dir).reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0); } catch (_) { return 0; } }
function clearCache(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
module.exports = { makeProxy, makeProxies, proxyPath, cacheSize, clearCache };

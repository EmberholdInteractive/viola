// Intelligenter Zuschnitt (z. B. Hochformat 9:16): findet mit sharp den auffälligsten Bildbereich.
const sharp = require('sharp');
const ff = require('./ffmpeg');
const os = require('os'), fs = require('fs'), path = require('path');

// Liefert {fx,fy} (0..1) = wohin der Ausschnitt gelegt werden soll
async function focusPoint(file, targetW, targetH) {
  const meta = await sharp(file, { failOn: 'none' }).rotate().metadata();
  const iw = (meta.orientation || 1) >= 5 ? meta.height : meta.width, ih = (meta.orientation || 1) >= 5 ? meta.width : meta.height;
  const tw = 320, th = Math.max(8, Math.round(320 * targetH / targetW));
  const { info } = await sharp(file, { failOn: 'none' }).rotate().resize(tw, th, { fit: 'cover', position: sharp.strategy.attention }).toBuffer({ resolveWithObject: true });
  const ratio = Math.max(tw / iw, th / ih); const rw = Math.round(iw * ratio), rh = Math.round(ih * ratio);
  // attentionX/Y = auffälligster Punkt im skalierten Bild; ältere sharp-Versionen liefern nur den Versatz
  const fraction = (att, size, win, off) => {
    if (size <= win) return 0.5;
    const left = att != null && att > 0 ? att - win / 2 : Math.abs(off || 0);
    return Math.max(0, Math.min(1, left / (size - win)));
  };
  const fx = fraction(info.attentionX, rw, tw, info.cropOffsetLeft);
  const fy = fraction(info.attentionY, rh, th, info.cropOffsetTop);
  return { fx: Math.max(0, Math.min(1, fx)), fy: Math.max(0, Math.min(1, fy)) };
}
// Fokus für ein Video: ein Bild aus der Mitte
async function focusPointVideo(file, targetW, targetH, t = 1) {
  const tmp = path.join(os.tmpdir(), 'viola-focus-' + process.pid + '-' + Date.now() + '.jpg');
  try { await ff.run(['-ss', String(t), '-i', file, '-frames:v', '1', '-q:v', '3', tmp]); return await focusPoint(tmp, targetW, targetH); }
  catch (_) { return { fx: 0.5, fy: 0.5 }; } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
}
// ffmpeg-Filter: schneidet auf Zielformat und skaliert
function cropFilter(W, H, fx, fy) {
  return `crop=w='min(iw,ih*${W}/${H})':h='min(ih,iw*${H}/${W})':x='(iw-ow)*${fx.toFixed(3)}':y='(ih-oh)*${fy.toFixed(3)}',scale=${W}:${H}:flags=lanczos,setsar=1`;
}
module.exports = { focusPoint, focusPointVideo, cropFilter };

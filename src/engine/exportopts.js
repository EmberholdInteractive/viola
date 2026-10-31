// Export-Parameter (Katalog: EXPORT): Container, Codec, Ratensteuerung, GOP, B-Frames, Hardware, Audio, Wasserzeichen, Untertitel, Bildfolge.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ff = require('./ffmpeg');

let _enc = null, _encFor = null;
function encoders() {
  if (_enc && _encFor === ff.binaries().ffmpeg) return _enc;
  const r = spawnSync(ff.binaries().ffmpeg, ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  _enc = new Set(((r.stdout || '').match(/^\s*[VAS][A-Z.]{5}\s+(\S+)/gm) || []).map(l => l.trim().split(/\s+/)[1])); _encFor = ff.binaries().ffmpeg; return _enc;
}
const has = e => encoders().has(e);
function hardwareAvailable() { return { nvenc: has('h264_nvenc'), qsv: has('h264_qsv'), amf: has('h264_amf') }; }

const CODECS = {
  h264:   { label: 'H.264 / AVC',  cpu: 'libx264', nvenc: 'h264_nvenc', qsv: 'h264_qsv', amf: 'h264_amf', containers: ['mp4', 'mov', 'mkv'] },
  h265:   { label: 'H.265 / HEVC', cpu: 'libx265', nvenc: 'hevc_nvenc', qsv: 'hevc_qsv', amf: 'hevc_amf', containers: ['mp4', 'mov', 'mkv'] },
  av1:    { label: 'AV1',          cpu: ['libsvtav1', 'libaom-av1'], nvenc: 'av1_nvenc', qsv: 'av1_qsv', amf: 'av1_amf', containers: ['mp4', 'mkv', 'webm'] },
  vp9:    { label: 'VP9',          cpu: 'libvpx-vp9', containers: ['webm', 'mkv'] },
  prores: { label: 'Apple ProRes', cpu: 'prores_ks', containers: ['mov'] },
  dnxhr:  { label: 'Avid DNxHR',   cpu: 'dnxhd', containers: ['mov', 'mxf'] },
};
const AUDIO = { aac: { enc: 'aac', containers: ['mp4', 'mov', 'mkv'] }, mp3: { enc: 'libmp3lame', containers: ['mp4', 'mkv'] }, opus: { enc: 'libopus', containers: ['webm', 'mkv', 'mp4'] }, flac: { enc: 'flac', containers: ['mkv', 'mov'] }, pcm: { enc: 'pcm_s16le', containers: ['mov', 'mkv', 'mxf'] } };

function pickEncoder(codec, hw) {
  const c = CODECS[codec] || CODECS.h264; const cpu = [].concat(c.cpu).find(has) || (codec === 'h264' ? 'libx264' : [].concat(c.cpu)[0]);
  const order = hw === 'auto' ? ['nvenc', 'qsv', 'amf'] : (hw && hw !== 'cpu' ? [hw] : []);
  for (const k of order) if (c[k] && has(c[k])) return { enc: c[k], hw: k };
  return { enc: cpu, hw: 'cpu' };
}
// Container passend zum Codec wählen (wenn ungültig kombiniert)
function containerFor(x) {
  const c = CODECS[x.codec] || CODECS.h264; let k = x.container || c.containers[0];
  if (!c.containers.includes(k)) k = c.containers[0];
  const a = AUDIO[x.audio && x.audio.codec]; if (a && !a.containers.includes(k)) x.audio = Object.assign({}, x.audio, { codec: k === 'webm' ? 'opus' : 'aac' });
  return k;
}
const extFor = x => '.' + containerFor(Object.assign({}, x));
function normalize(x, S) {
  const o = Object.assign({ codec: S.codec || 'h264', rc: 'crf', crf: S.crf, hw: 'cpu', audio: {}, gop: 0, bframes: -1 }, x || {});
  o.codec = CODECS[o.codec] ? o.codec : 'h264'; o.container = containerFor(o); return o;
}
// ffmpeg-Argumente für den Videoteil
function videoArgs(o) {
  const { enc, hw } = pickEncoder(o.codec, o.hw); const a = [];
  const q = Math.max(0, Math.min(51, Math.round(o.crf == null ? 23 : o.crf)));
  a.push('-c:v', enc);
  if (o.codec === 'prores') a.push('-profile:v', String({ proxy: 0, lt: 1, standard: 2, hq: 3 }[o.profile] != null ? { proxy: 0, lt: 1, standard: 2, hq: 3 }[o.profile] : 2), '-pix_fmt', 'yuv422p10le', '-vendor', 'apl0');
  else if (o.codec === 'dnxhr') a.push('-profile:v', { lb: 'dnxhr_lb', sq: 'dnxhr_sq', hq: 'dnxhr_hq' }[o.profile] || 'dnxhr_hq', '-pix_fmt', 'yuv422p');
  else {
    a.push('-pix_fmt', o.tenBit ? 'yuv420p10le' : 'yuv420p');
    const bitrate = o.bitrate ? Math.round(o.bitrate) + 'k' : null;
    if (o.rc === 'cbr' && bitrate) a.push('-b:v', bitrate, '-minrate', bitrate, '-maxrate', bitrate, '-bufsize', Math.round(o.bitrate * 2) + 'k');
    else if (o.rc === 'vbr' && bitrate) a.push('-b:v', bitrate, '-maxrate', Math.round(o.bitrate * 1.5) + 'k', '-bufsize', Math.round(o.bitrate * 3) + 'k');
    else if (hw === 'nvenc') a.push('-rc', 'vbr', '-cq', String(q), '-b:v', '0');
    else if (hw === 'qsv') a.push('-global_quality', String(q));
    else if (hw === 'amf') a.push('-rc', 'cqp', '-qp_i', String(q), '-qp_p', String(q + 2));
    else if (enc === 'libvpx-vp9') a.push('-crf', String(q), '-b:v', '0', '-row-mt', '1');
    else if (enc === 'libaom-av1') a.push('-crf', String(q), '-b:v', '0', '-cpu-used', '6', '-row-mt', '1');
    else a.push('-crf', String(q));
    if (hw === 'cpu' && (enc === 'libx264' || enc === 'libx265')) a.push('-preset', o.encoderPreset || 'medium');
    if (o.profile && ['libx264', 'libx265'].includes(enc) && /^[a-z0-9]+$/i.test(o.profile)) a.push('-profile:v', o.profile);
    if (o.gop > 0) a.push('-g', String(Math.round(o.gop)));
    if (o.bframes >= 0 && ['libx264', 'libx265', 'h264_nvenc', 'hevc_nvenc'].includes(enc)) a.push('-bf', String(Math.round(o.bframes)));
    if (o.codec === 'h265' && ['mp4', 'mov'].includes(o.container)) a.push('-tag:v', 'hvc1');
  }
  return a;
}
function audioArgs(o) {
  const x = o.audio || {}; const k = AUDIO[x.codec] ? x.codec : (o.container === 'webm' ? 'opus' : (o.codec === 'prores' || o.codec === 'dnxhr') ? 'pcm' : 'aac'); const a = ['-c:a', AUDIO[k].enc];
  if (x.rate) a.push('-ar', String(x.rate)); if (x.channels) a.push('-ac', String(x.channels));
  if (['aac', 'mp3', 'opus'].includes(k)) a.push('-b:a', (x.bitrate || 192) + 'k');
  return a;
}
// Wasserzeichen-Filter (Bild als zweite Eingabe)
function watermarkGraph(w, W, H) {
  const m = Math.round(Math.min(W, H) * 0.03), sc = Math.max(0.02, Math.min(0.6, w.scale || 0.15)), op = Math.max(0.05, Math.min(1, w.opacity == null ? 0.7 : w.opacity));
  const pos = { tl: `${m}:${m}`, tr: `W-w-${m}:${m}`, bl: `${m}:H-h-${m}`, br: `W-w-${m}:H-h-${m}`, center: '(W-w)/2:(H-h)/2' }[w.pos || 'br'];
  return `[1:v]scale=${Math.round(W * sc)}:-1,format=rgba,colorchannelmixer=aa=${op}[wm];[0:v][wm]overlay=${pos}[vout]`;
}
// Letzter Export-Schritt: Codec, Container, Wasserzeichen, Untertitel (eingebettet oder separat)
async function exportFinal(input, out, o, S, { srt, signal } = {}) {
  const args = ['-i', input]; let idx = 1; const maps = ['-map', '0:v', '-map', '0:a?'];
  let vf = null;
  if (o.watermark && o.watermark.file && fs.existsSync(o.watermark.file)) { args.push('-i', o.watermark.file); idx++; vf = watermarkGraph(o.watermark, S.width, S.height); maps.splice(0, 2, '-map', '[vout]'); }
  const subs = o.embedSubs && srt && ['mp4', 'mov', 'mkv'].includes(o.container);
  if (subs) { args.push('-i', srt); maps.push('-map', `${idx}:0`); }
  if (vf) args.push('-filter_complex', vf);
  args.push(...maps, ...videoArgs(o), ...audioArgs(o));
  if (subs) args.push('-c:s', o.container === 'mkv' ? 'srt' : 'mov_text');
  if (o.container === 'mp4' || o.container === 'mov') args.push('-movflags', '+faststart');
  if (o.container === 'mkv') args.push('-f', 'matroska'); else if (o.container === 'webm') args.push('-f', 'webm'); else if (o.container === 'mxf') args.push('-f', 'mxf'); else args.push('-f', o.container === 'mov' ? 'mov' : 'mp4');
  args.push(out);
  await ff.run(args, { signal });
  return out;
}
// Nur Ton (Stems): WAV/FLAC/MP3/AAC
async function exportAudioOnly(input, out, { codec = 'wav', lufs, signal } = {}) {
  const enc = { wav: ['-c:a', 'pcm_s16le'], flac: ['-c:a', 'flac'], mp3: ['-c:a', 'libmp3lame', '-b:a', '256k'], aac: ['-c:a', 'aac', '-b:a', '192k'] }[codec] || ['-c:a', 'pcm_s16le'];
  await ff.run(['-i', input, '-vn', ...(lufs ? ['-af', `loudnorm=I=${lufs}:TP=-1.5:LRA=11`] : []), ...enc, out], { signal }); return out;
}
// Bildfolge: PNG/JPG, optional nur jedes n-te Bild
async function exportImageSequence(input, dir, { format = 'png', every = 1, signal } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  await ff.run(['-i', input, ...(every > 1 ? ['-vf', `select='not(mod(n,${Math.round(every)}))'`, '-vsync', 'vfr'] : []), ...(format === 'jpg' ? ['-q:v', '2'] : []), path.join(dir, 'bild_%05d.' + format)], { signal }); return dir;
}
module.exports = { CODECS, AUDIO, encoders, hardwareAvailable, pickEncoder, containerFor, extFor, normalize, videoArgs, audioArgs, exportFinal, exportAudioOnly, exportImageSequence };

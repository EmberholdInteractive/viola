'use strict';
// Aufnahme über FFmpeg: Bildschirm (gdigrab), optional mit Mikrofon (DirectShow), oder nur Sprecher-Aufnahme. Beenden durch "q" auf stdin.
// Hinweis: ASIO wird von FFmpeg nicht unterstützt – Viola nimmt über DirectShow/WASAPI-Geräte auf, die jede ASIO-Karte meist zusätzlich anbietet.
const { spawn, spawnSync } = require('child_process'), path = require('path'), fs = require('fs');
const ff = require('./ffmpeg');

function listAudioDevices(platform = process.platform) {
  if (platform !== 'win32') return [];
  const r = spawnSync(ff.binaries().ffmpeg, ['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], { encoding: 'utf8' });
  const txt = String(r.stderr || ''); const out = []; txt.split('\n').forEach(l => { const m = l.match(/"([^"]+)"\s+\(audio\)/); if (m) out.push(m[1]); }); return [...new Set(out)];
}
function args(o, out, platform = process.platform) {
  const fps = Math.max(5, Math.min(60, +o.fps || 30)); const a = ['-y', '-hide_banner', '-loglevel', 'error'];
  const audioOnly = o.kind === 'audio';
  if (o.source === 'test') {
    if (!audioOnly) a.push('-re', '-f', 'lavfi', '-i', `testsrc2=s=${o.size || '320x180'}:r=${fps}`);
    if (o.audio || audioOnly) a.push('-re', '-f', 'lavfi', '-i', 'sine=f=440:r=48000');
  } else {
    if (!audioOnly) {
      if (platform === 'win32') { a.push('-f', 'gdigrab', '-framerate', String(fps), '-draw_mouse', o.mouse === false ? '0' : '1'); if (o.window) a.push('-i', `title=${o.window}`); else a.push('-i', 'desktop'); }
      else a.push('-f', 'x11grab', '-framerate', String(fps), '-i', process.env.DISPLAY || ':0');
    }
    if (o.audio || audioOnly) { if (platform === 'win32') a.push('-f', 'dshow', '-i', `audio=${o.audio}`); else a.push('-f', 'pulse', '-i', o.audio || 'default'); }
  }
  if (audioOnly) a.push('-c:a', 'pcm_s16le', '-ar', '48000', out);
  else { a.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-pix_fmt', 'yuv420p'); if (o.audio) a.push('-c:a', 'aac', '-b:a', '160k'); a.push('-movflags', '+frag_keyframe+empty_moov', out); }
  return a;
}
let cur = null;
function start(o, dir) {
  if (cur) throw new Error('Aufnahme läuft bereits');
  fs.mkdirSync(dir, { recursive: true }); const ext = (o && o.kind === 'audio') ? '.wav' : '.mp4';
  const out = path.join(dir, ((o && o.kind === 'audio') ? 'Sprecher_' : 'Aufnahme_') + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + ext);
  const p = spawn(ff.binaries().ffmpeg, args(o || {}, out), { stdio: ['pipe', 'ignore', 'pipe'] }); let err = ''; p.stderr.on('data', d => { err += d; });
  cur = { p, out, err: () => err, t0: Date.now() }; p.on('close', () => { if (cur && cur.p === p) cur.done = true; }); return out;
}
function stop() {
  return new Promise((res, rej) => { if (!cur) return rej(new Error('Keine Aufnahme aktiv')); const c = cur; const fin = () => { cur = null; fs.existsSync(c.out) && fs.statSync(c.out).size > 0 ? res({ file: c.out, seconds: (Date.now() - c.t0) / 1000 }) : rej(new Error('Aufnahme leer: ' + c.err().slice(-200))); };
    if (c.done) return fin(); c.p.on('close', fin); try { c.p.stdin.write('q'); } catch (_) {} setTimeout(() => c.p.kill('SIGTERM'), 8000); });
}
module.exports = { args, start, stop, active: () => !!cur, listAudioDevices };

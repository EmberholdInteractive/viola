// Untertitel: Sprache erkennen (Whisper), SRT lesen/schreiben, einbrennen.
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');
const ff = require('./ffmpeg');

const pad = (n, l = 2) => String(n).padStart(l, '0');
function tc(sec, sep = ',') { const ms = Math.round(sec * 1000); return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${sep}${pad(ms % 1000, 3)}`; }
const parseTc = s => { const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(s); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4].padEnd(3, '0')) / 1000 : 0; };

// Zeilenumbruch: maximal maxChars je Zeile, höchstens 2 Zeilen
function wrap(text, maxChars = 38) {
  const words = String(text).trim().split(/\s+/); const lines = []; let cur = '';
  for (const w of words) { if (cur && (cur + ' ' + w).length > maxChars) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
  if (cur) lines.push(cur); return lines.join('\n');
}
function toSrt(segs, { maxChars = 38 } = {}) { return segs.map((s, i) => `${i + 1}\n${tc(s.start)} --> ${tc(s.end)}\n${wrap(s.text, maxChars)}\n`).join('\n'); }
function parseSrt(txt) {
  return String(txt).replace(/\r/g, '').split(/\n\s*\n/).map(b => b.trim().split('\n')).filter(l => l.length >= 2).map(l => {
    const ti = l.findIndex(x => x.includes('-->')); if (ti < 0) return null; const [a, b] = l[ti].split('-->');
    return { start: parseTc(a), end: parseTc(b), text: l.slice(ti + 1).join(' ').trim() };
  }).filter(Boolean);
}
// Lange Segmente teilen, damit Untertitel gut lesbar bleiben (max. ~7 s)
function splitLong(segs, maxDur = 7, maxChars = 76) {
  const out = [];
  for (const s of segs) {
    const dur = s.end - s.start;
    if (dur <= maxDur && s.text.length <= maxChars) { out.push(s); continue; }
    const words = s.text.split(/\s+/); const parts = Math.ceil(Math.max(dur / maxDur, s.text.length / maxChars)); const per = Math.ceil(words.length / parts);
    for (let i = 0; i < parts; i++) { const w = words.slice(i * per, (i + 1) * per); if (!w.length) continue; out.push({ start: s.start + dur * (i * per) / words.length, end: s.start + dur * Math.min(words.length, (i + 1) * per) / words.length, text: w.join(' ') }); }
  }
  return out;
}
// --- Erkennung ---
function toWav(input, wav, signal) { return ff.run(['-i', input, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav], { signal }); }
function exec(cmd, args, signal, onLine) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { windowsHide: true }); let out = '', err = '';
    p.stdout.on('data', d => { out += d; onLine && onLine(String(d)); }); p.stderr.on('data', d => { err += d; onLine && onLine(String(d)); });
    if (signal) signal.addEventListener('abort', () => { p.kill('SIGKILL'); rej(new Error('abgebrochen')); }, { once: true });
    p.on('error', e => rej(new Error('Whisper konnte nicht gestartet werden: ' + e.message)));
    p.on('close', c => c === 0 ? res(out) : rej(new Error('Whisper-Fehler (' + c + '): ' + err.slice(-600))));
  });
}
const PY = `import sys, json
from faster_whisper import WhisperModel
m = WhisperModel(sys.argv[2], device=sys.argv[4], compute_type='int8' if sys.argv[4]=='cpu' else 'float16')
segs, _ = m.transcribe(sys.argv[1], language=(None if sys.argv[3]=='auto' else sys.argv[3]), vad_filter=True)
print('@@JSON@@'+json.dumps([{'start':s.start,'end':s.end,'text':s.text.strip()} for s in segs]))
`;
// cfg: { engine:'cpp'|'python', exe, model, language:'de'|'auto', device:'cpu'|'cuda' }
async function transcribe(input, cfg, { signal, onProgress } = {}) {
  if (!cfg || !cfg.exe) throw new Error('Whisper ist nicht eingerichtet (Einstellungen → Untertitel).');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'viola-sub-')); const wav = path.join(tmp, 'a.wav');
  try {
    onProgress && onProgress({ phase: 'audio' }); await toWav(input, wav, signal);
    onProgress && onProgress({ phase: 'erkennen' });
    let segs;
    if (cfg.engine === 'python') {
      const script = path.join(tmp, 'w.py'); fs.writeFileSync(script, PY);
      const out = await exec(cfg.exe, [script, wav, cfg.model || 'small', cfg.language || 'de', cfg.device || 'cpu'], signal);
      const i = out.lastIndexOf('@@JSON@@'); if (i < 0) throw new Error('Whisper hat keine Ausgabe geliefert.'); segs = JSON.parse(out.slice(i + 8));
    } else {
      // whisper.cpp: whisper-cli -m modell.bin -f a.wav -l de -osrt -of <ohne Endung>
      const base = path.join(tmp, 'out');
      await exec(cfg.exe, ['-m', cfg.model, '-f', wav, '-l', cfg.language || 'de', '-osrt', '-of', base], signal);
      segs = parseSrt(fs.readFileSync(base + '.srt', 'utf8'));
    }
    return splitLong(segs);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
// --- Einbrennen ---
function hasSubtitleFilter() { return ff.supportedFilters(['subtitles']).includes('subtitles'); }
function burnArgs(srtFile, { size = 22, margin = 40, color = 'FFFFFF', outline = '1A0A2E', font = 'Arial', box = true } = {}) {
  const p = srtFile.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
  const style = `FontName=${font},FontSize=${size},PrimaryColour=&H00${color.slice(4, 6)}${color.slice(2, 4)}${color.slice(0, 2)},OutlineColour=&H00${outline.slice(4, 6)}${outline.slice(2, 4)}${outline.slice(0, 2)},BorderStyle=${box ? 4 : 1},Outline=2,Shadow=0,MarginV=${margin},Alignment=2`;
  return `subtitles='${p}':force_style='${style}'`;
}
async function burnIn(video, srtFile, output, opts = {}) {
  await ff.run(['-i', video, '-vf', burnArgs(srtFile, opts), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(opts.crf || 22), '-c:a', 'copy', '-movflags', '+faststart', '-f', 'mp4', output], opts);
}
async function burnAss(video, assFile, output, opts = {}) {
  const p = assFile.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
  await ff.run(['-i', video, '-vf', `ass='${p}'`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(opts.crf || 22), '-c:a', 'copy', '-movflags', '+faststart', '-f', 'mp4', output], opts);
}
module.exports = { burnAss, toSrt, parseSrt, wrap, splitLong, transcribe, burnIn, burnArgs, hasSubtitleFilter, tc };

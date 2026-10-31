'use strict';
// RaLyrics-Anbindung: .lrc / .words.lrc lesen, als Untertitel oder Karaoke (ASS) verwenden, Lyrics zur Projektmusik zusammenstellen.
const fs = require('fs'), path = require('path');
const ff = require('./ffmpeg');
const LINE = /^\s*\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/;
const WORD = /<(\d+):(\d+(?:\.\d+)?)>/g;
const T = (m, s) => parseInt(m, 10) * 60 + parseFloat(s);

// -> [{ start, end, text, words?: [{start,end,text}] }]
function parse(text, lastLen = 4) {
  const lines = [];
  for (const raw of String(text).replace(/^﻿/, '').split(/\r?\n/)) {
    const m = LINE.exec(raw); if (!m) continue; const start = T(m[1], m[2]); let rest = m[3];
    const marks = [...rest.matchAll(WORD)];
    if (marks.length) {
      const words = []; for (let i = 0; i < marks.length; i++) { const a = marks[i], b = marks[i + 1]; const w = rest.slice(a.index + a[0].length, b ? b.index : rest.length).trim(); if (w) words.push({ start: T(a[1], a[2]), end: b ? T(b[1], b[2]) : null, text: w }); }
      words.forEach((w, i) => { if (w.end == null) w.end = i + 1 < words.length ? words[i + 1].start : w.start + 0.6; });
      lines.push({ start, end: start, text: words.map(w => w.text).join(' '), words });
    } else lines.push({ start, end: start, text: rest.trim() });
  }
  lines.sort((a, b) => a.start - b.start).forEach((l, i, a) => { l.end = i + 1 < a.length ? a[i + 1].start : (l.words ? l.words[l.words.length - 1].end : l.start + lastLen); });
  return lines.filter(l => l.text);
}
const shift = (lines, off, limit) => lines.map(l => ({ start: l.start + off, end: Math.min(l.end + off, limit == null ? Infinity : limit), text: l.text, words: l.words && l.words.map(w => ({ start: w.start + off, end: w.end + off, text: w.text })) })).filter(l => limit == null || l.start < limit);

// Mögliche Lyrics-Dateien zu einem Lied (neben dem Lied, im Unterordner "Lyrics")
function find(song, sub = 'Lyrics') {
  const dir = path.dirname(song), b = path.basename(song, path.extname(song));
  const c = [path.join(dir, b + '.words.lrc'), path.join(dir, sub, b + '.words.lrc'), path.join(dir, b + '.lrc'), path.join(dir, sub, b + '.lrc')];
  return c.filter(f => fs.existsSync(f));
}
// Lyrics für die Musikspuren eines Projekts (gleiche Zeitrechnung wie das Abmischen: Übergang 'cross')
function forMusic(project, total, { words = true, sub = 'Lyrics' } = {}) {
  const tracks = (project.audio || []).filter(t => t.src && fs.existsSync(t.src)); const cross = (project.music && project.music.cross) != null ? project.music.cross : 4;
  const out = []; const missing = []; let t = 0, k = 0, tot = 0, n = 0;
  if (!tracks.length) return { lines: [], missing };
  while (tot < total + cross + 1 && n++ < 400) {
    const tr = tracks[k % tracks.length]; const d = ff.duration(tr.src); if (d <= cross + 1) { k++; if (n > tracks.length * 3) break; continue; }
    const f = find(tr.src, sub).filter(x => words || !/\.words\.lrc$/i.test(x))[0];
    if (f) out.push(...shift(parse(fs.readFileSync(f, 'utf8')), t, Math.min(total, t + d))); else if (!missing.includes(tr.src)) missing.push(tr.src);
    t += d - cross; tot = t + cross; k++; if (t >= total) break;
  }
  return { lines: out, missing };
}

// ASS mit Karaoke-Wortfärbung (\k, Zentisekunden). Gesungenes Wort wird farbig, noch nicht gesungenes bleibt weiß.
const ass = (sec) => { const cs = Math.round(sec * 100); const h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, s = Math.floor(cs / 100) % 60; return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`; };
const hex = c => { c = /^#?[0-9a-f]{6}$/i.test(c || '') ? c.replace('#', '') : 'FFFFFF'; return `&H00${c.slice(4, 6)}${c.slice(2, 4)}${c.slice(0, 2)}`; };
function toAss(lines, { width = 1280, height = 720, size, color = 'FFFFFF', sung = 'D946EF', outline = '1A0A2E', font = 'Arial', marginV } = {}) {
  const fs_ = size || Math.round(height * 0.065), mv = marginV == null ? Math.round(height * 0.08) : marginV;
  const head = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,${font},${fs_},${hex(sung)},${hex(color)},${hex(outline)},&H80000000,1,0,0,0,100,100,0,0,1,2,0,2,40,40,${mv},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  const esc = s => String(s).replace(/[{}\\]/g, '').replace(/\n/g, ' ');
  const ev = lines.map(l => {
    let text; if (l.words && l.words.length) { let cur = l.start; text = l.words.map(w => { const gap = Math.max(0, Math.round((w.start - cur) * 100)); const dur = Math.max(1, Math.round((w.end - w.start) * 100)); cur = w.end; return (gap ? `{\\k${gap}}` : '') + `{\\k${dur}}${esc(w.text)} `; }).join('').trim(); }
    else text = `{\\k${Math.max(1, Math.round((l.end - l.start) * 100))}}${esc(l.text)}`;
    return `Dialogue: 0,${ass(l.start)},${ass(Math.max(l.end, l.start + 0.3))},Default,,0,0,0,,${text}`;
  }).join('\n');
  return head + ev + '\n';
}
module.exports = { parse, shift, find, forMusic, toAss };

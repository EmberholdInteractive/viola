const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const ff = require('../src/engine/ffmpeg'); const lrc = require('../src/engine/lrc'); const subs = require('../src/engine/subtitles'); const { renderProject } = require('../src/engine/render'); const sharp = require('sharp');
const ok = m => console.log('OK  ', m);
(async () => {
  const L = lrc.parse('[ar:x]\n[00:01.00]Hallo Welt\n[00:04.50]<00:04.50>Zweite <00:05.20>Zeile\n[00:08.00]\n[00:09.00]Ende');
  assert.strictEqual(L.length, 3); assert.strictEqual(L[0].end, 4.5); assert.strictEqual(L[1].words.length, 2); assert.strictEqual(L[1].words[0].end, 5.2); ok('Zeilen- und Wort-LRC werden gelesen');
  const a = lrc.toAss(L, { width: 320, height: 180 }); assert(/\\k70/.test(a) && /Dialogue/.test(a)); ok('Karaoke-ASS mit \\k-Zeiten');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lrc-')); fs.mkdirSync(path.join(d, 'Lyrics'));
  const song = path.join(d, 'Lied.mp3'); await ff.run(['-f', 'lavfi', '-i', 'sine=frequency=330:duration=8', '-c:a', 'libmp3lame', song]);
  fs.writeFileSync(path.join(d, 'Lyrics', 'Lied.lrc'), '[00:00.50]Eins\n[00:03.00]Zwei\n'); assert.strictEqual(lrc.find(song).length, 1);
  const p = { audio: [song], music: { cross: 1 } }; p.audio = [{ src: song }];
  const r = lrc.forMusic(p, 12); assert(r.lines.length >= 3, 'Lied wird wiederholt: ' + r.lines.length); assert(r.lines.every(l => l.start < 12)); ok('Lyrics zur Projektmusik inkl. Wiederholung und Versatz (' + r.lines.length + ' Zeilen)');
  const img = path.join(d, 'a.jpg'); await sharp({ create: { width: 320, height: 180, channels: 3, background: '#335' } }).jpeg().toFile(img);
  if (subs.hasSubtitleFilter()) {
    const out = await renderProject({ settings: { preset: 'klein', width: 320, height: 180 }, slides: [{ type: 'photo', src: img, duration: 6 }], audio: p.audio, music: { cross: 1 }, subtitles: { segments: L, mode: 'karaoke', burn: true } }, path.join(d, 'k.mp4'));
    assert(out.duration > 5); ok('Karaoke-Text ins Video gebrannt (' + out.duration.toFixed(1) + ' s)');
  } else console.log('SKIP  kein subtitles-Filter in diesem FFmpeg');
  console.log('\nLRC-TESTS BESTANDEN');
})().catch(e => { console.log('FEHLER:', e.stack || e.message); process.exit(1); });

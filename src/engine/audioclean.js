// Sprache bereinigen: Rauschen entfernen, tiefes Brummen filtern, Lautstärke angleichen.
const ff = require('./ffmpeg');

const LEVELS = {
  leicht: { label: 'Leicht', nr: 8,  nf: -45, hp: 70 },
  mittel: { label: 'Mittel', nr: 14, nf: -40, hp: 90 },
  stark:  { label: 'Stark',  nr: 22, nf: -35, hp: 110 },
};
// Filterkette für ffmpeg. rnnModel = optionale arnndn-Modelldatei (.rnnn) für KI-Entrauschen.
function cleanChain(level = 'mittel', { rnnModel, loudness = -16 } = {}) {
  const L = LEVELS[level] || LEVELS.mittel;
  const f = [`highpass=f=${L.hp}`, `afftdn=nr=${L.nr}:nf=${L.nf}:tn=1`];
  if (rnnModel) f.push(`arnndn=m='${rnnModel.replace(/\\/g, '/').replace(/:/g, '\\:')}'`);
  f.push('speechnorm=e=6:r=0.0001:l=1', `loudnorm=I=${loudness}:TP=-1.5:LRA=9`, 'alimiter=limit=0.95');
  return f.join(',');
}
async function cleanAudio(input, output, opts = {}) {
  const { level = 'mittel', onProgress, signal } = opts;
  const video = ff.probe(input).streams.some(s => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic));
  const args = ['-i', input, '-vn', '-af', cleanChain(level, opts), '-ar', '48000', '-c:a', output.toLowerCase().endsWith('.wav') ? 'pcm_s16le' : 'aac', '-b:a', '192k', output];
  await ff.run(args, { onProgress, signal });
  return { output, hadVideo: video };
}
// Misst grob, wie laut das Rauschen vorher/nachher ist (Mittelwert-Lautstärke), damit die UI eine Rückmeldung geben kann.
module.exports = { LEVELS, cleanChain, cleanAudio };

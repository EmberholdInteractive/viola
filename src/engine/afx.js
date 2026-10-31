// Audio-Effekte (Katalog: EQ/Dynamics, Effects, Repair). Gleiches Datenmodell wie fx.js.
const f = (label, def, min, max, step, unit) => ({ type: 'float', label, def, min, max, step: step || 0.1, unit: unit || '' });
const i = (label, def, min, max, step, unit) => ({ type: 'int', label, def, min, max, step: step || 1, unit: unit || '' });
const en = (label, def, options) => ({ type: 'enum', label, def, options });
const n = v => Number(v).toFixed(3);
const AFX = {
  'AFX.EQ.PARAMETRIC': { name: 'Equalizer (3 Bänder)', group: 'EQ/Dynamics', needs: ['equalizer'], params: { lowF: f('Tiefen Hz', 120, 30, 400, 1), lowG: f('Tiefen dB', 0, -18, 18), midF: f('Mitten Hz', 1500, 300, 6000, 10), midG: f('Mitten dB', 0, -18, 18), midQ: f('Güte', 1, 0.2, 8), highF: f('Höhen Hz', 8000, 3000, 16000, 100), highG: f('Höhen dB', 0, -18, 18) },
    build: p => `equalizer=f=${p.lowF}:t=q:w=0.7:g=${n(p.lowG)},equalizer=f=${p.midF}:t=q:w=${n(p.midQ)}:g=${n(p.midG)},equalizer=f=${p.highF}:t=q:w=0.7:g=${n(p.highG)}` },
  'AFX.EQ.HIGHPASS': { name: 'Hochpass', group: 'EQ/Dynamics', needs: ['highpass'], params: { f: i('Grenze', 80, 20, 2000, 1, 'Hz') }, build: p => `highpass=f=${p.f}` },
  'AFX.EQ.LOWPASS':  { name: 'Tiefpass', group: 'EQ/Dynamics', needs: ['lowpass'], params: { f: i('Grenze', 12000, 500, 20000, 10, 'Hz') }, build: p => `lowpass=f=${p.f}` },
  'AFX.EQ.NOTCH':    { name: 'Kerbfilter', group: 'EQ/Dynamics', needs: ['bandreject'], params: { f: i('Frequenz', 50, 20, 8000, 1, 'Hz'), w: f('Breite', 2, 0.5, 200, 0.5, 'Hz') }, build: p => `bandreject=f=${p.f}:t=h:w=${n(p.w)}` },
  'AFX.DYN.COMPRESSOR': { name: 'Kompressor', group: 'EQ/Dynamics', needs: ['acompressor'], params: { threshold: f('Schwelle', -18, -60, 0, 1, 'dB'), ratio: f('Verhältnis', 3, 1, 20, 0.5), attack: f('Attack', 20, 1, 500, 1, 'ms'), release: f('Release', 250, 10, 2000, 10, 'ms'), makeup: f('Make-up', 3, 0, 24, 0.5, 'dB') },
    build: p => `acompressor=threshold=${n(Math.pow(10, p.threshold / 20))}:ratio=${p.ratio}:attack=${p.attack}:release=${p.release}:makeup=${n(Math.pow(10, p.makeup / 20))}` },
  'AFX.DYN.LIMITER': { name: 'Limiter', group: 'EQ/Dynamics', needs: ['alimiter'], params: { ceiling: f('Obergrenze', -1, -20, 0, 0.5, 'dB') }, build: p => `alimiter=limit=${n(Math.pow(10, p.ceiling / 20))}` },
  'AFX.DYN.GATE': { name: 'Noise-Gate', group: 'EQ/Dynamics', needs: ['agate'], params: { threshold: f('Schwelle', -45, -90, 0, 1, 'dB'), ratio: f('Stärke', 6, 1, 20, 0.5) }, build: p => `agate=threshold=${n(Math.pow(10, p.threshold / 20))}:ratio=${p.ratio}:attack=10:release=250` },
  'AFX.DYN.DEESSER': { name: 'De-Esser', group: 'EQ/Dynamics', needs: ['deesser'], params: { intensity: f('Stärke', 0.4, 0, 1, 0.05) }, build: p => `deesser=i=${n(p.intensity)}` },
  'AFX.FX.REVERB': { name: 'Hall (Echo-Raum)', group: 'Effects', needs: ['aecho'], params: { size: f('Raumgröße', 0.5, 0.1, 1, 0.05), amount: f('Anteil', 0.35, 0.05, 0.9, 0.05) }, build: p => `aecho=0.8:${n(0.7 + p.amount * 0.2)}:${Math.round(40 + p.size * 120)}|${Math.round(90 + p.size * 220)}|${Math.round(150 + p.size * 400)}:${n(p.amount)}|${n(p.amount * 0.7)}|${n(p.amount * 0.45)}` },
  'AFX.FX.DELAY': { name: 'Delay', group: 'Effects', needs: ['aecho'], params: { ms: i('Zeit', 350, 20, 2000, 10, 'ms'), feedback: f('Rückkopplung', 0.4, 0, 0.9, 0.05) }, build: p => `aecho=0.8:0.9:${p.ms}:${n(p.feedback)}` },
  'AFX.FX.CHORUS': { name: 'Chorus', group: 'Effects', needs: ['chorus'], params: {}, build: () => 'chorus=0.7:0.9:55:0.4:0.25:2' },
  'AFX.FX.FLANGER': { name: 'Flanger', group: 'Effects', needs: ['flanger'], params: {}, build: () => 'flanger' },
  'AFX.FX.PHASER': { name: 'Phaser', group: 'Effects', needs: ['aphaser'], params: {}, build: () => 'aphaser' },
  'AFX.FX.SATURATION': { name: 'Sättigung / Verzerrung', group: 'Effects', needs: ['asoftclip'], params: { type: en('Art', 'tanh', ['tanh', 'atan', 'cubic', 'exp']), gain: f('Vorverstärkung', 6, 0, 30, 0.5, 'dB') }, build: p => `volume=${p.gain}dB,asoftclip=type=${p.type}` },
  'AFX.FX.PITCH': { name: 'Tonhöhe verschieben', group: 'Effects', needs: ['rubberband'], params: { semitones: f('Halbtöne', 0, -12, 12, 0.5) }, build: p => `rubberband=pitch=${n(Math.pow(2, p.semitones / 12))}` },
  'AFX.FX.PAN': { name: 'Stereo-Panorama', group: 'Mixer', needs: ['stereotools'], params: { balance: f('Balance (L ↔ R)', 0, -1, 1, 0.05), width: f('Breite', 1, 0, 2, 0.05) }, build: p => `stereotools=balance_out=${n(p.balance)}:sbal=0:slev=${n(p.width)}` },
  'AFX.MIX.GAIN': { name: 'Verstärkung', group: 'Mixer', needs: ['volume'], params: { gain: f('Gain', 0, -40, 24, 0.5, 'dB') }, build: p => `volume=${p.gain}dB` },
  'AFX.REPAIR.DENOISE': { name: 'Rauschen entfernen', group: 'Repair', needs: ['afftdn'], params: { reduction: f('Reduktion', 12, 1, 40, 0.5, 'dB'), floor: f('Rauschpegel', -40, -80, -20, 1, 'dB') }, build: p => `afftdn=nr=${n(p.reduction)}:nf=${n(p.floor)}:tn=1` },
  'AFX.REPAIR.HUM': { name: 'Netzbrummen entfernen', group: 'Repair', needs: ['bandreject'], params: { base: en('Netzfrequenz', '50', ['50', '60']) }, build: p => [1, 2, 3].map(k => `bandreject=f=${Number(p.base) * k}:t=h:w=2`).join(',') },
  'AFX.REPAIR.DECLICK': { name: 'Klicks und Knackser', group: 'Repair', needs: ['adeclick'], params: {}, build: () => 'adeclick' },
  'AFX.REPAIR.DECLIP': { name: 'Übersteuerung (De-Clip)', group: 'Repair', needs: ['adeclip'], params: {}, build: () => 'adeclip' },
  'AFX.REPAIR.NORMALIZE': { name: 'Lautheit angleichen (LUFS)', group: 'Repair', needs: ['loudnorm'], params: { lufs: f('Ziel', -16, -30, -5, 0.5, 'LUFS') }, build: p => `loudnorm=I=${n(p.lufs)}:TP=-1.5:LRA=9` },
  'AFX.REPAIR.SPEECH': { name: 'Sprache gleichmäßig machen', group: 'Repair', needs: ['speechnorm'], params: {}, build: () => 'speechnorm=e=6:r=0.0001:l=1' },
};
function defaults(id) { return Object.fromEntries(Object.entries(AFX[id].params).map(([k, v]) => [k, v.def])); }
function create(id, params) { return { id, version: 1, enabled: true, bypass: false, mix: 1, params: Object.assign(defaults(id), params || {}) }; }
function validate(id, params) {
  const out = {}; for (const [k, s] of Object.entries(AFX[id].params)) {
    let v = params && params[k] != null ? params[k] : s.def;
    if (s.type === 'float' || s.type === 'int') { v = Number(v); if (!isFinite(v)) v = s.def; v = Math.max(s.min, Math.min(s.max, v)); if (s.type === 'int') v = Math.round(v); }
    else if (s.type === 'enum' && !s.options.includes(v)) v = s.def; out[k] = v;
  } return out;
}
function catalog() { return Object.entries(AFX).map(([id, d]) => ({ id, name: d.name, group: d.group, needs: d.needs, params: d.params })); }
// Kette für -af / filter_complex. supported(names)->Liste der vorhandenen Filter (optional).
function chain(effects, supported) {
  const parts = []; const skipped = [];
  for (const e of effects || []) {
    if (!e || !AFX[e.id] || e.enabled === false || e.bypass) continue;
    if (supported && supported(AFX[e.id].needs).length !== AFX[e.id].needs.length) { skipped.push(e.id); continue; }
    parts.push(AFX[e.id].build(validate(e.id, e.params)));
  }
  return { chain: parts.join(','), skipped };
}
module.exports = { AFX, defaults, create, validate, catalog, chain };

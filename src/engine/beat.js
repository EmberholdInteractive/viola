// Beat-Erkennung (Energie-Onsets + Autokorrelation) und "Beat-Sync": Folienwechsel auf den Takt legen.
const { spawn } = require('child_process');
const ff = require('./ffmpeg');

function decode(file, sr = 11025) {
  return new Promise((resolve, reject) => {
    const p = spawn(ff.binaries().ffmpeg, ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(sr), '-f', 's16le', '-']);
    const bufs = []; let err = '';
    p.stdout.on('data', d => bufs.push(d)); p.stderr.on('data', d => err += d);
    p.on('error', reject);
    p.on('close', c => c === 0 ? resolve(Buffer.concat(bufs)) : reject(new Error('Decode-Fehler: ' + err.slice(-300))));
  });
}

async function analyzeBeats(file, { minBpm = 70, maxBpm = 175 } = {}) {
  const sr = 11025, hop = 128, win = 256;
  const pcm = await decode(file, sr); const n = Math.floor(pcm.length / 2);
  const frames = Math.floor((n - win) / hop); if (frames < 400) return { bpm: 0, beats: [], duration: n / sr };
  const E = new Float64Array(frames);
  for (let f = 0; f < frames; f++) { let s = 0; for (let i = 0; i < win; i++) { const v = pcm.readInt16LE((f * hop + i) * 2) / 32768; s += v * v; } E[f] = Math.log1p(1000 * s / win); }
  const env = new Float64Array(frames);
  for (let f = 1; f < frames; f++) { let m = 0, c = 0; for (let k = Math.max(0, f - 30); k < f; k++) { m += E[k]; c++; } env[f] = Math.max(0, E[f] - m / c); }
  const fps = sr / hop;
  // grob: Autokorrelation
  let best = -1, bestBpm = 120;
  for (let bpm = minBpm; bpm <= maxBpm; bpm += 0.5) {
    const lag = 60 / bpm * fps; const l0 = Math.floor(lag), fr = lag - l0; let s = 0;
    for (let f = 0; f + l0 + 1 < frames; f++) s += env[f] * ((1 - fr) * env[f + l0] + fr * env[f + l0 + 1]);
    s *= 1 - Math.abs(Math.log2(bpm / 120)) * 0.15;
    if (s > best) { best = s; bestBpm = bpm; }
  }
  // fein: Kamm-Raster über Tempo und Phase
  const peak = r => Math.max(env[r - 1] || 0, env[r] || 0, env[r + 1] || 0);
  let bs = -1, bPeriod = 60 / bestBpm * fps, bPh = 0;
  for (let bpm = bestBpm - 3; bpm <= bestBpm + 3; bpm += 0.05) {
    const period = 60 / bpm * fps;
    for (let ph = 0; ph < period; ph += 0.5) {
      let s = 0, c = 0; for (let t = ph; t < frames - 1; t += period) { s += peak(Math.round(t)); c++; }
      s /= c; if (s > bs) { bs = s; bPeriod = period; bPh = ph; }
    }
  }
  const beats = []; for (let t = bPh; t < frames; t += bPeriod) beats.push(t / fps);
  return { bpm: Math.round(60 * fps / bPeriod * 10) / 10, beats, duration: n / sr };
}

// Legt die Übergangsmitte jeder Folie auf einen Beat. every=1: jeder Beat, 2: jeder 2., 4: Taktanfang ...
function snapToBeats(slides, beats, { every = 2, transitionDur = 1, minFactor = 0.5, defaultSlide = 5, offset = 0 } = {}) {
  if (!beats || beats.length < 4 || !slides.length) return slides.map(s => Object.assign({}, s));
  const grid = beats.filter((_, i) => i % every === 0).map(b => b + offset);
  const out = slides.map(s => Object.assign({}, s)); const F = transitionDur;
  let sumPrev = 0;
  for (let i = 0; i < out.length - 1; i++) {
    const d0 = out[i].duration || defaultSlide;
    const mid = sumPrev + d0 - (i + 1) * F + F / 2 + F * 0; // Mitte des Übergangs i -> i+1 (Anfang: off = sum - (i+1)F)
    let b = grid.reduce((p, c) => Math.abs(c - mid) < Math.abs(p - mid) ? c : p, grid[0]);
    let nd = b - F / 2 + (i + 1) * F - sumPrev;
    if (nd < d0 * minFactor) { const nb = grid.find(g => g - F / 2 + (i + 1) * F - sumPrev >= d0 * minFactor); if (nb != null) nd = nb - F / 2 + (i + 1) * F - sumPrev; }
    nd = Math.max(nd, 2 * F + 0.1);
    out[i].duration = Math.round(nd * 1000) / 1000; sumPrev += out[i].duration;
  }
  return out;
}

module.exports = { analyzeBeats, snapToBeats };

// Look: eingebaute LUTs (werden als .cube erzeugt), eigene .cube-Dateien und einfache Farbkorrektur.
const fs = require('fs');
const path = require('path');
const clamp = v => Math.max(0, Math.min(1, v));
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const sCurve = (v, k) => clamp(v + k * (v - 0.5) * (1 - Math.abs(2 * v - 1)) * 2);

// Jeder Look: Funktion (r,g,b) in 0..1 -> [r,g,b]
const LOOKS = {
  neutral:  { label: 'Neutral', fn: (r, g, b) => [r, g, b] },
  warm:     { label: 'Warm (Sommer)', fn: (r, g, b) => [clamp(r * 1.08 + 0.02), clamp(g * 1.02), clamp(b * 0.9)] },
  kalt:     { label: 'Kalt (Winter)', fn: (r, g, b) => [clamp(r * 0.92), clamp(g * 1.0), clamp(b * 1.1 + 0.02)] },
  kino:     { label: 'Kino (Teal und Orange)', fn: (r, g, b) => { const l = luma(r, g, b); return [clamp(sCurve(r, 0.35) + (l - 0.5) * 0.12), clamp(sCurve(g, 0.3)), clamp(sCurve(b, 0.35) - (l - 0.5) * 0.12 + 0.03)]; } },
  sw:       { label: 'Schwarz-Weiß', fn: (r, g, b) => { const l = sCurve(luma(r, g, b), 0.25); return [l, l, l]; } },
  vintage:  { label: 'Vintage (verblasst)', fn: (r, g, b) => [clamp(r * 0.85 + 0.1), clamp(g * 0.82 + 0.09), clamp(b * 0.75 + 0.1)] },
  lebendig: { label: 'Lebendig', fn: (r, g, b) => { const l = luma(r, g, b); const s = 1.35; return [clamp(l + (r - l) * s), clamp(l + (g - l) * s), clamp(l + (b - l) * s)]; } },
};

function cubeText(name, fn, size = 17) {
  const out = [`TITLE "${name}"`, `LUT_3D_SIZE ${size}`];
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
    const c = fn(r / (size - 1), g / (size - 1), b / (size - 1));
    out.push(c.map(v => clamp(v).toFixed(6)).join(' '));
  }
  return out.join('\n') + '\n';
}

// Schreibt die eingebauten Looks in einen Ordner und gibt {id,label,file} zurück.
function ensureBuiltinLuts(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return Object.entries(LOOKS).map(([id, l]) => {
    const file = path.join(dir, id + '.cube');
    if (!fs.existsSync(file)) fs.writeFileSync(file, cubeText(l.label, l.fn));
    return { id, label: l.label, file };
  });
}

// Pfad für ffmpeg-Filtergraph (Doppelpunkte und Apostrophe schützen, auch bei C:\)
function filterPath(p) { return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'"); }

// Farbkorrektur: {exposure -1..1, contrast -1..1, saturation -1..1, temperature -1..1} und optional LUT
function colorChain(color, lutFile) {
  const parts = [];
  const c = color || {};
  const has = k => typeof c[k] === 'number' && Math.abs(c[k]) > 1e-6;
  if (has('exposure') || has('contrast') || has('saturation')) {
    parts.push(`eq=brightness=${((c.exposure || 0) * 0.3).toFixed(3)}:contrast=${(1 + (c.contrast || 0) * 0.6).toFixed(3)}:saturation=${(1 + (c.saturation || 0)).toFixed(3)}`);
  }
  if (has('temperature')) { const t = c.temperature * 0.25; parts.push(`colorbalance=rm=${t.toFixed(3)}:bm=${(-t).toFixed(3)}:rs=${(t / 2).toFixed(3)}:bs=${(-t / 2).toFixed(3)}`); }
  if (lutFile) parts.push(`lut3d=file='${filterPath(lutFile)}'`);
  return parts.join(',');
}

module.exports = { LOOKS, cubeText, ensureBuiltinLuts, colorChain, filterPath };

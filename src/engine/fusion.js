'use strict';
// Fusion: Knotengraph pro Folie. comp = { nodes: [{ id, type: 'in'|'out'|'fx'|'merge'|'matte', fx?, mode?, opacity?, shape?, cx, cy, w, h, feather, invert, x, y }], edges: [{ from, to, port }] }
// Ports: fx/matte/out: 'in'; merge: 'bg' (Hintergrund) und 'fg' (Vordergrund). Der Compiler erzeugt einen ffmpeg-Filtergraphen.
const fxm = require('./fx');
const MODES = { normal: 'normal', screen: 'screen', multiply: 'multiply', overlay: 'overlay', add: 'addition', lighten: 'lighten', darken: 'darken', difference: 'difference', softlight: 'softlight', hardlight: 'hardlight' };
const n3 = v => Number(v).toFixed(3);
const num = (v, d) => (Number.isFinite(+v) ? +v : d);

function validate(comp) {
  if (!comp || !Array.isArray(comp.nodes) || !Array.isArray(comp.edges)) return 'kein Graph';
  const ids = new Set(comp.nodes.map(n => n.id)); if (ids.size !== comp.nodes.length) return 'doppelte Knoten';
  if (comp.nodes.filter(n => n.type === 'in').length !== 1 || comp.nodes.filter(n => n.type === 'out').length !== 1) return 'genau ein Eingang und ein Ausgang nötig';
  for (const e of comp.edges) if (!ids.has(e.from) || !ids.has(e.to)) return 'Verbindung zu unbekanntem Knoten';
  // Zyklen
  const seen = new Map(); const dfs = id => { if (seen.get(id) === 1) return true; if (seen.get(id) === 2) return false; seen.set(id, 1); for (const e of comp.edges.filter(x => x.to === id)) if (dfs(e.from)) return true; seen.set(id, 2); return false; };
  if (comp.nodes.some(n => dfs(n.id))) return 'Zyklus im Graphen';
  return null;
}
function matteExpr(n) {
  const cx = num(n.cx, 0.5), cy = num(n.cy, 0.5), w = Math.max(0.02, num(n.w, 0.5)), h = Math.max(0.02, num(n.h, 0.5));
  const sh = n.shape === 'rect' ? `lte(abs(X/W-${n3(cx)}),${n3(w / 2)})*lte(abs(Y/H-${n3(cy)}),${n3(h / 2)})` : `lte(hypot((X/W-${n3(cx)})/${n3(w / 2)},(Y/H-${n3(cy)})/${n3(h / 2)}),1)`;
  return n.invert ? `255*(1-${sh})` : `255*${sh}`;
}
// in -> Label des Eingangsbilds, out -> Label des Ergebnisses
function compile(comp, inL, outL, ctx, tag = 'n') {
  const err = validate(comp); if (err) return [`[${inL}]null[${outL}]`];
  const byId = Object.fromEntries(comp.nodes.map(n => [n.id, n])); const consumers = {};
  comp.edges.forEach(e => { consumers[e.from] = (consumers[e.from] || 0) + 1; });
  const inId = comp.nodes.find(x => x.type === 'in').id;
  comp.nodes.forEach(n => { const ports = n.type === 'merge' ? ['bg', 'fg'] : n.type === 'in' ? [] : ['in']; ports.forEach(p => { if (!comp.edges.some(e => e.to === n.id && (e.port || 'in') === p)) consumers[inId] = (consumers[inId] || 0) + 1; }); });
  const stmts = []; const done = new Map(); let c = 0; const lbl = () => `${tag}_${c++}`;
  const feeds = {}; // Knoten-ID -> Liste freier Ausgangs-Labels (bei mehreren Verbrauchern aufgeteilt)
  function take(id) { // liefert ein Label der Ausgabe von id
    if (!feeds[id]) { const base = produce(id); const k = consumers[id] || 1; if (k <= 1) feeds[id] = [base]; else { const ls = Array.from({ length: k }, lbl); stmts.push(`[${base}]split=${k}${ls.map(l => `[${l}]`).join('')}`); feeds[id] = ls; } }
    return feeds[id].shift();
  }
  const inputOf = (id, port) => { const e = comp.edges.find(x => x.to === id && (x.port || 'in') === port); return e ? take(e.from) : null; };
  function produce(id) {
    if (done.has(id)) return done.get(id); const n = byId[id]; let out;
    if (n.type === 'in') out = inL;
    else if (n.type === 'fx') { const src = inputOf(id, 'in') || take(inId); out = lbl(); const e = Object.assign({ version: 1, enabled: true, bypass: false, mix: 1 }, n.fx); stmts.push(...fxm.buildGraph([e], src, out, ctx, lbl()).stmts); }
    else if (n.type === 'matte') { const src = inputOf(id, 'in') || take(inId); const [a, b, m, k] = [lbl(), lbl(), lbl(), lbl()]; out = lbl(); const f = num(n.feather, 10);
      stmts.push(`[${src}]split[${a}][${b}]`, `[${b}]geq=lum='${matteExpr(n)}':cb=128:cr=128,${f > 0 ? `gblur=sigma=${n3(Math.max(0.1, f / 2))},` : ''}format=gray[${k}]`, `[${a}]format=yuva420p[${m}]`, `[${m}][${k}]alphamerge[${out}]`); }
    else if (n.type === 'merge') { const bg = inputOf(id, 'bg') || take(inId); const fg = inputOf(id, 'fg') || take(inId); out = lbl(); const op = Math.max(0, Math.min(1, num(n.opacity, 1))); const mode = MODES[n.mode] || 'normal';
      if (mode === 'normal') { const f2 = lbl(); stmts.push(`[${fg}]format=rgba${op < 1 ? `,colorchannelmixer=aa=${n3(op)}` : ''}[${f2}]`, `[${bg}][${f2}]overlay=format=auto:shortest=1,format=yuv420p[${out}]`); }
      else { const a = lbl(), b = lbl(); stmts.push(`[${bg}]format=yuv420p[${a}]`, `[${fg}]format=yuv420p[${b}]`, `[${a}][${b}]blend=all_mode=${mode}:all_opacity=${n3(op)}:shortest=1[${out}]`); } }
    else if (n.type === 'out') { out = inputOf(id, 'in') || take(inId); }
    else out = inL;
    done.set(id, out); return out;
  }
  const outNode = comp.nodes.find(n => n.type === 'out'); const res = produce(outNode.id);
  // ungenutzte Aufteilungen schließen, damit ffmpeg keine hängenden Ausgänge meldet
  Object.entries(feeds).forEach(([id, ls]) => ls.forEach(l => stmts.push(`[${l}]nullsink`)));
  stmts.push(`[${res}]format=yuv420p[${outL}]`); return stmts;
}
const defaultComp = () => ({ nodes: [{ id: 'in', type: 'in', x: 20, y: 60 }, { id: 'out', type: 'out', x: 520, y: 60 }], edges: [{ from: 'in', to: 'out', port: 'in' }] });
module.exports = { compile, validate, defaultComp, MODES };

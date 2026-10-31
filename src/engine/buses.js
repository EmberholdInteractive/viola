'use strict';
// Audio-Busse und Sends. project.buses = [{ id, name, volume, effects }], project.sends = { music: [{ bus, level }], voice: [...] }
// Der Send zweigt das Signal ab, schickt es durch die Effekte des Busses (z. B. Hall) und mischt es als Return wieder dazu.
function stmts(inL, outL, sends, buses, afxChain, tag) {
  const list = (sends || []).map(s => ({ s, b: (buses || []).find(x => x.id === s.bus) })).filter(x => x.b && (+x.s.level || 0) > 0.001);
  if (!list.length) return [`[${inL}]anull[${outL}]`];
  const n = list.length; const out = [`[${inL}]asplit=${n + 1}[${tag}d]${list.map((_, i) => `[${tag}s${i}]`).join('')}`]; const ret = [];
  list.forEach(({ s, b }, i) => { const fx = afxChain(b.effects); const lvl = Math.max(0, Math.min(2, +s.level)); const bv = b.volume == null ? 1 : Math.max(0, Math.min(2, +b.volume));
    out.push(`[${tag}s${i}]volume=${lvl.toFixed(3)}${fx ? ',' + fx : ''},volume=${bv.toFixed(3)}[${tag}r${i}]`); ret.push(`[${tag}r${i}]`); });
  out.push(`[${tag}d]${ret.join('')}amix=inputs=${n + 1}:normalize=0:duration=first[${outL}]`);
  return out;
}
module.exports = { stmts };

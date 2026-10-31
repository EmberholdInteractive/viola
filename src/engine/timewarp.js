// Zeitwerkzeuge für Videoclips: Tempo, Rückwärts, Ping-Pong, Standbild, Loop. Gibt Eingabe-Optionen und Filter zurück.
// clip: { speed (Prozent, 10..1000), reverse, pingpong, freeze (Sekunden am Ende einfrieren), loop (Anzahl Wiederholungen), trimStart }
function plan(clip, dur) {
  // Speed Ramp: Tempo wechselt linear von rampFrom % auf rampTo % über die Clip-Dauer
  const rf = clip.rampFrom ? Math.max(10, Math.min(1000, clip.rampFrom)) / 100 : 0, rt = clip.rampTo ? Math.max(10, Math.min(1000, clip.rampTo)) / 100 : 0;
  const ramp = rf && rt && Math.abs(rf - rt) > 0.01 ? { a: rf, b: rt } : null;
  // Time-Remap: Tempo-Kurve [{t:0..1, speed:%}] mit linearen Übergängen; Quelle = Integral des Tempos
  let curve = null;
  if (Array.isArray(clip.curve) && clip.curve.length >= 2) {
    const k = clip.curve.map(p => ({ t: Math.max(0, Math.min(1, +p.t || 0)), v: Math.max(0.1, Math.min(10, (+p.speed || 100) / 100)) })).sort((a, b) => a.t - b.t);
    if (k[0].t > 0) k.unshift({ t: 0, v: k[0].v }); if (k[k.length - 1].t < 1) k.push({ t: 1, v: k[k.length - 1].v });
    const segs = []; let P = 0; for (let i = 0; i < k.length - 1; i++) { const d = (k[i + 1].t - k[i].t) * dur; if (d <= 1e-6) continue; segs.push({ t0: k[i].t * dur, d, v0: k[i].v, v1: k[i + 1].v, P0: P }); P += d * (k[i].v + k[i + 1].v) / 2; }
    if (segs.length) curve = { segs, total: P };
  }
  const speed = curve ? curve.total / dur : ramp ? (ramp.a + ramp.b) / 2 : Math.max(0.1, Math.min(10, (clip.speed || 100) / 100));
  const pingpong = !!clip.pingpong;
  const need = dur * speed / (pingpong ? 2 : 1);     // so viel Quellmaterial wird gebraucht (Ping-Pong spielt vor und zurück)
  const inArgs = [];
  const loop = Math.max(0, Math.min(50, Math.round(clip.loop || 0)));
  if (loop) inArgs.push('-stream_loop', String(loop));
  inArgs.push('-ss', String(Math.max(0, clip.trimStart || 0)), '-t', need.toFixed(3));
  const pre = clip.reverse ? ['reverse'] : [];
  const T = dur.toFixed(4);
  const curveExpr = () => { const f = n => Number(n).toFixed(6); const p = '((PTS-STARTPTS)*TB)'; let e = f(dur);
    for (let i = curve.segs.length - 1; i >= 0; i--) { const s = curve.segs[i]; const end = s.P0 + s.d * (s.v0 + s.v1) / 2; const k = (s.v1 - s.v0) / (2 * s.d);
      const x = Math.abs(k) < 1e-9 ? `(${p}-${f(s.P0)})/${f(s.v0)}` : `(-${f(s.v0)}+sqrt(${f(s.v0 * s.v0)}+4*${f(k)}*max(0,${p}-${f(s.P0)})))/(2*${f(k)})`;
      e = `if(lt(${p},${f(end)}),${f(s.t0)}+${x},${e})`; } return `setpts='(${e})/TB'`; };
  const speedPts = curve ? curveExpr() : ramp
    ? `setpts=${T}*(sqrt(${(ramp.a * ramp.a).toFixed(5)}+2*${(ramp.b - ramp.a).toFixed(5)}*(PTS-STARTPTS)*TB/${T})-${ramp.a.toFixed(5)})/${(ramp.b - ramp.a).toFixed(5)}/TB`
    : `setpts=(PTS-STARTPTS)/${speed.toFixed(4)}`;
  // fehlendes Material am Ende mit dem letzten Bild auffüllen (auch für "Standbild am Ende"), dann auf genau 'dur' kürzen
  const post = [`tpad=stop_mode=clone:stop_duration=${(dur + (clip.freeze || 0)).toFixed(3)}`, `trim=duration=${dur.toFixed(3)}`, 'setpts=PTS-STARTPTS'];
  return { inArgs, pre, pingpong, speedPts, post, speed };
}
// atempo erlaubt 0.5..2 je Stufe; für andere Werte hintereinanderschalten
function atempoChain(speed) { const out = []; let s = speed; while (s > 2) { out.push('atempo=2'); s /= 2; } while (s < 0.5) { out.push('atempo=0.5'); s /= 0.5; } out.push(`atempo=${s.toFixed(4)}`); return out.join(','); }
module.exports = { plan, atempoChain };

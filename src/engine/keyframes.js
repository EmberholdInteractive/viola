// Keyframes für Zoom und Schwenk: Liste [{t:0..1, zoom:1..4, x:0..1, y:0..1}] -> zoompan-Ausdrücke.
// x,y sind der Bildmittelpunkt des Ausschnitts (0 = links/oben, 1 = rechts/unten, 0.5 = Mitte).
function normalize(kfs) {
  const k = (kfs || []).map(v => ({ t: Math.max(0, Math.min(1, +v.t || 0)), zoom: Math.max(1, +v.zoom || 1), x: v.x == null ? 0.5 : +v.x, y: v.y == null ? 0.5 : +v.y })).sort((a, b) => a.t - b.t);
  if (k.length && k[0].t > 0) k.unshift(Object.assign({}, k[0], { t: 0 }));
  if (k.length && k[k.length - 1].t < 1) k.push(Object.assign({}, k[k.length - 1], { t: 1 }));
  return k;
}
// stückweise lineare Funktion über p, verschachtelte if()-Ausdrücke
function piecewise(k, key, p) {
  let expr = String(k[k.length - 1][key]);
  for (let i = k.length - 2; i >= 0; i--) {
    const a = k[i], b = k[i + 1]; const dt = Math.max(1e-6, b.t - a.t);
    expr = `if(lt(${p},${b.t}),${a[key]}+(${b[key] - a[key]})*(${p}-${a.t})/${dt},${expr})`;
  }
  return expr;
}
function keyframeExpr(kfs, fullFrames, offFrames) {
  const k = normalize(kfs); if (k.length < 2) return null;
  const p = `min(1,(on+${offFrames})/${Math.max(1, fullFrames)})`;
  const z = piecewise(k, 'zoom', p), cx = piecewise(k, 'x', p), cy = piecewise(k, 'y', p);
  // Ausschnitt-Ecke so, dass die Mitte bei (cx,cy) liegt und das Bild nie verlassen wird
  return { z, x: `max(0,min(iw-iw/zoom,(${cx})*iw-iw/zoom/2))`, y: `max(0,min(ih-ih/zoom,(${cy})*ih-ih/zoom/2))` };
}
module.exports = { keyframeExpr, normalize };

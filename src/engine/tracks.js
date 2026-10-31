// Mehrspur-Zustand: V3, V2, V1, A1 (Musik), A2 (Sprecher), A3 (reserviert)
// Jede Spur: { lock, hide (Auge aus), mute, solo }. Beim Rendern werden stumme/ausgeblendete Spuren entfernt.
const NAMES = ['V3', 'V2', 'V1', 'A1', 'A2', 'A3'];
const clone = o => JSON.parse(JSON.stringify(o));

function flags(p) { const t = (p && p.tracks) || {}; return Object.fromEntries(NAMES.map(n => [n, Object.assign({ lock: false, hide: false, mute: false, solo: false }, t[n] || {})])); }
function anySolo(f, kind) { return NAMES.some(n => n[0] === kind && f[n].solo); }
function visible(f, n) { return !f[n].hide && (!anySolo(f, 'V') || f[n].solo); }
function audible(f, n) { return !f[n].mute && (!anySolo(f, 'A') || f[n].solo); }

// Overlay-Spur t (1 = V2, 2 = V3, ...) → Spurname
const ovName = t => 'V' + ((t || 1) + 1);

function apply(project) {
  if (!project || !project.tracks) return project;
  const f = flags(project); const q = clone(project);
  q.overlays = (q.overlays || []).filter(o => { const n = ovName(o.track); return !f[n] || visible(f, n); });
  if (!audible(f, 'A1')) q.audio = [];
  if (!audible(f, 'A2')) q.voice = [];
  return q;
}

// Marker
function addMarker(p, t, name, color) { (p.markers = p.markers || []).push({ id: Math.random().toString(36).slice(2, 9), t: Math.max(0, +t || 0), name: name || 'Marker', color: color || '#a78bfa' }); p.markers.sort((a, b) => a.t - b.t); return p.markers; }

// CMX3600-EDL der Hauptspur (V1)
function tc(sec, fps) { const fr = Math.round(sec * fps); const f = fr % fps, s = Math.floor(fr / fps) % 60, m = Math.floor(fr / fps / 60) % 60, h = Math.floor(fr / fps / 3600); return [h, m, s, f].map(x => String(x).padStart(2, '0')).join(':'); }
function toEdl(project, fps = 25) {
  const out = [`TITLE: ${project.name || 'Viola'}`, 'FCM: NON-DROP FRAME', '']; let t = 0; let n = 1;
  (project.slides || []).forEach(s => {
    const d = +s.duration || 5; const src = (s.src || s.text || 'TITLE').toString().split(/[\\/]/).pop();
    const ts = +s.trimStart || 0;
    out.push(`${String(n++).padStart(3, '0')}  AX       V     C        ${tc(ts, fps)} ${tc(ts + d, fps)} ${tc(t, fps)} ${tc(t + d, fps)}`, `* FROM CLIP NAME: ${src}`);
    t += d;
  });
  return out.join('\n') + '\n';
}

module.exports = { NAMES, flags, visible, audible, ovName, apply, addMarker, toEdl, tc };

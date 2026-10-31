// Untertitel-Prüfung (Katalog: Prüfung) + Versionsstände + Austauschformate
// lines: [{ t (s), text }] – Dauer einer Zeile = bis zur nächsten (letzte: 3 s)
function check(lines, o = {}) {
  const L = Object.assign({ maxChars: 42, maxLines: 2, maxCps: 17, minDur: 1, maxDur: 7 }, o); const out = [];
  lines.forEach((l, i) => {
    const next = lines[i + 1]; const dur = next ? next.t - l.t : (l.dur || 3); const rows = String(l.text || '').split('\n'); const chars = rows.join('').replace(/\s/g, '').length;
    const at = `${Math.floor(l.t / 60)}:${String(Math.floor(l.t % 60)).padStart(2, '0')}`;
    if (rows.some(r => r.length > L.maxChars)) out.push({ i, at, kind: 'zeichen', msg: `Zeile länger als ${L.maxChars} Zeichen (${Math.max(...rows.map(r => r.length))})` });
    if (rows.length > L.maxLines) out.push({ i, at, kind: 'zeilen', msg: `${rows.length} Zeilen (max. ${L.maxLines})` });
    if (dur > 0 && chars / dur > L.maxCps) out.push({ i, at, kind: 'tempo', msg: `Lesetempo ${(chars / dur).toFixed(1)} Zeichen/s (max. ${L.maxCps})` });
    if (dur < L.minDur) out.push({ i, at, kind: 'kurz', msg: `nur ${dur.toFixed(1)} s sichtbar (min. ${L.minDur} s)` });
    if (dur > L.maxDur) out.push({ i, at, kind: 'lang', msg: `${dur.toFixed(1)} s sichtbar (max. ${L.maxDur} s)` });
  });
  return out;
}

// Versionsstände: userData/versions/<projekt>/<zeit>_<notiz>.json
const fs = require('fs'), path = require('path');
const safeName = s => String(s || 'Projekt').replace(/[^\w\-äöüÄÖÜß ]/g, '_').slice(0, 60);
function saveVersion(dir, project, note) {
  const d = path.join(dir, safeName(project.name)); fs.mkdirSync(d, { recursive: true });
  const f = path.join(d, new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '_' + safeName(note || 'Stand') + '.json'); fs.writeFileSync(f, JSON.stringify(project)); return f;
}
function listVersions(dir, name) { const d = path.join(dir, safeName(name)); if (!fs.existsSync(d)) return []; return fs.readdirSync(d).filter(f => f.endsWith('.json')).sort().reverse().map(f => ({ file: path.join(d, f), label: f.replace(/\.json$/, '').replace('T', ' ') })); }
function loadVersion(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

// Austauschformate der Hauptspur (V1): FCPXML 1.9 (Premiere/DaVinci/Final Cut) und OpenTimelineIO
const esc = s => String(s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
const fr = (sec, fps) => `${Math.round(sec * fps)}/${fps}s`;
function toFcpxml(project, fps = 25) {
  const sl = project.slides || []; let t = 0; let id = 1; const assets = [], clips = [];
  sl.forEach(s => { const d = +s.duration || 5; if (s.type === 'title') { clips.push(`<title ref="r0" offset="${fr(t, fps)}" duration="${fr(d, fps)}" name="${esc(s.text || 'Titel')}"/>`); } else { const aid = 'a' + (id++); const nm = esc(String(s.src).split(/[\\/]/).pop()); assets.push(`<asset id="${aid}" name="${nm}" start="0s" duration="${fr(d + (+s.trimStart || 0), fps)}" hasVideo="1"><media-rep kind="original-media" src="file:///${esc(String(s.src).replace(/\\/g, '/'))}"/></asset>`); clips.push(`<asset-clip ref="${aid}" offset="${fr(t, fps)}" name="${nm}" start="${fr(+s.trimStart || 0, fps)}" duration="${fr(d, fps)}"/>`); } t += d; });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<fcpxml version="1.9"><resources><format id="r1" frameDuration="1/${fps}s" width="1920" height="1080"/><effect id="r0" name="Basic Title" uid=".../Titles.localized/Bumper:Opener.localized/Basic Title.localized/Basic Title.moti"/>${assets.join('')}</resources><library><event name="Viola"><project name="${esc(project.name || 'Viola')}"><sequence format="r1" duration="${fr(t, fps)}"><spine>${clips.join('')}</spine></sequence></project></event></library></fcpxml>\n`;
}
function toOtio(project, fps = 25) {
  const children = (project.slides || []).map(s => { const d = +s.duration || 5; const ts = +s.trimStart || 0; return { OTIO_SCHEMA: 'Clip.2', name: s.type === 'title' ? (s.text || 'Titel') : String(s.src).split(/[\\/]/).pop(), source_range: { OTIO_SCHEMA: 'TimeRange.1', start_time: { OTIO_SCHEMA: 'RationalTime.1', rate: fps, value: Math.round(ts * fps) }, duration: { OTIO_SCHEMA: 'RationalTime.1', rate: fps, value: Math.round(d * fps) } }, media_reference: s.type === 'title' ? { OTIO_SCHEMA: 'MissingReference.1' } : { OTIO_SCHEMA: 'ExternalReference.1', target_url: 'file:///' + String(s.src).replace(/\\/g, '/') }, metadata: {} }; });
  return JSON.stringify({ OTIO_SCHEMA: 'Timeline.1', name: project.name || 'Viola', global_start_time: null, tracks: { OTIO_SCHEMA: 'Stack.1', name: 'tracks', children: [{ OTIO_SCHEMA: 'Track.1', name: 'V1', kind: 'Video', children, metadata: {} }], metadata: {} }, metadata: {} }, null, 2);
}
module.exports = { check, saveVersion, listVersions, loadVersion, toFcpxml, toOtio };

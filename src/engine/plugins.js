'use strict';
// Plug-in-System für Effekte. Ordner mit .json- oder .js-Dateien.
// JSON: { "id": "PLUG.MEINE.SACHE", "name": "Meine Sache", "group": "Plugins", "params": { "h": { "type": "float", "label": "Farbton", "def": 0, "min": -180, "max": 180, "step": 1 } }, "filter": "hue=h={h}" }
// JS:   module.exports = { id, name, group, params, build(p, ctx) | graph(a, o, p, ctx, u), needs: [...] }  (läuft mit den Rechten der App – nur eigene Plug-ins verwenden)
const fs = require('fs'), path = require('path');
const OK_ID = /^PLUG\.[A-Z0-9_.]{1,40}$/;
const num = (v, d) => (Number.isFinite(+v) ? +v : d);

function fromJson(j) {
  if (!j || !OK_ID.test(j.id || '') || !j.name || typeof j.filter !== 'string') throw new Error('id (PLUG.…), name und filter nötig');
  const params = {}; Object.entries(j.params || {}).forEach(([k, s]) => { if (!/^\w{1,20}$/.test(k)) throw new Error('Parametername ungültig: ' + k); params[k] = Object.assign({ type: 'float', label: k, def: 0 }, s); if (params[k].type === 'float' || params[k].type === 'int') { params[k].min = num(s.min, 0); params[k].max = num(s.max, 100); params[k].step = num(s.step, 1); params[k].def = num(s.def, 0); } });
  const needs = [...new Set(j.filter.split(/[,;]/).map(x => (x.trim().match(/^[a-z0-9_]+/i) || [''])[0].toLowerCase()).filter(Boolean))];
  const tpl = j.filter;
  return { name: j.name, group: j.group || 'Plugins', needs, params, plugin: true,
    build: p => tpl.replace(/\{(\w+)\}/g, (_, k) => { const s = params[k]; if (!s) return ''; const v = p[k]; if (s.type === 'bool') return v ? '1' : '0'; if (s.type === 'enum') return (s.options || []).includes(v) ? String(v) : String(s.def); if (s.type === 'string') return String(v == null ? s.def : v).replace(/[^\w .#\/-]/g, ''); return String(num(v, s.def)); }) };
}
// FX-Tabelle um Plug-ins aus den Ordnern erweitern. Gibt { loaded, errors } zurück.
function load(FX, dirs) {
  const loaded = [], errors = [];
  for (const dir of dirs || []) {
    let files = []; try { files = fs.readdirSync(dir).filter(f => /\.(json|js)$/i.test(f)); } catch (_) { continue; }
    for (const f of files) {
      try {
        const full = path.join(dir, f); let d;
        if (/\.json$/i.test(f)) { const j = JSON.parse(fs.readFileSync(full, 'utf8')); d = fromJson(j); d.id = j.id; }
        else { const m = require(full); if (!OK_ID.test(m.id || '') || !m.name || !(m.build || m.graph)) throw new Error('id (PLUG.…), name und build/graph nötig'); d = Object.assign({ group: 'Plugins', needs: [], params: {}, plugin: true }, m); }
        const id = d.id; delete d.id; FX[id] = d; loaded.push(id);
      } catch (e) { errors.push(f + ': ' + e.message); }
    }
  }
  return { loaded, errors };
}
module.exports = { load, fromJson };

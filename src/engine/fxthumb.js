// Vorschaubild eines Effekts: Teststandbild durch den Effekt (mit Standardwerten) schicken
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const fxm = require('./fx'), ff = require('./ffmpeg');
const cache = new Map();
function thumb(id, params, dir) {
  const key = id + JSON.stringify(params || {}); if (cache.has(key)) return cache.get(key);
  const pr = new Promise(resolve => {
    try {
      const e = fxm.create(id, params); const g = fxm.buildGraph([e], 'src', 'res', { W: 160, H: 90, supported: n => ff.supportedFilters(n) }, 'q');
      const out = path.join(dir || os.tmpdir(), 'fxt_' + id.replace(/\W/g, '_') + '.png'); fs.mkdirSync(path.dirname(out), { recursive: true });
      const src = 'testsrc2=s=160x90:d=2,format=yuv420p';
      const p = spawn(ff.binaries().ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', src, '-filter_complex', `[0:v]null[src];${g.stmts.join(';')}`, '-map', '[res]', '-frames:v', '1', out]);
      p.on('close', c => resolve(c === 0 && fs.existsSync(out) ? out : null)); p.on('error', () => resolve(null));
    } catch (_) { resolve(null); }
  });
  cache.set(key, pr); return pr;
}
module.exports = { thumb };

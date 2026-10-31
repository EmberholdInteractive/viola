'use strict';
// AAF-Export: AAF ist ein Microsoft-Strukturspeicher-Format. Viola schreibt zuerst OpenTimelineIO und lässt es von Python (opentimelineio + otio-aaf-adapter + pyaaf2) umwandeln.
const { spawnSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const sc = require('./subcheck');
const PY = `import sys, opentimelineio as otio
t = otio.adapters.read_from_file(sys.argv[1])
otio.adapters.write_to_file(t, sys.argv[2])
`;
function findPython(extra) {
  for (const c of [extra, 'python', 'py', 'python3'].filter(Boolean)) { const r = spawnSync(c, ['-c', 'import opentimelineio, aaf2'], { encoding: 'utf8' }); if (r.status === 0) return c; }
  return null;
}
function available(extra) { return !!findPython(extra); }
function convert(project, outFile, { python, fps = 25 } = {}) {
  const py = findPython(python);
  if (!py) throw new Error('AAF braucht Python mit „pip install opentimelineio pyaaf2 otio-aaf-adapter". Stattdessen FCPXML oder OTIO exportieren.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aaf-')); const otio = path.join(tmp, 't.otio'); fs.writeFileSync(otio, sc.toOtio(project, fps));
  const r = spawnSync(py, ['-c', PY, otio, outFile], { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(outFile)) throw new Error('AAF-Umwandlung fehlgeschlagen: ' + String(r.stderr || '').split('\n').filter(Boolean).slice(-2).join(' '));
  return outFile;
}
module.exports = { available, convert };

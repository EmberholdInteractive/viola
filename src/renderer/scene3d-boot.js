// Aufruf aus dem Hauptprozess: await init(spec, w, h) und dann renderFrame(i, fps) -> PNG-Daten-URL
let S3;
async function init(spec, w, h) { const c = document.getElementById('c'); c.width = w; c.height = h; S3 = Scene3D.create(THREE, c, w, h); await S3.load(spec); return true; }
function renderFrame(i, fps) { S3.setTime(i / fps); return S3.dataURL(); }

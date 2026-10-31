// Viola 3D: Szene aus Beschreibung aufbauen und zeitabhängig rendern (three.js). Wird im Hauptfenster (Vorschau) und im unsichtbaren Render-Fenster benutzt.
// spec = { fov, camera: { pos:[x,y,z], target:[x,y,z], orbit: Grad/s }, ambient, sun: { intensity, pos }, bg: 'transparent' | '#rrggbb',
//          objects: [{ kind: 'cube'|'sphere'|'torus'|'cylinder'|'cone'|'plane'|'image'|'text', color, size, pos, rot (Grad), spin (Grad/s), bob, text, image, wire, opacity }] }
(function (g) {
  const rad = d => d * Math.PI / 180;
  const v3 = (a, d) => (Array.isArray(a) && a.length === 3 && a.every(Number.isFinite) ? a : d);
  function textTexture(THREE, text, color, aspect) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = Math.max(64, Math.round(1024 / aspect)); const x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height); x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; let fs = c.height * 0.7; x.font = `bold ${fs}px Arial, sans-serif`;
    while (x.measureText(text).width > c.width * 0.94 && fs > 12) { fs *= 0.92; x.font = `bold ${fs}px Arial, sans-serif`; }
    x.fillText(text, c.width / 2, c.height / 2); const t = new THREE.CanvasTexture(c); return t;
  }
  function create(THREE, canvas, w, h) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(w, h, false);
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200); const amb = new THREE.AmbientLight(0xffffff, 0.6); const sun = new THREE.DirectionalLight(0xffffff, 1); scene.add(amb, sun);
    let spec = {}, items = [], loader = new THREE.TextureLoader();
    function clear() { items.forEach(i => { scene.remove(i.mesh); i.mesh.traverse && i.mesh.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => { if (x.map) x.map.dispose(); x.dispose(); }); }); }); items = []; }
    const tex = url => new Promise(res => loader.load(url, t => res(t), undefined, () => res(null)));
    async function load(s) {
      spec = s || {}; clear(); camera.fov = +spec.fov || 45; camera.aspect = w / h; camera.updateProjectionMatrix();
      amb.intensity = spec.ambient == null ? 0.6 : +spec.ambient; const sp = spec.sun || {}; sun.intensity = sp.intensity == null ? 1 : +sp.intensity; const sq = v3(sp.pos, [3, 4, 5]); sun.position.set(sq[0], sq[1], sq[2]);
      renderer.setClearColor(spec.bg && /^#[0-9a-f]{6}$/i.test(spec.bg) ? spec.bg : 0x000000, spec.bg && /^#[0-9a-f]{6}$/i.test(spec.bg) ? 1 : 0);
      for (const o of spec.objects || []) {
        const col = /^#[0-9a-f]{6}$/i.test(o.color || '') ? o.color : '#8b5cf6'; const sz = Math.max(0.05, +o.size || 1); let geo, mat, mesh;
        const mk = (map, transparent) => new THREE.MeshStandardMaterial({ color: map ? 0xffffff : col, map: map || null, roughness: 0.45, metalness: 0.15, transparent: !!transparent || (o.opacity != null && o.opacity < 1), opacity: o.opacity == null ? 1 : +o.opacity, wireframe: !!o.wire, side: THREE.DoubleSide });
        switch (o.kind) {
          case 'sphere': mesh = new THREE.Mesh(new THREE.SphereGeometry(sz * 0.6, 48, 32), mk()); break;
          case 'torus': mesh = new THREE.Mesh(new THREE.TorusGeometry(sz * 0.5, sz * 0.2, 24, 64), mk()); break;
          case 'cylinder': mesh = new THREE.Mesh(new THREE.CylinderGeometry(sz * 0.4, sz * 0.4, sz, 48), mk()); break;
          case 'cone': mesh = new THREE.Mesh(new THREE.ConeGeometry(sz * 0.5, sz, 48), mk()); break;
          case 'plane': mesh = new THREE.Mesh(new THREE.PlaneGeometry(sz * 1.6, sz), mk()); break;
          case 'image': { const t = o.image ? await tex(o.image) : null; const asp = t && t.image ? t.image.width / t.image.height : 1.6; mesh = new THREE.Mesh(new THREE.PlaneGeometry(sz * asp, sz), mk(t, true)); break; }
          case 'text': { const txt = String(o.text || 'Text'); const asp = Math.max(1, Math.min(8, txt.length * 0.55)); const grp = new THREE.Group(); const layers = 8;
            for (let i = 0; i < layers; i++) { const t = textTexture(THREE, txt, i === layers - 1 ? col : '#' + new THREE.Color(col).multiplyScalar(0.55).getHexString(), asp); const m = new THREE.Mesh(new THREE.PlaneGeometry(sz * asp, sz), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, roughness: 0.4 })); m.position.z = (i - layers + 1) * sz * 0.03; grp.add(m); }
            mesh = grp; break; }
          default: mesh = new THREE.Mesh(new THREE.BoxGeometry(sz, sz, sz), mk());
        }
        const p = v3(o.pos, [0, 0, 0]), r = v3(o.rot, [0, 0, 0]); mesh.position.set(p[0], p[1], p[2]); mesh.rotation.set(rad(r[0]), rad(r[1]), rad(r[2])); scene.add(mesh);
        items.push({ mesh, base: { p, r }, spin: v3(o.spin, [0, 0, 0]), bob: +o.bob || 0 });
      }
    }
    function setTime(t) {
      items.forEach(i => { i.mesh.rotation.set(rad(i.base.r[0] + i.spin[0] * t), rad(i.base.r[1] + i.spin[1] * t), rad(i.base.r[2] + i.spin[2] * t)); i.mesh.position.set(i.base.p[0], i.base.p[1] + (i.bob ? Math.sin(t * 2.2) * i.bob : 0), i.base.p[2]); });
      const c = spec.camera || {}; const cp = v3(c.pos, [0, 0, 6]), ct = v3(c.target, [0, 0, 0]); const orbit = rad((+c.orbit || 0) * t);
      const dx = cp[0] - ct[0], dz = cp[2] - ct[2]; camera.position.set(ct[0] + dx * Math.cos(orbit) - dz * Math.sin(orbit), cp[1], ct[2] + dx * Math.sin(orbit) + dz * Math.cos(orbit)); camera.lookAt(ct[0], ct[1], ct[2]);
      renderer.render(scene, camera);
    }
    return { load, setTime, renderer, dataURL: () => canvas.toDataURL('image/png'), dispose: () => { clear(); renderer.dispose(); } };
  }
  g.Scene3D = { create };
})(typeof window !== 'undefined' ? window : globalThis);

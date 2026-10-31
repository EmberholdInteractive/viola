// Effektsystem (Datenmodell nach Katalog Abschnitt 3):
// Jede Effektinstanz: { id, version, enabled, bypass, mix, params }. Jeder Parameter: name, type, def, min, max, step, unit, label.
// Effekte sind reine Daten + ein Filter-Baustein für FFmpeg; so entsteht die Oberfläche (Effektbrowser, Inspektor) automatisch.
const f = (label, def, min, max, step, unit) => ({ type: 'float', label, def, min, max, step: step || 0.01, unit: unit || '' });
const i = (label, def, min, max, step, unit) => ({ type: 'int', label, def, min, max, step: step || 1, unit: unit || '' });
const b = (label, def) => ({ type: 'bool', label, def: !!def });
const en = (label, def, options) => ({ type: 'enum', label, def, options });
const S = (label, def) => ({ type: 'string', label, def });
const ev = n => Math.max(2, Math.floor(n / 2) * 2);   // gerade Größe für yuv420p
const n3 = v => Number(v).toFixed(3);

// build(p, ctx) -> Filterkette (String) oder graph(inL, outL, p, ctx, uid) -> Liste von Filtergraph-Anweisungen
const FX = {
  'FX.BLUR.GAUSSIAN':  { name: 'Gaußscher Weichzeichner', group: 'Blur/Sharpen', needs: ['gblur'], params: { radius: f('Radius', 8, 0, 200, 1, 'px') }, build: p => `gblur=sigma=${n3(Math.max(0.01, p.radius / 2))}:steps=2` },
  'FX.BLUR.BOX':       { name: 'Box-Blur', group: 'Blur/Sharpen', needs: ['boxblur'], params: { radius: i('Radius', 6, 0, 60, 1, 'px') }, build: p => `boxblur=${p.radius}:1` },
  'FX.SHARPEN.UNSHARP':{ name: 'Unscharf maskieren', group: 'Blur/Sharpen', needs: ['unsharp'], params: { amount: f('Stärke', 1, -2, 5, 0.1), size: i('Größe', 5, 3, 13, 2) }, build: p => `unsharp=${p.size}:${p.size}:${n3(p.amount)}:${p.size}:${p.size}:0` },
  'FX.LIGHT.VIGNETTE': { name: 'Vignette', group: 'Light', needs: ['vignette'], params: { angle: f('Stärke', 0.6, 0.1, 1.5, 0.05) }, build: p => `vignette=angle=${n3(p.angle)}:mode=forward:eval=init` },
  'FX.LIGHT.GLOW':     { name: 'Glow / Bloom', group: 'Light', needs: ['gblur', 'blend'], params: { radius: f('Radius', 30, 2, 200, 1, 'px'), amount: f('Stärke', 0.5, 0, 1, 0.05), threshold: f('Helligkeit', 0.1, -0.5, 0.5, 0.05) },
    graph: (a, o, p, c, u) => [`[${a}]split[${u}a][${u}b]`, `[${u}b]gblur=sigma=${n3(p.radius / 2)}:steps=2,eq=brightness=${n3(p.threshold)}[${u}c]`, `[${u}a][${u}c]blend=all_mode=screen:all_opacity=${n3(p.amount)}[${o}]`] },
  'FX.ANALOG.GRAIN':   { name: 'Filmkorn', group: 'Analog', needs: ['noise'], params: { strength: i('Stärke', 18, 0, 100) }, build: p => `noise=alls=${p.strength}:allf=t+u` },
  'FX.ANALOG.CHROMATIC': { name: 'Chromatische Aberration', group: 'Analog', needs: ['rgbashift'], params: { amount: i('Versatz', 4, 0, 30, 1, 'px') }, build: p => `rgbashift=rh=${p.amount}:bh=${-p.amount}` },
  'FX.ANALOG.VHS':     { name: 'VHS', group: 'Analog', needs: ['gblur', 'rgbashift', 'noise', 'eq'], params: { wear: f('Abnutzung', 0.5, 0, 1, 0.05) }, build: p => `gblur=sigma=${n3(0.6 + p.wear)}:steps=1,rgbashift=rh=${Math.round(2 + p.wear * 4)}:bh=${-Math.round(2 + p.wear * 4)},noise=alls=${Math.round(8 + p.wear * 30)}:allf=t,eq=saturation=1.15:contrast=1.05` },
  'FX.ANALOG.SCANLINES': { name: 'Scanlines / CRT', group: 'Analog', needs: ['geq'], params: { depth: f('Tiefe', 0.35, 0, 0.9, 0.05) }, build: p => `geq=lum='lum(X,Y)*if(eq(mod(floor(Y/2),2),0),1,${n3(1 - p.depth)})':cb='cb(X,Y)':cr='cr(X,Y)'` },
  'FX.ANALOG.FLICKER': { name: 'Flackern', group: 'Analog', needs: ['eq'], params: { strength: f('Stärke', 0.05, 0, 0.3, 0.01), speed: f('Tempo', 6, 0.5, 30, 0.5, 'Hz') }, build: p => `eq=brightness='${n3(p.strength)}*sin(t*${n3(p.speed)}*6.2832)':eval=frame` },
  'FX.STYLIZE.POSTERIZE': { name: 'Posterisieren', group: 'Stylize', needs: ['lutrgb'], params: { levels: i('Stufen', 6, 2, 32) }, build: p => `lutrgb=r='trunc(val*${p.levels}/256)*256/${p.levels}':g='trunc(val*${p.levels}/256)*256/${p.levels}':b='trunc(val*${p.levels}/256)*256/${p.levels}'` },
  'FX.STYLIZE.PIXELATE': { name: 'Mosaik / Pixel', group: 'Stylize', needs: ['scale'], params: { size: i('Blockgröße', 16, 2, 128, 1, 'px') }, build: (p, c) => `scale=${ev(c.W / p.size)}:${ev(c.H / p.size)}:flags=neighbor,scale=${c.W}:${c.H}:flags=neighbor` },
  'FX.STYLIZE.EDGES':  { name: 'Kanten finden', group: 'Stylize', needs: ['edgedetect'], params: { high: f('Schwelle', 0.3, 0.05, 0.9, 0.05) }, build: p => `edgedetect=mode=colormix:high=${n3(p.high)}:low=${n3(p.high / 3)}` },
  'FX.STYLIZE.EMBOSS': { name: 'Relief (Emboss)', group: 'Stylize', needs: ['convolution'], params: {}, build: () => { const k = "'-2 -1 0 -1 1 1 0 1 2'"; return `convolution=0m=${k}:1m=${k}:2m=${k}:0bias=128:1bias=128:2bias=128`; } },
  'FX.STYLIZE.NEGATIVE': { name: 'Negativ', group: 'Stylize', needs: ['negate'], params: {}, build: () => 'negate' },
  'FX.STYLIZE.SEPIA':  { name: 'Sepia', group: 'Stylize', needs: ['colorchannelmixer'], params: {}, build: () => 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131' },
  'FX.DISTORT.LENS':   { name: 'Linsenverzerrung', group: 'Distortion', needs: ['lenscorrection'], params: { k1: f('Tonne / Kissen', -0.2, -0.8, 0.8, 0.02), k2: f('Randstärke', 0, -0.8, 0.8, 0.02) }, build: p => `lenscorrection=k1=${n3(p.k1)}:k2=${n3(p.k2)}` },
  'FX.TRANSFORM.FLIP': { name: 'Spiegeln', group: 'Transform', needs: ['hflip', 'vflip'], params: { h: b('Horizontal', true), v: b('Vertikal', false) }, build: p => [p.h ? 'hflip' : '', p.v ? 'vflip' : ''].filter(Boolean).join(',') || 'null' },
  'FX.TRANSFORM.CROP': { name: 'Zuschneiden', group: 'Transform', needs: ['crop', 'scale'], params: { left: f('Links', 0, 0, 45, 0.5, '%'), right: f('Rechts', 0, 0, 45, 0.5, '%'), top: f('Oben', 0, 0, 45, 0.5, '%'), bottom: f('Unten', 0, 0, 45, 0.5, '%') },
    build: (p, c) => `crop=w=iw*${n3(1 - (p.left + p.right) / 100)}:h=ih*${n3(1 - (p.top + p.bottom) / 100)}:x=iw*${n3(p.left / 100)}:y=ih*${n3(p.top / 100)},scale=${c.W}:${c.H}:flags=lanczos,setsar=1` },
  'FX.TRANSFORM.ROTATE': { name: 'Drehen', group: 'Transform', needs: ['rotate'], params: { angle: f('Winkel', 0, -180, 180, 0.5, '°') }, build: p => `rotate=${n3(p.angle * Math.PI / 180)}:ow=iw:oh=ih:c=black@0` },
  'FX.RESTORE.DENOISE': { name: 'Rauschen entfernen (räumlich/zeitlich)', group: 'Restoration', needs: ['hqdn3d'], params: { spatial: f('Räumlich', 4, 0, 20, 0.5), temporal: f('Zeitlich', 6, 0, 20, 0.5) }, build: p => `hqdn3d=${n3(p.spatial)}:${n3(p.spatial * 0.75)}:${n3(p.temporal)}:${n3(p.temporal * 0.75)}` },
  'FX.RESTORE.NLMEANS': { name: 'Rauschen entfernen (hohe Qualität, langsam)', group: 'Restoration', needs: ['nlmeans'], params: { strength: f('Stärke', 3, 1, 30, 0.5) }, build: p => `nlmeans=s=${n3(p.strength)}` },
  'FX.RESTORE.DEBAND': { name: 'Farbbänder glätten', group: 'Restoration', needs: ['deband'], params: {}, build: () => 'deband' },
  'FX.RESTORE.DEFLICKER': { name: 'Deflicker', group: 'Restoration', needs: ['deflicker'], params: { size: i('Fenster', 5, 2, 129) }, build: p => `deflicker=size=${p.size}:mode=am` },
  'FX.RESTORE.DEINTERLACE': { name: 'Deinterlace', group: 'Restoration', needs: ['yadif'], params: {}, build: () => 'yadif=mode=0' },
  'FX.COLOR.CURVES':   { name: 'Kurven (RGB/Luma)', group: 'Color', needs: ['curves'], params: { preset: en('Vorlage', 'none', ['none', 'increase_contrast', 'strong_contrast', 'lighter', 'darker', 'cross_process', 'vintage', 'negative']), master: S('Eigene Punkte (x/y)', ''), red: S('Rot', ''), green: S('Grün', ''), blue: S('Blau', '') },
    build: p => { const ok = s => /^(\d*\.?\d+\/\d*\.?\d+)(\s+\d*\.?\d+\/\d*\.?\d+)*$/.test(String(s).trim()); const o = []; if (p.preset && p.preset !== 'none') o.push(`preset=${p.preset}`); ['master', 'red', 'green', 'blue'].forEach(k => { if (ok(p[k])) o.push(`${k}='${p[k].trim()}'`); }); return o.length ? `curves=${o.join(':')}` : 'null'; } },
  'FX.COLOR.LEVELS':   { name: 'Tonwerte', group: 'Color', needs: ['colorlevels', 'eq'], params: { black: f('Schwarzpunkt', 0, 0, 0.5, 0.01), white: f('Weißpunkt', 1, 0.5, 1, 0.01), gamma: f('Gamma', 1, 0.3, 3, 0.05) }, build: p => `colorlevels=rimin=${n3(p.black)}:gimin=${n3(p.black)}:bimin=${n3(p.black)}:rimax=${n3(p.white)}:gimax=${n3(p.white)}:bimax=${n3(p.white)},eq=gamma=${n3(p.gamma)}` },
  'FX.COLOR.BALANCE':  { name: 'Lift / Gamma / Gain', group: 'Color', needs: ['colorbalance'], params: Object.fromEntries(['Lift:s', 'Gamma:m', 'Gain:h'].flatMap(x => { const [l, k] = x.split(':'); return [['r', 'Rot'], ['g', 'Grün'], ['b', 'Blau']].map(([c, cl]) => [k + c, f(`${l} ${cl}`, 0, -1, 1, 0.02)]); })),
    build: p => `colorbalance=rs=${p.sr}:gs=${p.sg}:bs=${p.sb}:rm=${p.mr}:gm=${p.mg}:bm=${p.mb}:rh=${p.hr}:gh=${p.hg}:bh=${p.hb}` },
  'FX.COLOR.VIBRANCE': { name: 'Dynamik (Vibrance)', group: 'Color', needs: ['vibrance'], params: { intensity: f('Stärke', 0.6, -2, 2, 0.05) }, build: p => `vibrance=intensity=${n3(p.intensity)}` },
  'FX.COLOR.LUT':      { name: 'LUT anwenden (.cube/.3dl)', group: 'Color', needs: ['lut3d'], params: { file: S('LUT-Datei', '') }, build: p => { const q = String(p.file || '').trim(); if (!q) return 'null'; return `lut3d=file='${q.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, '')}'`; } },
  'FX.COLOR.EQ':       { name: 'Helligkeit / Kontrast / Sättigung', group: 'Color', needs: ['eq'], params: { brightness: f('Helligkeit', 0, -1, 1, 0.01), contrast: f('Kontrast', 1, 0, 3, 0.01), saturation: f('Sättigung', 1, 0, 3, 0.01), gamma: f('Gamma', 1, 0.3, 3, 0.01) }, build: p => `eq=brightness=${n3(p.brightness)}:contrast=${n3(p.contrast)}:saturation=${n3(p.saturation)}:gamma=${n3(p.gamma)}` },
  'FX.COLOR.TEMP':     { name: 'Farbtemperatur', group: 'Color', needs: ['colortemperature'], params: { temperature: i('Temperatur', 6500, 2000, 12000, 100, 'K') }, build: p => `colortemperature=temperature=${p.temperature}` },
  'FX.COLOR.HSL':      { name: 'HSL nach Farbbereich', group: 'Color', needs: ['huesaturation'], params: Object.fromEntries(['r:Rot', 'y:Gelb', 'g:Grün', 'c:Cyan', 'b:Blau', 'm:Magenta'].flatMap(x => { const [k, l] = x.split(':'); return [['h' + k, f(l + ' Farbton', 0, -180, 180, 1, '°')], ['s' + k, f(l + ' Sättigung', 0, -1, 1, 0.05)], ['l' + k, f(l + ' Helligkeit', 0, -1, 1, 0.05)]]; })),
    build: p => { const o = ['r', 'y', 'g', 'c', 'b', 'm'].filter(k => p['h' + k] || p['s' + k] || p['l' + k]).map(k => `huesaturation=colors=${k}:hue=${n3(p['h' + k])}:saturation=${n3(p['s' + k])}:intensity=${n3(p['l' + k])}`); return o.length ? o.join(',') : 'null'; } },
  'FX.COLOR.HUE':      { name: 'Farbton / Sättigung', group: 'Color', needs: ['hue'], params: { hue: f('Farbton', 0, -180, 180, 1, '°'), sat: f('Sättigung', 1, 0, 3, 0.05) }, build: p => `hue=h=${n3(p.hue)}:s=${n3(p.sat)}` },
  'FX.COLOR.TONEMAP':  { name: 'HDR → SDR (Tone-Mapping)', group: 'Color', needs: ['zscale', 'tonemap'], params: { source: en('Quelle', 'pq', ['pq', 'hlg']), mode: en('Verfahren', 'hable', ['hable', 'mobius', 'reinhard']) }, build: p => `setparams=color_primaries=bt2020:color_trc=${p.source === 'pq' ? 'smpte2084' : 'arib-std-b67'}:colorspace=bt2020nc:range=tv,zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=${p.mode}:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p` },
  'FX.TRANSFORM.STABILIZE': { name: 'Stabilisieren (Verwackeln glätten)', group: 'Transform', needs: ['deshake'], params: { range: i('Suchbereich', 16, 16, 64, 16, 'px'), edge: en('Ränder', 'mirror', ['blank', 'original', 'clamp', 'mirror']) }, build: p => { const r = Math.max(16, Math.min(64, Math.round(p.range / 16) * 16)); return `deshake=rx=${r}:ry=${r}:edge=${p.edge}`; } },
  'FX.KEY.CHROMA': { name: 'Chroma-Key (Farbe freistellen)', group: 'Key', needs: ['chromakey', 'overlay', 'drawbox', 'gblur'], params: { color: S('Farbe (Hex)', '00ff00'), similarity: f('Toleranz', 0.25, 0.01, 0.6, 0.01), blend: f('Weiche Kante', 0.08, 0, 0.5, 0.01), bg: en('Hintergrund', 'black', ['black', 'white', 'gray', 'blur']) },
    graph: (a, o, p, c, u) => { const col = /^[0-9a-f]{6}$/i.test(p.color) ? p.color : '00ff00'; const bg = { black: 'drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill', white: 'drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill', gray: 'drawbox=x=0:y=0:w=iw:h=ih:color=gray:t=fill', blur: 'gblur=sigma=20' }[p.bg] || 'drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill';
      return [`[${a}]split[${u}a][${u}b]`, `[${u}a]${bg}[${u}bg]`, `[${u}b]chromakey=color=0x${col}:similarity=${n3(p.similarity)}:blend=${n3(p.blend)},format=yuva420p[${u}k]`, `[${u}bg][${u}k]overlay=format=auto,format=yuv420p[${o}]`]; } },
  'FX.MASK.SHAPE': { name: 'Maske (Ellipse / Rechteck)', group: 'Mask', needs: ['geq', 'gblur', 'alphamerge', 'overlay', 'eq', 'hue'], params: { shape: en('Form', 'ellipse', ['ellipse', 'rect']), cx: f('Mitte X', 0.5, 0, 1, 0.01), cy: f('Mitte Y', 0.5, 0, 1, 0.01), w: f('Breite', 0.5, 0.05, 1, 0.01), h: f('Höhe', 0.5, 0.05, 1, 0.01), feather: f('Weiche Kante', 20, 0, 200, 1, 'px'), invert: b('Invertieren', false), outside: en('Außerhalb', 'blur', ['blur', 'dark', 'bw', 'light']) },
    graph: (a, o, p, c, u) => {
      const sh = p.shape === 'rect' ? `lte(abs(X/W-${n3(p.cx)}),${n3(p.w / 2)})*lte(abs(Y/H-${n3(p.cy)}),${n3(p.h / 2)})` : `lte(hypot((X/W-${n3(p.cx)})/${n3(p.w / 2)},(Y/H-${n3(p.cy)})/${n3(p.h / 2)}),1)`;
      const m = p.invert ? `255*(1-${sh})` : `255*${sh}`; const out = { blur: 'gblur=sigma=18', dark: 'eq=brightness=-0.5', bw: 'hue=s=0', light: 'eq=brightness=0.4' }[p.outside] || 'gblur=sigma=18';
      return [`[${a}]split=3[${u}i][${u}o][${u}m]`, `[${u}m]geq=lum='${m}':cb=128:cr=128,${p.feather > 0 ? `gblur=sigma=${n3(Math.max(0.1, p.feather / 2))},` : ''}format=gray[${u}k]`, `[${u}o]${out}[${u}x]`, `[${u}i]format=yuva420p[${u}j]`, `[${u}j][${u}k]alphamerge[${u}ia]`, `[${u}x][${u}ia]overlay=format=auto,format=yuv420p[${o}]`]; } },
  'FX.MASK.POLYGON': { name: 'Rotoskopie (Polygon-Maske, animiert)', group: 'Mask', needs: ['geq', 'gblur', 'alphamerge', 'overlay', 'eq', 'hue'],
    params: { keys: { type: 'string', label: 'Punkte (Zeit x y x y … | Zeit …)', def: '0 0.3 0.3 0.7 0.3 0.7 0.7 0.3 0.7', len: 2000 }, feather: f('Weiche Kante', 6, 0, 200, 1, 'px'), invert: b('Invertieren', false), outside: en('Außerhalb', 'black', ['black', 'blur', 'dark', 'bw', 'light']) },
    graph: (a, o, p, c, u) => {
      const keys = polyKeys(p.keys); if (!keys.length) return [`[${a}]null[${o}]`];
      const sh = polyExpr(keys); const m = p.invert ? `255*(1-${sh})` : `255*${sh}`;
      const out = { black: 'eq=brightness=-1', blur: 'gblur=sigma=18', dark: 'eq=brightness=-0.5', bw: 'hue=s=0', light: 'eq=brightness=0.4' }[p.outside] || 'eq=brightness=-1';
      return [`[${a}]split=3[${u}i][${u}o][${u}m]`, `[${u}m]geq=lum='${m}':cb=128:cr=128,${p.feather > 0 ? `gblur=sigma=${n3(Math.max(0.1, p.feather / 2))},` : ''}format=gray[${u}k]`, `[${u}o]${out}[${u}x]`, `[${u}i]format=yuva420p[${u}j]`, `[${u}j][${u}k]alphamerge[${u}ia]`, `[${u}x][${u}ia]overlay=format=auto,format=yuv420p[${o}]`]; } },
  'FX.RESTORE.DELOGO': { name: 'Objekt / Logo entfernen (Fläche überblenden)', group: 'Restoration', needs: ['delogo'], params: { x: f('Links', 0.8, 0, 1, 0.005), y: f('Oben', 0.05, 0, 1, 0.005), w: f('Breite', 0.15, 0.01, 1, 0.005), h: f('Höhe', 0.1, 0.01, 1, 0.005), start: f('Von', 0, 0, 86400, 0.1, 's'), end: f('Bis', 86400, 0, 86400, 0.1, 's') },
    build: (p, c) => { const W = (c && c.W) || 1920, H = (c && c.H) || 1080; let x = Math.round(p.x * W), y = Math.round(p.y * H), w = Math.round(p.w * W), h = Math.round(p.h * H); x = Math.max(1, Math.min(W - 3, x)); y = Math.max(1, Math.min(H - 3, y)); w = Math.max(2, Math.min(W - x - 1, w)); h = Math.max(2, Math.min(H - y - 1, h));
      return `delogo=x=${x}:y=${y}:w=${w}:h=${h}:enable='between(t,${n3(p.start)},${n3(p.end)})'`; } },
  'FX.TRANSFORM.PERSPECTIVE3D': { name: 'Perspektive (3D-Kippen)', group: 'Transform', needs: ['perspective'], params: { pitch: f('Neigen (X)', 0, -80, 80, 0.5, '°'), yaw: f('Drehen (Y)', 25, -80, 80, 0.5, '°'), roll: f('Rollen (Z)', 0, -180, 180, 0.5, '°'), dist: f('Abstand', 1.6, 0.6, 6, 0.05), zoom: f('Größe', 1, 0.3, 2, 0.01) },
    build: (p, c) => { const W = (c && c.W) || 1920, H = (c && c.H) || 1080; const q = persp(p, W, H); return `perspective=x0=${q[0]}:y0=${q[1]}:x1=${q[2]}:y1=${q[3]}:x2=${q[4]}:y2=${q[5]}:x3=${q[6]}:y3=${q[7]}:sense=destination:interpolation=linear`; } },
  'FX.TIME.BLEND':     { name: 'Bildmischung (weichere Bewegung)', group: 'Time', needs: ['tmix'], params: { frames: i('Bilder', 3, 2, 12) }, build: p => `tmix=frames=${p.frames}` },
  'FX.TIME.INTERPOLATE': { name: 'Zwischenbilder (Optical Flow)', group: 'Time', needs: ['minterpolate'], params: { fps: i('Ziel-FPS', 50, 25, 120), mode: en('Verfahren', 'mci', ['blend', 'mci']) }, build: p => `minterpolate=fps=${p.fps}:mi_mode=${p.mode}` },
};

// Rotoskopie: "Zeit x y x y …|Zeit x y …" (x,y normiert 0..1). Zwischen den Schlüsselbildern wird linear überblendet.
function polyKeys(str) {
  return String(str || '').split('|').map(k => k.trim().split(/\s+/).map(Number)).filter(a => a.length >= 7 && a.length % 2 === 1 && a.every(Number.isFinite)).slice(0, 8)
    .map(a => ({ t: a[0], pts: Array.from({ length: (a.length - 1) / 2 }, (_, i) => [a[1 + 2 * i], a[2 + 2 * i]]) })).filter(k => k.pts.length >= 3 && k.pts.length <= 12).sort((x, y) => x.t - y.t)
    .filter((k, _, all) => k.pts.length === all[0].pts.length);
}
function polyExpr(keys) {
  const N = keys[0].pts.length; const f6 = v => Number(v).toFixed(5);
  const coord = (vi, ax) => { if (keys.length === 1) return f6(keys[0].pts[vi][ax]); let e = f6(keys[keys.length - 1].pts[vi][ax]);
    for (let k = keys.length - 2; k >= 0; k--) { const A = keys[k], B = keys[k + 1]; const dt = Math.max(1e-6, B.t - A.t); e = `if(lt(T,${f6(B.t)}),${f6(A.pts[vi][ax])}+(${f6(B.pts[vi][ax] - A.pts[vi][ax])})*(T-${f6(A.t)})/${f6(dt)},${e})`; } return e; };
  const X = [], Y = []; for (let i = 0; i < N; i++) { X.push(coord(i, 0)); Y.push(coord(i, 1)); }
  const terms = []; for (let i = 0; i < N; i++) { const j = (i + 1) % N; const xi = X[i], yi = Y[i], xj = X[j], yj = Y[j];
    terms.push(`(1-eq(gt(${yi},Y/H),gt(${yj},Y/H)))*lt(X/W,(${xj}-${xi})*(Y/H-${yi})/(${yj}-${yi}+0.000001)+${xi})`); }
  return `mod(${terms.join('+')},2)`;
}
// 3D-Projektion der vier Ecken (Reihenfolge: oben links, oben rechts, unten links, unten rechts)
function persp(p, W, H) {
  const r = d => d * Math.PI / 180, cx = Math.cos(r(p.pitch)), sx = Math.sin(r(p.pitch)), cy = Math.cos(r(p.yaw)), sy = Math.sin(r(p.yaw)), cz = Math.cos(r(p.roll)), sz = Math.sin(r(p.roll));
  const fl = p.dist * W; const out = [];
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([u, v]) => {
    let x = u * W / 2 * p.zoom, y = v * H / 2 * p.zoom, z = 0;
    let y1 = y * cx - z * sx, z1 = y * sx + z * cx; y = y1; z = z1;        // um X
    let x2 = x * cy + z * sy, z2 = -x * sy + z * cy; x = x2; z = z2;      // um Y
    let x3 = x * cz - y * sz, y3 = x * sz + y * cz; x = x3; y = y3;       // um Z
    const k = fl / (fl + z); out.push(Math.round(W / 2 + x * k), Math.round(H / 2 + y * k)); });
  return out;
}
const VERSION = 1;

function defaults(id) { const d = FX[id]; if (!d) throw new Error('Unbekannter Effekt: ' + id); return Object.fromEntries(Object.entries(d.params).map(([k, v]) => [k, v.def])); }
function create(id, params) { return { id, version: VERSION, enabled: true, bypass: false, mix: 1, params: Object.assign(defaults(id), params || {}) }; }
// Werte prüfen und auf den erlaubten Bereich begrenzen (Katalog: "validation")
function validate(id, params) {
  const d = FX[id]; const out = {};
  for (const [k, spec] of Object.entries(d.params)) {
    let v = params && params[k] != null ? params[k] : spec.def;
    if (spec.type === 'float' || spec.type === 'int') { v = Number(v); if (!isFinite(v)) v = spec.def; v = Math.max(spec.min, Math.min(spec.max, v)); if (spec.type === 'int') v = Math.round(v); }
    else if (spec.type === 'bool') v = !!v;
    else if (spec.type === 'enum') { if (!spec.options.includes(v)) v = spec.def; }
    else v = String(v).slice(0, spec.len || 200).replace(/['\\:;,\[\]]/g, '');   // Strings dürfen keine Filtergraph-Zeichen enthalten
    out[k] = v;
  }
  return out;
}
function catalog() { return Object.entries(FX).map(([id, d]) => ({ id, name: d.name, group: d.group, needs: d.needs, params: d.params })); }

// Baut Filtergraph-Anweisungen: von Eingang [inL] zu Ausgang [outL]. ctx = { W, H, supported(names) }
function buildGraph(effects, inL, outL, ctx, uid = 'fx') {
  const list = (effects || []).filter(e => e && FX[e.id] && e.enabled !== false && !e.bypass);
  const usable = list.filter(e => !ctx.supported || ctx.supported(FX[e.id].needs).length === FX[e.id].needs.length);
  const skipped = list.filter(e => !usable.includes(e)).map(e => e.id);
  if (!usable.length) return { stmts: [`[${inL}]null[${outL}]`], skipped };
  const stmts = []; let cur = inL;
  usable.forEach((e, k) => {
    const d = FX[e.id], p = validate(e.id, e.params), last = k === usable.length - 1, out = last ? outL : `${uid}_${k}`, u = `${uid}${k}`;
    const mix = e.mix == null ? 1 : Math.max(0, Math.min(1, e.mix));
    const sub = d.graph ? d.graph(cur, mix >= 0.999 ? out : `${u}fx`, p, ctx, u) : [`[${cur}]${d.build(p, ctx)}${mix >= 0.999 ? '' : ',format=yuv420p'}[${mix >= 0.999 ? out : u + 'fx'}]`];
    if (mix >= 0.999) stmts.push(...sub);
    else stmts.push(`[${cur}]split[${u}o][${u}s]`, ...sub.map(s => s.replace(`[${cur}]`, `[${u}s]`)), `[${u}o][${u}fx]blend=all_expr='A*${n3(1 - mix)}+B*${n3(mix)}'[${out}]`);
    cur = out;
  });
  return { stmts, skipped };
}
function loadPlugins(dirs) { return require('./plugins').load(FX, dirs); }
module.exports = { FX, VERSION, defaults, create, validate, catalog, buildGraph, loadPlugins, polyKeys, persp };

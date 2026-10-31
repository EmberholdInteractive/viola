// Render-Engine: Projekt (Folien + Musik) -> MP4. Arbeitet in Blöcken, damit auch tausende Fotos gehen.
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const ff = require('./ffmpeg');
const look = require('./look');
const kf = require('./keyframes');
const reframe = require('./reframe');
const subs = require('./subtitles');
const { cleanChain } = require('./audioclean');
const fxm = require('./fx');
const afx = require('./afx');
const timewarp = require('./timewarp');
const xo = require('./exportopts');

const PRESETS = {
  klein:    { width: 1280, height: 720,  crf: 30, group: 'Allgemein', label: 'Klein (720p, stark komprimiert)' },
  '720p':   { width: 1280, height: 720,  crf: 26, group: 'Allgemein', label: '720p (gut komprimiert)' },
  '1080p':  { width: 1920, height: 1080, crf: 23, group: 'Allgemein', label: '1080p (Full HD)' },
  '4k':     { width: 3840, height: 2160, crf: 22, group: 'Allgemein', label: '4K (sehr groß)' },
  youtube:  { width: 1920, height: 1080, crf: 21, group: 'Plattformen', label: 'YouTube 1080p', fps: 30 },
  youtube4k:{ width: 3840, height: 2160, crf: 21, group: 'Plattformen', label: 'YouTube 4K', fps: 30, codec: 'h265' },
  reels:    { width: 1080, height: 1920, crf: 23, group: 'Plattformen', label: 'Instagram Reels / TikTok / Shorts (9:16)', fps: 30, fit: 'smart' },
  feed45:   { width: 1080, height: 1350, crf: 23, group: 'Plattformen', label: 'Instagram Feed (4:5)', fps: 30, fit: 'smart' },
  quadrat:  { width: 1080, height: 1080, crf: 23, group: 'Plattformen', label: 'Quadrat (1:1)', fps: 30, fit: 'smart' },
  hevc1080: { width: 1920, height: 1080, crf: 26, group: 'Codec', label: '1080p H.265 (halbe Dateigröße)', codec: 'h265' },
  prores:   { width: 1920, height: 1080, crf: 18, group: 'Codec', label: 'ProRes 422 (zum Weiterbearbeiten, .mov)', codec: 'prores', ext: '.mov' },
};
const TRANSITIONS = ['fade', 'dissolve', 'fadeblack', 'wipeleft', 'wiperight', 'slideleft', 'slideright', 'circleopen', 'radial', 'smoothleft', 'zoomin', 'pixelize'];
const MOTIONS = ['none', 'zoomin', 'zoomout', 'panleft', 'panright'];

const esc = s => String(s == null ? '' : s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
const FONT = "font-family=\"Georgia, 'DejaVu Serif', serif\"";

function defaults(project) {
  const s = Object.assign({ preset: '720p', fps: 25, transitionDur: 1, defaultSlide: 5, chunk: 12, encoderPreset: 'veryfast', motion: 'none', transition: 'fade', fit: 'blur' }, project.settings || {});
  const pr = PRESETS[s.preset] || PRESETS['720p'];
  s.fit = (project.settings && project.settings.fit) || pr.fit || 'blur';
  s.codec = s.codec || pr.codec || 'h264';
  if (!(project.settings && project.settings.fps) && pr.fps) s.fps = pr.fps;
  s.width = s.width || pr.width; s.height = s.height || pr.height; s.crf = s.crf == null ? pr.crf : s.crf;
  return s;
}

function capSvg(text, W, H) {
  const fs_ = Math.round(Math.min(W, H) * 0.045);
  return `<svg width="${W}" height="${H}"><rect x="0" y="${H - fs_ * 2.2}" width="${W}" height="${fs_ * 2.2}" fill="#1a0a2e" fill-opacity="0.6"/><text x="50%" y="${H - fs_ * 0.75}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fs_}" fill="#fff">${esc(text)}</text></svg>`;
}

async function makeFrame(slide, S, out) {
  const { width: W, height: H } = S;
  if (slide.type === 'title') {
    let base;
    if (slide.bgFrom && fs.existsSync(slide.bgFrom)) {
      base = await sharp(slide.bgFrom, { failOn: 'none' }).rotate().resize(W, H, { fit: 'cover' }).blur(30).modulate({ brightness: 0.4 }).toBuffer();
    } else {
      const g = `<svg width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1245"/><stop offset="1" stop-color="#6b3fa0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
      base = await sharp(Buffer.from(g)).png().toBuffer();
    }
    const big = Math.round(H * 0.14), small = Math.round(H * 0.055);
    const hasSub = !!slide.subtitle;
    const svg = `<svg width="${W}" height="${H}"><text x="50%" y="${hasSub ? H * 0.5 : H * 0.54}" text-anchor="middle" ${FONT} font-size="${big}" font-weight="bold" fill="#000" fill-opacity="0.55" transform="translate(4,4)">${esc(slide.text)}</text><text x="50%" y="${hasSub ? H * 0.5 : H * 0.54}" text-anchor="middle" ${FONT} font-size="${big}" font-weight="bold" fill="#fff">${esc(slide.text)}</text>` +
      (hasSub ? `<text x="50%" y="${H * 0.5 + small * 1.9}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${small}" fill="#d9c4f5">${esc(slide.subtitle)}</text>` : '') + '</svg>';
    await sharp(base).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 92 }).toFile(out);
    return;
  }
  const base = sharp(slide.src, { failOn: 'none' }).rotate();
  if (S.fit === 'smart') {
    const sm = await base.clone().resize(W, H, { fit: 'cover', position: sharp.strategy.attention }).toBuffer();
    const lay = []; if (slide.caption) lay.push({ input: Buffer.from(capSvg(slide.caption, W, H)) });
    await sharp(sm).composite(lay).jpeg({ quality: 90 }).toFile(out); return;
  }
  const fg = await base.clone().resize(S.fit === 'cover' ? W : W - Math.round(W * 0.03), S.fit === 'cover' ? H : H - Math.round(H * 0.05), { fit: S.fit === 'cover' ? 'cover' : 'inside' }).toBuffer();
  const layers = [{ input: fg, gravity: 'center' }];
  let bg;
  if (S.fit === 'cover') bg = await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).png().toBuffer();
  else bg = await base.clone().resize(W, H, { fit: 'cover' }).blur(28).modulate({ brightness: 0.45 }).toBuffer();
  if (slide.caption) {
    layers.push({ input: Buffer.from(capSvg(slide.caption, W, H)) });
  }
  await sharp(bg).composite(layers).jpeg({ quality: 90 }).toFile(out);
}

function motionExpr(motion, fullFrames, off) {
  const p = `((on+${off})/${Math.max(1, fullFrames)})`;
  switch (motion) {
    case 'zoomin':  return { z: `1+0.15*${p}`, x: 'iw/2-(iw/zoom/2)', y: 'ih/2-(ih/zoom/2)' };
    case 'zoomout': return { z: `1.15-0.15*${p}`, x: 'iw/2-(iw/zoom/2)', y: 'ih/2-(ih/zoom/2)' };
    case 'panleft': return { z: '1.15', x: `(iw-iw/zoom)*(1-${p})`, y: 'ih/2-(ih/zoom/2)' };
    case 'panright':return { z: '1.15', x: `(iw-iw/zoom)*${p}`, y: 'ih/2-(ih/zoom/2)' };
    default: return null;
  }
}

function pickTransition(slide, S, i) {
  const ok = ff.supportedTransitions(TRANSITIONS);
  let t = slide.transition || S.transition || 'fade';
  if (t === 'random') t = ok[(i * 7 + 3) % ok.length];
  return ok.includes(t) ? t : 'fade';
}

const skippedFx = [];
async function renderChunk(items, S, idx, total, tmp, signal, fullInfo) {
  const { width: W, height: H, fps: FPS } = S, F = S.transitionDur;
  const out = path.join(tmp, `chunk_${String(idx).padStart(5, '0')}.mp4`);
  const args = []; const fc = [];
  items.forEach((it, i) => {
    const sl = it.slide;
    const cc = look.colorChain(Object.assign({}, S.color, sl.color), sl.lut || S.lut);
    if (sl.type === 'video') {
      const tw = timewarp.plan(Object.assign({}, sl, { trimStart: sl.trimStart || 0 }), it.full);
      args.push(...tw.inArgs, '-i', sl.src);
      const fit = (S.fit === 'smart' && sl._focus) ? reframe.cropFilter(W, H, sl._focus.fx, sl._focus.fy) : `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;
      const cut = it.skip > 0 ? [`trim=start=${it.skip.toFixed(3)}:duration=${it.dur.toFixed(3)}`, 'setpts=PTS-STARTPTS'] : [];
      const head = [fit, ...tw.pre]; let pre = `[${i}:v]${head.join(',')}`;
      if (tw.pingpong) pre += `,split[pa${i}][pb${i}];[pb${i}]reverse[pc${i}];[pa${i}][pc${i}]concat=n=2:v=1:a=0`;
      fc.push(`${pre},${tw.speedPts},fps=${FPS},${tw.post.join(',')}${cut.length ? ',' + cut.join(',') : ''}${cc ? ',' + cc : ''},format=yuv420p[b${i}]`);
    } else {
      const mo = sl.type === 'title' ? 'none' : (sl.motion || S.motion || 'none');
      const fullF = Math.round(it.full * FPS), offF = Math.round(it.skip * FPS);
      const ex = (sl.type !== 'title' && sl.keyframes && sl.keyframes.length >= 2 && kf.keyframeExpr(sl.keyframes, fullF, offF)) || motionExpr(mo, fullF, offF);
      if (ex) {
        const n = Math.max(1, Math.round(it.dur * FPS));
        args.push('-i', it.frame);
        fc.push(`[${i}:v]scale=${W * 2}:${H * 2},zoompan=z='${ex.z}':x='${ex.x}':y='${ex.y}':d=${n}:s=${W}x${H}:fps=${FPS},setsar=1${cc ? ',' + cc : ''},format=yuv420p[b${i}]`);
      } else {
        args.push('-loop', '1', '-framerate', String(FPS), '-t', String(it.dur), '-i', it.frame);
        fc.push(`[${i}:v]scale=${W}:${H},setsar=1,fps=${FPS}${cc ? ',' + cc : ''},format=yuv420p[b${i}]`);
      }
    }
  });
  const ctx = { W, H, supported: names => ff.supportedFilters(names) };
  items.forEach((it, i) => {
    const eff = [...(S.effects || []), ...(it.slide.effects || [])];
    const fus = require('./fusion'); const comp = it.slide.comp && !fus.validate(it.slide.comp) ? it.slide.comp : null;
    const g = fxm.buildGraph(eff, `b${i}`, comp ? `c${i}` : `v${i}`, ctx, `e${i}`); fc.push(...g.stmts);
    if (comp) fc.push(...fus.compile(comp, `c${i}`, `v${i}`, ctx, `n${i}`));
    if (g.skipped.length) skippedFx.push(...g.skipped);
  });
  const n = items.length; let last = '[v0]'; let acc = items[0].dur;
  for (let i = 1; i < n; i++) {
    const off = acc - i * F; const nm = `[x${i}]`;
    fc.push(`${last}[v${i}]xfade=transition=${items[i].trans}:duration=${F}:offset=${off.toFixed(3)}${nm}`);
    last = nm; acc += items[i].dur;
  }
  const tot = acc - (n - 1) * F;
  let post = 'format=yuv420p';
  if (idx === 0) post = `fade=t=in:st=0:d=0.6,` + post;
  if (idx === total - 1) post = `fade=t=out:st=${Math.max(0, tot - 0.8).toFixed(3)}:d=0.8,` + post;
  fc.push(`${last}${post}[vout]`);
  args.push('-filter_complex', fc.join(';'), '-map', '[vout]', '-r', String(FPS), '-c:v', 'libx264', '-preset', S.encoderPreset, '-crf', String(S.crf), '-pix_fmt', 'yuv420p', '-threads', String(S.threads || 0), out);
  await ff.run(args, { signal });
  return { out, dur: tot };
}

// Zerlegt die Folien in Blöcke, die sich über genau eine Überblendung überlappen -> nahtlos beim Zusammenfügen.
function planChunks(slides, S) {
  const F = S.transitionDur, CH = Math.max(2, S.chunk);
  const dur = slides.map(s => Math.max(s.duration || S.defaultSlide, 2 * F + 0.1));
  const chunks = []; let a = 0;
  while (a < slides.length) {
    const b = Math.min(slides.length - 1, a + CH - 1); const items = [];
    for (let i = a; i <= b; i++) {
      const isFirstOfLater = i === a && a > 0;
      items.push({ idx: i, slide: slides[i], full: dur[i], skip: isFirstOfLater ? F : 0, dur: isFirstOfLater ? dur[i] - F : dur[i], trans: pickTransition(slides[i], S, i) });
    }
    if (b + 1 < slides.length) items.push({ idx: b + 1, slide: slides[b + 1], full: dur[b + 1], skip: 0, dur: F, partner: true, trans: pickTransition(slides[b + 1], S, b + 1) });
    chunks.push(items); a = b + 1;
  }
  return chunks;
}

async function buildAudio(videoFile, project, S, tmp, outFile, signal, report) {
  const tracks = (project.audio || []).filter(t => t.src && fs.existsSync(t.src));
  if (!tracks.length) { fs.copyFileSync(videoFile, outFile); return; }
  const D = ff.duration(videoFile); const M = Object.assign({ normalize: true, lufs: -14, fadeIn: 2, fadeOut: 5, cross: 4 }, project.music || {});
  const list = []; let tot = 0; let k = 0;
  while (tot < D + M.cross + 1 && k < 400) { const t = tracks[k % tracks.length]; const d = ff.duration(t.src); if (d <= M.cross + 1) { if (++k > tracks.length * 3) break; continue; } list.push(t); tot += d - (list.length > 1 ? M.cross : 0); k++; }
  if (!list.length) { fs.copyFileSync(videoFile, outFile); return; }
  const args = ['-i', videoFile]; list.forEach(t => args.push('-i', t.src));
  const fc = [];
  list.forEach((t, i) => fc.push(`[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo${M.normalize ? `,loudnorm=I=${M.lufs}:TP=-1.0:LRA=9,aresample=48000` : ''},volume=${t.volume == null ? 1 : t.volume}${t.pan ? `,stereotools=balance_out=${Math.max(-1, Math.min(1, t.pan)).toFixed(2)}` : ''}${(() => { const c = afx.chain(t.effects, n => ff.supportedFilters(n)).chain; return c ? ',' + c : ''; })()}[n${i}]`));
  const masterFx = afx.chain(M.effects, n => ff.supportedFilters(n)).chain;
  let last = '[n0]';
  for (let i = 1; i < list.length; i++) { fc.push(`${last}[n${i}]acrossfade=d=${M.cross}:c1=tri:c2=tri[c${i}]`); last = `[c${i}]`; }
  fc.push(`${last}atrim=0:${D.toFixed(2)},asetpts=PTS-STARTPTS,afade=t=in:d=${M.fadeIn},afade=t=out:st=${Math.max(0, D - M.fadeOut).toFixed(2)}:d=${M.fadeOut}${masterFx ? ',' + masterFx : ''}[mus]`);
  fc.push(...require('./buses').stmts('mus', 'mus2', (project.sends || {}).music, project.buses, e => afx.chain(e, n => ff.supportedFilters(n)).chain, 'bm'));
  const hasVoice = (project.voice || []).some(v => v.src && fs.existsSync(v.src)); const mastV = Math.max(0, Math.min(2, project.master && project.master.volume != null ? +project.master.volume : 1));
  fc.push(`[mus2]${hasVoice || Math.abs(mastV - 1) < 0.001 ? '' : 'volume=' + mastV.toFixed(3) + ','}alimiter=limit=0.95[a]`);
  args.push('-filter_complex', fc.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-shortest', '-movflags', '+faststart', outFile);
  await ff.run(args, { signal, onProgress: t => report && report({ phase: 'audio', value: Math.min(1, t / D) }) });
}

// Sprecher-Spuren über die Musik legen; die Musik wird leiser, solange jemand spricht.
async function mixVoice(inFile, project, S, tmp, outFile, signal) {
  const voice = (project.voice || []).filter(v => v.src && fs.existsSync(v.src));
  if (!voice.length) return inFile;
  const D = ff.duration(inFile), withMusic = ff.hasAudio(inFile);
  const args = ['-i', inFile]; voice.forEach(v => args.push('-i', v.src));
  const fc = voice.map((v, k) => {
    const ms = Math.max(0, Math.round((v.start || 0) * 1000));
    const clean = (v.clean === false ? '' : ',' + cleanChain(v.level || 'mittel')) + (() => { const c = afx.chain(v.effects, n => ff.supportedFilters(n)).chain; return c ? ',' + c : ''; })();
    return `[${k + 1}:a]aresample=48000,aformat=channel_layouts=stereo${clean},adelay=${ms}|${ms},volume=${v.volume == null ? 1 : v.volume}${v.pan ? `,stereotools=balance_out=${Math.max(-1, Math.min(1, v.pan)).toFixed(2)}` : ''}[w${k}]`;
  });
  fc.push(voice.map((_, k) => `[w${k}]`).join('') + `amix=inputs=${voice.length}:normalize=0[vo0]`);
  fc.push(...require('./buses').stmts('vo0', 'vo1b', (project.sends || {}).voice, project.buses, e => afx.chain(e, n => ff.supportedFilters(n)).chain, 'bv'));
  fc.push('[vo1b]alimiter=limit=0.95[vo]');
  const mv = `volume=${Math.max(0, Math.min(2, project.master && project.master.volume != null ? +project.master.volume : 1)).toFixed(3)}`;
  if (withMusic) fc.push(`[vo]asplit=2[vo1][vo2];[0:a][vo2]sidechaincompress=threshold=0.04:ratio=10:attack=15:release=450[duck];[duck][vo1]amix=inputs=2:normalize=0:duration=first,${mv},alimiter=limit=0.95[a]`);
  else fc.push(`[vo]atrim=0:${D.toFixed(2)},asetpts=PTS-STARTPTS,${mv}[a]`);
  args.push('-filter_complex', fc.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', D.toFixed(2), '-movflags', '+faststart', '-f', 'mp4', outFile);
  await ff.run(args, { signal });
  return outFile;
}

// Letzte Schritte: Sprache mischen, Untertitel einbrennen, Codec umwandeln. Gibt den Pfad der fertigen Datei zurück.
async function finalize(stage, project, S, tmp, partBase, signal, report) {
  let cur = await require('./overlays').apply(stage, project.overlays, S, tmp, path.join(tmp, 'overlay.mp4'), { signal });
  cur = await mixVoice(cur, project, S, tmp, path.join(tmp, 'voice.mp4'), signal);
  const sub = project.subtitles;
  if (sub && sub.segments && sub.segments.length) {
    const srt = path.join(tmp, 'untertitel.srt'); fs.writeFileSync(srt, subs.toSrt(sub.segments));
    if (sub.burn !== false && subs.hasSubtitleFilter()) {
      report && report({ phase: 'untertitel' });
      const out = path.join(tmp, 'burn.mp4');
      if (sub.mode === 'karaoke') { const af = path.join(tmp, 'karaoke.ass'); fs.writeFileSync(af, require('./lrc').toAss(sub.segments, Object.assign({ width: S.width, height: S.height }, sub.style))); await subs.burnAss(cur, af, out, { crf: S.crf, signal }); }
      else await subs.burnIn(cur, srt, out, Object.assign({ size: S.height > S.width ? 14 : 16, crf: S.crf, signal }, sub.style)); cur = out;
    }
  }
  const X = xo.normalize(project.export, S); report && report({ phase: 'export' });
  const out = partBase + xo.extFor(X); const srtFile = path.join(tmp, 'untertitel.srt');
  return xo.exportFinal(cur, out, X, S, { srt: fs.existsSync(srtFile) ? srtFile : null, signal });
}

async function renderProject(project, outFile, { onProgress = () => {}, signal, keepTemp = false, concurrency = 2 } = {}) {
  const S = defaults(project);
  const X = xo.normalize(project.export, S); outFile = outFile.replace(/\.[A-Za-z0-9]+$/, xo.extFor(X));
  const slides = (project.slides || []).filter(s => s.type === 'title' || (s.src && fs.existsSync(s.src)));
  if (!slides.length) throw new Error('Keine Folien zum Rendern.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'viola-'));
  const t0 = Date.now();
  try {
    onProgress({ phase: 'frames', done: 0, total: slides.length });
    // 1) Standbilder vorbereiten (parallel)
    let done = 0; const frames = new Array(slides.length); let next = 0;
    async function worker() {
      while (next < slides.length) {
        const i = next++; const sl = slides[i];
        if (sl.type === 'video') { frames[i] = null; if (S.fit === 'smart') sl._focus = await reframe.focusPointVideo(sl.src, S.width, S.height, (sl.trimStart || 0) + 1); }
        else {
          if (sl.type === 'title' && !sl.bgFrom) { const nb = slides.slice(i + 1).find(s => s.type === 'photo'); if (nb) sl.bgFrom = nb.src; }
          const f = path.join(tmp, `f_${i}.jpg`);
          try { await makeFrame(sl, S, f); frames[i] = f; } catch (e) { frames[i] = null; sl._broken = true; }
        }
        done++; if (done % 5 === 0 || done === slides.length) onProgress({ phase: 'frames', done, total: slides.length });
        if (signal && signal.aborted) throw new Error('abgebrochen');
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
    const ok = slides.map((s, i) => ({ s, f: frames[i] })).filter(x => x.s.type === 'video' || x.f);
    const okSlides = ok.map(x => x.s); const okFrames = ok.map(x => x.f);
    // 2) Blöcke rendern
    const chunks = planChunks(okSlides, S);
    chunks.forEach(c => c.forEach(it => { it.frame = okFrames[it.idx]; }));
    const files = [];
    for (let c = 0; c < chunks.length; c++) {
      const r = await renderChunk(chunks[c], S, c, chunks.length, tmp, signal);
      files.push(r.out);
      const el = (Date.now() - t0) / 1000; const frac = (c + 1) / chunks.length;
      onProgress({ phase: 'video', done: c + 1, total: chunks.length, eta: Math.round(el / frac - el) });
    }
    // 3) Zusammenfügen
    const list = path.join(tmp, 'list.txt'); fs.writeFileSync(list, files.map(ff.concatLine).join(''));
    const silent = path.join(tmp, 'silent.mp4');
    await ff.run(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent], { signal });
    // 4) Musik
    onProgress({ phase: 'audio', value: 0 });
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    const stage = path.join(tmp, 'music.mp4');
    await buildAudio(silent, project, S, tmp, stage, signal, onProgress);
    const final = await finalize(stage, project, S, tmp, outFile + '.part', signal, onProgress);
    fs.renameSync(final, outFile);
    { const sx = path.join(tmp, 'untertitel.srt'); const Xo = xo.normalize(project.export, S); if (Xo.sidecarSubs && fs.existsSync(sx)) fs.copyFileSync(sx, outFile.replace(/\.[^.\\/]+$/, '.srt')); }
    onProgress({ phase: 'done', outFile, seconds: Math.round((Date.now() - t0) / 1000) });
    return { outFile, duration: ff.duration(outFile), slides: okSlides.length, skipped: slides.length - okSlides.length };
  } finally {
    if (!keepTemp) fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Gesamtlänge (Sekunden) eines Projekts, ohne zu rendern
function projectDuration(project) {
  const S = defaults(project); const F = S.transitionDur;
  const d = (project.slides || []).map(s => Math.max(s.duration || S.defaultSlide, 2 * F + 0.1));
  return d.length ? d.reduce((a, b) => a + b, 0) - (d.length - 1) * F : 0;
}

module.exports = { skippedFx, renderProject, projectDuration, planChunks, PRESETS, TRANSITIONS, MOTIONS, defaults };

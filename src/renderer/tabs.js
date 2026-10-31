'use strict';
// Reiter: Medien, Musik (mit Beat-Sync), Collage, Upscaler (Video2X), Export + Warteschlange.
const KIND_RE = { photo: /\.(jpe?g|png|webp|bmp|tiff?)$/i, video: /\.(mp4|mov|avi|mkv|mts|m2ts|3gp|wmv|webm)$/i, audio: /\.(mp3|wav|m4a|aac|flac|ogg)$/i };
const kindOfPath = p => KIND_RE.photo.test(p) ? 'photo' : KIND_RE.video.test(p) ? 'video' : KIND_RE.audio.test(p) ? 'audio' : null;
const step = (title, ...kids) => el('div', { class: 'card' }, el('div', { class: 'muted', style: { marginBottom: '6px', color: '#d9b8ff' } }, title), ...kids);
const btn = (label, fn, cls) => el('button', { class: 'btn ' + (cls || ''), onclick: fn }, label);
const bar = () => { const i = el('i'); const b = el('div', { class: 'bar' }, i); b.set = f => { i.style.width = Math.round(Math.max(0, Math.min(1, f)) * 100) + '%'; }; return b; };
const uniq = a => [...new Set(a)];

// ---------------- Medien ----------------
App.tabs.media = {
  sel: new Set(), limit: 400,
  build(p) {
    p.append(el('h2', {}, 'Medien'));
    p.append(el('div', { class: 'row' }, btn('Fotos/Videos hinzufügen', () => this.pick(), 'primary'), btn('Ordner', () => this.folder())));
    p.append(el('div', { class: 'row' }, btn('Titel einfügen', addTitle), btn('Alle zur Zeitleiste', () => this.addAll()), btn('Markierte →', () => this.addSel())));
    this.prog = el('div', { class: 'hint' }); p.append(this.prog);
    this.grid = el('div', { class: 'grid', style: { marginTop: '10px' } }); p.append(this.grid);
    this.more = el('div', { style: { marginTop: '10px', textAlign: 'center' } }); p.append(this.more);
    this.refresh();
  },
  async pick() { const f = await App.api.invoke('dialog:files', 'media'); await this.importPaths(f); },
  async folder() {
    const fs_ = await App.api.invoke('dialog:folder', true); if (!fs_.length) return;
    this.prog.textContent = 'Lese Ordner …'; const stop = App.onEvent(m => { if (m.type === 'scan' && m.id === 'media-scan') this.prog.textContent = `Lese Ordner … ${m.done}/${m.total}`; });
    try {
      const items = await App.api.invoke('scan:start', 'media-scan', fs_, {}); items.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.path.localeCompare(b.path));
      const media = items.filter(i => i.kind !== 'audio'); const aud = items.filter(i => i.kind === 'audio');
      if (media.length > 5000 && !confirm(`${media.length} Dateien gefunden. Alle importieren? (Für ganze Jahre ist der Reiter „Collage" besser.)`)) { this.prog.textContent = ''; return; }
      await this.importPaths(media.map(i => i.path), false); if (aud.length) { P().audio.push(...aud.map(a => ({ src: a.path, volume: 1, duration: 0 }))); await App.tabs.music.probeAll(); }
      this.prog.textContent = `${media.length} Dateien importiert`;
    } catch (e) { toast(e.message, true); this.prog.textContent = ''; } finally { stop(); }
  },
  async importPaths(paths, rerender = true) {
    const have = new Set(S().media.map(m => m.path)); const add = [];
    for (const p of paths) { const k = kindOfPath(p); if (!k || have.has(p)) continue; if (k === 'audio') { P().audio.push({ src: p, volume: 1, duration: 0 }); continue; } add.push({ id: uid(), path: p, kind: k, name: base(p), duration: 0 }); }
    S().media.push(...add); if (rerender) this.refresh();
    if (paths.some(p => kindOfPath(p) === 'audio')) App.tabs.music.probeAll();
    for (const m of add.filter(a => a.kind === 'video')) App.api.invoke('media:probe', m.path).then(r => { m.duration = r.duration; }).catch(() => {});
  },
  refresh() {
    if (!this.grid) return; this.grid.replaceChildren(); const list = S().media;
    if (!list.length) { this.grid.append(el('div', { class: 'empty', style: { gridColumn: '1/-1' } }, 'Noch keine Medien.\nFotos oder Videos hinzufügen oder einen ganzen Ordner einlesen.')); this.more.replaceChildren(); return; }
    list.slice(0, this.limit).forEach(m => {
      const t = el('div', { class: 'thumb' + (this.sel.has(m.id) ? ' sel' : ''), title: m.path, onclick: e => { e.ctrlKey || e.metaKey ? (this.sel.has(m.id) ? this.sel.delete(m.id) : this.sel.add(m.id)) : (this.sel = new Set([m.id])); this.refresh(); }, ondblclick: () => addSlides([m]) },
        m.kind === 'video' ? el('div', { class: 'badge' }, '🎞') : null, el('div', { class: 'lbl' }, m.name));
      thumbUrl(m.path).then(u => { if (u) t.style.backgroundImage = `url("${u}")`; }); this.grid.append(t);
    });
    this.more.replaceChildren(list.length > this.limit ? btn(`Mehr anzeigen (${list.length - this.limit} weitere)`, () => { this.limit += 400; this.refresh(); }, 'small') : el('span', { class: 'hint' }, `${list.length} Dateien · Doppelklick fügt zur Zeitleiste hinzu`));
  },
  addSel() { const m = S().media.filter(x => this.sel.has(x.id)); if (!m.length) return toast('Erst Dateien anklicken (Strg = mehrere).'); addSlides(m); },
  addAll() { if (!S().media.length) return; addSlides(S().media.slice()); },
};

// ---------------- Musik + Beat-Sync ----------------
App.tabs.music = {
  bpm: null, beats: null, every: 2,
  build(p) {
    p.append(el('h2', {}, 'Musik'));
    p.append(el('div', { class: 'row' }, btn('Lieder hinzufügen', () => this.add(), 'primary'), btn('Ordner', () => this.folder())));
    this.list = el('div'); p.append(this.list);
    p.append(el('h3', {}, 'Beat-Sync'));
    this.syncBox = el('div', { class: 'card' }); p.append(this.syncBox); this.refresh();
  },
  async add() { const f = await App.api.invoke('dialog:files', 'audio'); if (!f.length) return; snap(); f.forEach(x => P().audio.push({ src: x, volume: 1, duration: 0 })); await this.probeAll(); },
  async folder() { const d = await App.api.invoke('dialog:folder', false); if (!d.length) return; const items = (await App.api.invoke('scan:start', 'music-scan', d, {})).filter(i => i.kind === 'audio').sort((a, b) => a.path.localeCompare(b.path)); if (!items.length) return toast('Keine Musikdateien gefunden.'); snap(); items.forEach(i => P().audio.push({ src: i.path, volume: 1, duration: 0 })); await this.probeAll(); toast(items.length + ' Lieder hinzugefügt'); },
  async probeAll() { for (const a of P().audio) if (!a.duration) { try { a.duration = (await App.api.invoke('media:probe', a.src)).duration; } catch (_) { a.duration = 180; } } renderAll(); },
  refresh() {
    if (!this.list) return; this.list.replaceChildren();
    if (!P().audio.length) this.list.append(el('div', { class: 'empty' }, 'Noch keine Musik. Die Lieder laufen nacheinander mit Überblendung und werden auf gleiche Lautstärke gebracht.'));
    P().audio.forEach((a, i) => this.list.append(el('div', { class: 'card', style: { padding: '8px 10px' } },
      el('div', { class: 'row', style: { margin: 0 } }, el('b', { style: { flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: a.src }, (i + 1) + '. ' + base(a.src).replace(/\.[^.]+$/, '')), el('span', { class: 'muted', style: { flex: '0 0 auto' } }, a.duration ? fmt(a.duration) : '…'),
        btn('↑', () => { if (i) { snap(); [P().audio[i - 1], P().audio[i]] = [P().audio[i], P().audio[i - 1]]; renderAll(); } }, 'small'), btn('✕', () => { snap(); P().audio.splice(i, 1); renderAll(); }, 'small danger')),
      el('div', { class: 'row', style: { margin: '4px 0 0' } }, el('label', { style: { flex: '0 0 60px' } }, 'Pegel'), el('input', { type: 'range', min: 0.2, max: 1.5, step: 0.05, value: a.volume == null ? 1 : a.volume, onchange: e => { snap(); a.volume = +e.target.value; } })))));
    const total = P().audio.reduce((s, a, i) => s + (a.duration || 0) - (i ? 4 : 0), 0); const need = layout().total;
    this.syncBox.replaceChildren(
      el('p', { class: 'hint' }, `Musik gesamt: ${fmt(total)} · Video: ${fmt(need)}${total && total < need ? ' – Lieder werden wiederholt' : ''}`),
      rowOf('Wechsel auf jeden', sel([[1, '1. Schlag'], [2, '2. Schlag'], [4, '4. Schlag (Takt)']], this.every, v => { this.every = +v; })),
      el('div', { class: 'row' }, btn('Takt analysieren & anwenden', () => this.sync(), 'primary')),
      this.status = el('p', { class: 'hint' }, this.bpm ? `Erkannt: ${this.bpm} BPM – Folienwechsel liegen auf dem Takt von Lied 1.` : 'Analysiert das erste Lied und passt die Foliendauern an den Takt an.'));
  },
  async sync() {
    if (!P().audio.length) return toast('Erst ein Lied hinzufügen.'); if (!P().slides.length) return toast('Erst Folien in die Zeitleiste legen.');
    this.status.textContent = 'Analysiere Takt …';
    try {
      const r = await App.api.invoke('beat:analyze', P().audio[0].src); if (!r.bpm) { this.status.textContent = 'Kein klarer Takt erkannt.'; return; }
      const out = await App.api.invoke('beat:snap', P().slides, r.beats, { every: this.every, transitionDur: P().settings.transitionDur, defaultSlide: P().settings.defaultSlide });
      this.bpm = r.bpm; commit(() => { P().slides.forEach((s, i) => { s.duration = out[i].duration; }); }); toast(`Beat-Sync: ${r.bpm} BPM angewendet`);
    } catch (e) { this.status.textContent = e.message; toast(e.message, true); }
  },
};

// ---------------- Auto-Collage ----------------
App.tabs.collage = {
  folders: [], items: null, dropped: new Set(), years: null, chosen: new Set(),
  o: { perMonth: 0, photoSeconds: 2.5, transitionDur: 0.5, videos: false, dedupe: true, undated: true, monthTitles: true, yearTitle: true, useMusic: true, motion: 'none', concat: true },
  build(p) {
    p.append(el('h2', {}, 'Auto-Collage'));
    p.append(el('p', { class: 'hint' }, 'Liest Ordner ein, sortiert nach Aufnahmedatum in Jahre und Monate, entfernt Duplikate und baut pro Jahr ein Video mit Titeln, Überblendungen und Musik.'));
    this.flist = el('div'); p.append(step('1 · Ordner', this.flist, el('div', { class: 'row' }, btn('Ordner hinzufügen', async () => { const d = await App.api.invoke('dialog:folder', true); d.forEach(x => { if (!this.folders.includes(x)) this.folders.push(x); }); this.refresh(); }, 'primary'))));
    const o = this.o; const chk = (k, l) => el('div', { class: 'row' }, el('label', { style: { flex: '1 1 auto' } }, l), el('input', { type: 'checkbox', checked: !!o[k], style: { flex: '0 0 18px' }, onchange: e => { o[k] = e.target.checked; } }));
    p.append(step('2 · Einstellungen',
      rowOf('Fotos pro Monat', sel([[0, 'Alle'], [5, '5'], [10, '10'], [20, '20'], [50, '50'], [100, '100']], o.perMonth, v => { o.perMonth = +v; })),
      rowOf('Sekunden pro Foto', num(o.photoSeconds, 0.5, 1, v => { o.photoSeconds = v || 2.5; })),
      rowOf('Überblendung (s)', num(o.transitionDur, 0.1, 0.2, v => { o.transitionDur = v || 0.5; })),
      rowOf('Bewegung', sel([['none', 'Keine (schnell)'], ['zoomin', 'Heranzoomen'], ['zoomout', 'Herauszoomen'], ['panleft', 'Schwenk']], o.motion, v => { o.motion = v; }), 'Zoom-Effekt verlängert die Renderzeit deutlich'),
      chk('dedupe', 'Duplikate entfernen (auch ähnliche Bilder)'), chk('undated', 'Fotos ohne Datum als „Weitere Fotos" anhängen'), chk('videos', 'Videos einbeziehen'), chk('monthTitles', 'Titelkarte pro Monat'), chk('yearTitle', 'Titelkarte pro Jahr'), chk('useMusic', 'Musik aus dem Reiter „Musik" verwenden')));
    this.scanBar = bar(); this.status = el('div', { class: 'hint' });
    p.append(step('3 · Einlesen', el('div', { class: 'row' }, btn('Scannen', () => this.scan(), 'primary'), btn('Abbrechen', () => App.api.invoke('job:cancel', 'collage-scan').then(() => App.api.invoke('job:cancel', 'collage-dedupe')), 'small')), this.scanBar, this.status));
    this.ytab = el('div'); p.append(step('4 · Jahre', this.ytab));
    this.refresh();
  },
  refresh() {
    if (!this.flist) return; this.flist.replaceChildren(...(this.folders.length ? this.folders.map(f => el('div', { class: 'row', style: { margin: '2px 0' } }, el('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: f }, f), btn('✕', () => { this.folders = this.folders.filter(x => x !== f); this.refresh(); }, 'small'))) : [el('div', { class: 'empty' }, 'Noch kein Ordner gewählt, z. B. G:\\Fotos')]));
    this.renderYears();
  },
  async scan() {
    if (!this.folders.length) return toast('Erst einen Ordner wählen.');
    this.items = null; this.years = null; this.dropped = new Set(); this.renderYears(); this.scanBar.set(0); this.status.textContent = 'Lese Dateien und Aufnahmedaten …';
    const stop = App.onEvent(m => { if (m.type === 'scan' && m.id === 'collage-scan') { this.scanBar.set(m.done / Math.max(1, m.total) * (this.o.dedupe ? 0.4 : 1)); this.status.textContent = `Lese Dateien … ${m.done}/${m.total}`; } if (m.type === 'dedupe' && m.id === 'collage-dedupe') { this.scanBar.set(0.4 + 0.6 * m.done / Math.max(1, m.total)); this.status.textContent = `Suche Duplikate … ${m.done}/${m.total}`; } });
    try {
      this.items = (await App.api.invoke('scan:start', 'collage-scan', this.folders, {})).filter(i => i.kind !== 'audio');
      if (this.o.dedupe) { const photos = this.items.filter(i => i.kind === 'photo' && i.size > 80000); const r = await App.api.invoke('dedupe:run', 'collage-dedupe', photos, { threshold: 5 }); this.dropped = new Set(r.dropped); }
      this.scanBar.set(1); this.compute(); this.status.textContent = `${this.items.length} Dateien · ${this.dropped.size} Duplikate aussortiert`;
    } catch (e) { this.status.textContent = e.message; if (e.message !== 'abgebrochen') toast(e.message, true); } finally { stop(); }
  },
  keep() { return this.items.filter(i => !this.dropped.has(i.path)); },
  opts() { const o = this.o; return { perMonth: o.perMonth, photoSeconds: o.photoSeconds, transitionDur: o.transitionDur, videos: o.videos, includeUndated: o.undated, monthTitles: o.monthTitles, yearTitle: o.yearTitle, motion: o.motion, preset: P().settings.preset, transition: P().settings.transition === 'random' ? 'random' : 'fade', audio: o.useMusic ? JSON.parse(JSON.stringify(P().audio)) : [], music: P().music }; },
  async compute() {
    const info = await App.api.invoke('collage:years', this.keep(), { includeUndated: this.o.undated, assumeYear: null }); this.years = info;
    const dropByYear = {}; this.items.forEach(i => { if (this.dropped.has(i.path) && i.date) { const y = new Date(i.date).getFullYear(); dropByYear[y] = (dropByYear[y] || 0) + 1; } }); this.dropByYear = dropByYear;
    this.chosen = new Set(Object.keys(info).map(Number)); this.renderYears();
  },
  estimate(y) { const o = this.o; const n = this.o.perMonth ? Math.min(y.dated, this.o.perMonth * y.months) : y.dated; return n * o.photoSeconds + y.months * 3.5; },
  renderYears() {
    if (!this.ytab) return; this.ytab.replaceChildren();
    if (!this.years) { this.ytab.append(el('div', { class: 'empty' }, 'Nach dem Scannen erscheinen hier die Jahre.')); return; }
    const ys = Object.keys(this.years).map(Number).sort(); if (!ys.length) { this.ytab.append(el('div', { class: 'empty' }, 'Keine datierten Fotos gefunden.')); return; }
    const t = el('table', { class: 'yt' }, el('tr', {}, el('th', {}, ''), el('th', {}, 'Jahr'), el('th', {}, 'Monate'), el('th', {}, 'Fotos'), el('th', {}, 'ohne Datum'), el('th', {}, 'Dupl.'), el('th', {}, 'Länge')));
    ys.forEach(y => { const i = this.years[y]; t.append(el('tr', {}, el('td', {}, el('input', { type: 'checkbox', checked: this.chosen.has(y), onchange: e => { e.target.checked ? this.chosen.add(y) : this.chosen.delete(y); } })), el('td', {}, el('b', {}, y)), el('td', {}, i.months), el('td', {}, i.dated.toLocaleString('de-DE')), el('td', {}, i.undated.toLocaleString('de-DE')), el('td', {}, (this.dropByYear[y] || 0)), el('td', {}, fmt(this.estimate(i))))); });
    this.ytab.append(t);
    const tot = ys.filter(y => this.chosen.has(y)).reduce((s, y) => s + this.estimate(this.years[y]), 0);
    this.ytab.append(el('p', { class: 'hint' }, `Ausgewählt: ${this.chosen.size} Jahre · ca. ${fmt(tot)} Video`));
    this.ytab.append(el('div', { class: 'row' }, btn('Ein Jahr in die Zeitleiste', () => this.loadOne(), 'small'), btn('Jahre rendern', () => this.renderChosen(), 'primary')));
    this.ytab.append(el('div', { class: 'row' }, el('label', { style: { flex: '1 1 auto' } }, 'Danach zu einem Gesamtvideo zusammenfügen'), el('input', { type: 'checkbox', checked: this.o.concat, style: { flex: '0 0 18px' }, onchange: e => { this.o.concat = e.target.checked; } })));
  },
  async loadOne() {
    const ys = [...this.chosen].sort(); if (ys.length !== 1) return toast('Für die Zeitleiste genau ein Jahr ankreuzen.');
    const pr = await App.api.invoke('collage:build', this.keep(), ys[0], this.opts()); if (!pr) return toast('Keine Fotos für dieses Jahr.');
    if (P().slides.length && !confirm('Die aktuelle Zeitleiste durch dieses Jahr ersetzen?')) return;
    commit(() => { const keepAudio = P().audio; App.state.project = Object.assign(blankProject(), pr, { audio: this.o.useMusic ? keepAudio : [], name: pr.name }); App.state.project.slides.forEach(s => { s.id = uid(); }); S().selected.clear(); S().t = 0; }); toast(`${pr.slides.length} Folien für ${ys[0]} geladen`);
  },
  async renderChosen() {
    const ys = [...this.chosen].sort(); if (!ys.length) return toast('Kein Jahr ausgewählt.');
    const dir = App.settings.outDir; const jobs = [];
    for (const y of ys) {
      const pr = await App.api.invoke('collage:build', this.keep(), y, this.opts()); if (!pr) continue; pr.slides.forEach(s => { s.id = uid(); });
      jobs.push(App.queue.addRender({ title: `Jahr ${y}`, project: pr, outFile: dir + (dir.includes('\\') ? '\\' : '/') + `Jahr_${y}.mp4` }));
    }
    if (this.o.concat && jobs.length > 1) App.queue.concatAfter = { jobs, out: dir + (dir.includes('\\') ? '\\' : '/') + 'Gesamt_' + ys[0] + '-' + ys[ys.length - 1] + '.mp4' };
    toast(`${jobs.length} Jahre in der Warteschlange`); App.showTab('export');
  },
};

// ---------------- Upscaler (Video2X) ----------------
App.tabs.upscale = {
  o: { filter: 'realesrgan', model: 'realesrgan-plus', scale: 4, gpu: '', codec: 'libx264', crf: 16, scope: 'flagged', photos: true, videos: true, apply: true },
  det: null, running: false,
  build(p) {
    p.append(el('h2', {}, 'Upscaler (Video2X)'));
    p.append(el('p', { class: 'hint' }, 'Verbessert Fotos und Videos mit KI. Das Programm startet Video2X im Hintergrund; die Ergebnisse werden zwischengespeichert, jede Datei wird nur einmal berechnet.'));
    this.stat = el('div'); p.append(step('Video2X', this.stat));
    const o = this.o; const F = App.info.filters;
    this.optBox = el('div'); p.append(step('Einstellungen', this.optBox));
    this.scopeBox = el('div'); p.append(step('Was soll verbessert werden?', this.scopeBox));
    this.jobBox = el('div'); p.append(this.jobBox);
    this.checkVideo2x(); this.refresh();
  },
  async checkVideo2x() {
    this.det = await App.api.invoke('v2x:detect'); if (!this.stat) return; this.stat.replaceChildren(
      this.det.found ? el('div', {}, el('span', { class: 'tag ok' }, 'gefunden'), ' ', el('span', { class: 'muted' }, this.det.version || this.det.exe)) : el('div', {}, el('span', { class: 'tag err' }, 'nicht gefunden'), el('p', { class: 'hint' }, 'Bitte die video2x.exe auswählen (z. B. unter %LOCALAPPDATA%\\Programs\\video2x).')),
      el('div', { class: 'row' }, btn('video2x.exe wählen …', async () => { const f = await App.api.invoke('dialog:files', 'exe'); if (f[0]) { App.settings = await App.api.invoke('settings:set', { video2xPath: f[0] }); this.checkVideo2x(); } }, 'small'), btn('Neu suchen', () => this.checkVideo2x(), 'small')));
  },
  refresh() {
    if (!this.optBox) return; const o = this.o, F = App.info.filters, fd = F[o.filter];
    this.optBox.replaceChildren(
      rowOf('Verfahren', sel(Object.entries(F).map(([k, v]) => [k, (v.group ? v.group + " · " : "") + v.label]), o.filter, v => { o.filter = v; o.model = F[v].models[0]; if (F[v].scales.length && !F[v].scales.includes(o.scale)) o.scale = F[v].scales[F[v].scales.length - 1]; this.refresh(); })),
      rowOf('Modell', sel(fd.models.map(m => [m, m]), o.model, v => { o.model = v; })),
      fd.scales.length ? rowOf('Vergrößerung', sel(fd.scales.map(s => [s, s + '×']), o.scale, v => { o.scale = +v; })) : rowOf('Zielgröße', sel([['3840x2160', '4K (3840×2160)'], ['2560x1440', '1440p'], ['1920x1080', 'Full HD']], (o.width || 3840) + 'x' + (o.height || 2160), v => { [o.width, o.height] = v.split('x').map(Number); })),
      rowOf('Grafikkarte (Nr.)', el('input', { type: 'text', value: o.gpu, placeholder: 'leer = automatisch', onchange: e => { o.gpu = e.target.value.trim(); } }), 'Nummer laut „video2x --list-gpus"'),
      rowOf('Video-Codec', sel([['libx264', 'H.264 (kompatibel)'], ['libx265', 'H.265 (kleiner)']], o.codec, v => { o.codec = v; })),
      rowOf('Video-Qualität (CRF)', num(o.crf, 1, 10, v => { o.crf = v || 16; }), 'Kleiner = besser/größer (16–20 üblich)'));
    const sl = P().slides.filter(s => s.type !== 'title'); const fl = sl.filter(s => s.upscale);
    this.scopeBox.replaceChildren(
      rowOf('Auswahl', sel([['flagged', `Markierte Folien (${fl.length})`], ['all', `Alle Fotos/Videos der Zeitleiste (${sl.length})`]], o.scope, v => { o.scope = v; })),
      el('div', { class: 'row' }, el('label', { style: { flex: '1 1 auto' } }, 'Fotos'), el('input', { type: 'checkbox', checked: o.photos, style: { flex: '0 0 18px' }, onchange: e => { o.photos = e.target.checked; } })),
      el('div', { class: 'row' }, el('label', { style: { flex: '1 1 auto' } }, 'Videos'), el('input', { type: 'checkbox', checked: o.videos, style: { flex: '0 0 18px' }, onchange: e => { o.videos = e.target.checked; } })),
      el('div', { class: 'row' }, el('label', { style: { flex: '1 1 auto' } }, 'Ergebnis automatisch im Projekt verwenden'), el('input', { type: 'checkbox', checked: o.apply, style: { flex: '0 0 18px' }, onchange: e => { o.apply = e.target.checked; } })),
      el('div', { class: 'row' }, btn(this.running ? 'Läuft …' : 'Hochskalieren starten', () => this.start(), 'primary'), btn('Abbrechen', () => App.api.invoke('job:cancel', 'v2x-job'), 'small')),
      el('p', { class: 'hint' }, 'Tipp: In der Zeitleiste Folien anklicken und im Inspektor „KI-Hochskalieren" aktivieren.'));
  },
  async start() {
    if (this.running) return; const o = this.o;
    let sl = P().slides.filter(s => s.type !== 'title' && s.src); if (o.scope === 'flagged') sl = sl.filter(s => s.upscale);
    sl = sl.filter(s => (s.type === 'photo' && o.photos) || (s.type === 'video' && o.videos)); const paths = uniq(sl.map(s => s.src));
    if (!paths.length) return toast('Keine passenden Folien. Erst Folien markieren oder „Alle" wählen.');
    if (!this.det || !this.det.found) { await this.checkVideo2x(); if (!this.det.found) return toast('Video2X wurde nicht gefunden.', true); }
    this.running = true; this.refresh(); const box = this.jobBox; box.replaceChildren(); const cur = el('div', { class: 'job' }, el('div', { class: 'top' }, el('b', {}, 'Video2X'), el('span', { class: 'tag' }, 'läuft')), el('div', { class: 'muted', id: 'v2xcur' }, ''), (this.pb = bar())); box.append(cur);
    const stop = App.onEvent(m => { if (m.type !== 'v2x' || m.id !== 'v2x-job') return; const name = base(m.input); $('#v2xcur').textContent = `${m.index + 1}/${m.total} · ${name}${m.state === 'cached' ? ' (bereits fertig)' : ''}${m.state === 'error' ? ' – Fehler: ' + (m.error || '').slice(0, 160) : ''}`; this.pb.set((m.index + (m.percent || (m.state === 'done' || m.state === 'cached' ? 100 : 0)) / 100) / m.total); });
    try {
      const opts = { filter: o.filter, model: o.model, scale: o.scale, width: o.width, height: o.height, gpu: o.gpu, codec: o.codec, crf: o.crf };
      const map = await App.api.invoke('v2x:run', 'v2x-job', paths.map(p => ({ path: p })), opts); const n = Object.keys(map).length;
      if (o.apply && n) commit(() => { P().slides.forEach(s => { if (s.src && map[s.src]) { s.origSrc = s.src; s.src = map[s.src]; s.upscale = false; } }); });
      toast(`${n} von ${paths.length} Dateien hochskaliert${o.apply ? ' und im Projekt übernommen' : ''}`); cur.querySelector('.tag').textContent = 'fertig'; cur.querySelector('.tag').className = 'tag ok';
    } catch (e) { toast(e.message, e.message !== 'abgebrochen'); cur.querySelector('.tag').textContent = e.message === 'abgebrochen' ? 'abgebrochen' : 'Fehler'; cur.querySelector('.tag').className = 'tag err'; }
    finally { stop(); this.running = false; this.refresh(); }
  },
};

// ---------------- Export + Warteschlange ----------------
App.queue = {
  jobs: [], running: false, concatAfter: null,
  addRender({ title, project, outFile }) { const j = { id: 'job-' + uid(), kind: 'render', title, project: JSON.parse(JSON.stringify(project)), outFile, state: 'wartet', frac: 0, phase: 'wartet' }; this.jobs.push(j); this.refreshUI(); this.pump(); return j; },
  async pump() {
    if (this.running) return; const j = this.jobs.find(x => x.state === 'wartet'); if (!j) { this.maybeConcat(); return; }
    this.running = true; j.state = 'läuft'; this.refreshUI();
    try {
      if (j.project.slides.some(s => s.upscale)) toast('Hinweis: Folien mit „KI-Hochskalieren" wurden noch nicht per Video2X verbessert (Reiter „Upscaler").');
      const r = await App.api.invoke('render:start', j.id, j.project, j.outFile); j.state = 'fertig'; j.frac = 1; j.result = r; j.phase = `${fmt(r.duration)} · ${r.slides} Folien`;
    } catch (e) { j.state = e.message === 'abgebrochen' ? 'abgebrochen' : 'Fehler'; j.phase = e.message.slice(0, 200); }
    this.running = false; this.refreshUI(); this.pump();
  },
  async maybeConcat() {
    const c = this.concatAfter; if (!c || this.jobs.some(j => c.jobs.includes(j) && (j.state === 'wartet' || j.state === 'läuft'))) return; this.concatAfter = null;
    const ok = c.jobs.filter(j => j.state === 'fertig').map(j => j.outFile); if (ok.length < 2) return;
    try { toast('Füge Jahresvideos zusammen …'); const r = await App.api.invoke('render:concat', 'concat-' + uid(), ok, c.out); toast(`Gesamtvideo fertig: ${fmt(r.duration)}`); this.jobs.push({ id: 'done-' + uid(), kind: 'concat', title: 'Gesamtvideo', outFile: c.out, state: 'fertig', frac: 1, phase: fmt(r.duration) }); this.refreshUI(); } catch (e) { toast('Zusammenfügen fehlgeschlagen: ' + e.message, true); }
  },
  onEvent(m) {
    if (m.type !== 'render') return; const j = this.jobs.find(x => x.id === m.id); if (!j) return;
    if (m.phase === 'frames') { j.frac = 0.2 * m.done / Math.max(1, m.total); j.phase = `Bilder vorbereiten ${m.done}/${m.total}`; }
    else if (m.phase === 'video') { j.frac = 0.2 + 0.7 * m.done / Math.max(1, m.total); j.phase = `Video rendern ${m.done}/${m.total} Blöcke${m.eta != null ? ' · noch ca. ' + fmt(m.eta) : ''}`; }
    else if (m.phase === 'audio') { j.frac = 0.9 + 0.1 * (m.value || 0); j.phase = 'Musik abmischen'; }
    this.refreshUI(true);
  },
  cancel(j) { if (j.state === 'läuft') App.api.invoke('job:cancel', j.id); else { j.state = 'abgebrochen'; this.refreshUI(); } },
  refreshUI(light) { const t = App.tabs.export; if (t && t.qbox && S().tab === 'export') t.renderQueue(); },
};
App.tabs.export = {
  build(p) {
    p.append(el('h2', {}, 'Exportieren'));
    const dir = App.settings.outDir; const pr = P().settings;
    this.info = el('p', { class: 'hint' });
    p.append(step('Ziel', rowOf('Ordner', el('div', { style: { display: 'flex', gap: '6px' } }, el('input', { type: 'text', value: dir, id: 'outDir', onchange: async e => { App.settings = await App.api.invoke('settings:set', { outDir: e.target.value }); } }), btn('…', async () => { const d = await App.api.invoke('dialog:folder', false); if (d[0]) { App.settings = await App.api.invoke('settings:set', { outDir: d[0] }); $('#outDir').value = d[0]; } }, 'small'))),
      rowOf('Dateiname', el('input', { type: 'text', value: (P().name || 'Collage').replace(/[\\/:*?"<>|]/g, '_'), id: 'outName' })),
      rowOf('Qualität', sel(Object.entries(App.info.presets).map(([k, v]) => [k, (v.group ? v.group + " · " : "") + v.label]), pr.preset, v => { snap(); P().settings.preset = v; this.refresh(); })), this.info));
    p.append(el('div', { class: 'row' }, btn('Jetzt rendern', () => this.go(), 'primary'), btn('Alle fertigen zusammenfügen', () => this.mergeDone(), 'small')));
    p.append(el('h3', {}, 'Warteschlange')); this.qbox = el('div'); p.append(this.qbox); this.refresh(); this.renderQueue();
  },
  refresh() { if (!this.info) return; const { total } = layout(); const pr = P().settings.preset; const k = { klein: 0.28, '720p': 0.45, '1080p': 0.9, '4k': 2.8 }[pr] || 0.5; this.info.textContent = `Länge ${fmt(total)} · ${P().slides.length} Folien · ca. ${(total * k / 8 * 1).toFixed(0)} MB (grobe Schätzung für Fotos, Videoclips werden größer)`; },
  go() {
    if (!P().slides.length) return toast('Die Zeitleiste ist leer.'); const dir = $('#outDir').value.trim(); const name = ($('#outName').value.trim() || 'Collage').replace(/\.mp4$/i, '');
    App.queue.addRender({ title: name, project: P(), outFile: dir + (dir.includes('\\') ? '\\' : '/') + name + '.mp4' }); toast('Zur Warteschlange hinzugefügt');
  },
  async mergeDone() {
    const done = App.queue.jobs.filter(j => j.kind === 'render' && j.state === 'fertig'); if (done.length < 2) return toast('Mindestens zwei fertige Videos nötig.');
    const dir = $('#outDir').value.trim(); const out = dir + (dir.includes('\\') ? '\\' : '/') + 'Gesamt.mp4';
    try { const r = await App.api.invoke('render:concat', 'concat-' + uid(), done.map(j => j.outFile), out); toast('Gesamtvideo: ' + fmt(r.duration)); App.queue.jobs.push({ id: 'done-' + uid(), kind: 'concat', title: 'Gesamtvideo', outFile: out, state: 'fertig', frac: 1, phase: fmt(r.duration) }); this.renderQueue(); } catch (e) { toast(e.message, true); }
  },
  renderQueue() {
    if (!this.qbox) return; this.qbox.replaceChildren(); const jobs = App.queue.jobs;
    if (!jobs.length) { this.qbox.append(el('div', { class: 'empty' }, 'Noch keine Aufträge.')); return; }
    jobs.forEach(j => { const b = bar(); b.set(j.frac); const cls = j.state === 'fertig' ? 'ok' : j.state === 'Fehler' ? 'err' : j.state === 'läuft' ? '' : 'warn';
      this.qbox.append(el('div', { class: 'job' }, el('div', { class: 'top' }, el('b', {}, j.title), el('span', { class: 'tag ' + cls }, j.state)), b, el('div', { class: 'hint' }, j.phase || ''),
        el('div', { class: 'row', style: { marginTop: '6px' } }, j.state === 'fertig' ? btn('Im Ordner zeigen', () => App.api.invoke('shell:reveal', j.outFile), 'small') : null, j.state === 'fertig' ? btn('Öffnen', () => App.api.invoke('shell:open', j.outFile), 'small') : null, (j.state === 'läuft' || j.state === 'wartet') ? btn('Abbrechen', () => App.queue.cancel(j), 'small danger') : btn('Entfernen', () => { App.queue.jobs = App.queue.jobs.filter(x => x !== j); this.renderQueue(); }, 'small'))));
    });
  },
};
App.onEvent(m => App.queue.onEvent(m));

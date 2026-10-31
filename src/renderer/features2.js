'use strict';
// Viola – neue Reiter: Untertitel (Whisper) und Sprache (Bereinigen, Sprecher über Musik).
Object.assign(ICONS, {
  subs: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 11h4M13 11h4M7 15h7"/>',
  audio: '<path d="M3 10v4M7 7v10M11 4v16M15 8v8M19 10v4"/>',
});
App.railTabs.splice(3, 0, ['audio', 'Sprache'], ['subs', 'Untertitel']);
const subsOf = () => (P().subtitles = P().subtitles || { segments: [], burn: true, style: {} });
const voiceOf = () => (P().voice = P().voice || []);
const fileRow = (value, onpick, id) => el('div', { style: { display: 'flex', gap: '6px' } }, el('input', { type: 'text', value: value || '', id, onchange: e => onpick(e.target.value) }), btn('…', async () => { const f = await App.api.invoke('dialog:files', 'media'); if (f[0]) onpick(f[0]); }, 'small'));
const tcs = t => { const m = Math.floor(t / 60), s = (t % 60).toFixed(1); return m + ':' + s.padStart(4, '0'); };

App.tabs.subs = {
  src: '',
  build(p) {
    p.append(el('h2', {}, 'Untertitel'));
    const sb = subsOf(); const w = App.settings.whisper || {};
    const setW = async patch => { App.settings = await App.api.invoke('settings:set', { whisper: Object.assign({}, App.settings.whisper, patch) }); };
    p.append(step('Spracherkennung einrichten (einmalig)',
      rowOf('Programm', sel([['cpp', 'whisper.cpp (whisper-cli.exe)'], ['python', 'Python mit faster-whisper']], w.engine || 'cpp', v => setW({ engine: v }))),
      rowOf(w.engine === 'python' ? 'python.exe' : 'whisper-cli', fileRow(w.exe, async v => { await setW({ exe: v }); App.showTab('subs'); }, 'wExe')),
      rowOf(w.engine === 'python' ? 'Modell' : 'Modell (.bin)', w.engine === 'python' ? txt(w.model || 'small', v => setW({ model: v }), 'small, medium, large-v3') : fileRow(w.model, async v => { await setW({ model: v }); App.showTab('subs'); })),
      rowOf('Sprache', sel([['de', 'Deutsch'], ['en', 'Englisch'], ['auto', 'Automatisch']], w.language || 'de', v => setW({ language: v }))),
      el('div', { class: 'hint' }, 'Alles läuft lokal auf deinem PC. Das Lyrics-Tool mit WhisperX kann dieselbe Python-Umgebung nutzen.')));
    const list = el('div'); this.list = list;
    p.append(step('Sprache erkennen',
      rowOf('Datei', fileRow(this.src, v => { this.src = v; App.showTab('subs'); }, 'sSrc'), 'Video oder Audio mit Sprache'),
      el('div', { class: 'row' }, btn('Untertitel erzeugen', () => this.run(), 'primary'), btn('SRT öffnen', async () => { const s = await App.api.invoke('subs:openSrt'); if (s) { snap(); sb.segments = s; this.refresh(); } }, 'small')),
      this.status = el('div', { class: 'hint' })));
    p.append(step('Im Video',
      rowOf('Einbrennen', el('input', { type: 'checkbox', checked: sb.burn !== false, onchange: e => { snap(); sb.burn = e.target.checked; } }), 'Untertitel beim Rendern ins Bild schreiben'),
      rowOf('Schriftgröße', num(sb.style.size || '', 1, 6, v => { snap(); sb.style = Object.assign({}, sb.style, { size: v || undefined }); }), 'leer = automatisch'),
      rowOf('Zeitversatz (s)', num(0, 0.1, -600, v => { if (!v) return; snap(); sb.segments = sb.segments.map(s => ({ start: Math.max(0, s.start + v), end: Math.max(0.1, s.end + v), text: s.text })); this.refresh(); }), 'verschiebt alle Untertitel'),
      el('div', { class: 'row' }, btn('SRT speichern', async () => { if (!sb.segments.length) return toast('Noch keine Untertitel.'); const f = await App.api.invoke('subs:saveSrt', sb.segments, (P().name || 'Untertitel') + '.srt'); if (f) toast('Gespeichert: ' + base(f)); }, 'small'), btn('Alle löschen', () => { snap(); sb.segments = []; this.refresh(); }, 'small danger'))));
    p.append(el('h3', {}, 'Texte bearbeiten'), list); this.refresh();
    App.api.invoke('subs:available').then(a => { if (!a.burn) p.append(el('div', { class: 'hint', style: { color: '#fbbf24' } }, 'Dieses FFmpeg kann Untertitel nicht einbrennen. Die SRT-Datei wird trotzdem gespeichert.')); });
  },
  async run() {
    if (!this.src) return toast('Erst eine Datei wählen.'); const id = 'subs-' + uid(); this.status.textContent = 'Läuft … (bei langen Videos dauert das einige Minuten)';
    const stop = App.onEvent(m => { if (m.type === 'subs' && m.id === id) this.status.textContent = m.phase === 'audio' ? 'Audio wird vorbereitet …' : 'Sprache wird erkannt …'; });
    try { const segs = await App.api.invoke('subs:transcribe', id, this.src); snap(); subsOf().segments = segs; this.status.textContent = segs.length + ' Untertitel erkannt'; this.refresh(); }
    catch (e) { this.status.textContent = ''; toast(e.message, true); } finally { stop(); }
  },
  refresh() {
    if (!this.list) return; this.list.replaceChildren(); const segs = subsOf().segments;
    if (!segs.length) { this.list.append(el('div', { class: 'empty' }, 'Noch keine Untertitel.')); return; }
    segs.slice(0, 300).forEach((s, i) => this.list.append(el('div', { class: 'card', style: { padding: '8px' } },
      el('div', { class: 'row', style: { margin: 0 } }, el('span', { class: 'hint', style: { flex: '0 0 auto' } }, `${tcs(s.start)} – ${tcs(s.end)}`), btn('✕', () => { snap(); segs.splice(i, 1); this.refresh(); }, 'small')),
      el('textarea', { rows: 2, onchange: e => { snap(); s.text = e.target.value; } }, s.text))));
    if (segs.length > 300) this.list.append(el('div', { class: 'hint' }, `… und ${segs.length - 300} weitere (im Video enthalten)`));
  },
};

App.tabs.audio = {
  src: '', level: 'mittel',
  build(p) {
    p.append(el('h2', {}, 'Sprache und Ton'));
    p.append(el('div', { class: 'hint', style: { marginBottom: '8px' } }, 'Sprecher werden über die Musik gelegt. Die Musik wird automatisch leiser, solange jemand spricht.'));
    this.vbox = el('div'); p.append(el('div', { class: 'row' }, btn('Sprecher-Spur hinzufügen', async () => { const f = await App.api.invoke('dialog:files', 'media'); if (!f.length) return; snap(); f.forEach(x => voiceOf().push({ src: x, start: 0, volume: 1, clean: true, level: 'mittel' })); this.refresh(); }, 'primary')), this.vbox);
    const stat = el('div', { class: 'hint' });
    p.append(step('Sprachaufnahme bereinigen',
      el('div', { class: 'hint' }, 'Entfernt Rauschen und Brummen und gleicht die Lautstärke an. Das Ergebnis wird als eigene Datei gespeichert.'),
      rowOf('Datei', fileRow(this.src, v => { this.src = v; App.showTab('audio'); })),
      rowOf('Stärke', sel(Object.entries({ leicht: 'Leicht', mittel: 'Mittel', stark: 'Stark' }), this.level, v => { this.level = v; })),
      el('div', { class: 'row' }, btn('Bereinigen und speichern', async () => {
        if (!this.src) return toast('Erst eine Datei wählen.'); const out = await App.api.invoke('dialog:saveAudio', base(this.src).replace(/\.[^.]+$/, '') + '_bereinigt.m4a'); if (!out) return;
        stat.textContent = 'Läuft …'; try { await App.api.invoke('audio:clean', 'clean-' + uid(), this.src, out, { level: this.level }); stat.textContent = ''; toast('Fertig: ' + base(out)); App.api.invoke('shell:reveal', out); } catch (e) { stat.textContent = ''; toast(e.message, true); }
      }, 'primary')), stat));
    this.refresh();
  },
  refresh() {
    if (!this.vbox) return; this.vbox.replaceChildren(); const v = voiceOf();
    if (!v.length) { this.vbox.append(el('div', { class: 'empty' }, 'Noch keine Sprecher-Spur.')); return; }
    v.forEach((t, i) => this.vbox.append(el('div', { class: 'card' },
      el('div', { class: 'row', style: { margin: 0 } }, el('b', {}, base(t.src)), btn('✕', () => { snap(); v.splice(i, 1); this.refresh(); }, 'small')),
      rowOf('Startet bei (s)', num(t.start, 0.5, 0, x => { snap(); t.start = x || 0; })),
      rowOf('Lautstärke', num(t.volume, 0.1, 0, x => { snap(); t.volume = x; })),
      rowOf('Bereinigen', el('input', { type: 'checkbox', checked: t.clean !== false, onchange: e => { snap(); t.clean = e.target.checked; } })),
      rowOf('Stärke', sel([['leicht', 'Leicht'], ['mittel', 'Mittel'], ['stark', 'Stark']], t.level || 'mittel', x => { snap(); t.level = x; })))));
  },
};

// Start (zuerst Looks laden, dann die Oberfläche)
(async () => { App.looks = await App.api.invoke('looks:list'); App.proxies = {}; await App.init(); })()
  .catch(e => { document.body.append(el('pre', { style: { position: 'fixed', inset: '20px', background: '#300', color: '#fcc', padding: '20px', zIndex: 999, whiteSpace: 'pre-wrap' } }, 'Startfehler: ' + (e.stack || e))); });

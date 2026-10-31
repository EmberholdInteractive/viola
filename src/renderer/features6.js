'use strict';
// Viola – Anbindung an RaLyrics (Lyrics aus Songs) und RaSing (mitsingen): Programme starten, Lyrics als Untertitel/Karaoke ins Video übernehmen.
Object.assign(ICONS, { lyrics: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/><path d="M4 4h3M4 8h3"/>' });
App.railTabs.splice(5, 0, ['lyrics', 'Lyrics']);
App.tabs.lyrics = {
  mode: 'lyrics', words: true, color: '#ffffff', sung: '#d946ef',
  build(p) {
    const st = el('div', { class: 'hint' });
    p.append(el('h2', {}, 'Lyrics und Karaoke'));
    p.append(step('Deine Programme',
      el('div', { class: 'hint' }, 'RaLyrics erstellt aus einem Lied zeitgenaue Lyrics (.lrc). RaSing spielt Musik und zeigt den Text zum Mitsingen.'),
      rowOf('Ordner', el('input', { type: 'text', value: App.settings.toolsDir || 'E:\\Dev\\whisperx', onchange: async e => { App.settings = await App.api.invoke('settings:set', { toolsDir: e.target.value.trim() }); } })),
      el('div', { class: 'row' },
        btn('RaLyrics öffnen', async () => { const r = await App.api.invoke('tools:launch', 'ralyrics'); toast(r.ok ? 'RaLyrics gestartet' : r.error, !r.ok); }, 'primary'),
        btn('RaSing öffnen', async () => { const r = await App.api.invoke('tools:launch', 'rasing'); toast(r.ok ? 'RaSing gestartet' : r.error, !r.ok); }))));
    const apply = (lines, label) => {
      if (!lines.length) return toast('Keine Lyrics gefunden.', true); snap();
      P().subtitles = { segments: lines, mode: this.mode === 'karaoke' ? 'karaoke' : 'text', burn: true, style: this.mode === 'karaoke' ? { color: this.color.replace('#', ''), sung: this.sung.replace('#', '') } : undefined };
      renderAll(); st.textContent = `${lines.length} Zeilen übernommen (${label}). Sie werden beim Rendern ins Bild geschrieben.`; toast(lines.length + ' Lyrics-Zeilen übernommen');
    };
    const miss = el('div', { class: 'hint' });
    p.append(step('Lyrics im Video',
      rowOf('Darstellung', sel([['text', 'Normaler Untertitel'], ['karaoke', 'Karaoke (Wort für Wort gefärbt)']], this.mode === 'karaoke' ? 'karaoke' : 'text', v => { this.mode = v; })),
      rowOf('Textfarbe', el('input', { type: 'color', value: this.color, onchange: e => { this.color = e.target.value; } })),
      rowOf('Gesungen (Karaoke)', el('input', { type: 'color', value: this.sung, onchange: e => { this.sung = e.target.value; } })),
      el('div', { class: 'row' }, el('label', { style: { flex: '1 1 auto' } }, 'Wortzeiten nutzen (.words.lrc), wenn vorhanden'), el('input', { type: 'checkbox', checked: this.words, onchange: e => { this.words = e.target.checked; } })),
      el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } },
        btn('Lyrics zur Projektmusik laden', async () => {
          if (!P().audio.length) return toast('Erst ein Lied hinzufügen.', true);
          const r = await App.api.invoke('lrc:forMusic', P(), layout().total, { words: this.words });
          miss.textContent = r.missing.length ? `Keine Lyrics gefunden für: ${r.missing.map(base).join(', ')}. Mit RaLyrics erstellen.` : '';
          apply(r.lines, 'Projektmusik');
        }, 'primary'),
        btn('.lrc-Datei laden …', async () => { const r = await App.api.invoke('lrc:open'); if (r) apply(r.lines, r.name); }, 'small')),
      miss, st,
      el('div', { class: 'hint' }, 'Tipp: Die Lyrics liegen neben dem Lied oder im Unterordner „Lyrics“. Danach wie gewohnt exportieren. Im Reiter Untertitel kannst du Zeilen noch ändern.')));
  },
};

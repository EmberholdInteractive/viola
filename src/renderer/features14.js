'use strict';
// Viola – Tutorial: Kapitel mit Schritten, "Mach das → das kommt raus"-Beispielen, Demo-Projekt, Sprung zu den Seiten (F1 / Hilfe-Menü)
(function () {
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };
  const page = n => () => window.Studio3 && Studio3.setPage && Studio3.setPage(n);
  // Kapitel: t = Titel, p = Seite (zum Öffnen), intro, steps = Anleitung, ex = { goal, do[], res }
  const CH = [
    { t: 'Willkommen', p: 'Schnitt', intro: 'Viola schneidet Fotos und Videos zu einem Film. Oben wählst du eine Seite (Schnitt, Farbe, Effekte, Audio, Fusion, 3D, KI) – Tastenkürzel Alt+1 bis Alt+7. Links sind die Medien, in der Mitte die Vorschau, rechts die Eigenschaften, unten die Zeitleiste.',
      steps: ['Medien links: Dateien hinzufügen, Titel einfügen, Aufnahme starten.', 'Zeitleiste unten: Folien (V1), Overlays (V2/V3), Musik (A1), Sprecher (A2).', 'Klick auf eine Folie wählt sie aus – rechts erscheinen ihre Eigenschaften.', 'Strg+K öffnet die Befehlspalette: Tippe, was du tun willst (z. B. „Teilen“).', 'Strg+S speichert, Strg+Z macht rückgängig, F1 öffnet dieses Tutorial.', 'Die unteren Fenster haben oben rechts „–“ (minimieren in die Fensterleiste ganz unten) und „⤢“ (vergrößern). Ein Klick auf den Namen in der Leiste holt das Fenster zurück. Die Breite ziehst du am Rand zwischen zwei Fenstern, die Höhe am oberen Rand der Fensterreihe.'],
      ex: { goal: 'In 1 Minute einen ersten kleinen Film sehen', do: ['Unten auf „Demo-Projekt einfügen“ klicken.', 'Leertaste oder ▶ drücken.'], res: 'Du siehst drei Titel-Folien mit Überblendung hintereinander – dein Grundgerüst zum Ausprobieren.' } },
    { t: 'Medien & Zeitleiste', p: 'Schnitt', intro: 'Alles beginnt mit deinen Fotos und Videos. Jede Datei wird eine Folie auf der Spur V1; die Reihenfolge links nach rechts ist die Reihenfolge im Film.',
      steps: ['„Fotos/Videos hinzufügen“ wählt Dateien, „Ordner“ lädt einen ganzen Ordner.', 'Dateien in der Medienliste markieren und „Auswahl →“ schicken sie in die Zeitleiste, „Alle in Zeitleiste“ nimmt alle.', 'Folien per Maus verschieben, um die Reihenfolge zu ändern.', 'Mit dem Zoom-Regler rechts oben in der Zeitleiste machst du die Spur breiter oder schmaler.'],
      ex: { goal: '10 Urlaubsfotos zu einem Film machen', do: ['Ordner mit den Fotos über „Ordner“ laden.', '„Alle in Zeitleiste“ klicken.', 'Eine Folie anklicken und rechts „Dauer“ auf 3 Sekunden stellen.', 'Mit gedrückter Strg-Taste alle Folien markieren, um die Dauer für alle zu setzen.'], res: 'Jedes Foto steht 3 Sekunden, der Film dauert 30 Sekunden.' } },
    { t: 'Titel & Text', p: 'Schnitt', intro: 'Titel gibt es als eigene Folie (vor, zwischen oder nach den Bildern) oder als Overlay, das über einem Bild liegt.',
      steps: ['„Titel einfügen“ legt eine Titel-Folie an, rechts änderst du Text und Untertitel.', '„+ Titel (Overlay)“ in der Zeitleiste legt Text über das aktuelle Bild; Beginn und Dauer stellst du rechts ein.', 'Mit Einblenden/Ausblenden sorgst du für sanftes Erscheinen.', 'Overlays kannst du auf V2 und V3 stapeln.'],
      ex: { goal: 'Den Ort als Text ins Bild einblenden', do: ['Zeitleiste auf das Foto stellen.', '„+ Titel (Overlay)“ klicken.', 'Text auf „Alpen“ ändern, Dauer 3 s, Einblenden 0,5 s.'], res: 'Während des Fotos erscheint „Alpen“ weich eingeblendet über dem Bild.' } },
    { t: 'Schneiden', p: 'Schnitt', intro: 'Auch Videos lassen sich teilen und neu anordnen. Die Übergänge steuerst du pro Folie.',
      steps: ['Zeitleiste an die Schnittstelle stellen und „Teilen“ (oder Taste S) klicken.', '„Duplizieren“ (Strg+D) kopiert eine Folie, „Entfernen“ (Entf) löscht sie.', 'Rechts bei „Übergang davor“ wählst du z. B. „fade“ (Überblendung).', 'Mit „Marker“ merkst du dir Stellen, zu denen du später springen willst.'],
      ex: { goal: 'Ein langes Video auf die besten 10 Sekunden kürzen', do: ['Zeitleiste auf 0:12 stellen, „Teilen“ klicken.', 'Zeitleiste auf 0:22 stellen, „Teilen“ klicken.', 'Das Stück davor und danach anklicken und „Entfernen“.'], res: 'Nur das mittlere 10-Sekunden-Stück bleibt übrig, die Lücken sind geschlossen.' } },
    { t: 'Effekte & Farbe', p: 'Effekte', intro: 'Effekte sind Filter, die auf eine oder mehrere markierte Folien wirken. Sie werden der Reihe nach angewendet – die Reihenfolge verändert das Ergebnis.',
      steps: ['Folie(n) markieren, rechts unter „Effekte“ auf „+ Effekt hinzufügen …“.', 'Regler des Effekts verstellen, die Vorschau zeigt es sofort.', 'Auf der Seite „Farbe“ findest du Farbkorrektur, Scopes (Histogramm, RGB-Parade, Vektorskop) und LUTs.', 'Eigene .cube-Dateien (LUTs) legst du in den LUT-Ordner.'],
      ex: { goal: 'Einen warmen Film-Look erzeugen', do: ['Alle Folien markieren.', 'Effekt hinzufügen: Farbkorrektur, Temperatur etwas nach warm, Kontrast leicht erhöhen.', 'Zusätzlich einen leichten Vignetten-Effekt hinzufügen.'], res: 'Alle Bilder wirken einheitlich warm und etwas kontrastreicher mit dunklen Rändern.' } },
    { t: 'Zoom & Schwenk', p: 'Schnitt', intro: 'Mit Keyframes (Zoom und Schwenk) bewegst du dich über ein Foto – der berühmte Ken-Burns-Effekt.',
      steps: ['Folie markieren, rechts den Reiter „Keyframes“ öffnen.', 'Am Anfang Zoom 100 % setzen, am Ende z. B. 125 %.', 'Position (x/y) verschiebt den Ausschnitt.'],
      ex: { goal: 'Langsam auf ein Gesicht zufahren', do: ['Folie markieren, Reiter „Keyframes“.', 'Anfang: Zoom 100 %, Mitte des Bildes.', 'Ende: Zoom 130 %, Position auf das Gesicht.'], res: 'Das Foto wirkt lebendig: Die Kamera fährt in 4 Sekunden auf das Gesicht zu.' } },
    { t: 'Audio & Mixer', p: 'Audio', intro: 'Auf der Seite „Audio“ liegt der Mixer: ein Fader je Spur (Musik A1, Sprecher A2), ein Master und frei anlegbare Busse mit Sends.',
      steps: ['Fader ziehen = Lautstärke in dB. M stummschaltet, S spielt nur diese Spur (Solo).', '„+ Bus“ legt einen Bus an (z. B. Hall). Spuren schicken über „Send“ einen Teil ihres Signals dorthin.', 'Der Master-Fader regelt das Gesamtergebnis; ein Limiter verhindert Übersteuern.', 'Musik legst du über die Seite „Audio“ bzw. den Reiter Audio oben ein.'],
      ex: { goal: 'Sprecher deutlich über der Musik', do: ['Musik A1 auf etwa −12 dB senken.', 'Sprecher A2 auf 0 dB lassen.', '„+ Bus“ → „Hall“, bei A2 den Send auf etwa 20 % stellen.'], res: 'Die Stimme ist klar vorne und klingt leicht „im Raum“, die Musik liegt leise darunter.' } },
    { t: 'Untertitel & Sprecher', p: 'KI', intro: 'Untertitel kannst du von Hand schreiben oder automatisch aus der Sprache erzeugen. Die Seite „KI“ zeigt die Werkzeuge als Kacheln.',
      steps: ['Reiter „Untertitel“ öffnet den Untertitel-Editor mit Tabelle (Start, Ende, Text).', 'Spracherkennung (Whisper) erzeugt Text automatisch, benötigt die Einrichtung in den Einstellungen.', 'Sprecher-Erkennung sortiert den Text nach Personen (Python + Hugging-Face-Token nötig).', '„Übersetzen“ übersetzt alle Zeilen in eine andere Sprache (Python-Paket nötig).'],
      ex: { goal: 'Deutsche Untertitel zusätzlich auf Englisch', do: ['Untertitel erzeugen oder eintippen.', 'Im Editor „Übersetzen“, Von: Deutsch, Nach: Englisch.', 'Ergebnis in der Tabelle prüfen und korrigieren.'], res: 'Zu jeder Zeile gibt es eine englische Fassung mit denselben Zeiten.' } },
    { t: 'Rotoskopie & Objekt entfernen', p: 'Effekte', intro: 'Rotoskopie schneidet ein Objekt mit einem Polygon frei, das du per Maus auf einem Standbild zeichnest. „Objekt entfernen“ verdeckt ein Logo oder Wasserzeichen. Das ist Delogo, keine KI-Retusche: Es wird weichgezeichnet bzw. aus der Umgebung aufgefüllt, bewegte Hintergründe sehen nicht perfekt aus.',
      steps: ['Folie markieren, rechts „Rotoskopie …“ klicken.', 'Auf dem Standbild die Eckpunkte des Objekts anklicken, am Ende schließen.', 'Weitere Standbilder an anderen Zeitpunkten setzen – dazwischen wird bewegt.', '„Objekt entfernen …“: Rechteck um das Logo ziehen, Start und Ende wählen.'],
      ex: { goal: 'Nur eine Person farbig lassen, den Rest schwarz-weiß', do: ['Rotoskopie auf der Person zeichnen.', 'Die Maske auf „außen“ umstellen bzw. invertieren.', 'Effekt „Schwarz-Weiß“ hinzufügen.'], res: 'Die Person bleibt farbig, die gesamte Umgebung ist schwarz-weiß.' } },
    { t: 'Motion-Tracking', p: 'Effekte', intro: 'Tracking verfolgt einen Bildausschnitt durch das Video. Ein Overlay (z. B. ein Text) folgt dann diesem Punkt.',
      steps: ['Folie mit Video markieren, „Tracking …“ klicken.', 'Auf dem Standbild einen Rahmen um das Objekt ziehen (kontrastreiche Stelle wählen).', '„Verfolgen“ startet die Analyse.', 'Beim Overlay „Tracking“ wählen: Es bewegt sich entlang des Pfads. „Pfad löschen“ setzt zurück.'],
      ex: { goal: 'Ein Namensschild folgt einer gehenden Person', do: ['Rahmen um den Kopf der Person ziehen, „Verfolgen“.', 'Titel-Overlay „Anna“ anlegen.', 'Beim Overlay den Track auswählen.'], res: 'Das Schild „Anna“ wandert während des Gehens mit der Person mit.' } },
    { t: 'Fusion (Node-Editor)', p: 'Fusion', intro: 'Im Node-Editor baust du Effekte als Graph: Knoten (Eingang, Effekt, Merge, Maske, Ausgang) verbindest du mit Linien. Nützlich, wenn du mehrere Ebenen kombinieren willst.',
      steps: ['Folie markieren, auf der Seite „Fusion“ „Node-Graph anlegen“ klicken.', 'Knoten mit der Maus verschieben, von Ausgang zu Eingang ziehen, um zu verbinden.', 'Knoten anklicken: Rechts stellst du seine Parameter ein. „+ Merge“ legt Ebenen übereinander, „+ Maske“ blendet aus.', '„Bild testen“ zeigt das Ergebnis, „Knoten löschen“ entfernt einen Knoten. Kreise im Graph werden verhindert.'],
      ex: { goal: 'Ein Foto mit weichem Leuchten (Glow) versehen', do: ['Node-Graph anlegen.', 'Einen Blur-Effekt-Knoten hinzufügen und mit „+ Merge“ über das Original legen (Modus „screen“).', '„Bild testen“.'], res: 'Helle Stellen des Fotos strahlen weich – wie ein Traum-Look.' } },
    { t: '3D-Szenen', p: '3D', intro: 'Der 3D-Editor baut eine einfache Szene aus Würfel, Kugel, Torus, Zylinder, Kegel, Fläche, Text und Bild. Sie wird beim Export gerendert und als Overlay über deinen Film gelegt. Wichtig: Text besteht aus gestapelten flachen Ebenen, nicht aus echten 3D-Buchstaben, und es gibt kein Raytracing.',
      steps: ['Seite „3D“ öffnen, mit „+ Würfel“, „+ Kugel“ usw. Objekte hinzufügen.', 'Objekt in der Liste anklicken: Position, Größe, Farbe, Drehung einstellen.', '„Kamera & Licht“ legt Blickwinkel und Beleuchtung fest.', '„Als Overlay einfügen“ legt die Szene in die Zeitleiste. Später wieder öffnen mit „3D bearbeiten“.'],
      ex: { goal: 'Einen sich drehenden Logo-Würfel als Intro', do: ['„+ Würfel“, „+ Bild“ (dein Logo) auf eine Seite legen.', 'Drehung animieren.', '„Als Overlay einfügen“, Dauer 3 s.'], res: 'Beim Export dreht sich ein Würfel mit deinem Logo über den ersten 3 Sekunden – Hintergrund transparent.' } },
    { t: 'Multicam', p: 'Schnitt', intro: 'Mehrere Kameras zum gleichen Ereignis lassen sich über den Ton synchronisieren. Viola findet den Zeitversatz automatisch.',
      steps: ['Mehrere Videos derselben Szene in der Zeitleiste markieren.', '„Kameras hinzufügen …“ wählt die Winkel, „Ton abgleichen“ berechnet die Versätze.', 'Danach legst du fest, wann zu welcher Kamera umgeschnitten wird (oder automatisch alle X Sekunden).'],
      ex: { goal: 'Konzert mit zwei Handys schneiden', do: ['Beide Aufnahmen laden.', '„Ton abgleichen“ drücken.', 'Automatischen Schnitt alle 6 s wählen.'], res: 'Der Film wechselt alle 6 Sekunden die Kamera, der Ton bleibt durchgehend synchron.' } },
    { t: 'Plug-ins', p: 'Effekte', intro: 'Eigene Effekte kannst du als kleine Dateien (JSON oder JS) in den Plug-in-Ordner legen. Sie erscheinen unter den Effekten mit dem Namen PLUG.…',
      steps: ['Auf der Seite „Effekte“ das Plug-ins-Fenster öffnen, „Ordner öffnen“ zeigt den Ordner.', 'Beispiel-Plug-in „Beispiel-Farbton“ liegt im Ordner plugins/.', 'Datei kopieren, anpassen, „Neu laden“ – der Effekt steht in der Effektliste.'],
      ex: { goal: 'Eigenen Effekt „Warmton“ anlegen', do: ['Beispiel-Plug-in kopieren und umbenennen.', 'Name und Parameter im Text ändern.', '„Neu laden“ klicken.'], res: 'Unter den Effekten gibt es nun deinen „Warmton“ mit eigenen Reglern.' } },
    { t: 'Export & Warteschlange', p: 'Schnitt', intro: 'Beim Export entsteht die fertige Videodatei. Mehrere Aufträge laufen nacheinander in der Warteschlange – mit Priorität.',
      steps: ['Oben auf „Exportieren“ (oder Reiter Export) klicken, Auflösung und Format wählen.', 'Priorität (niedrig, normal, hoch) festlegen; in der Warteschlange mit ▲▼ oder „Als Nächstes“ umsortieren.', 'Für andere Programme gibt es Austausch-Formate (FCPXML, OTIO, AAF – AAF braucht Python).', 'Das Projekt mit Strg+S speichern, damit du jederzeit weiterarbeiten kannst.'],
      ex: { goal: 'Schnell eine Vorschau und nachts die Endversion', do: ['Auftrag 1: 720p, Priorität „hoch“.', 'Auftrag 2: 1080p, Priorität „niedrig“.'], res: 'Zuerst wird die schnelle 720p-Vorschau fertig, danach die große Version.' } },
  ];

  function demo() {
    if (typeof commit !== 'function') return toast('Demo konnte nicht erstellt werden');
    const mk = (text, subtitle, d) => ({ id: uid(), type: 'title', text, subtitle, duration: d });
    const list = [mk('Willkommen bei Viola', 'Dein erster Film', 3), mk('Kapitel 1', 'Hier beginnt die Geschichte', 3), mk('Danke fürs Zuschauen', '', 3)];
    commit(() => { P().slides.push(...list); S().selected = new Set([list[0].id]); }); renderAll(); toast('Demo-Projekt eingefügt – drück die Leertaste zum Abspielen');
  }

  function open(start) {
    const m = document.createElement('div'); m.className = 'modal';
    const box = el('div', { class: 'mbox tut' }); m.append(box); document.body.append(m);
    const close = () => { m.remove(); document.removeEventListener('keydown', esc, true); }; const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', esc, true); m.onclick = e => { if (e.target === m) close(); };
    let cur = Math.max(0, Math.min(CH.length - 1, start || +LS.get('viola.tut.ch') || 0));
    const nav = el('div', { class: 'tutnav' }), body = el('div', { class: 'tutbody' });
    const draw = () => {
      LS.set('viola.tut.ch', String(cur)); nav.replaceChildren(); body.replaceChildren(); const c = CH[cur];
      CH.forEach((x, i) => nav.append(el('div', { class: 'tutitem' + (i === cur ? ' on' : ''), onclick: () => { cur = i; draw(); } }, (i + 1) + '. ' + x.t)));
      const ex = c.ex;
      body.append(el('h2', {}, (cur + 1) + '. ' + c.t), el('p', { class: 'tutintro' }, c.intro),
        el('h3', {}, 'So geht’s'), el('ol', {}, ...c.steps.map(s => el('li', {}, s))),
        el('div', { class: 'tutex' }, el('b', {}, el('span', {}, 'Beispiel:'), ' ', el('span', {}, ex.goal)), el('div', { class: 'tutlab' }, 'Mach das:'), el('ol', {}, ...ex.do.map(s => el('li', {}, s))), el('div', { class: 'tutlab' }, 'Das kommt raus:'), el('p', { class: 'tutres' }, ex.res)),
        el('div', { class: 'tutbtns' },
          cur === 0 ? btn('Demo-Projekt einfügen', demo) : null,
          btn('Seite öffnen: ' + c.p, () => { close(); page(c.p)(); }),
          el('span', { style: { flex: 1 } }),
          btn('← Zurück', () => { if (cur > 0) { cur--; draw(); } }), btn(cur === CH.length - 1 ? 'Fertig' : 'Weiter →', () => { if (cur < CH.length - 1) { cur++; draw(); } else close(); }), btn('Schließen', close)));
      body.scrollTop = 0;
    };
    box.append(el('div', { class: 'tutwrap' }, nav, body)); draw(); return m;
  }

  const css = document.createElement('style'); css.textContent = `
.tut{width:min(980px,94vw)!important;max-width:94vw!important;height:min(640px,88vh);padding:0!important;overflow:hidden}
.tutwrap{display:grid;grid-template-columns:230px 1fr;height:100%}
.tutnav{border-right:1px solid var(--line,#2d2650);overflow:auto;padding:10px 6px}
.tutitem{padding:7px 10px;border-radius:8px;cursor:pointer;font-size:13px;color:var(--muted,#a79fc7)}
.tutitem:hover{background:rgba(167,139,250,.12)} .tutitem.on{background:rgba(124,92,255,.28);color:#fff}
.tutbody{overflow:auto;padding:18px 24px 20px} .tutbody h2{margin:0 0 8px} .tutbody h3{margin:16px 0 6px;font-size:14px;color:var(--accent,#a78bfa)}
.tutbody ol{padding-left:24px;margin:6px 0}.tutintro{line-height:1.5} .tutbody li{margin:4px 0;line-height:1.45}
.tutex{margin-top:16px;padding:12px 14px;border:1px solid rgba(167,139,250,.45);border-radius:12px;background:rgba(124,92,255,.10)}
.tutlab{margin-top:8px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#a79fc7)} .tutres{margin:4px 0 0;color:#c9f7d4}
.tutbtns{display:flex;gap:8px;margin-top:18px;align-items:center;flex-wrap:wrap}`;
  document.head.append(css);

  window.Studio3 = Object.assign(window.Studio3 || {}, { tutorial: open, TUTORIAL: CH });
  document.addEventListener('keydown', e => { if (e.key === 'F1') { e.preventDefault(); open(); } });
  // Beim allerersten Start fragen, ob das Tutorial laufen soll
  function welcome() {
    LS.set('viola.tut.welcome', '1');
    const m = document.createElement('div'); m.className = 'modal'; m.style.zIndex = 300;
    const close = () => m.remove();
    const box = el('div', { class: 'mbox welcome' }, el('h2', {}, 'Willkommen bei Viola!'), el('p', {}, 'Möchtest du eine kurze Einführung? Das Tutorial zeigt Schritt für Schritt, wie alles funktioniert, mit Beispielen zum Nachmachen.'), el('p', { class: 'muted' }, 'Du findest es jederzeit unter Hilfe → Tutorial oder mit F1.'),
      el('div', { class: 'tutbtns' }, el('span', { style: { flex: 1 } }), btn('Nein, später', close), btn('Tutorial starten', () => { close(); open(0); }, 'primary')));
    m.append(box); document.body.append(m);
  }
  if (!LS.get('viola.tut.welcome')) setTimeout(welcome, 1800);
  window.Studio3.welcome = welcome;
})();

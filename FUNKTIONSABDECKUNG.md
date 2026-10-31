# Viola – Funktionsabdeckung gegenüber dem Master-Funktionskatalog (PDF)

Stand: ehrliche Bestandsaufnahme. Legende: ✅ umgesetzt · 🟡 teilweise · ❌ nicht umgesetzt · ⛔ mit Electron+FFmpeg nicht realistisch

Hinweis: Der Katalog beschreibt eine C++/Rust + Qt 6 + D3D12-Anwendung und sagt selbst, er sei keine vollständige Implementierung. Viola ist Electron + FFmpeg. Alles getestet nur in Linux/Headless-Chromium + FFmpeg-Tests, **nicht** in echtem Electron unter Windows.

| Modul | Status | Details |
|---|---|---|
| CORE (Projekt, Autosave, Undo) | 🟡 | Projekt speichern/öffnen, Undo/Redo, Autosave alle 45 s, Absturz-Wiederherstellung, Backups, Relink, Projekt sammeln ✅. Vorlagen/Archiv/Versionen ❌ |
| MEDIA (Import, Medienverwaltung) | 🟡 | Import Foto/Video/Audio, Thumbnails ✅. Bins/Smart Bins/Tags/Bewertungen/Favoriten, Proxy-Verwaltung, Hash ❌ |
| TIME (Spuren, Clips, Navigation) | 🟡 | Hauptspur + Overlay-Spuren V2/V3 (Titel, Foto, Video), Musik/Voice, Zoom, Playhead ✅. Echtes Mehrspur-Modell (A1–A3, Lock/Mute/Solo/Auge), Marker, J/K/L ❌ |
| EDIT (Schnittwerkzeuge) | 🟡 | Teilen, Duplizieren, Löschen, Verschieben, Trimmen ✅. Ripple/Roll/Slip/Slide, 3-/4-Punkt, J/L-Cuts ❌ |
| TRANSFORM | 🟡 | Position/Größe/Deckkraft bei Overlays, Stabilisieren, Zuschneiden/Skalieren über Effekte ✅. Blend-Modes, Safe Areas ❌ |
| SPEED | 🟡 | Tempo/Zeit-Steuerung, Reverse über Effekte ✅. Speed Ramp / Time Remap / Optical Flow ❌ |
| ANIM (Keyframes) | 🟡 | Ken-Burns-Bewegung pro Folie ✅. Keyframe-Editor mit Bézier-Kurven ❌ |
| TRANSITION | ✅/🟡 | Überblendungen (Fade u. a.) mit Dauer ✅. Große Bibliothek mit Vorschau-UI ❌ |
| FX | ✅/🟡 | Effektkatalog (Video+Audio) mit Parametern, Stapel, DE/EN, HDR-Tonemapping, Chroma-Key, Stabilisierung ✅. GPU-Effekte/Shader-Plugins ⛔ |
| COLOR | 🟡 | Grundkorrektur, Look-/Filter-Effekte, Scopes (Waveform/Histogramm/Vectorscope) ✅. Farbräder, Kurven, HSL-Sekundär, LUT-Import-UI, Farbmanagement ❌ |
| MASK / Keying / Rotoscoping | 🟡 | Chroma-Key ✅. Masken, Rotoscoping ❌ |
| TRACK (Tracking) | ❌ | Motion-Tracking nicht umgesetzt (Stabilisierung ✅) |
| COMP (Node-Compositing) | ⛔ | Node-Graph/Fusion nicht realistisch |
| MOTION (Motion Graphics) | 🟡 | Titel + Overlay-Titel mit Ein-/Ausblenden ✅. Vorlagen, Lower Thirds, Formen ❌ |
| 3D | ⛔ | Szenen/Kameras/Licht/Raytracing nicht realistisch |
| TEXT / Untertitel | 🟡 | Titel, Bildunterschriften, Untertitel SRT einbrennen/Sidecar, Karaoke-ASS ✅ (via RaLyrics-LRC). Typografie-Feinheiten, Speaker-Diarization-Prüfwerte ❌ |
| AUDIO | 🟡 | Musik-Playlist mit Crossfade, Normalisierung, Voice-Mix, Audio-Effekte (EQ, Kompressor, Limiter, Gate u. a.), Stille-Erkennung ✅. Mixer mit Bussen/Sends/Automation, Pegelanzeigen ❌ |
| AI | 🟡 | Upscaling (Video2X), Transkription/Lyrics (RaLyrics/WhisperX), Gesang (RaSing), Stille-/Szenenerkennung ✅. Text-Based-Edit, Hintergrundentfernung, Inpainting, Dubbing, ONNX/DirectML ❌/⛔ |
| MULTICAM | ❌/⛔ | nicht umgesetzt |
| CAPTURE | ❌ | Bildschirm-/Webcam-Aufnahme nicht umgesetzt |
| REVIEW / Team | ❌ | nicht umgesetzt (Teamfunktionen nicht sinnvoll für Einzelnutzer-App) |
| EXPORT | ✅ | MP4/MKV/MOV/WebM/Audio-only, H.264/H.265/VP9/ProRes u. a. je nach FFmpeg, CRF/Bitrate, Hardware-Encoder, Lautheit, Sidecar-SRT, Wasserzeichen ✅. Queue/Batch mit Priorität 🟡, MXF/DNxHR/Alpha/Bildsequenz je nach Build 🟡 |
| FORMAT | 🟡 | Container/Codecs über FFmpeg, LRC/SRT ✅. XML/EDL/AAF/OTIO ❌ |
| PERF | 🟡 | Hardware-Encoder-Erkennung, Segment-Rendering ✅. D3D12/DirectCompute ⛔ |
| AUTO | ❌ | Watch-Folder, Skripte, Makros nicht umgesetzt |
| PLUGIN | ⛔ | Plug-in-SDK nicht realistisch |
| ACCESS | 🟡 | Tastatur-Kürzel, DE/EN ✅. Screenreader/Barrierefreiheit nicht geprüft |
| SEC | 🟡 | Lokale Arbeit, keine Cloud ✅. Verschlüsselung/Audit ❌ |

## Zusammenfassung
- Der **Kern** (Foto/Video-Slideshow- und Schnittprogramm, Effekte, Export, Overlays, Lyrics, Analyse, Sicherheit, DE/EN, Installer-Konfiguration) steht.
- **Fehlt** und machbar: Mehrspur-Datenmodell, Farbpanel, Medien-Bins, Marker, Masken, Keyframe-Editor, Mixer-UI, Befehlspalette.
- **Nicht realistisch**: 3D, Node-Compositing, Plug-in-SDK, ASIO, Multicam, ONNX/DirectML.

## Update 2
- ✅ Masken (Ellipse/Rechteck, Weiche Kante, Invertieren, Außerhalb: Blur/Dunkel/S-W/Hell) – Effekt "Maske"
- ✅ Schnitt: Slip, Roll, Ripple-Löschen (Overlays und Marker rücken nach)
- ✅ Bildschirmaufnahme (FFmpeg gdigrab) – **nur mit Testquelle getestet, nicht echt unter Windows**
- ✅ Effekt-Vorschaubilder (39 Stück, aus Teststandbild gerendert), Projektbaum, Menüs Clip/Timeline/Effekte/Farbe/Audio/Fenster, Programm-Kopf mit Auflösung/fps, Schnell-Module im Inspektor
- ❌ weiterhin offen: Time-Remap-Kurve (nur lineare Speed Ramp), Rotoscoping/Tracking, Objektentfernung (KI), Mixer-Pegelanzeige, Panel-Docking/Workspaces

## Update 3
- ✅ Time-Remap-Kurve (Tempo-Punkte pro Clip), Pan pro Spur, Mixer-Pegelanzeige (aus ffmpeg-Pegelverlauf, läuft mit der Wiedergabe)
- ✅ Farbe: Histogramm, HSL pro Farbbereich (braucht FFmpeg 5.1+)
- ✅ Arbeitsbereiche (Standard/Farbe/Audio/Effekte/Minimal), Panels ein/aus, ziehbare Leisten (linke Leiste, Docks)
- ✅ Untertitel-Prüfung (Zeichen/Zeile, Zeilenzahl, Lesetempo, Mindest-/Maximaldauer)
- ✅ Austausch: FCPXML (Premiere/DaVinci/Final Cut) und OpenTimelineIO zusätzlich zu EDL — nur Hauptspur, ungetestet in den Zielprogrammen
- ✅ Versionsstände (speichern/wiederherstellen), überwachter Ordner (Auto-Import), Makros (letzte 5 Befehle)
- ❌ nicht gebaut: Rotoscoping, Motion-Tracking, AAF, Queue-Prioritäten, Sprecher-Erkennung/Übersetzung, Busse/Sends

## Update 4 (Viola Pro: Seiten, Fusion, 3D, Tracking u. a.)
Alles unten ist durch automatische Tests mit Testmaterial abgedeckt (`npm test`, Welle 5) **oder** ausdrücklich als „ungetestet“ markiert. Echtes Electron unter Windows habe ich nicht gesehen.

| Funktion | Status | Ehrliche Einordnung |
|---|---|---|
| Seiten Schnitt/Farbe/Effekte/Audio/Fusion/3D/KI | ✅ | Seitenleiste oben (Alt+1…7); jede Seite ordnet Panels und Docks neu an |
| Motion-Tracking | ✅ | Block-Matching (SAD) auf Graubildern, in JavaScript. Funktioniert gut bei kontrastreichen Objekten, nicht bei Verdeckung/Drehung/Skalierung. Ergebnis ist ein Pfad, dem ein Overlay folgt |
| Rotoskopie | 🟡 | Animiertes Polygon (3–12 Punkte, bis 8 Schlüsselbilder, lineare Überblendung) als Maske. Kein automatisches Nachfahren der Kante, kein Spline |
| Objekt entfernen | 🟡 | `delogo` (Fläche mit Umgebung überblenden). **Kein KI-Inpainting** |
| Blend-Modes für Overlays | ✅ | Screen, Add, Multiply, Overlay u. a. |
| 3D-Perspektive (Effekt) | ✅ | Kippen/Drehen eines Bildes im Raum |
| Node-Editor (Fusion) | 🟡 | Echter Knoteneditor (Eingang, Effekte, Merge mit Mischmodus, Masken, Ausgang), pro Folie; wird zu einem FFmpeg-Filtergraphen. Kein Echtzeit-Compositing, Testbild per Knopf, keine Kurven/Keyframes in Knoten |
| 3D-Szenen | 🟡 | three.js: Würfel, Kugel, Torus, Zylinder, Kegel, Fläche, Bild, Text (gestapelte Flächen, **kein echter 3D-Text**), Kamera-Umlauf, Spin, Licht. Wird beim Export als transparente Bildfolge gerendert und als Overlay eingebaut. Kein Raytracing, keine Importe von 3D-Modellen |
| Busse/Sends/Master im Mixer | ✅ | Hall-Bus o. ä. mit beliebigen Audioeffekten, Send-Regler für Musik und Sprecher, Master-Fader |
| Warteschlange mit Prioritäten | ✅ | hoch/normal/niedrig, „Als Nächstes“ |
| Plug-ins | 🟡 | JSON-Effekte (Filter-Vorlage mit {Parametern}) und JS-Module in `plugins/`. **Kein SDK**, JS-Plug-ins laufen mit vollen Rechten |
| Multicam | 🟡 | Ton-Abgleich per Kreuzkorrelation, Schnittplan (automatisch oder von Hand). Kein Live-Mehrfachmonitor |
| AAF-Export | 🟡 | Über Python (`opentimelineio`, `otio-aaf-adapter`, `pyaaf2`). Mit Testprojekt geschrieben und wieder geöffnet, in Avid/Pro Tools **ungetestet**; Medien werden nur referenziert |
| Sprecher-Erkennung | 🟡 | WhisperX + pyannote über Python, braucht Hugging-Face-Token. **Nicht getestet** (Modelle nicht verfügbar) |
| Untertitel übersetzen | 🟡 | argostranslate offline über Python. **Nicht getestet** (Sprachpaket-Download) |
| Sprecher-Aufnahme (Mikrofon) | 🟡 | DirectShow-Geräte, Test nur mit Testton. **ASIO wird von FFmpeg nicht unterstützt** (⛔) |
| Scopes (Histogramm, RGB-Parade, Vektorskop) | ✅ | live aus der Vorschau |
| Untertitel-Editor (Tabelle) | ✅ | |

Weiterhin ⛔: ASIO, GPU-/Shader-Plug-ins, Raytracing, echtes Echtzeit-Compositing, KI-Objektentfernung.

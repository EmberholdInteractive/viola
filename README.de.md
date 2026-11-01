# Viola – Videostudio

[English](README.md) · **Deutsch**

Viola ist ein Videoschnittprogramm für Windows mit Auto-Collage, Beat-Sync, Untertiteln, Sprachbereinigung, KI-Hochskalieren und FFmpeg-Rendering im dunklen „Amethyst/Aurora“-Design. Die Oberfläche gibt es in **15 Sprachen**; sie wählt automatisch die Sprache von Windows.

## Download (Windows)
Den aktuellen Installer gibt es unter **[Releases](../../releases/latest)**: `Viola-Setup-x.y.z.exe` ausführen.
Der Installer ist nicht signiert, deshalb warnt Windows SmartScreen eventuell: *Weitere Informationen → Trotzdem ausführen*.
Nach der Installation sucht Viola selbst bei GitHub nach neuen Versionen und installiert Updates (*Hilfe → Nach Updates suchen*).
Ein Uninstaller ist dabei (Windows-Einstellungen → Apps oder Startmenü).

## Funktionen
- **Medien und Zeitleiste**: Fotos, Videos, ganze Ordner, Proxy-Vorschau; Teilen, Duplizieren, Rückgängig/Wiederholen, Übergänge, Ken Burns, Titel und Overlays auf mehreren Spuren.
- **Seiten**: Schnitt, Farbe, Effekte, Audio, Fusion, 3D, KI (`Alt+1`…`Alt+7`); die unteren Fenster lassen sich in eine Fensterleiste minimieren, vergrößern und in der Größe ziehen.
- **Farbe**: Looks, eigene `.cube`-LUTs, Kurven, Farbräder, Scopes (Histogramm, RGB-Parade, Vektorskop).
- **Effekte**: FFmpeg-Effekte, Keyframes (Zoom und Schwenk), Mischmodi, Plug-ins (JSON/JS im Ordner `plugins`).
- **Rotoskopie und Tracking**: Polygon-Masken, Motion-Tracking für Overlays, Logo-Entfernung (Delogo, keine KI-Retusche).
- **Fusion (Node-Editor)**: Knotengraph mit Effekt-, Merge- und Masken-Knoten pro Folie.
- **3D**: einfache three.js-Szenen (Würfel, Kugel, Torus, Text, Bild …) als Overlay. Text besteht aus gestapelten flachen Ebenen, nicht aus echten 3D-Buchstaben; kein Raytracing.
- **Audio**: Mixer mit Bussen, Sends und Master, Lautstärke angleichen, Rauschen entfernen, Sprecher-Spuren, die die Musik absenken.
- **Untertitel**: lokale Erkennung mit Whisper, Bearbeiten, SRT-Export oder Einbrennen; Sprecher-Erkennung und Übersetzung brauchen Python-Pakete.
- **Multicam**: mehrere Kameras über den Ton synchronisieren.
- **Auto-Collage**: Ordner einlesen, nach Jahr und Monat sortieren, Duplikate entfernen, ein Video pro Jahr.
- **Upscaler**: Video2X (Real-ESRGAN, Real-CUGAN, libplacebo).
- **Export**: YouTube, Reels/TikTok/Shorts (9:16), Instagram, H.265, ProRes; Warteschlange mit Prioritäten; FCPXML, OTIO und AAF (AAF braucht Python).
- **Tutorial**: `F1` öffnet 15 Kapitel mit Schritt-für-Schritt-Beispielen.

## Nicht unterstützt
ASIO-Audio, echter 3D-Text und Raytracing, KI-Objektentfernung.

## Aus dem Quellcode starten
1. Node.js (LTS) installieren.
2. Im Projektordner: `npm install`, dann `npm start`.
3. Installer bauen: `npm run dist` (Ergebnis im Ordner `dist`).

## Einrichtung optionaler Werkzeuge
- **Video2X**: Pfad zur `video2x.exe` im Reiter Upscaler wählen.
- **Untertitel**: Reiter Untertitel → whisper.cpp (`whisper-cli.exe` + Modell `.bin`) oder Python mit `faster-whisper` angeben.
- **Sprecher-Erkennung / Übersetzung / AAF**: Python mit den in der Fehlermeldung genannten Paketen (für die Sprecher-Erkennung braucht man einen Hugging-Face-Token, nie in eine Datei im Repo schreiben).

## Tests
`npm test` prüft Engine (Rendern, Lautstärke, Beat-Sync, Duplikate, Video2X-Befehle) und die neueren Funktionen (Looks, Keyframes, Zuschnitt, Audio, Proxy, Untertitel, Presets, H.265, ProRes, Tracking, Rotoskopie, Busse, Fusion, Plug-ins, Multicam).

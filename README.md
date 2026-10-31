# Viola – Videostudio

Foto- und Videoschnitt mit Auto-Collage, Beat-Sync, Untertiteln, Sprachbereinigung, KI-Hochskalieren (Video2X) und FFmpeg-Rendering. Design: Amethyst.

## Starten (Windows)
1. Node.js (LTS) installieren.
2. Im Projektordner: `npm install`
3. `npm start`
4. Installer bauen: `npm run dist` (Ergebnis im Ordner `dist`)

## Funktionen
- **Medien**: Fotos, Videos, ganze Ordner; Proxy-Vorschau für große Dateien.
- **Zeitleiste**: Teilen, Duplizieren, Rückgängig/Wiederholen, Dauer, Übergänge (11 Stück), Ken Burns, Titel, Bildtexte.
- **Keyframes**: Zoom und Schwenk frei über mehrere Punkte (Inspektor, Foto auswählen).
- **Look und Farbe**: eingebaute Looks (Warm, Kalt, Kino, Schwarz-Weiß, Vintage, Lebendig), eigene `.cube`-LUTs, Belichtung/Kontrast/Sättigung/Temperatur. Pro Folie oder für alles.
- **Musik**: gleiche Lautstärke, Überblendung, Beat-Sync.
- **Sprache**: Sprecher-Spuren über die Musik (Musik wird automatisch leiser), Rauschen entfernen, Lautstärke angleichen; Einzeldateien bereinigen.
- **Untertitel**: lokal mit Whisper erkennen, bearbeiten, als SRT speichern oder einbrennen.
- **Auto-Collage**: Ordner einlesen, nach Jahr und Monat sortieren, Duplikate entfernen, ein Video pro Jahr.
- **Upscaler**: Video2X (Real-ESRGAN, Real-CUGAN, libplacebo) für Fotos und Videos.
- **Export**: Presets für YouTube, Reels/TikTok/Shorts (9:16 mit intelligentem Zuschnitt), Instagram 4:5, Quadrat, H.265, ProRes; Warteschlange; Gesamtvideo aus Jahresvideos.

## Einrichtung
- **Video2X**: Pfad zur `video2x.exe` im Reiter Upscaler wählen.
- **Untertitel**: Reiter Untertitel → whisper.cpp (`whisper-cli.exe` + Modell `.bin`) oder Python mit `faster-whisper` angeben.

## Tests
`npm test` prüft Engine (Rendern, Lautstärke, Beat-Sync, Duplikate, Video2X-Befehle) und die neuen Funktionen (Looks, Keyframes, Zuschnitt, Audio, Proxy, Untertitel, Presets, H.265, ProRes).

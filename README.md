# Viola – Video Studio

**English** · [Deutsch](README.de.md)

Viola is a Windows video editor for photos and video: auto-collage, beat sync, subtitles, speech cleanup, AI upscaling and FFmpeg rendering, with a dark "Amethyst/Aurora" design. The interface comes in **15 languages** and picks your Windows language automatically.

## Download (Windows)
Get the latest installer from **[Releases](../../releases/latest)** and run `Viola-Setup-x.y.z.exe`.
The installer is not code-signed, so Windows SmartScreen may warn you: click *More info → Run anyway*.
Once installed, Viola checks GitHub for new versions on its own and installs updates (*Help → Check for updates*).
An uninstaller is included (Windows Settings → Apps, or the Start menu entry).

## Features
- **Media & timeline**: photos, videos, whole folders, proxy previews; split, duplicate, undo/redo, transitions, Ken Burns, titles and overlays on several tracks.
- **Pages**: Edit, Color, Effects, Audio, Fusion, 3D, AI (`Alt+1`…`Alt+7`); the lower windows can be minimized into a taskbar, enlarged and resized.
- **Color**: looks, your own `.cube` LUTs, curves, wheels, scopes (histogram, RGB parade, vectorscope).
- **Effects**: FFmpeg-based effects, keyframes (zoom and pan), blend modes, plug-ins (JSON/JS files in the `plugins` folder).
- **Rotoscoping & tracking**: polygon masks, motion tracking for overlays, logo removal (delogo – not AI inpainting).
- **Fusion (node editor)**: node graph with effect, merge and matte nodes per clip.
- **3D**: simple three.js scenes (cube, sphere, torus, text, image …) rendered as an overlay. Text is stacked flat layers, not real 3D letters; there is no ray tracing.
- **Audio**: mixer with buses, sends and master, loudness matching, noise removal, speaker tracks that duck the music.
- **Subtitles**: local recognition with Whisper, editing, SRT export or burn-in; speaker detection and translation need Python packages.
- **Multicam**: sync several cameras by audio.
- **Auto-collage**: scan folders, sort by year and month, remove duplicates, one video per year.
- **Upscaler**: Video2X (Real-ESRGAN, Real-CUGAN, libplacebo).
- **Export**: YouTube, Reels/TikTok/Shorts (9:16), Instagram, H.265, ProRes; render queue with priorities; FCPXML, OTIO and AAF (AAF needs Python).
- **Tutorial**: press `F1` for 15 chapters with step-by-step examples.

## Not supported
ASIO audio, real 3D text and ray tracing, AI object removal.

## Run from source
1. Install Node.js (LTS).
2. In the project folder: `npm install`, then `npm start`.
3. Build the installer: `npm run dist` (result in `dist`).

## Setup of optional tools
- **Video2X**: choose the path to `video2x.exe` on the Upscaler tab.
- **Subtitles**: on the Subtitles tab, point to whisper.cpp (`whisper-cli.exe` + model `.bin`) or Python with `faster-whisper`.
- **Speaker detection / translation / AAF**: Python with the packages named in the error message (a Hugging Face token is needed for speaker detection; never commit it).

## Tests
`npm test` covers the engine (rendering, loudness, beat sync, duplicates, Video2X commands) and the newer features (looks, keyframes, cropping, audio, proxies, subtitles, presets, H.265, ProRes, tracking, rotoscoping, buses, Fusion, plug-ins, multicam).

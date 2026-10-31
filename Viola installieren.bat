@echo off
chcp 65001 >nul
title Viola installieren
cd /d "%~dp0"
echo === Viola: Installer bauen ===
where node >nul 2>nul || (echo Node.js fehlt. Bitte von https://nodejs.org installieren und erneut starten. & pause & exit /b 1)
call npm install || goto fehler
rem Neuere npm-Versionen blockieren Install-Skripte; hier manuell ausfuehren
if not exist "node_modules\electron\dist\electron.exe" call node node_modules\electron\install.js || goto fehler
if not exist "node_modules\ffmpeg-static\ffmpeg.exe" call node node_modules\ffmpeg-static\install.js || goto fehler
call npm run dist || goto fehler
echo.
echo Fertig! Der Installer liegt im Ordner dist: Viola-Setup-*.exe
start "" "%~dp0dist"
pause
exit /b 0
:fehler
echo Fehler beim Bauen. Meldung oben lesen.
pause
exit /b 1

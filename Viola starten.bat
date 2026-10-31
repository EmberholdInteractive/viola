@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
if not exist "node_modules\electron\dist\electron.exe" call node node_modules\electron\install.js
if not exist "node_modules\ffmpeg-static\ffmpeg.exe" call node node_modules\ffmpeg-static\install.js
start "" /b npm start

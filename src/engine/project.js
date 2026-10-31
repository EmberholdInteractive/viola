const fs = require('fs');
const path = require('path');
const VERSION = 1;
function blank() { return { version: VERSION, name: 'Neues Projekt', settings: { preset: '720p', fps: 25, transitionDur: 1, defaultSlide: 5, transition: 'fade', motion: 'none' }, slides: [], audio: [], music: { normalize: true, lufs: -14 } }; }
function save(file, project) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(Object.assign({ version: VERSION }, project), null, 1)); fs.renameSync(file + '.tmp', file); }
function load(file) { const p = JSON.parse(fs.readFileSync(file, 'utf8')); return Object.assign(blank(), p); }
module.exports = { blank, save, load };

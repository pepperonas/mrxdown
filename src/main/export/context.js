// MrxDown Main — Export-Kontext
// Dependency-Injection für die Export-Module: main.js registriert Getter für
// veränderlichen App-Zustand (settings, currentFilePath), damit die Module keine
// main.js-Globals kennen müssen. APP_ROOT löst Ressourcen-Pfade (pdf-templates/,
// vendor/) unabhängig vom __dirname des jeweiligen Moduls auf — funktioniert im
// Dev-Tree und innerhalb von app.asar.
const path = require('path');

const APP_ROOT = path.join(__dirname, '..', '..', '..');

let _getSettings = () => ({});
let _getCurrentFilePath = () => null;

function configure({ getSettings, getCurrentFilePath } = {}) {
    if (getSettings) _getSettings = getSettings;
    if (getCurrentFilePath) _getCurrentFilePath = getCurrentFilePath;
}

module.exports = {
    APP_ROOT,
    configure,
    getSettings: () => _getSettings() || {},
    getCurrentFilePath: () => _getCurrentFilePath()
};

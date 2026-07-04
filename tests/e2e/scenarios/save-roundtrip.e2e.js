// Save-Roundtrip: saveFileSync schreibt exakt & atomar (kein Temp-Rest),
// Umlaute/UTF-8 bleiben erhalten.
// Regression für: atomare Writes (M10), updateGlobals-Semantik der Sync-Pfade.

const fs = require('fs');
const os = require('os');
const path = require('path');

module.exports = {
    name: 'save-roundtrip',
    async run(d) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrxdown-e2e-save-'));
        const target = path.join(dir, 'roundtrip äöü.md');
        const content = '# Titel mit Ümläuten\n\nInhalt: äöüß €\n\n- [x] erledigt\n';

        try {
            const result = await d.exec(`
                return await window.electronAPI.saveFileSync(${JSON.stringify(content)}, ${JSON.stringify(target)});
            `);
            d.assertEq('saveFileSync meldet Erfolg', result && result.success, true);
            d.assertEq('gemeldeter Pfad stimmt', result && result.filePath, target);

            const onDisk = fs.readFileSync(target, 'utf-8');
            d.assertEq('Datei-Inhalt byte-identisch (UTF-8/Umlaute)', onDisk, content);

            const leftovers = fs.readdirSync(dir).filter(f => f.includes('.mrxdown-tmp'));
            d.assertEq('kein atomarer Temp-Rest (M10)', leftovers, []);

            // Zweiter Save überschreibt sauber (rename über existierende Datei)
            const content2 = content + '\nZweite Version.\n';
            const result2 = await d.exec(`
                return await window.electronAPI.saveFileSync(${JSON.stringify(content2)}, ${JSON.stringify(target)});
            `);
            d.assertEq('Überschreiben meldet Erfolg', result2 && result2.success, true);
            d.assertEq('Überschreiben landet auf Platte', fs.readFileSync(target, 'utf-8'), content2);
        } finally {
            try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
        }
    }
};

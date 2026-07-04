// Screenshot-Hilfsszenario: rendert beide Themes mit Beispieldokument und
// legt PNGs unter tests/e2e/screenshots/ ab (visuelles Review + Doku).
const fs = require('fs');
const path = require('path');

const SAMPLE = [
    '# MrxDown — M3 Expressive',
    '',
    'Ein **Beispieldokument** mit `Code`, [Link](https://example.com) und Liste:',
    '',
    '- [x] Material 3 Expressive Tokens',
    '- [ ] Feder-Physik',
    '',
    '| Spalte A | Spalte B |',
    '|----------|----------|',
    '| tonal    | pille    |',
    '',
    '```js',
    'const spring = { stiffness: 380, damping: 0.8 };',
    '```',
].join('\n');

module.exports = {
    name: 'zz-screenshot',
    async run(d) {
        const outDir = path.join(__dirname, '..', 'screenshots');
        fs.mkdirSync(outDir, { recursive: true });
        d.win.setBounds({ width: 1400, height: 900 });
        await d.sleep(300);
        await d.setContent(SAMPLE);
        await d.sleep(600);

        for (const theme of ['dark', 'light']) {
            await d.exec(`settings.theme = '${theme}'; await applyThemeSetting(); renderMarkdown(true);`);
            await d.sleep(600);
            const img = await d.win.webContents.capturePage();
            fs.writeFileSync(path.join(outDir, `m3e-${theme}.png`), img.toPNG());
            d.assert(`${theme}-Screenshot geschrieben`, fs.statSync(path.join(outDir, `m3e-${theme}.png`)).size > 10000);
        }
        // Fokus-Test: Dialog öffnen und screenshotten (Modal-Look prüfen)
        await d.exec(`settings.theme = 'dark'; await applyThemeSetting(); showSettings();`);
        await d.sleep(500);
        const img = await d.win.webContents.capturePage();
        fs.writeFileSync(path.join(outDir, 'm3e-dialog.png'), img.toPNG());
        d.assert('Dialog-Screenshot geschrieben', true);
        await d.exec(`closeSettingsDialog();`);
    }
};

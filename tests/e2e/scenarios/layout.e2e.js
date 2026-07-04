// Layout-Invarianten: Kein Inhalt darf UI aus dem Fenster schieben oder
// Toolbar-Buttons abschneiden — bei keiner Fensterbreite.
// Regression für: Preview-Overflow durch lange Wörter (2026-07-04),
// Toolbar-Clipping, fehlendes min-width:0 auf Flex-Panes.

const REPRO = 'das'.repeat(120) + '\n\n| ' + 'x'.repeat(200) + ' | b |\n|---|---|\n| 1 | 2 |\n\n' +
    'https://example.com/' + 'sehr-lange-url-'.repeat(20) + '\n';

module.exports = {
    name: 'layout',
    async run(d) {
        await d.setContent(REPRO);
        for (const width of [1400, 1200, 1000, 900]) {
            await d.resize(width, 800);
            const m = await d.exec(`
                const w = window.innerWidth;
                const prev = document.getElementById('preview');
                const pane = document.querySelector('.preview-pane');
                const clipped = Array.from(document.querySelectorAll('.toolbar-button'))
                    .filter(b => b.offsetParent !== null)
                    .filter(b => { const r = b.getBoundingClientRect(); return r.right > w + 1 || r.left < -1; })
                    .map(b => b.getAttribute('data-tooltip'));
                return {
                    bodyOverflow: document.body.scrollWidth - w,
                    previewOverflow: prev.scrollWidth - prev.clientWidth,
                    paneRight: Math.round(pane.getBoundingClientRect().right),
                    winW: w,
                    clipped
                };
            `);
            d.assert(`(${width}px) Body kein horizontaler Overflow`, m.bodyOverflow <= 0, m);
            d.assert(`(${width}px) Preview bricht um (kein interner Overflow)`, m.previewOverflow <= 0, m);
            d.assert(`(${width}px) Preview-Pane endet an der Fensterkante`, m.paneRight <= m.winW + 1, m);
            d.assertEq(`(${width}px) keine abgeschnittenen Toolbar-Buttons`, m.clipped, []);
        }
    }
};

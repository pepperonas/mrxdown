// E4: Callouts (> [!NOTE] …) — voller Preview-Roundtrip durch die echte
// Render-Pipeline (marked-Extension → DOMPurify → morphdom). Prüft insbesondere,
// dass die Icon-SVGs die Sanitization überleben und normale Blockquotes
// Blockquotes bleiben.

module.exports = {
    name: 'callouts',
    async run(d) {
        await d.setContent(
            '> [!NOTE]\n> Ein **Hinweis** mit Markdown.\n\n' +
            '> [!WARNING] Eigener Titel\n> Warntext\n\n' +
            '> [!TIP]\n> - Listenpunkt\n\n' +
            '> Normales Zitat ohne Callout.'
        );

        const r = await d.exec(`
            const p = document.getElementById('preview');
            const note = p.querySelector('.callout.callout-note');
            const warn = p.querySelector('.callout.callout-warning');
            const tip = p.querySelector('.callout.callout-tip');
            return {
                noteExists: !!note,
                noteTitle: note ? note.querySelector('.callout-title span').textContent : null,
                noteHasIcon: note ? !!note.querySelector('svg.callout-icon') : false,
                noteBold: note ? !!note.querySelector('strong') : false,
                warnTitle: warn ? warn.querySelector('.callout-title span').textContent : null,
                tipHasList: tip ? !!tip.querySelector('li') : false,
                plainBlockquotes: p.querySelectorAll('blockquote').length,
                blockquoteInsideCallout: !!p.querySelector('.callout blockquote')
            };
        `);

        d.assert('Note-Callout gerendert', r.noteExists);
        d.assertEq('Standard-Label deutsch', r.noteTitle, 'Hinweis');
        d.assert('Icon-SVG überlebt DOMPurify', r.noteHasIcon);
        d.assert('Markdown im Callout-Body', r.noteBold);
        d.assertEq('Eigener Titel übernommen', r.warnTitle, 'Eigener Titel');
        d.assert('Liste im Tip-Callout', r.tipHasList);
        d.assertEq('Normales Zitat bleibt Blockquote', r.plainBlockquotes, 1);
        d.assertEq('Kein Blockquote im Callout', r.blockquoteInsideCallout, false);

        // Theme-Wechsel: Callout bleibt bestehen (Tokens schalten nur Farben)
        const themed = await d.exec(`
            toggleTheme();
            await new Promise(r => setTimeout(r, 400));
            const ok = !!document.querySelector('#preview .callout-note');
            toggleTheme();
            await new Promise(r => setTimeout(r, 400));
            return ok;
        `);
        d.assert('Callout übersteht Theme-Wechsel', themed);
    }
};

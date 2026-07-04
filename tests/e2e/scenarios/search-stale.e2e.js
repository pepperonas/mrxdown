// Suche: Treffer-Offsets dürfen nach Dokument-Edits nicht veralten.
// Regression für: M1 (stale searchMatches selektierten falsche Ranges).

module.exports = {
    name: 'search-stale',
    async run(d) {
        await d.setContent('alpha beta alpha gamma alpha');

        const first = await d.exec(`
            showSearchDialog();
            document.getElementById('searchInput').value = 'alpha';
            findNext();
            const sel = { start: editor.selectionStart, end: editor.selectionEnd };
            return { sel, text: editor.value.slice(sel.start, sel.end) };
        `);
        d.assertEq('erster Treffer selektiert "alpha"', first.text, 'alpha');
        d.assertEq('erster Treffer an Position 0', first.sel.start, 0);

        // Dokument VOR den Treffern editieren → alte Offsets wären falsch
        const afterEdit = await d.exec(`
            editor.cmView.dispatch({ changes: { from: 0, to: 0, insert: 'XXXX ' } });
            findNext();
            const sel = { start: editor.selectionStart, end: editor.selectionEnd };
            return { sel, text: editor.value.slice(sel.start, sel.end) };
        `);
        // M1-Regression: die Selektion muss exakt auf einem "alpha" landen
        d.assertEq('Treffer nach Edit noch korrekt (M1)', afterEdit.text, 'alpha');

        await d.exec(`closeSearchDialog();`);

        // Fokus kehrt zum Editor zurück (L12)
        const focused = await d.exec(`
            return document.activeElement && !!document.activeElement.closest('.cm-editor');
        `);
        d.assertEq('Fokus nach Dialog-Schließen im Editor (L12)', focused, true);
    }
};

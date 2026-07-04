// A6: Undo-History überlebt Tab-Wechsel; Theme-Änderungen auf anderem Tab
// springen beim Rückwechsel NICHT zurück (Compartment-Reapply in setState).

module.exports = {
    name: 'undo-per-tab',
    async run(d) {
        // In Tab 1 zwei getrennte Edits tippen
        await d.exec(`editor.cmView.dispatch({ changes: { from: 0, insert: 'ERSTER ' } });`);
        await d.sleep(700); // > CM6 newGroupDelay (500 ms), sonst verschmelzen beide Edits zu EINEM Undo-Schritt
        await d.exec(`editor.cmView.dispatch({ changes: { from: 7, insert: 'ZWEITER ' } });`);
        await d.sleep(150);

        const t1 = await d.exec(`return { id: activeTabId, val: editor.value };`);
        d.assertEq('Tab 1 hat beide Edits', t1.val, 'ERSTER ZWEITER ');

        // Neuen Tab öffnen, dort Theme umschalten, zurückwechseln
        const themed = await d.exec(`
            handleMenuAction('new-file');
            toggleTheme(); // App ist jetzt hell (Start: dunkel)
            await new Promise(r => setTimeout(r, 350)); // View-Transition abwarten
            switchTab(${t1.id});
            return { bodyLight: document.body.classList.contains('light-theme'),
                     editorVal: editor.value };
        `);
        d.assertEq('Inhalt nach Rückwechsel intakt', themed.editorVal, 'ERSTER ZWEITER ');
        // Regression Compartment-Reapply: das App-Theme bleibt hell, obwohl
        // Tab 1s gespeicherter EditorState mit dunklem Editor-Theme angelegt wurde
        d.assertEq('Theme bleibt nach Tab-Rückwechsel erhalten', themed.bodyLight, true);

        // Undo muss die History von Tab 1 treffen
        const afterUndo = await d.exec(`editor.undo(); return editor.value;`);
        d.assertEq('Undo entfernt letzten Edit (History überlebt Tab-Wechsel)', afterUndo, 'ERSTER ');

        const afterRedo = await d.exec(`editor.redo(); return editor.value;`);
        d.assertEq('Redo stellt Edit wieder her', afterRedo, 'ERSTER ZWEITER ');

        // Theme zurücksetzen für Szenario-Unabhängigkeit
        await d.exec(`settings.theme = 'dark'; await applyThemeSetting();`);
    }
};

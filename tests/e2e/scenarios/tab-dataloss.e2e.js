// Datenverlust-Regressionen (kritische Audit-Funde 2026-07-03):
// C1 — ⌘N/Öffnen verwarf ungespeicherte Änderungen des aktuellen Tabs
// C2 — Hintergrund-Tab schließen setzte den aktiven Tab zurück
// H1 — Menü-Aktionen markierten Tabs fälschlich als geändert

module.exports = {
    name: 'tab-dataloss',
    async run(d) {
        // --- C1: Tippen → neuer Tab → zurückwechseln: Text muss überleben ---
        await d.exec(`
            // Echtes Tippen simulieren: docChanged-Dispatch (löst input-Event + isModified aus)
            const doc = editor.cmView.state.doc;
            editor.cmView.dispatch({ changes: { from: 0, to: doc.length, insert: 'UNGESPEICHERTER TEXT 123' } });
        `);
        await d.sleep(300);
        const before = await d.exec(`
            return { content: editor.value, tabCount: tabs.length, firstTabId: tabs[0].id,
                     modified: tabs.find(t => t.id === activeTabId).isModified };
        `);
        d.assertEq('Tippen setzt isModified', before.modified, true);

        await d.exec(`handleMenuAction('new-file');`);
        await d.sleep(300);
        const afterNew = await d.exec(`
            return { tabCount: tabs.length,
                     newTabModified: tabs.find(t => t.id === activeTabId).isModified,
                     newTabContent: editor.value };
        `);
        d.assertEq('⌘N erzeugt neuen Tab', afterNew.tabCount, before.tabCount + 1);
        // H1-Regression: frischer Tab darf NICHT als geändert gelten
        d.assertEq('neuer Tab ist unverändert (H1)', afterNew.newTabModified, false);
        d.assertEq('neuer Tab ist leer', afterNew.newTabContent, '');

        const backOnFirst = await d.exec(`
            switchTab(${before.firstTabId});
            return editor.value;
        `);
        // C1-Regression: der getippte Text muss nach dem Rückwechsel noch da sein
        d.assertEq('Text überlebt ⌘N + Tab-Rückwechsel (C1)', backOnFirst, 'UNGESPEICHERTER TEXT 123');

        // --- C2: Hintergrund-Tab schließen darf aktiven Tab nicht zurücksetzen ---
        await d.exec(`
            editor.cmView.dispatch({ changes: { from: editor.value.length, insert: ' PLUS NEUE ZEILE' } });
        `);
        await d.sleep(200);
        const state = await d.exec(`
            const bg = tabs.find(t => t.id !== activeTabId); // der leere neue Tab
            return { bgId: bg.id, bgModified: bg.isModified, active: editor.value };
        `);
        d.assertEq('Hintergrund-Tab ist unmodifiziert (kein Dialog nötig)', state.bgModified, false);

        await d.exec(`closeTab(${state.bgId});`);
        await d.sleep(300);
        const afterClose = await d.exec(`return { content: editor.value, tabCount: tabs.length };`);
        d.assertEq('Hintergrund-Tab wurde geschlossen', afterClose.tabCount, before.tabCount);
        // C2-Regression: aktiver Editor-Inhalt unangetastet
        d.assertEq('aktiver Tab überlebt Schließen des Hintergrund-Tabs (C2)',
            afterClose.content, 'UNGESPEICHERTER TEXT 123 PLUS NEUE ZEILE');

        // --- H1: nicht-mutierende Aktionen dürfen nicht dirty machen ---
        const h1 = await d.exec(`
            const t = tabs.find(x => x.id === activeTabId);
            const wasModified = t.isModified;
            handleMenuAction('find');
            closeSearchDialog();
            handleMenuAction('toggle-sidebar');
            handleMenuAction('toggle-sidebar');
            return { before: wasModified, after: t.isModified };
        `);
        d.assertEq('Suchen/Sidebar ändern Modified-Status nicht (H1)', h1.after, h1.before);
    }
};

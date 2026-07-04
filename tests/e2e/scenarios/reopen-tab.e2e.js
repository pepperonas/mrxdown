// ⌘⇧T: Geschlossener Tab kommt mit Inhalt zurück (Feature 2026-07-03).

module.exports = {
    name: 'reopen-tab',
    async run(d) {
        const state = await d.exec(`
            const t = createNewTab('Inhalt des zweiten Tabs', null);
            t.isModified = false; // kein Schließen-Dialog im Test
            renderTabs();
            return { id: t.id, count: tabs.length };
        `);

        const afterClose = await d.exec(`
            await closeTab(${state.id});
            return { count: tabs.length, ids: tabs.map(t => t.id) };
        `);
        d.assertEq('Tab wurde geschlossen', afterClose.count, state.count - 1);
        d.assert('geschlossener Tab nicht mehr in Liste', !afterClose.ids.includes(state.id));

        const afterReopen = await d.exec(`
            reopenClosedTab();
            return { count: tabs.length, content: editor.value,
                     activeModifiedFlagIsBool: typeof tabs.find(t => t.id === activeTabId).isModified === 'boolean' };
        `);
        d.assertEq('Tab-Anzahl wieder wie vorher', afterReopen.count, state.count);
        d.assertEq('Inhalt wiederhergestellt', afterReopen.content, 'Inhalt des zweiten Tabs');
    }
};

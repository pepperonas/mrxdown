// E2: Slash-Commands & Snippets — Trigger am Zeilenanfang, Filterung,
// Einfügen mit {{cursor}}-Stop, eigene Snippets aus settings, und der
// Nicht-Trigger mitten in Prosa/URLs.

module.exports = {
    name: 'slash-commands',
    async run(d) {
        // Trigger + Filterung: "/tab" → Tabelle vorn
        const open = await d.exec(`
            editor.value = '/tab';
            editor.selectionStart = editor.selectionEnd = editor.value.length;
            checkAutocomplete();
            const popup = document.getElementById('autocompletePopup');
            const items = [...popup.querySelectorAll('.autocomplete-item')];
            return {
                visible: popup.style.display === 'block',
                first: items[0] ? items[0].querySelector('span').textContent : null
            };
        `);
        d.assert('Slash-Menü öffnet bei /tab', open.visible);
        d.assertEq('Tabelle ist erster Treffer', open.first, 'Tabelle');

        // Auswahl ersetzt /tab durch das Tabellen-Gerüst, Cursor am {{cursor}}-Stop
        const inserted = await d.exec(`
            const popup = document.getElementById('autocompletePopup');
            popup.querySelector('.autocomplete-item').click();
            return {
                value: editor.value,
                cursor: editor.selectionStart,
                popupClosed: popup.style.display !== 'block'
            };
        `);
        d.assert('Tabellen-Gerüst eingefügt', inserted.value.startsWith('| Spalte 1 |'), inserted.value);
        d.assert('Kein /tab-Rest', !inserted.value.includes('/tab'));
        d.assert('Cursor am Stop in der ersten Zelle', inserted.value.substring(inserted.cursor - 2, inserted.cursor) === '| ', String(inserted.cursor));
        d.assert('Popup geschlossen', inserted.popupClosed);

        // Datum-Befehl expandiert {{date}} zu ISO
        const datum = await d.exec(`
            editor.value = '/datum';
            editor.selectionStart = editor.selectionEnd = editor.value.length;
            checkAutocomplete();
            document.querySelector('#autocompletePopup .autocomplete-item').click();
            return editor.value;
        `);
        d.assert('Datum als ISO eingefügt', /^\d{4}-\d{2}-\d{2}$/.test(datum), datum);

        // Eigenes Snippet aus settings erscheint zuerst und expandiert Platzhalter
        const custom = await d.exec(`
            settings.snippets = [{ name: 'gruss', body: 'Hallo aus {{title}}!{{cursor}} Ende' }];
            editor.value = '/gru';
            editor.selectionStart = editor.selectionEnd = editor.value.length;
            checkAutocomplete();
            const item = document.querySelector('#autocompletePopup .autocomplete-item');
            const hint = item.querySelector('.autocomplete-hint');
            item.click();
            const result = { value: editor.value, cursor: editor.selectionStart, hint: hint ? hint.textContent : null };
            settings.snippets = [];
            return result;
        `);
        d.assert('Eigenes Snippet expandiert', custom.value.startsWith('Hallo aus ') && custom.value.endsWith('! Ende'), custom.value);
        d.assertEq('Snippet-Hint angezeigt', custom.hint, 'Snippet');
        d.assertEq('Cursor am Stop', custom.value.substring(0, custom.cursor).endsWith('!'), true);

        // Kein Trigger mitten in der Zeile (Prosa, URLs)
        const noTrigger = await d.exec(`
            editor.value = 'Preis pro Stück: 5€/kg';
            editor.selectionStart = editor.selectionEnd = editor.value.length;
            checkAutocomplete();
            const midline = document.getElementById('autocompletePopup').style.display === 'block';
            editor.value = 'https://celox.io/pfad';
            editor.selectionStart = editor.selectionEnd = editor.value.length;
            checkAutocomplete();
            const inUrl = document.getElementById('autocompletePopup').style.display === 'block';
            return { midline, inUrl };
        `);
        d.assertEq('Kein Trigger in Prosa', noTrigger.midline, false);
        d.assertEq('Kein Trigger in URL', noTrigger.inUrl, false);

        // Snippet-Verwaltung: anlegen → in settings, löschen funktioniert
        const mgmt = await d.exec(`
            showSnippetsDialog();
            document.getElementById('snippetName').value = 'Test Snippet';
            document.getElementById('snippetBody').value = 'Inhalt {{date}}';
            await saveSnippet();
            const saved = settings.snippets.find(s => s.name === 'test-snippet');
            const modalVisible = document.getElementById('snippetsModal').classList.contains('visible');
            // aufräumen
            settings.snippets = [];
            closeSnippetsDialog();
            return { saved: !!saved, normalized: saved ? saved.name : null, modalVisible };
        `);
        d.assert('Snippet gespeichert', mgmt.saved);
        d.assertEq('Name normalisiert (kebab-case)', mgmt.normalized, 'test-snippet');
        d.assert('Dialog war sichtbar', mgmt.modalVisible);
    }
};

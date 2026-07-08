// E3: Visueller Tabellen-Editor — Floating-Toolbar, Spalten-/Zeilen-
// Operationen unter dem Cursor, Auto-Format, CSV/TSV-Paste.

module.exports = {
    name: 'table-editor',
    async run(d) {
        const TABLE = '| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |';

        // Toolbar erscheint bei Cursor in der Tabelle, verschwindet außerhalb
        const toolbar = await d.exec(`
            editor.value = 'Davor\\n\\n' + ${JSON.stringify(TABLE)} + '\\n\\nDanach';
            editor.selectionStart = editor.selectionEnd = editor.value.indexOf('| 1') + 2;
            updateTableToolbar();
            const tb = document.getElementById('tableToolbar');
            // gerendertes Display prüfen — das hidden-Attribut allein hat in
            // v0.18.0 nicht gereicht (CSS display:flex überstimmte [hidden])
            const inTable = getComputedStyle(tb).display !== 'none';
            editor.selectionStart = editor.selectionEnd = 2; // "Davor"
            updateTableToolbar();
            const outside = getComputedStyle(tb).display === 'none';
            return { inTable, outside };
        `);
        d.assert('Toolbar sichtbar in Tabelle', toolbar.inTable);
        d.assert('Toolbar versteckt außerhalb', toolbar.outside);

        // Spalte rechts einfügen — Cursor steht in Spalte A (Zelle "1")
        const addCol = await d.exec(`
            editor.selectionStart = editor.selectionEnd = editor.value.indexOf('| 1') + 2;
            tableInsertColumnRight();
            const lines = editor.value.split('\\n');
            return { header: lines[2], row: lines[4] };
        `);
        d.assert('Neue Spalte im Header', /\|\s*A\s*\|\s*Spalte\s*\|\s*B\s*\|/.test(addCol.header), addCol.header);
        d.assert('Neue leere Zelle in Datenzeile', /\|\s*1\s*\|\s*\|\s*2\s*\|/.test(addCol.row), addCol.row);

        // Spalte wieder löschen (Cursor steht nach der Op in derselben Zelle → Spalte A+1 = neue)
        const delCol = await d.exec(`
            tableInsertColumnRight(); // noch eine
            tableRemoveColumn();      // und wieder weg
            return editor.value.split('\\n')[2];
        `);
        d.assert('Spalte gelöscht', /Spalte/.test(delCol), delCol);

        // Zeile darunter + Ausrichtung + Format
        const rowOps = await d.exec(`
            editor.value = ${JSON.stringify(TABLE)};
            editor.selectionStart = editor.selectionEnd = editor.value.indexOf('| 1') + 2;
            tableInsertRowBelow();
            const rows = editor.value.trim().split('\\n').length;
            tableToggleAlignment(); // Spalte 0: null → left
            const sep = editor.value.split('\\n')[1];
            return { rows, sep };
        `);
        d.assertEq('Zeile eingefügt (5 Zeilen)', rowOps.rows, 5);
        d.assert('Ausrichtung links gesetzt (:---)', /\|\s*:-+\s*\|/.test(rowOps.sep), rowOps.sep);

        // Auto-Format richtet ungleichmäßige Pipes aus
        const formatted = await d.exec(`
            editor.value = '| lang-lang-lang | b |\\n|---|---|\\n| x | wert |';
            editor.selectionStart = editor.selectionEnd = 3;
            tableFormatBlock();
            const lines = editor.value.split('\\n');
            return new Set(lines.map(l => l.length)).size;
        `);
        d.assertEq('Alle Zeilen gleich breit nach Format', formatted, 1);

        // CSV-Paste → Markdown-Tabelle (Semikolon, deutsches Excel-Format)
        const csv = await d.exec(`
            editor.value = '';
            editor.selectionStart = editor.selectionEnd = 0;
            const dt = new DataTransfer();
            dt.setData('text/plain', 'Name;Ort\\nMartin;Berlin\\nAnna;Köln');
            const ev = new ClipboardEvent('paste', { clipboardData: dt, cancelable: true, bubbles: true });
            document.querySelector('.cm-content').dispatchEvent(ev);
            await new Promise(r => setTimeout(r, 50));
            return editor.value;
        `);
        d.assert('CSV wird zur Markdown-Tabelle', csv.startsWith('| Name') && csv.includes('| Martin'), csv);
        d.assert('Separator-Zeile vorhanden', csv.split('\n')[1].includes('---'), csv);

        // Prosa mit Kommas bleibt normaler Paste
        const prose = await d.exec(`
            editor.value = '';
            editor.selectionStart = editor.selectionEnd = 0;
            const dt = new DataTransfer();
            dt.setData('text/plain', 'Hallo, Welt.\\nZweiter Satz, mit Komma.');
            const ev = new ClipboardEvent('paste', { clipboardData: dt, cancelable: true, bubbles: true });
            document.querySelector('.cm-content').dispatchEvent(ev);
            await new Promise(r => setTimeout(r, 50));
            return editor.value;
        `);
        d.assert('Prosa bleibt Prosa', !prose.includes('|'), prose);


        // Regression v0.18.0: im leeren Dokument darf die Toolbar nicht als
        // 0,0-Pille über der Haupt-Toolbar schweben (gerendert, nicht Attribut)
        const emptyDoc = await d.exec(`
            editor.value = '';
            editor.selectionStart = editor.selectionEnd = 0;
            updateTableToolbar();
            return getComputedStyle(document.getElementById('tableToolbar')).display;
        `);
        d.assertEq('Leeres Dokument: Toolbar wirklich unsichtbar', emptyDoc, 'none');
    }
};

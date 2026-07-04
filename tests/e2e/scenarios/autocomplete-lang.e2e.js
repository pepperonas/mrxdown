// Code-Fence-Autocomplete: Liste scrollt mit der Pfeiltasten-Auswahl
// (Fix 2026-07-04), Tippen filtert, Auswahl ersetzt das getippte Präfix.
// '\x60' = Backtick — vermeidet Escaping-Kollisionen in den exec-Strings.

module.exports = {
    name: 'autocomplete-lang',
    async run(d) {
        // ``` "tippen" → Popup mit der vollen Sprachliste
        const opened = await d.exec(`
            const FENCE = '\\x60\\x60\\x60';
            editor.value = FENCE;
            editor.selectionStart = editor.selectionEnd = 3; // Cursor hinter die Fence
            checkAutocomplete();
            const popup = document.getElementById('autocompletePopup');
            return {
                visible: popup && popup.style.display === 'block',
                count: popup ? popup.querySelectorAll('.autocomplete-item').length : 0
            };
        `);
        d.assertEq('Popup öffnet bei Fence', opened.visible, true);
        d.assert('Liste umfasst >30 Sprachen', opened.count > 30, opened.count);

        // Pfeiltasten weit nach unten → Popup muss mitscrollen (Regression)
        const scrolled = await d.exec(`
            const popup = document.getElementById('autocompletePopup');
            const fake = { key: 'ArrowDown', preventDefault() {} };
            for (let i = 0; i < 20; i++) handleAutocompleteKeydown(fake);
            const sel = popup.querySelector('.autocomplete-item.selected');
            const pr = popup.getBoundingClientRect();
            const sr = sel.getBoundingClientRect();
            return {
                scrollTop: popup.scrollTop,
                selectedVisible: sr.top >= pr.top - 1 && sr.bottom <= pr.bottom + 1,
                selectedText: sel.textContent
            };
        `);
        d.assert('Popup hat gescrollt (scrollTop > 0)', scrolled.scrollTop > 0, scrolled);
        d.assertEq('Auswahl bleibt sichtbar', scrolled.selectedVisible, true);

        // Tippen filtert: ```py → nur python
        const filtered = await d.exec(`
            const FENCE = '\\x60\\x60\\x60';
            editor.value = FENCE + 'py';
            editor.selectionStart = editor.selectionEnd = 5;
            checkAutocomplete();
            const popup = document.getElementById('autocompletePopup');
            return Array.from(popup.querySelectorAll('.autocomplete-item')).map(i => i.textContent);
        `);
        d.assertEq('Präfix-Filter (py → python)', filtered, ['python']);

        // Enter übernimmt und ersetzt das Präfix
        const accepted = await d.exec(`
            handleAutocompleteKeydown({ key: 'Enter', preventDefault() {} });
            return editor.value;
        `);
        const FENCE = '\x60\x60\x60';
        d.assertEq('Auswahl ersetzt Präfix + schließt Fence',
            accepted, FENCE + 'python\n\n' + FENCE);

        // Unbekanntes Präfix blendet das Popup aus
        const unknown = await d.exec(`
            const FENCE = '\\x60\\x60\\x60';
            editor.value = FENCE + 'zzz';
            editor.selectionStart = editor.selectionEnd = 6;
            checkAutocomplete();
            return document.getElementById('autocompletePopup').style.display;
        `);
        d.assertEq('unbekanntes Präfix → Popup zu', unknown, 'none');

        await d.exec(`editor.value = ''; hideAutocomplete();`);
    }
};

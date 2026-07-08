// E1: Wiki-Links & Backlinks — voller Roundtrip gegen einen echten Temp-Vault:
// Index (rekursiv), Preview-Rendering (aufgelöst/fehlend/Alias), Klick-Öffnen,
// [[-Autocomplete aus dem Vault, Backlinks-Panel.

const fs = require('fs');
const os = require('os');
const path = require('path');

module.exports = {
    name: 'wiki-links',
    async run(d) {
        // Temp-Vault: zwei Verweise auf "Ziel" (einer aus Unterordner), ein Ziel
        const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'mrxdown-vault-'));
        fs.writeFileSync(path.join(vault, 'Ziel.md'), '# Ziel\n\nInhalt.\n');
        fs.writeFileSync(path.join(vault, 'noteA.md'), 'Siehe [[Ziel]] und [[Ziel|nochmal]].\n');
        fs.mkdirSync(path.join(vault, 'sub'));
        fs.writeFileSync(path.join(vault, 'sub', 'Tief.md'), 'Auch ich: [[ziel]]\n');

        try {
            // Vault laden → Index rekursiv (3 Dateien inkl. sub/)
            const indexSize = await d.exec(`
                await loadFileTree(${JSON.stringify(vault)});
                await refreshVaultIndex();
                return vaultIndex.length;
            `);
            d.assertEq('Vault-Index rekursiv (3 Dateien)', indexSize, 3);

            // Preview: aufgelöst vs. fehlend vs. Alias
            await d.setContent('Link zu [[Ziel]], zu [[Gibtsnicht]] und [[Ziel|Mein Alias]].');
            const preview = await d.exec(`
                const p = document.getElementById('preview');
                const links = [...p.querySelectorAll('.wiki-link')];
                return {
                    count: links.length,
                    resolvedPath: links[0] ? links[0].dataset.wikiPath : null,
                    missingClass: links[1] ? links[1].classList.contains('wiki-link-missing') : false,
                    aliasLabel: links[2] ? links[2].textContent : null
                };
            `);
            d.assertEq('3 Wiki-Links gerendert', preview.count, 3);
            d.assert('Aufgelöster Link trägt Pfad', (preview.resolvedPath || '').endsWith('Ziel.md'), preview.resolvedPath);
            d.assert('Fehlender Link markiert', preview.missingClass);
            d.assertEq('Alias ist das Label', preview.aliasLabel, 'Mein Alias');

            // Klick auf aufgelösten Link öffnet die Datei als Tab
            const opened = await d.exec(`
                const link = document.querySelector('#preview .wiki-link[data-wiki-path]');
                await handleWikiLinkClick(link);
                await new Promise(r => setTimeout(r, 400));
                const activeTab = tabs.find(t => t.id === activeTabId);
                return activeTab ? activeTab.filePath : null;
            `);
            d.assert('Klick öffnet Ziel.md', (opened || '').endsWith('Ziel.md'), opened);

            // Backlinks-Panel: noteA + sub/Tief verlinken auf Ziel (case-insensitive)
            const backlinks = await d.exec(`
                await updateBacklinksPanel();
                const items = [...document.querySelectorAll('#backlinksPanel .backlink-item .backlink-name')];
                return items.map(i => i.textContent).sort();
            `);
            d.assertEq('Backlinks gefunden', JSON.stringify(backlinks), JSON.stringify(['Tief', 'noteA']));

            // Autocomplete: [[Zi → Vorschlag "Ziel", Auswahl vervollständigt + schließt
            const auto = await d.exec(`
                editor.value = 'Neu: [[Zi';
                editor.selectionStart = editor.selectionEnd = editor.value.length;
                checkAutocomplete();
                const popup = document.getElementById('autocompletePopup');
                const items = [...popup.querySelectorAll('.autocomplete-item')];
                const visible = popup.style.display === 'block';
                const first = items[0] ? items[0].textContent : null;
                if (items[0]) items[0].click();
                return { visible, first, value: editor.value };
            `);
            d.assert('Popup sichtbar bei [[', auto.visible);
            d.assertEq('Vorschlag aus dem Vault', auto.first, 'Ziel');
            d.assertEq('Vervollständigung schließt die Klammern', auto.value, 'Neu: [[Ziel]]');

            // IPC-Härtung: kaputte Payloads → leere Ergebnisse, kein Crash
            const hardened = await d.exec(`
                const a = await window.electronAPI.getVaultIndex(12345);
                const b = await window.electronAPI.findBacklinks({ vaultRoot: null, targetPath: 42 });
                return { a: a.length, b: b.length };
            `);
            d.assertEq('getVaultIndex validiert Input', hardened.a, 0);
            d.assertEq('findBacklinks validiert Input', hardened.b, 0);
        } finally {
            fs.rmSync(vault, { recursive: true, force: true });
        }
    }
};

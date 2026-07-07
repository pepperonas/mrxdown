// K6: Paste-as-Markdown + .docx/.html-Import.
// Prüft die Turndown-Konvertierung, die Paste-Präzedenz (HTML→MD nur bei echter
// Struktur, nie aus dem eigenen Editor, nie im Code-Fence) und den Import-Pfad
// inkl. DOCX→HTML→Markdown-Roundtrip über die echte mammoth-IPC.

const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'paste-import',
    async run(d) {
        // --- Turndown-Konvertierung (ATX-Headings, GFM-Tabellen, Listen) ---
        const converted = await d.exec(`
            return convertHtmlToMarkdown(
                '<h2>Titel</h2><p>Text mit <strong>fett</strong> und <a href="https://x.de">Link</a>.</p>' +
                '<ul><li>eins</li><li>zwei</li></ul>' +
                '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
            );
        `);
        d.assert('ATX-Heading', converted.includes('## Titel'), converted);
        d.assert('Fett + Link', converted.includes('**fett**') && converted.includes('[Link](https://x.de)'), converted);
        d.assert('Liste mit -', converted.includes('- eins') && converted.includes('- zwei'), converted);
        d.assert('GFM-Tabelle', converted.includes('| A') && converted.includes('| ---'), converted);

        // Google-Docs-Wrapper wird entpackt (sonst wäre alles fett)
        const gdocs = await d.exec(`
            return convertHtmlToMarkdown('<b style="font-weight:normal" id="docs-internal-guid-abc"><p>Nur <em>kursiv</em>.</p></b>');
        `);
        d.assert('Google-Docs-Wrapper entpackt', !gdocs.includes('**') && gdocs.includes('*kursiv*'), gdocs);

        // --- Paste-Pipeline: synthetisches Paste-Event mit text/html auf dem Editor ---
        const pasted = await d.exec(`
            editor.value = '';
            const dt = new DataTransfer();
            dt.setData('text/html', '<h1>Aus HTML</h1><p>Mit <em>Stil</em>.</p>');
            dt.setData('text/plain', 'Aus HTML\\nMit Stil.');
            const ev = new ClipboardEvent('paste', { clipboardData: dt, cancelable: true, bubbles: true });
            document.querySelector('.cm-content').dispatchEvent(ev);
            await new Promise(r => setTimeout(r, 50));
            return { prevented: ev.defaultPrevented, content: editor.value };
        `);
        d.assert('HTML-Paste wird abgefangen', pasted.prevented);
        // Exakt-Vergleich: bei doppelter Einfügung (CM-plain + unser Markdown) schlüge das fehl
        d.assertEq('NUR Markdown eingefügt', pasted.content, '# Aus HTML\n\nMit *Stil*.');

        // Wrapper-only-HTML (div/p) → KEINE Konvertierung, normaler Paste-Pfad
        const wrapperOnly = await d.exec(`
            editor.value = '';
            const dt = new DataTransfer();
            dt.setData('text/html', '<div><p>Nur Text</p></div>');
            dt.setData('text/plain', 'Nur Text');
            const ev = new ClipboardEvent('paste', { clipboardData: dt, cancelable: true, bubbles: true });
            document.querySelector('.cm-content').dispatchEvent(ev);
            await new Promise(r => setTimeout(r, 50));
            return editor.value;
        `);
        d.assertEq('Wrapper-HTML bleibt normaler Paste (CM fügt plain ein)', wrapperOnly, 'Nur Text');

        // Copy aus dem eigenen Editor (cm-line-Markup) → keine Konvertierung
        const cmCopy = await d.exec(`
            editor.value = '';
            const dt = new DataTransfer();
            dt.setData('text/html', '<div class="cm-line"><strong># Titel</strong></div>');
            dt.setData('text/plain', '# Titel');
            const ev = new ClipboardEvent('paste', { clipboardData: dt, cancelable: true, bubbles: true });
            document.querySelector('.cm-content').dispatchEvent(ev);
            await new Promise(r => setTimeout(r, 50));
            return editor.value;
        `);
        d.assertEq('Editor-eigenes HTML bleibt normaler Paste', cmCopy, '# Titel');

        // Im offenen Code-Fence → keine Konvertierung
        const inFence = await d.exec(`
            editor.value = '\u0060\u0060\u0060js\\ncode hier\\n';
            editor.cmView.dispatch({ selection: { anchor: editor.value.length } });
            const dt = new DataTransfer();
            dt.setData('text/html', '<h1>Nicht konvertieren</h1>');
            dt.setData('text/plain', 'Nicht konvertieren');
            const ev = new ClipboardEvent('paste', { clipboardData: dt, cancelable: true, bubbles: true });
            document.querySelector('.cm-content').dispatchEvent(ev);
            await new Promise(r => setTimeout(r, 50));
            return editor.value;
        `);
        d.assert('Im Code-Fence keine Konvertierung (plain, kein Heading)',
            inFence.endsWith('Nicht konvertieren') && !inFence.includes('# Nicht'), inFence);

        // Setting aus → keine Konvertierung
        const settingOff = await d.exec(`
            editor.value = '';
            settings.pasteHtmlAsMarkdown = false;
            const dt = new DataTransfer();
            dt.setData('text/html', '<h1>Aus</h1>');
            dt.setData('text/plain', 'Aus');
            const ev = new ClipboardEvent('paste', { clipboardData: dt, cancelable: true, bubbles: true });
            document.querySelector('.cm-content').dispatchEvent(ev);
            await new Promise(r => setTimeout(r, 50));
            settings.pasteHtmlAsMarkdown = true;
            return editor.value;
        `);
        d.assertEq('Setting aus → keine Konvertierung', settingOff, 'Aus');

        // --- Import: .html-Datei als neuer Tab ---
        const htmlImport = await d.exec(`
            const before = tabs.length;
            const file = new File(['<h1>HTML Import</h1><p>Absatz.</p>'], 'seite.html', { type: 'text/html' });
            await importDroppedFile(file);
            const tab = tabs[tabs.length - 1];
            return { added: tabs.length - before, title: tab.title, modified: tab.isModified, content: editor.value };
        `);
        d.assertEq('HTML-Import öffnet neuen Tab', htmlImport.added, 1);
        d.assertEq('Tab-Titel aus Dateiname', htmlImport.title, 'seite.md');
        d.assert('Tab ist ungespeichert markiert', htmlImport.modified);
        d.assert('Markdown im Editor', htmlImport.content.includes('# HTML Import'), htmlImport.content);

        // --- Import: .docx über die echte mammoth-IPC (Fixture als Bytes) ---
        const docxB64 = fs.readFileSync(path.join(__dirname, '..', '..', 'fixtures', 'import-sample.docx')).toString('base64');
        const docxImport = await d.exec(`
            const bytes = Uint8Array.from(atob('${docxB64}'), c => c.charCodeAt(0));
            const before = tabs.length;
            const file = new File([bytes], 'bericht.docx');
            await importDroppedFile(file);
            const tab = tabs[tabs.length - 1];
            return { added: tabs.length - before, title: tab.title, content: editor.value };
        `);
        d.assertEq('DOCX-Import öffnet neuen Tab', docxImport.added, 1);
        d.assertEq('DOCX-Tab-Titel', docxImport.title, 'bericht.md');
        d.assert('DOCX → Markdown (Heading + fett)',
            docxImport.content.includes('# Import Test') && docxImport.content.includes('**fett**'),
            docxImport.content);

        // --- IPC-Validierung: kaputte Payloads enden als Fehler, nie als Crash ---
        const badPayload = await d.exec(`return await window.electronAPI.convertDocxToHtml({ data: 'kein-array' });`);
        d.assert('Ungültige DOCX-Daten werden abgelehnt', badPayload && !!badPayload.error, JSON.stringify(badPayload));
    }
};

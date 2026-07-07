// K1: Export-Registry + gemeinsamer Export-Dialog.
// Prüft den Format-Katalog (get-export-formats), das Umschalten der
// format-spezifischen Options-Sektion und den Modal-Lebenszyklus.

module.exports = {
    name: 'export-dialog',
    async run(d) {
        // Registry-Katalog über die preload-Bridge
        const formats = await d.exec(`return await window.electronAPI.getExportFormats();`);
        d.assert('Registry liefert Format-Liste', Array.isArray(formats) && formats.length >= 2,
            `bekam: ${JSON.stringify(formats)}`);
        const ids = (formats || []).map(f => f.id);
        d.assert('HTML-Format registriert', ids.includes('html'));
        d.assert('PDF-Format registriert', ids.includes('pdf'));
        const pdf = (formats || []).find(f => f.id === 'pdf') || {};
        d.assertEq('PDF deklariert Options-Panel', pdf.optionsPanel, 'pdf');
        d.assert('PDF deklariert benötigte Dokumentfelder',
            Array.isArray(pdf.needs) && pdf.needs.includes('previewHtml') && pdf.needs.includes('rawMarkdown'));

        // export-document validiert Inputs main-seitig (beide Fälle enden VOR dem Save-Dialog)
        const badFormat = await d.exec(`return await window.electronAPI.exportDocument({ formatId: 'gibtsnicht' });`);
        d.assert('Unbekanntes Format wird abgelehnt', badFormat && badFormat.success === false && /Unbekanntes Exportformat/.test(badFormat.error || ''),
            `bekam: ${JSON.stringify(badFormat)}`);
        const emptyDoc = await d.exec(`return await window.electronAPI.exportDocument({ formatId: 'html', fullHtml: '   ' });`);
        d.assert('Leerer Inhalt wird abgelehnt', emptyDoc && emptyDoc.success === false && /leer/.test(emptyDoc.error || ''),
            `bekam: ${JSON.stringify(emptyDoc)}`);

        // Dialog öffnen: PDF ist vorausgewählt, PDF-Optionen sichtbar
        const opened = await d.exec(`
            await showExportDialog();
            const modal = document.getElementById('exportModal');
            const select = document.getElementById('exportFormat');
            return {
                visible: modal.classList.contains('visible'),
                optionCount: select.options.length,
                selected: select.value,
                pdfOptionsVisible: !document.getElementById('exportPdfOptions').hidden
            };
        `);
        d.assert('Dialog ist sichtbar', opened.visible);
        d.assert('Format-Select ist befüllt', opened.optionCount >= 2);
        d.assertEq('PDF ist vorausgewählt', opened.selected, 'pdf');
        d.assert('PDF-Optionen sichtbar bei Format PDF', opened.pdfOptionsVisible);

        // Auf HTML umschalten: PDF-Options-Sektion verschwindet, Beschreibung folgt
        const switched = await d.exec(`
            const select = document.getElementById('exportFormat');
            select.value = 'html';
            select.dispatchEvent(new Event('change'));
            return {
                pdfOptionsHidden: document.getElementById('exportPdfOptions').hidden,
                description: document.getElementById('exportFormatDescription').textContent
            };
        `);
        d.assert('PDF-Optionen versteckt bei Format HTML', switched.pdfOptionsHidden);
        d.assert('Format-Beschreibung wird angezeigt', switched.description.length > 0);

        // Schließen über Escape-Pfad (closeExportDialog) + Reset auf PDF für Folge-Szenarien
        const closed = await d.exec(`
            closeExportDialog();
            const select = document.getElementById('exportFormat');
            select.value = 'pdf';
            select.dispatchEvent(new Event('change'));
            return document.getElementById('exportModal').classList.contains('visible');
        `);
        d.assertEq('Dialog geschlossen', closed, false);
    }
};

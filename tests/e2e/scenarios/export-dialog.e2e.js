// K1: Export-Registry + gemeinsamer Export-Dialog.
// Prüft den Format-Katalog (get-export-formats), das Umschalten der
// format-spezifischen Options-Sektion und den Modal-Lebenszyklus.

const path = require('path');

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
        d.assert('DOCX-Format registriert (K2)', ids.includes('docx'));
        d.assert('Slides-Format registriert (K4)', ids.includes('slides'));
        d.assert('EPUB-Format registriert (K5)', ids.includes('epub'));

        // K3: Pandoc-Formate erscheinen genau dann, wenn Pandoc installiert ist
        const { detectPandoc } = require(path.join(__dirname, '..', '..', '..', 'src', 'main', 'export', 'pandoc'));
        const pandoc = await detectPandoc();
        if (pandoc) {
            d.assert('Pandoc-Formate freigeschaltet (K3)', ids.includes('latex') && ids.includes('odt'));
            const latex = formats.find(f => f.id === 'latex');
            d.assert('Pandoc-Kennzeichnung im Katalog', /Pandoc/.test(latex.label) && /benötigt Pandoc/.test(latex.description));
        } else {
            d.assert('Ohne Pandoc keine Pandoc-Formate (K3-Fallback)', !ids.includes('latex') && !ids.includes('odt'));
        }
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

        // K2: DOCX zeigt seine eigene Options-Sektion, PDF-Optionen bleiben zu
        const docxUi = await d.exec(`
            const select = document.getElementById('exportFormat');
            select.value = 'docx';
            select.dispatchEvent(new Event('change'));
            return {
                docxVisible: !document.getElementById('exportDocxOptions').hidden,
                pdfHidden: document.getElementById('exportPdfOptions').hidden
            };
        `);
        d.assert('DOCX-Optionen sichtbar bei Format DOCX', docxUi.docxVisible);
        d.assert('PDF-Optionen versteckt bei Format DOCX', docxUi.pdfHidden);

        // K4: Slides-Panel (Theme-Auswahl)
        const slidesUi = await d.exec(`
            const select = document.getElementById('exportFormat');
            select.value = 'slides';
            select.dispatchEvent(new Event('change'));
            return {
                slidesVisible: !document.getElementById('exportSlidesOptions').hidden,
                docxHidden: document.getElementById('exportDocxOptions').hidden,
                themeCount: document.getElementById('slidesTheme').options.length
            };
        `);
        d.assert('Slides-Optionen sichtbar bei Format Slides', slidesUi.slidesVisible);
        d.assert('DOCX-Optionen versteckt bei Format Slides', slidesUi.docxHidden);
        d.assert('Theme-Auswahl befüllt', slidesUi.themeCount >= 10);

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

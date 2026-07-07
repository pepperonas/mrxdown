// MrxDown Main — PDF-Rendering (hidden window, printToPDF, Metadaten, Outline)
const path = require('path');
const fs = require('fs').promises;
const { app, BrowserWindow } = require('electron');

// Korrekte Warte-Bedingung vor printToPDF (PDF-Audit 2026-07-04):
// document.fonts.ready (Fonts wirklich geladen) + img.decode() (Pixel dekodiert)
// + ggf. Mermaid-Rendering (window.__mermaidReady, siehe buildPdfHtml) statt
// des alten requestIdleCallback-Blindflugs.
const PDF_SMART_WAIT_JS = `
    (async () => {
        try { await document.fonts.ready; } catch (e) {}
        await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => {})));
        if (window.__mermaidReady) { try { await window.__mermaidReady; } catch (e) {} }
        await new Promise(r => {
            if (typeof requestIdleCallback !== 'undefined') requestIdleCallback(() => r(), { timeout: 2000 });
            else setTimeout(r, 300);
        });
        return true;
    })()
`;

// Shared hidden-window PDF renderer for all GUI export paths.
// - Loads via temp file, not data: URL — Chromium truncates multi-MB data URLs (M6),
//   which blanked exports of documents with several embedded images.
// - try/finally destroys the window on EVERY path; failed exports used to leak one
//   invisible BrowserWindow each (M4).
// - No preload: the rendered markdown HTML must never see window.electronAPI.
async function renderHtmlToPdf(fullHtml, printOptions = {}, meta = null) {
    const pdfWindow = new BrowserWindow({
        width: 800,
        height: 1000,
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    const tempHtmlPath = path.join(app.getPath('temp'), `mrxdown-pdf-${process.pid}-${Date.now()}.html`);
    try {
        await fs.writeFile(tempHtmlPath, fullHtml, 'utf-8');
        await pdfWindow.loadFile(tempHtmlPath);
        await pdfWindow.webContents.executeJavaScript(PDF_SMART_WAIT_JS);
        const pdfData = await pdfWindow.webContents.printToPDF({
            marginsType: 0,
            pageSize: 'A4',
            printBackground: true,
            landscape: false,
            preferCSSPageSize: true,
            generateTaggedPDF: true,
            generateDocumentOutline: true, // seit Electron 43 wirksam (E28 ignorierte es still)
            ...printOptions
        });
        return meta ? await finalizePdfMetadata(pdfData, meta) : pdfData;
    } finally {
        if (!pdfWindow.isDestroyed()) pdfWindow.destroy();
        fs.unlink(tempHtmlPath).catch(() => {});
    }
}

// Phase 1 (PDF-Audit 2026-07-04): printToPDF schreibt keinerlei Dokument-
// Metadaten (nur Producer/CreationDate). Nachpass mit pdf-lib: Title/Author/
// Subject/Keywords aus dem Frontmatter, Sprache, Creator. Fehler sind nie
// fatal — dann bleibt das PDF schlicht ohne Metadaten.
async function finalizePdfMetadata(pdfBuffer, { frontmatter = {}, filePath = null } = {}) {
    try {
        const { PDFDocument } = require('@cantoo/pdf-lib');
        const doc = await PDFDocument.load(pdfBuffer, { updateMetadata: false });
        const title = frontmatter.title
            || (filePath ? path.basename(filePath).replace(/\.(md|markdown)$/i, '') : 'Markdown-Dokument');
        doc.setTitle(String(title), { showInWindowTitleBar: true });
        if (frontmatter.author) doc.setAuthor(String(frontmatter.author));
        if (frontmatter.subtitle || frontmatter.description) {
            doc.setSubject(String(frontmatter.subtitle || frontmatter.description));
        }
        if (frontmatter.keywords) {
            const kw = Array.isArray(frontmatter.keywords)
                ? frontmatter.keywords
                : String(frontmatter.keywords).split(/[,;]/).map(x => x.trim()).filter(Boolean);
            if (kw.length) doc.setKeywords(kw);
        }
        doc.setLanguage('de-DE');
        doc.setCreator('MrxDown ' + app.getVersion());
        doc.setProducer('MrxDown (Chromium printToPDF + pdf-lib)');
        doc.setModificationDate(new Date());
        return Buffer.from(await doc.save());
    } catch (err) {
        console.warn('PDF-Metadaten-Pass fehlgeschlagen:', err.message);
        return pdfBuffer;
    }
}

// Phase 4 (Zwei-Pass-TOC): Chromium kann target-counter() bis heute nicht —
// Pass 1 liefert ueber generateDocumentOutline die echte Heading->Seite-
// Zuordnung (pdfjs-dist liest die Outline), Pass 2 druckt das TOC mit Zahlen.
async function mapHeadingsToPages(pdfBuffer) {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer), useSystemFonts: true }).promise;
    try {
        const outline = (await doc.getOutline()) || [];
        const map = [];
        const walk = async (items) => {
            for (const it of items) {
                let dest = it.dest;
                if (typeof dest === 'string') dest = await doc.getDestination(dest);
                if (Array.isArray(dest) && dest[0]) {
                    try {
                        map.push({ title: (it.title || '').trim(), page: (await doc.getPageIndex(dest[0])) + 1 });
                    } catch (e) { /* Ziel nicht aufloesbar — Eintrag ueberspringen */ }
                }
                if (it.items && it.items.length) await walk(it.items);
            }
        };
        await walk(outline);
        return map;
    } finally {
        await doc.destroy().catch(() => {});
    }
}

module.exports = { PDF_SMART_WAIT_JS, renderHtmlToPdf, finalizePdfMetadata, mapHeadingsToPages };

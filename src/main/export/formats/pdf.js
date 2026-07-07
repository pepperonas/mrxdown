// MrxDown Export-Format: PDF
// Kern beider GUI-PDF-Pfade: der einfache Direkt-Export (Cmd+P) und der
// Options-Export (Dialog: Vorlage, Seitengröße, Ränder, TOC, Seitenzahlen).
// Beide teilen sich den Prolog (Frontmatter-Box strippen, Bilder einbetten)
// und den pdf-lib-Metadaten-Nachpass.
const path = require('path');
const { getSettings } = require('../context');
const { getPdfTemplatesManifest, loadPdfTemplateCss, renderTitlePage, resolvePdfTemplateName } = require('../pdf-templates');
const { buildPdfHtml, getHighlightCss, getKatexCss } = require('../pdf-html');
const { renderHtmlToPdf, finalizePdfMetadata, mapHeadingsToPages } = require('../pdf-render');
const { convertImagesToBase64 } = require('../images');
const { extractFrontmatter } = require('../frontmatter');

// Eingabe-Härtung für die Dialog-Optionen (kommen über IPC aus dem Renderer)
const ALLOWED_PAGE_SIZES = new Set(['A3', 'A4', 'A5', 'Letter', 'Legal', 'Tabloid']);
function sanitizePdfOptions(raw) {
    const opts = (raw && typeof raw === 'object') ? raw : {};
    const margin = Number(opts.margin);
    const fontSize = Number(opts.fontSize);
    return {
        template: typeof opts.template === 'string' ? opts.template : null,
        pageSize: ALLOWED_PAGE_SIZES.has(opts.pageSize) ? opts.pageSize : 'A4',
        landscape: opts.orientation === 'landscape',
        margin: Number.isFinite(margin) ? Math.min(Math.max(margin, 0), 50) : 20,
        fontSize: Number.isFinite(fontSize) ? Math.min(Math.max(fontSize, 8), 18) : 11,
        toc: !!opts.toc,
        pageNumbers: opts.pageNumbers !== false
    };
}

// Gemeinsamer Prolog: die Frontmatter-Info-Box der Preview gehört nicht ins
// exportierte Dokument; relative Bilder werden gegen das Verzeichnis der
// exportierten Datei aufgelöst und als base64 eingebettet (H2).
async function preparePreviewBody(previewHtml, filePath) {
    const content = (previewHtml || '').replace(/<div class="frontmatter-box">[\s\S]*?<\/div>\s*(?=<)/, '');
    return convertImagesToBase64(content, filePath ? path.dirname(filePath) : null);
}

// Einfacher Pfad (Cmd+P): Template aus Frontmatter/Settings, keine Layout-Overrides.
async function generatePdfSimple({ previewHtml, rawMarkdown, filePath = null }) {
    const { frontmatter } = extractFrontmatter(rawMarkdown || '');
    const content = await preparePreviewBody(previewHtml, filePath);
    return renderHtmlToPdf(
        buildPdfHtml({ bodyContent: content, frontmatter }),
        {},
        { frontmatter, filePath }
    );
}

// Options-Pfad (Export-Dialog): Vorlage + Seitengröße/Ränder/Schriftgröße als
// CSS-Override, optional TOC mit echten Seitenzahlen (Zwei-Pass über die
// PDF-Outline, siehe mapHeadingsToPages).
async function generatePdfWithOptions({ previewHtml, rawMarkdown, filePath = null, options = null }) {
    const opts = sanitizePdfOptions(options);
    const { frontmatter } = extractFrontmatter(rawMarkdown || '');
    const content = await preparePreviewBody(previewHtml, filePath);

    // M2: Template selection — the user's explicit dialog choice must beat frontmatter.
    // resolvePdfTemplateName checks frontmatter first, so it only gets the fallbacks.
    const settings = getSettings();
    const manifest = getPdfTemplatesManifest();
    const templateName = (opts.template && manifest[opts.template])
        ? opts.template
        : resolvePdfTemplateName(frontmatter, settings && settings.pdfTemplate);

    // M3: The old literal regex patches (margin: 20mm 15mm etc.) only matched the
    // default template's CSS — options were silently dropped for academic/minimal.
    // Append an override block instead; the cascade makes the later rule win.
    let customStyle = loadPdfTemplateCss(templateName);
    if (!opts.pageNumbers) {
        customStyle = customStyle.replace(/@bottom-center\s*\{[^}]+\}/, '');
    }
    customStyle += `\n/* User options from the PDF export dialog */\n` +
        `@page { size: ${opts.pageSize} ${opts.landscape ? 'landscape' : 'portrait'}; margin: ${opts.margin}mm; }\n` +
        `body { font-size: ${opts.fontSize}pt; }\n`;

    // Title page from frontmatter (only if template + frontmatter support it)
    const titlePage = renderTitlePage(frontmatter, templateName);

    // D5: TOC — klickbare Anker + (Phase 4) echte Seitenzahlen via Zwei-Pass
    const tocItems = [];
    if (opts.toc) {
        const headingRegex = /<h([1-3])[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/h\1>/gi;
        let match;
        while ((match = headingRegex.exec(content)) !== null) {
            tocItems.push({
                level: parseInt(match[1]),
                id: match[2],
                text: match[3].replace(/<[^>]+>/g, '')
            });
        }
    }

    // pageMap: null = Eintraege ohne Zahl (Pass 1); [{title,page}] = Pass 2
    const buildTocHtml = (pageMap) => {
        if (tocItems.length === 0) return '';
        const lines = ['<div class="pdf-toc"><h2>Inhaltsverzeichnis</h2><ul>'];
        let cursor = 0; // Outline-Eintraege in Dokumentreihenfolge konsumieren
        for (const item of tocItems) {
            const indent = (item.level - 1) * 20;
            let pageHtml = '';
            if (pageMap) {
                const idx = pageMap.findIndex((m, i) => i >= cursor && m.title === item.text.trim());
                if (idx !== -1) {
                    pageHtml = '<span class="toc-dots"></span><span class="toc-page">' + pageMap[idx].page + '</span>';
                    cursor = idx + 1;
                }
            }
            lines.push('<li style="margin-left:' + indent + 'px">' +
                '<a class="toc-label" href="#' + item.id + '">' + item.text + '</a>' + pageHtml + '</li>');
        }
        lines.push('</ul></div><div style="page-break-after:always"></div>');
        return lines.join('');
    };

    const tocStyle = '.pdf-toc { margin-bottom: 2em; } ' +
        '.pdf-toc h2 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; } ' +
        '.pdf-toc ul { list-style: none; padding: 0; } ' +
        '.pdf-toc li { padding: 4px 0; color: #1a1a1a; display: flex; align-items: baseline; gap: 6px; } ' +
        '.pdf-toc a.toc-label { color: #1a1a1a; text-decoration: none; } ' +
        '.pdf-toc .toc-dots { flex: 1; border-bottom: 1.5px dotted #999; min-width: 24px; } ' +
        '.pdf-toc .toc-page { font-variant-numeric: tabular-nums; }';
    const buildFullHtml = (tocHtml) =>
        '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><style>' + customStyle + tocStyle +
        getHighlightCss() + getKatexCss() + '</style></head><body>' + titlePage + tocHtml + content + '</body></html>';

    let pdfData = await renderHtmlToPdf(buildFullHtml(buildTocHtml(null)), { pageSize: opts.pageSize, landscape: opts.landscape });

    if (opts.toc && tocItems.length > 0) {
        // Phase 4: Outline aus Pass 1 lesen -> Heading->Seite -> Pass 2 mit Zahlen.
        // Jeder Fehlschlag ist unkritisch: dann bleibt das TOC ohne Seitenzahlen.
        try {
            const pageMap = await mapHeadingsToPages(pdfData);
            if (pageMap.length > 0) {
                pdfData = await renderHtmlToPdf(buildFullHtml(buildTocHtml(pageMap)), { pageSize: opts.pageSize, landscape: opts.landscape });
            }
        } catch (err) {
            console.warn('TOC-Seitenzahlen (Zwei-Pass) fehlgeschlagen:', err.message);
        }
    }

    return finalizePdfMetadata(pdfData, { frontmatter, filePath });
}

module.exports = {
    id: 'pdf',
    label: 'PDF',
    description: 'Druckfertiges PDF mit Vorlagen, Inhaltsverzeichnis und Metadaten',
    ext: 'pdf',
    mime: 'application/pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    needs: ['previewHtml', 'rawMarkdown'],
    optionsPanel: 'pdf',
    async toBuffer(doc) {
        return generatePdfWithOptions(doc);
    },
    generatePdfSimple,
    generatePdfWithOptions
};

// MrxDown Export-Format: DOCX (Word)
// JS-nativ über @turbodocx/html-to-docx — läuft ohne externe Binaries (kein
// Pandoc). Input ist das Preview-HTML (dieselbe Quelle wie der PDF-Export):
// echte Word-Heading-Styles, Tabellen, Listen, eingebettete Bilder, Code-Blöcke
// als Courier-Absätze. Frontmatter → Word-Dokumenteigenschaften (docProps).
// Optional wird ein echtes TOC-Feld eingefügt (Word füllt es beim Öffnen).
const path = require('path');
const { convertImagesToBase64 } = require('../images');
const { extractFrontmatter } = require('../frontmatter');

// Preview-Markup fürs Word-Dokument aufbereiten:
// - Frontmatter-Info-Box der Preview gehört nicht ins Dokument
// - KaTeX rendert MathML + HTML parallel — ohne Strip käme jede Formel doppelt
//   als Text an (der MathML-Block endet deterministisch mit </math></span>)
// - Mermaid-SVGs kann Word nicht — Platzhalter statt kaputtem Markup
function prepareHtmlForDocx(previewHtml) {
    let html = (previewHtml || '').replace(/<div class="frontmatter-box">[\s\S]*?<\/div>\s*(?=<)/, '');
    html = html.replace(/<span class="katex-mathml">[\s\S]*?<\/math><\/span>/g, '');
    html = html.replace(/<div class="mermaid[^"]*">[\s\S]*?<\/div>/g,
        '<p><em>[Mermaid-Diagramm — im Word-Export nicht unterstützt]</em></p>');
    return html;
}

// Nachpass: echtes Word-TOC-Feld (TOC \o "1-3") an den Body-Anfang + Auto-Update
// beim Öffnen (settings.xml). Word fragt einmal „Felder aktualisieren?" — das ist
// Standard-Verhalten für TOC-Felder; danach stehen die echten Einträge drin.
const TOC_FIELD_XML =
    '<w:sdt><w:sdtPr><w:docPartObj><w:docPartGallery w:val="Table of Contents"/><w:docPartUnique/></w:docPartObj></w:sdtPr><w:sdtContent>' +
    '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Inhaltsverzeichnis</w:t></w:r></w:p>' +
    '<w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>' +
    '<w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r>' +
    '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
    '<w:r><w:t>Inhaltsverzeichnis wird beim Öffnen aktualisiert.</w:t></w:r>' +
    '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>' +
    '</w:sdtContent></w:sdt>';

async function injectTocField(docxBuffer) {
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(docxBuffer);
    const docFile = zip.file('word/document.xml');
    if (!docFile) return docxBuffer; // unerwartetes Layout — lieber ohne TOC als kaputt
    let doc = await docFile.async('string');
    const bodyIdx = doc.indexOf('<w:body>');
    if (bodyIdx === -1) return docxBuffer;
    doc = doc.slice(0, bodyIdx + '<w:body>'.length) + TOC_FIELD_XML + doc.slice(bodyIdx + '<w:body>'.length);
    zip.file('word/document.xml', doc);

    const settingsFile = zip.file('word/settings.xml');
    if (settingsFile) {
        let settings = await settingsFile.async('string');
        if (!settings.includes('<w:updateFields')) {
            settings = settings.replace(/(<w:settings[^>]*>)/, '$1<w:updateFields w:val="true"/>');
            zip.file('word/settings.xml', settings);
        }
    }
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function generateDocx({ previewHtml, rawMarkdown, filePath = null, options = null }) {
    const { frontmatter } = extractFrontmatter(rawMarkdown || '');
    let html = prepareHtmlForDocx(previewHtml);
    // H2: relative Bilder gegen das Verzeichnis der exportierten Datei auflösen
    html = await convertImagesToBase64(html, filePath ? path.dirname(filePath) : null);

    const HTMLtoDOCX = require('@turbodocx/html-to-docx'); // lazy — nur beim Export
    const title = frontmatter.title
        || (filePath ? path.basename(filePath).replace(/\.(md|markdown)$/i, '') : 'Markdown-Dokument');
    const keywords = frontmatter.keywords
        ? String(frontmatter.keywords).split(/[,;]/).map(x => x.trim()).filter(Boolean)
        : undefined;

    let buffer = Buffer.from(await HTMLtoDOCX(html, null, {
        title: String(title),
        creator: frontmatter.author ? String(frontmatter.author) : 'MrxDown',
        description: (frontmatter.subtitle || frontmatter.description)
            ? String(frontmatter.subtitle || frontmatter.description) : undefined,
        keywords,
        lang: 'de-DE',
        table: { row: { cantSplit: true } },
        footer: false,
        pageNumber: false
    }));

    if (options && options.toc) {
        buffer = await injectTocField(buffer);
    }
    return buffer;
}

module.exports = {
    id: 'docx',
    label: 'Word (DOCX)',
    description: 'Word-Dokument mit echten Überschrift-Styles, Tabellen und eingebetteten Bildern',
    ext: 'docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    filters: [{ name: 'Word-Dokument', extensions: ['docx'] }],
    needs: ['previewHtml', 'rawMarkdown'],
    optionsPanel: 'docx',
    async toBuffer(doc) {
        return generateDocx(doc);
    },
    generateDocx,
    prepareHtmlForDocx
};

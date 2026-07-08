// MrxDown Export-Format: EPUB (nativ, ohne Pandoc)
// EPUB 3 mit EPUB-2-Kompatibilität (nav.xhtml + toc.ncx): Kapitel-Split an
// H1/H2 (splitEpubChapters, editor-utils.js), Metadaten + optionales Cover aus
// dem Frontmatter (`cover: pfad/zum/bild.jpg`), Bilder als echte Manifest-
// Dateien (Data-URIs können nicht alle Reader). Gebaut mit jszip.
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { extractFrontmatter } = require('../frontmatter');
const { convertImagesToBase64 } = require('../images');
const { parseMarkdown, resetHeadingIds } = require('../markdown');
const { splitEpubChapters } = require('../../../../editor-utils');

function escXml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// marked liefert HTML — EPUB-Kapitel müssen wohlgeformtes XHTML sein.
// Void-Elemente selbst schließen; alles andere erzeugt marked bereits sauber
// (Attribute mit Werten, escapte Entities).
function htmlToXhtml(html) {
    return html.replace(/<(img|br|hr|input)((?:[^>"']|"[^"]*"|'[^']*')*?)\s*\/?>/gi, '<$1$2/>');
}

// Bilder wurden von convertImagesToBase64 (inkl. Traversal-Guard + Downscaling)
// als data:-URIs eingebettet — hier werden sie zu echten Zip-Dateien extrahiert.
function extractDataUriImages(html, images) {
    return html.replace(/src="data:(image\/[a-z+]+);base64,([^"]+)"/gi, (m, mime, b64) => {
        const extMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/webp': 'webp' };
        const ext = extMap[mime] || 'png';
        // Identische Bilder nur einmal einbetten
        for (const img of images) {
            if (img.b64 === b64) return `src="images/${img.name}"`;
        }
        const name = `img${images.length + 1}.${ext}`;
        images.push({ name, mime, b64 });
        return `src="images/${name}"`;
    });
}

const EPUB_CSS = `body { font-family: serif; line-height: 1.6; margin: 1em; }
h1, h2, h3 { font-family: sans-serif; line-height: 1.25; }
code { font-family: monospace; font-size: 0.9em; }
pre { background: #f4f4f4; padding: 0.8em; overflow-x: auto; white-space: pre-wrap; }
blockquote { border-left: 3px solid #999; margin-left: 0; padding-left: 1em; color: #555; }
table { border-collapse: collapse; }
th, td { border: 1px solid #999; padding: 0.3em 0.6em; }
img { max-width: 100%; }
.callout { border-left: 3px solid #0969da; background: #f6f8fa; padding: 0.5em 0.8em; margin: 1em 0; }
.callout-title { font-weight: bold; margin: 0 0 0.3em 0; }
`;

function chapterXhtml(title, bodyHtml, lang) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}">
<head>
<title>${escXml(title)}</title>
<link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

async function generateEpub({ rawMarkdown, filePath = null }) {
    const JSZip = require('jszip');
    const { frontmatter, body } = extractFrontmatter(rawMarkdown || '');
    const baseDir = filePath ? path.dirname(filePath) : null;

    const title = frontmatter.title
        || (filePath ? path.basename(filePath).replace(/\.(md|markdown)$/i, '') : 'Markdown-Dokument');
    const author = frontmatter.author || '';
    const lang = 'de';
    const uuid = 'urn:uuid:' + crypto.randomUUID();

    // Kapitel rendern; Bilder erst einbetten (Guard/Downscale), dann extrahieren
    const chapters = splitEpubChapters(body);
    resetHeadingIds();
    const images = [];
    const renderedChapters = [];
    for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        let html = parseMarkdown(ch.markdown);
        html = await convertImagesToBase64(html, baseDir);
        html = extractDataUriImages(html, images);
        html = htmlToXhtml(html);
        renderedChapters.push({
            id: `ch${i + 1}`,
            file: `chapter${i + 1}.xhtml`,
            title: ch.title || title,
            html
        });
    }

    // Optionales Cover aus dem Frontmatter (Pfad relativ zur Quelldatei,
    // Traversal-Guard wie bei der Bild-Einbettung)
    let cover = null;
    if (frontmatter.cover && baseDir) {
        const coverPath = path.resolve(baseDir, String(frontmatter.cover));
        const rel = path.relative(path.resolve(baseDir), coverPath);
        if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
            try {
                const buf = await fs.readFile(coverPath);
                const ext = path.extname(coverPath).toLowerCase().replace('.', '') || 'jpg';
                const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
                cover = { name: 'cover.' + (ext === 'png' ? 'png' : 'jpg'), mime, buf };
            } catch { /* Cover fehlt — EPUB kommt ohne */ }
        }
    }

    const zip = new JSZip();
    // Spec: mimetype MUSS der erste Eintrag sein und unkomprimiert
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

    zip.file('OEBPS/style.css', EPUB_CSS);
    for (const ch of renderedChapters) {
        zip.file('OEBPS/' + ch.file, chapterXhtml(ch.title, ch.html, lang));
    }
    for (const img of images) {
        zip.file('OEBPS/images/' + img.name, img.b64, { base64: true });
    }
    if (cover) {
        zip.file('OEBPS/images/' + cover.name, cover.buf);
        zip.file('OEBPS/cover.xhtml', chapterXhtml(title,
            `<div style="text-align:center"><img src="images/${cover.name}" alt="${escXml(title)}"/></div>`, lang));
    }

    // Navigation (EPUB 3) + NCX (EPUB-2-Kompatibilität)
    const navItems = renderedChapters
        .map(ch => `      <li><a href="${ch.file}">${escXml(ch.title)}</a></li>`)
        .join('\n');
    zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}">
<head><title>Inhalt</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Inhalt</h1>
    <ol>
${navItems}
    </ol>
  </nav>
</body>
</html>`);

    const ncxPoints = renderedChapters
        .map((ch, i) => `    <navPoint id="np${i + 1}" playOrder="${i + 1}"><navLabel><text>${escXml(ch.title)}</text></navLabel><content src="${ch.file}"/></navPoint>`)
        .join('\n');
    zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${uuid}"/></head>
  <docTitle><text>${escXml(title)}</text></docTitle>
  <navMap>
${ncxPoints}
  </navMap>
</ncx>`);

    const manifestItems = [
        '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
        '    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
        '    <item id="css" href="style.css" media-type="text/css"/>',
        ...renderedChapters.map(ch => `    <item id="${ch.id}" href="${ch.file}" media-type="application/xhtml+xml"/>`),
        ...images.map((img, i) => `    <item id="img${i + 1}" href="images/${img.name}" media-type="${img.mime}"/>`)
    ];
    const spineItems = [];
    if (cover) {
        manifestItems.push(`    <item id="cover-image" href="images/${cover.name}" media-type="${cover.mime}" properties="cover-image"/>`);
        manifestItems.push('    <item id="coverpage" href="cover.xhtml" media-type="application/xhtml+xml"/>');
        spineItems.push('    <itemref idref="coverpage"/>');
    }
    spineItems.push(...renderedChapters.map(ch => `    <itemref idref="${ch.id}"/>`));

    zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="${lang}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${uuid}</dc:identifier>
    <dc:title>${escXml(title)}</dc:title>
    <dc:language>${lang}</dc:language>
${author ? '    <dc:creator>' + escXml(author) + '</dc:creator>\n' : ''}${frontmatter.description || frontmatter.subtitle ? '    <dc:description>' + escXml(frontmatter.description || frontmatter.subtitle) + '</dc:description>\n' : ''}    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
${manifestItems.join('\n')}
  </manifest>
  <spine toc="ncx">
${spineItems.join('\n')}
  </spine>
</package>`);

    return zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        // mimetype bleibt STORE (per-file-Option oben) — Spec-Anforderung
        mimeType: 'application/epub+zip'
    });
}

module.exports = {
    id: 'epub',
    label: 'E-Book (EPUB)',
    description: 'EPUB 3 — Kapitel an H1/H2, Cover + Metadaten aus dem Frontmatter',
    ext: 'epub',
    mime: 'application/epub+zip',
    filters: [{ name: 'EPUB', extensions: ['epub'] }],
    needs: ['rawMarkdown'],
    optionsPanel: null,
    async toBuffer(doc) {
        return generateEpub(doc);
    },
    generateEpub
};

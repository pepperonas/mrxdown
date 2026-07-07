// MrxDown Export-Format: HTML
// Nimmt das vom Renderer gebaute self-contained HTML-Dokument (generateHTMLExport)
// und bettet file://-Bilder als base64-Data-URLs ein, damit die Datei portabel ist.
const path = require('path');
const fs = require('fs').promises;

async function embedFileImagesAsBase64(content) {
    let processedContent = content;
    const imgRegex = /<img[^>]+src="file:\/\/([^"]+)"[^>]*>/g;
    let match;

    while ((match = imgRegex.exec(content)) !== null) {
        // M7: fileURLToPath handles Windows drive letters — the old
        // decodeURIComponent left '/C:/...' which fs can't open
        let imagePath;
        try {
            imagePath = require('url').fileURLToPath('file://' + match[1]);
        } catch (e) {
            imagePath = decodeURIComponent(match[1]);
        }
        try {
            const imageData = await fs.readFile(imagePath);
            const extension = path.extname(imagePath).toLowerCase().slice(1);
            const mimeType = extension === 'jpg' ? 'jpeg' : extension;
            const base64 = imageData.toString('base64');
            const dataUrl = `data:image/${mimeType};base64,${base64}`;
            processedContent = processedContent.replace(match[0], match[0].replace(`file://${match[1]}`, dataUrl));
        } catch (err) {
            console.error(`Failed to convert image ${imagePath}:`, err);
        }
    }

    return processedContent;
}

// K7: Standalone-HTML-Dokument für den CLI-Pfad (`--to html`). Das Stylesheet
// ist bewusst eine Kopie des GUI-HTML-Exports (generateHTMLExport in
// src/renderer/08-export.js) — beide Seiten müssen ohne die jeweils andere
// Laufzeit funktionieren; bei Änderungen BEIDE Stellen anfassen.
function buildStandaloneHtml(bodyHtml, title) {
    return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${String(title || 'Export').replace(/</g, '&lt;')}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            color: #333;
            line-height: 1.6;
        }
        h1, h2, h3 { margin-top: 24px; margin-bottom: 16px; }
        h1 { border-bottom: 2px solid #eee; padding-bottom: 8px; }
        code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
        }
        pre {
            background: #f4f4f4;
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
        }
        blockquote {
            border-left: 4px solid #ddd;
            padding-left: 16px;
            color: #666;
            margin: 16px 0;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 16px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px 12px;
            text-align: left;
        }
        th {
            background: #f4f4f4;
        }
        img {
            max-width: 100%;
            height: auto;
            margin: 16px 0;
        }
        .callout { border-left: 3px solid #0969da; border-radius: 4px; background: #f6f8fa; padding: 10px 14px; margin: 1em 0; }
        .callout-title { display: flex; align-items: center; gap: 7px; margin: 0 0 5px 0; font-weight: 600; color: #0969da; }
        .callout-tip { border-left-color: #1a7f37; } .callout-tip .callout-title { color: #1a7f37; }
        .callout-important { border-left-color: #8250df; } .callout-important .callout-title { color: #8250df; }
        .callout-warning { border-left-color: #9a6700; } .callout-warning .callout-title { color: #9a6700; }
        .callout-caution { border-left-color: #d1242f; } .callout-caution .callout-title { color: #d1242f; }
        a[href^="#"] {
            color: #688db1;
            text-decoration: none;
        }
        html { scroll-behavior: smooth; }
        h1[id], h2[id], h3[id], h4[id], h5[id], h6[id] { scroll-margin-top: 2em; }
    </style>
</head>
<body>
    ${bodyHtml}
</body>
</html>`;
}

module.exports = {
    id: 'html',
    label: 'HTML',
    description: 'Eigenständige HTML-Datei mit eingebetteten Bildern',
    ext: 'html',
    mime: 'text/html',
    filters: [{ name: 'HTML', extensions: ['html'] }],
    // Was der Renderer für dieses Format mitschicken muss
    needs: ['fullHtml'],
    optionsPanel: null,
    async toBuffer(doc) {
        const processed = await embedFileImagesAsBase64(doc.fullHtml || '');
        return Buffer.from(processed, 'utf-8');
    },
    embedFileImagesAsBase64,
    buildStandaloneHtml
};

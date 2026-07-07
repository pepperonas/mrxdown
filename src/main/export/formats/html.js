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
    embedFileImagesAsBase64
};

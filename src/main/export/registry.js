// MrxDown Export-Registry (K1)
// Zentrale Format-Registry: jedes Format ist ein Modul mit
// { id, label, description, ext, mime, filters, needs, optionsPanel, toBuffer(doc) }.
// - needs:       welche Dokument-Felder der Renderer mitschicken muss
//                ('fullHtml' | 'previewHtml' | 'rawMarkdown')
// - optionsPanel: Kennung der format-spezifischen Options-Sektion im Export-Dialog
//                 (null = keine Optionen)
// - toBuffer:    async (doc) -> Buffer; doc = { fullHtml?, previewHtml?,
//                rawMarkdown?, filePath?, options? }
// Neue Formate (DOCX, EPUB, Slides, …) registrieren sich hier.

const formats = new Map();

function registerFormat(format) {
    if (!format || typeof format.id !== 'string' || typeof format.toBuffer !== 'function') {
        throw new Error('Ungültiges Exportformat: id und toBuffer sind Pflicht');
    }
    formats.set(format.id, format);
}

function getFormat(id) {
    return formats.get(id) || null;
}

// Serialisierbare Katalog-Sicht für den Renderer (Export-Dialog)
function listFormats() {
    return [...formats.values()].map(f => ({
        id: f.id,
        label: f.label || f.id,
        description: f.description || '',
        ext: f.ext,
        mime: f.mime || '',
        needs: f.needs || [],
        optionsPanel: f.optionsPanel || null
    }));
}

// Eingebaute Formate
registerFormat(require('./formats/html'));
registerFormat(require('./formats/pdf'));

module.exports = { registerFormat, getFormat, listFormats };

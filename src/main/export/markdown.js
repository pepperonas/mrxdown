// MrxDown Main — geteilte marked-Instanz für Main-Prozess-Rendering (CLI, Slides).
// Identische Konfiguration wie die Preview: Callout-Extension (callouts.js) +
// GitHub-kompatibler Heading-ID-Renderer (editor-utils.js) — Anker-Links
// funktionieren damit in allen headless erzeugten Formaten.
let _marked = null;
let _headingIds = {};

function getSharedMarked() {
    if (!_marked) {
        _marked = require('marked');
        _marked.use(require('../../../callouts').createCalloutExtension());
        // E1: Wiki-Links headless ohne Vault-Kontext — nur das Label rendern
        _marked.use(require('../../../wikilinks').createWikiLinkExtension(null));
        const { generateHeadingId } = require('../../../editor-utils');
        const renderer = new _marked.Renderer();
        renderer.heading = function (text, level, raw) {
            const id = generateHeadingId(raw, _headingIds);
            return `<h${level} id="${id}">${text}</h${level}>`;
        };
        _marked.use({ renderer });
    }
    return _marked;
}

// Duplikat-Zähler der Heading-IDs zurücksetzen — einmal pro DOKUMENT aufrufen
// (nicht pro Folie/Abschnitt, sonst kollidieren gleichnamige Headings).
function resetHeadingIds() {
    _headingIds = {};
}

function parseMarkdown(markdown) {
    return getSharedMarked().parse(markdown);
}

module.exports = { getSharedMarked, resetHeadingIds, parseMarkdown };

// MrxDown Export-Format: Slides (reveal.js, self-contained)
// `---`/`===` (mit Leerzeile davor) trennt Folien (splitSlides, editor-utils.js),
// `<!-- notes: … -->` wird zur Speaker-Note (reveal-Notes-Plugin, Taste S).
// Das Ergebnis ist EINE portable HTML-Datei: reveal.js, CSS, Theme und Notes-
// Plugin sind inline eingebettet, Bilder als base64 — läuft offline im Browser.
const path = require('path');
const fsSync = require('fs');
const { APP_ROOT } = require('../context');
const { extractFrontmatter } = require('../frontmatter');
const { convertImagesToBase64 } = require('../images');
const { parseMarkdown, resetHeadingIds } = require('../markdown');
const { splitSlides } = require('../../../../editor-utils');

const REVEAL_THEMES = ['black', 'white', 'league', 'beige', 'night', 'serif', 'simple', 'solarized', 'moon', 'dracula', 'sky', 'blood'];
const DEFAULT_THEME = 'black';

const revealDist = path.join(APP_ROOT, 'node_modules', 'reveal.js', 'dist');
const _assetCache = new Map();
function readRevealAsset(rel) {
    if (_assetCache.has(rel)) return _assetCache.get(rel);
    const content = fsSync.readFileSync(path.join(revealDist, rel), 'utf-8');
    _assetCache.set(rel, content);
    return content;
}

// Inline-<script> darf kein rohes </script enthalten — Standard-Escape.
function escapeInlineScript(js) {
    return js.replace(/<\/script/gi, '<\\/script');
}

function escapeHtmlText(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function resolveTheme(options, frontmatter) {
    const candidates = [
        options && options.theme,
        frontmatter && frontmatter.theme
    ];
    for (const c of candidates) {
        if (c && REVEAL_THEMES.includes(String(c).toLowerCase())) return String(c).toLowerCase();
    }
    return DEFAULT_THEME;
}

async function generateSlides({ rawMarkdown, filePath = null, options = null }) {
    const { frontmatter, body } = extractFrontmatter(rawMarkdown || '');
    const slides = splitSlides(body);
    const theme = resolveTheme(options, frontmatter);

    resetHeadingIds(); // IDs pro Präsentation eindeutig, nicht pro Folie
    const sections = slides.map(slide => {
        let inner = parseMarkdown(slide.markdown);
        if (slide.notes) {
            inner += '<aside class="notes">' + parseMarkdown(slide.notes) + '</aside>';
        }
        return '<section>\n' + inner + '</section>';
    });

    // H2: relative Bilder gegen das Verzeichnis der Quelldatei auflösen + einbetten
    const slidesHtml = await convertImagesToBase64(
        sections.join('\n'),
        filePath ? path.dirname(filePath) : null
    );

    const title = frontmatter.title
        || (filePath ? path.basename(filePath).replace(/\.(md|markdown)$/i, '') : 'Präsentation');

    const html = `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtmlText(title)}</title>
    <style>${readRevealAsset('reset.css')}</style>
    <style>${readRevealAsset('reveal.css')}</style>
    <style>${readRevealAsset(path.join('theme', theme + '.css'))}</style>
    <style>
        /* Callouts auch auf Folien (E4-Markup) */
        .reveal .callout { border-left: 4px solid currentColor; border-radius: 6px; padding: 0.3em 0.6em; margin: 0.5em 0; text-align: left; background: rgba(128,128,128,0.12); }
        .reveal .callout-title { display: flex; align-items: center; gap: 0.4em; font-weight: 600; margin: 0 0 0.2em 0; }
        .reveal pre code { max-height: 500px; }
        .reveal img { max-height: 60vh; }
    </style>
</head>
<body>
    <div class="reveal">
        <div class="slides">
${slidesHtml}
        </div>
    </div>
    <script>${escapeInlineScript(readRevealAsset('reveal.js'))}</script>
    <script>${escapeInlineScript(readRevealAsset(path.join('plugin', 'notes.js')))}</script>
    <script>
        Reveal.initialize({
            hash: true,
            slideNumber: 'c/t',
            plugins: [RevealNotes]
        });
    </script>
</body>
</html>`;

    return Buffer.from(html, 'utf-8');
}

module.exports = {
    id: 'slides',
    label: 'Präsentation (reveal.js)',
    description: 'Self-contained HTML-Präsentation — "---" trennt Folien, <!-- notes: … --> wird Speaker-Note (Taste S)',
    ext: 'slides.html',
    mime: 'text/html',
    filters: [{ name: 'HTML-Präsentation', extensions: ['html'] }],
    needs: ['rawMarkdown'],
    optionsPanel: 'slides',
    async toBuffer(doc) {
        return generateSlides(doc);
    },
    generateSlides,
    REVEAL_THEMES
};

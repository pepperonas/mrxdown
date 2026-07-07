// MrxDown Main — PDF-HTML-Aufbereitung
// Markdown-nahe Vorverarbeitung (hljs, KaTeX, Mermaid) + buildPdfHtml, geteilt
// von allen PDF-Export-Pfaden (Einzel, Batch, CLI).
const path = require('path');
const fsSync = require('fs');
const { APP_ROOT, getSettings } = require('./context');
const { loadPdfTemplateCss, renderTitlePage, resolvePdfTemplateName } = require('./pdf-templates');

// highlight.js is only needed during PDF export but pulls ~9 MB of language
// definitions into memory at require() time. Lazy-load on first use.
let _hljs = null;
function getHljs() {
    if (!_hljs) _hljs = require('highlight.js');
    return _hljs;
}

// D3: Apply syntax highlighting to code blocks for PDF
function highlightCodeBlocks(htmlContent) {
    return htmlContent.replace(/<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g,
        (match, lang, code) => {
            // Mermaid blocks are rendered in the preview as SVG placeholders; the PDF
            // export uses the renderer's already-rendered HTML, so the language-mermaid
            // block only appears in CLI mode. Skip to avoid hljs warning + messy output.
            if (lang === 'mermaid') return match;
            // Unknown-language guard — highlight.js warns loudly on unregistered langs,
            // so we check first and fall back to untouched markup for those.
            if (!getHljs().getLanguage(lang)) return match;
            try {
                const decoded = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
                const result = getHljs().highlight(decoded, { language: lang, ignoreIllegals: true });
                return '<pre><code class="hljs language-' + lang + '">' + result.value + '</code></pre>';
            } catch (e) {
                return match;
            }
        }
    );
}

function getHighlightCss() {
    return `
        .hljs { color: #1a1a1a; }
        .hljs-keyword, .hljs-selector-tag, .hljs-built_in { color: #a626a4; font-weight: 600; }
        .hljs-string, .hljs-attr { color: #50a14f; }
        .hljs-number, .hljs-literal { color: #986801; }
        .hljs-comment { color: #999; font-style: italic; }
        .hljs-function .hljs-title, .hljs-title.function_ { color: #4078f2; }
        .hljs-class .hljs-title, .hljs-title.class_ { color: #c18401; }
        .hljs-type, .hljs-params { color: #c18401; }
        .hljs-meta, .hljs-tag { color: #e45649; }
        .hljs-variable, .hljs-template-variable { color: #e45649; }
        .hljs-regexp { color: #50a14f; }
        .hljs-symbol, .hljs-bullet { color: #4078f2; }
    `;
}

// Server-side KaTeX for CLI mode. The renderer's browser-side KaTeX can't run in
// headless-CLI context, so we pre-process $...$ / $$...$$ into KaTeX HTML here.
// Matches the delimiter set used by renderMathInPreview() in src/renderer/05-editor.js.
let _katex = null;
function renderMathForCLI(markdown) {
    if (!_katex) {
        try { _katex = require('katex'); } catch { return markdown; }
    }
    // Block math first (greedy-safe because we match $$ pairs).
    markdown = markdown.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
        try { return _katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false }); }
        catch { return _; }
    });
    // Inline math — require a non-dollar on both sides to avoid matching `$5.00 or $10`.
    // Single $...$ pairs on one line, no unescaped $ inside.
    markdown = markdown.replace(/(^|[^\\$])\$([^$\n]+?)\$(?!\d)/g, (m, prefix, expr) => {
        try { return prefix + _katex.renderToString(expr, { displayMode: false, throwOnError: false }); }
        catch { return m; }
    });
    return markdown;
}

// KaTeX CSS is inlined into the PDF stylesheet so rendered math is correctly laid out.
// Font URLs are rewritten to absolute file:// paths that resolve both from the on-disk
// vendor tree (dev) and from inside app.asar (packaged). Cached after first read.
let _katexCssCache = null;
function getKatexCss() {
    if (_katexCssCache !== null) return _katexCssCache;
    try {
        const katexCssPath = path.join(APP_ROOT, 'vendor', 'katex', 'katex.min.css');
        let css = fsSync.readFileSync(katexCssPath, 'utf-8');
        const fontsDir = path.join(APP_ROOT, 'vendor', 'katex', 'fonts');
        // Rewrite relative url(./fonts/X) and url(fonts/X) and url("fonts/X") to absolute file://
        css = css.replace(/url\((['"]?)(?:\.\/)?fonts\//g, (_, quote) => `url(${quote}file://${fontsDir}/`);
        _katexCssCache = css;
    } catch (err) {
        console.warn('Could not load KaTeX CSS for PDF:', err.message);
        _katexCssCache = '';
    }
    return _katexCssCache;
}

// buildPdfHtml accepts either a bare bodyContent string (legacy) or an options
// object with { bodyContent, template, frontmatter }. Template selection falls
// through frontmatter.template -> settings.pdfTemplate -> 'default'.
function buildPdfHtml(bodyContentOrOpts) {
    const opts = typeof bodyContentOrOpts === 'string'
        ? { bodyContent: bodyContentOrOpts }
        : (bodyContentOrOpts || {});
    const bodyContent = opts.bodyContent || '';
    const frontmatter = opts.frontmatter || {};
    const settings = getSettings();
    const fallback = opts.template || (settings && settings.pdfTemplate) || 'default';
    const templateName = resolvePdfTemplateName(frontmatter, fallback);

    const highlightedContent = highlightCodeBlocks(bodyContent);
    const titlePage = renderTitlePage(frontmatter, templateName);
    const stylesheet = loadPdfTemplateCss(templateName);

    // D1-CLI: Enthaelt der Body <div class="mermaid">-Bloecke (CLI-Pfad), wird
    // das vendor-Mermaid ins Druckfenster injiziert und dort gerendert; das
    // Warte-Skript (PDF_SMART_WAIT_JS) awaited window.__mermaidReady.
    let mermaidScripts = '';
    if (highlightedContent.includes('class="mermaid"')) {
        const mermaidPath = path.join(APP_ROOT, 'vendor', 'mermaid.min.js');
        mermaidScripts = '\n<script src="file://' + mermaidPath + '"></script>' +
            '\n<script>window.__mermaidReady = (async () => {' +
            ' try { if (window.mermaid) {' +
            ' mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });' +
            ' await mermaid.run({ querySelector: ".mermaid" });' +
            ' } } catch (e) { console.error("mermaid:", e); } return true; })();</script>';
    }

    return '<!DOCTYPE html>\n<html lang="de">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <style>' + stylesheet + getHighlightCss() + getKatexCss() + '</style>\n</head>\n<body>' + titlePage + highlightedContent + mermaidScripts + '</body>\n</html>';
}

// D1-CLI: ```mermaid-Fences -> <div class="mermaid"> (HTML-escaped,
// Mermaid liest den Textinhalt). Muss VOR marked.parse laufen.
function renderMermaidForCLI(markdown) {
    return markdown.replace(/```mermaid[ \t]*\r?\n([\s\S]*?)```/g, (m, src) => {
        const esc = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return '<div class="mermaid">\n' + esc + '\n</div>';
    });
}

module.exports = {
    getHljs,
    highlightCodeBlocks,
    getHighlightCss,
    renderMathForCLI,
    getKatexCss,
    buildPdfHtml,
    renderMermaidForCLI
};

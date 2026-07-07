// MrxDown Main — PDF-Template-System
// Templates live in pdf-templates/<name>.css alongside a templates.json manifest.
// Selection order: frontmatter `template:` > settings default > 'default'.
// Templates may opt into a title page by providing .mrx-titlepage styles.
const path = require('path');
const fsSync = require('fs');
const { APP_ROOT } = require('./context');
const { escHtml } = require('./frontmatter');

const pdfTemplatesDir = path.join(APP_ROOT, 'pdf-templates');
let _pdfTemplatesManifest = null;
const _pdfTemplateCssCache = new Map(); // name -> css string

function getPdfTemplatesManifest() {
    if (_pdfTemplatesManifest) return _pdfTemplatesManifest;
    try {
        const raw = fsSync.readFileSync(path.join(pdfTemplatesDir, 'templates.json'), 'utf-8');
        _pdfTemplatesManifest = JSON.parse(raw);
    } catch (err) {
        console.warn('PDF templates manifest missing or invalid:', err.message);
        _pdfTemplatesManifest = { default: { name: 'Standard', description: '', supportsTitlePage: true } };
    }
    return _pdfTemplatesManifest;
}

function loadPdfTemplateCss(name) {
    // Guard against traversal via user-supplied frontmatter values
    if (!/^[a-z0-9_-]+$/i.test(name || '')) name = 'default';
    if (_pdfTemplateCssCache.has(name)) return _pdfTemplateCssCache.get(name);
    const filePath = path.join(pdfTemplatesDir, `${name}.css`);
    try {
        const css = fsSync.readFileSync(filePath, 'utf-8');
        _pdfTemplateCssCache.set(name, css);
        return css;
    } catch (err) {
        if (name !== 'default') {
            console.warn(`PDF template '${name}' not found, falling back to 'default'`);
            return loadPdfTemplateCss('default');
        }
        console.error('Could not load any PDF template CSS:', err);
        return '';
    }
}

function renderTitlePage(frontmatter, templateName) {
    const manifest = getPdfTemplatesManifest();
    const tpl = manifest[templateName] || manifest.default || {};
    if (!tpl.supportsTitlePage) return '';
    if (!frontmatter || !frontmatter.title) return '';
    const parts = [];
    parts.push(`<h1>${escHtml(frontmatter.title)}</h1>`);
    if (frontmatter.subtitle) parts.push(`<div class="mrx-subtitle">${escHtml(frontmatter.subtitle)}</div>`);
    if (frontmatter.author) parts.push(`<div class="mrx-author">${escHtml(frontmatter.author)}</div>`);
    if (frontmatter.affiliation) parts.push(`<div class="mrx-affiliation">${escHtml(frontmatter.affiliation)}</div>`);
    if (frontmatter.date) parts.push(`<div class="mrx-date">${escHtml(frontmatter.date)}</div>`);
    if (frontmatter.abstract) {
        parts.push('<div class="mrx-abstract">');
        parts.push('<div class="mrx-abstract-label">Abstract</div>');
        parts.push(escHtml(frontmatter.abstract).replace(/\n/g, '<br>'));
        parts.push('</div>');
    }
    return `<div class="mrx-titlepage">${parts.join('')}</div>`;
}

function resolvePdfTemplateName(frontmatter, fallback) {
    const manifest = getPdfTemplatesManifest();
    const candidates = [
        frontmatter && frontmatter.template,
        fallback,
        'default'
    ];
    for (const c of candidates) {
        if (c && manifest[c]) return c;
    }
    return 'default';
}

// Shared PDF stylesheet — kept as a thin wrapper that loads the 'default' template
// for callers that predate the template system. New code should prefer loadPdfTemplateCss().
function getPdfStylesheet() {
    return loadPdfTemplateCss('default');
}

module.exports = {
    getPdfTemplatesManifest,
    loadPdfTemplateCss,
    renderTitlePage,
    resolvePdfTemplateName,
    getPdfStylesheet
};

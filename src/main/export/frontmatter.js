// MrxDown Main — Frontmatter-Parsing (pure, testbar)
// Minimal YAML-lite parser for the frontmatter we care about (key: value pairs,
// block scalars via `|` or `>`, simple comments). Handles multi-line abstracts.
// NOT a full YAML implementation — just enough for frontmatter in practice.

function parseFrontmatterYaml(raw) {
    if (!raw) return {};
    const out = {};
    const lines = raw.split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
        const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
        if (!m) { i++; continue; }
        const key = m[1];
        let val = m[2].trim();
        if (val === '|' || val === '>') {
            // Block scalar — collect until dedent or blank line
            i++;
            const indent = (lines[i] || '').match(/^(\s*)/)[1].length || 2;
            const collected = [];
            while (i < lines.length) {
                const l = lines[i];
                if (!l.trim()) { collected.push(''); i++; continue; }
                if (l.match(/^(\s*)/)[1].length < indent) break;
                collected.push(l.slice(indent));
                i++;
            }
            out[key] = val === '>' ? collected.join(' ').trim() : collected.join('\n').trimEnd();
            continue;
        }
        // Strip surrounding quotes
        val = val.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
        out[key] = val;
        i++;
    }
    return out;
}

function extractFrontmatter(markdown) {
    // L3: strip UTF-8 BOM — a BOM'd file otherwise never matches ^--- and silently
    // loses its template/title-page frontmatter
    if (markdown && markdown.charCodeAt(0) === 0xFEFF) markdown = markdown.slice(1);
    const m = (markdown || '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (!m) return { frontmatter: {}, body: markdown || '' };
    return {
        frontmatter: parseFrontmatterYaml(m[1]),
        body: markdown.slice(m[0].length)
    };
}

// Escape HTML for title-page text fields
function escHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

module.exports = { parseFrontmatterYaml, extractFrontmatter, escHtml };

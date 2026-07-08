// wikilinks.js — E1: Wiki-Links ([[Notiz]], [[Notiz#Heading]], [[Notiz|Alias]])
// Dual-use wie callouts.js: classic script im Renderer (Preview + Autocomplete +
// Klick-Handling) UND CommonJS im Main-Prozess (CLI-Exporte, Backlinks-Scan).
// Die marked-Inline-Extension bekommt den Resolver injiziert — der Renderer
// löst gegen den Vault-Index auf, headless-Exporte rendern nur das Label.

// Pure: zerlegt den Inhalt zwischen [[ und ]] in Ziel/Heading/Alias.
// "Seite#Abschnitt|Anzeige" → { target: 'Seite', heading: 'Abschnitt', alias: 'Anzeige' }
function parseWikiLinkText(inner) {
    if (!inner || !inner.trim()) return null;
    let rest = inner;
    let alias = null;
    const pipeIdx = rest.indexOf('|');
    if (pipeIdx !== -1) {
        alias = rest.slice(pipeIdx + 1).trim() || null;
        rest = rest.slice(0, pipeIdx);
    }
    let heading = null;
    const hashIdx = rest.indexOf('#');
    if (hashIdx !== -1) {
        heading = rest.slice(hashIdx + 1).trim() || null;
        rest = rest.slice(0, hashIdx);
    }
    const target = rest.trim();
    if (!target && !heading) return null;
    return { target, heading, alias };
}

// Pure: findet die Datei zu einem Wiki-Ziel im Vault-Index.
// files = [{ name, path }] (name = Dateiname MIT Endung). Match-Reihenfolge:
// exakter Name ohne Endung (case-insensitive) → exakter Name mit Endung.
function resolveWikiTarget(target, files) {
    if (!target || !Array.isArray(files)) return null;
    const needle = target.toLowerCase();
    for (const f of files) {
        const base = f.name.replace(/\.(md|markdown)$/i, '').toLowerCase();
        if (base === needle) return f.path;
    }
    for (const f of files) {
        if (f.name.toLowerCase() === needle) return f.path;
    }
    return null;
}

function escapeWikiHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// marked-Inline-Extension. resolveFn(target) → Pfad oder null; ohne resolveFn
// (headless) wird nur das Label ohne Link-Funktion gerendert.
function createWikiLinkExtension(resolveFn) {
    return {
        extensions: [{
            name: 'wikilink',
            level: 'inline',
            start(src) {
                const idx = src.indexOf('[[');
                return idx === -1 ? undefined : idx;
            },
            tokenizer(src) {
                const cap = /^\[\[([^[\]\n]+)\]\]/.exec(src);
                if (!cap) return undefined;
                const parsed = parseWikiLinkText(cap[1]);
                if (!parsed) return undefined;
                return {
                    type: 'wikilink',
                    raw: cap[0],
                    target: parsed.target,
                    heading: parsed.heading,
                    alias: parsed.alias
                };
            },
            renderer(token) {
                const label = token.alias
                    || (token.target ? token.target + (token.heading ? ' › ' + token.heading : '') : token.heading);
                const resolved = (typeof resolveFn === 'function' && token.target)
                    ? resolveFn(token.target)
                    : null;
                const attrs = [
                    'class="wiki-link' + (resolved ? '' : ' wiki-link-missing') + '"',
                    'data-wiki-target="' + escapeWikiHtml(token.target) + '"'
                ];
                if (token.heading) attrs.push('data-wiki-heading="' + escapeWikiHtml(token.heading) + '"');
                if (resolved) attrs.push('data-wiki-path="' + escapeWikiHtml(resolved) + '"');
                return '<a href="#" ' + attrs.join(' ') + '>' + escapeWikiHtml(label) + '</a>';
            }
        }]
    };
}

// Pure: alle Wiki-Link-Ziele eines Dokuments (für den Backlinks-Scan).
// Code-Fences werden übersprungen — dort sind [[…]] Literale.
function extractWikiTargets(markdown) {
    const targets = [];
    const lines = (markdown || '').split('\n');
    let inFence = false;
    for (const line of lines) {
        if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
        if (inFence) continue;
        const re = /\[\[([^[\]\n]+)\]\]/g;
        let m;
        while ((m = re.exec(line)) !== null) {
            const parsed = parseWikiLinkText(m[1]);
            if (parsed && parsed.target) targets.push(parsed.target);
        }
    }
    return targets;
}

// Export for Node.js (main/tests), no-op in browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseWikiLinkText, resolveWikiTarget, createWikiLinkExtension, extractWikiTargets };
}

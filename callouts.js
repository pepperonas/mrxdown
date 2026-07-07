// callouts.js — E4: Callouts/Admonitions (GitHub-/Obsidian-Stil)
// `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`
// als marked-Extension (Block-Tokenizer + Renderer). Dual-use wie editor-utils.js:
// classic script im Renderer (Preview) UND CommonJS im Main-Prozess (CLI-PDF),
// damit beide Pfade identisches Callout-HTML erzeugen.

// Inline-Lucide-Icons (stroke: currentColor → erben die Callout-Akzentfarbe).
// Bewusst eingebettet statt icons.js: das Modul muss auch im Main-Prozess laufen.
const CALLOUT_SVG_ATTRS = 'xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="callout-icon"';

const CALLOUT_TYPES = {
    note: {
        label: 'Hinweis',
        icon: `<svg ${CALLOUT_SVG_ATTRS}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`
    },
    tip: {
        label: 'Tipp',
        icon: `<svg ${CALLOUT_SVG_ATTRS}><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`
    },
    important: {
        label: 'Wichtig',
        icon: `<svg ${CALLOUT_SVG_ATTRS}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v2"/><path d="M12 13h.01"/></svg>`
    },
    warning: {
        label: 'Warnung',
        icon: `<svg ${CALLOUT_SVG_ATTRS}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 20h16a2 2 0 0 0 1.73-2Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`
    },
    caution: {
        label: 'Achtung',
        icon: `<svg ${CALLOUT_SVG_ATTRS}><path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`
    }
};

// Pure: erkennt eine Callout-Kopfzeile ("[!NOTE]" oder "[!warning] Eigener Titel").
// Gibt { type, title } zurück (title = null → Standard-Label) oder null.
function parseCalloutHeader(line) {
    const m = /^\[!([A-Za-z]+)\][ \t]*(.*)$/.exec((line || '').trim());
    if (!m) return null;
    const type = m[1].toLowerCase();
    if (!CALLOUT_TYPES[type]) return null;
    return { type, title: m[2].trim() || null };
}

function escapeCalloutHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// marked-Extension (Block-Level). Läuft VOR dem eingebauten blockquote-Tokenizer;
// alles, was keine Callout-Kopfzeile hat, fällt an den normalen blockquote zurück.
// Strikt zeilenbasiert (jede Zeile braucht ihr '>') — keine Lazy-Continuation,
// dafür vorhersagbar und ohne Reimplementierung der marked-Interna.
function createCalloutExtension() {
    return {
        extensions: [{
            name: 'callout',
            level: 'block',
            start(src) {
                const m = src.match(/(^|\n) {0,3}> ?\[!/);
                return m ? m.index + (m[1] ? 1 : 0) : undefined;
            },
            tokenizer(src) {
                const cap = /^ {0,3}> ?[^\n]*(?:\n {0,3}>[^\n]*)*/.exec(src);
                if (!cap) return undefined;
                const lines = cap[0].split('\n').map(l => l.replace(/^ {0,3}> ?/, ''));
                const header = parseCalloutHeader(lines[0]);
                if (!header) return undefined; // normaler Blockquote
                const token = {
                    type: 'callout',
                    raw: cap[0],
                    calloutType: header.type,
                    calloutTitle: header.title,
                    tokens: []
                };
                this.lexer.blockTokens(lines.slice(1).join('\n'), token.tokens);
                return token;
            },
            renderer(token) {
                const meta = CALLOUT_TYPES[token.calloutType];
                const title = token.calloutTitle || meta.label;
                const body = this.parser.parse(token.tokens);
                return '<div class="callout callout-' + token.calloutType + '">' +
                    '<p class="callout-title">' + meta.icon +
                    '<span>' + escapeCalloutHtml(title) + '</span></p>' +
                    body + '</div>\n';
            }
        }]
    };
}

// Export for Node.js (CLI/tests), no-op in browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CALLOUT_TYPES, parseCalloutHeader, createCalloutExtension };
}

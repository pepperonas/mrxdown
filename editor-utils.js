// editor-utils.js — Pure utility functions for the MrxDown editor
// These functions are shared between the renderer (browser) and tests (Node.js)

/**
 * Generate a GitHub-compatible heading ID from heading text.
 * @param {string} text - The heading text
 * @param {Object} [idCounts] - Mutable counter object for duplicate handling
 * @returns {string} The generated ID
 */
function generateHeadingId(text, idCounts) {
    const startsWithEmoji = /^[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(text.trim());

    let id = text
        .toLowerCase()
        .trim()
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '-')
        .replace(/\s+/g, '-')
        .replace(/[^\w\u00E4\u00F6\u00FC\u00DF\u00C4\u00D6\u00DC-]/g, '')
        .replace(/-+$/g, '')
        .replace(/^-+/, startsWithEmoji ? '-' : '');

    if (idCounts) {
        const baseId = id;
        if (idCounts[baseId] !== undefined) {
            idCounts[baseId]++;
            id = `${baseId}-${idCounts[baseId]}`;
        } else {
            idCounts[baseId] = 0;
        }
    }

    return id;
}

/**
 * Determine what text to insert for smart enter in a list context.
 * @param {string} currentLine - The text of the current line (up to cursor)
 * @returns {string|null} The continuation text, '' to end the list, or null if not in a list
 */
function getSmartEnterText(currentLine) {
    // Match unordered list: - item, * item, + item (with optional indent)
    const unorderedMatch = currentLine.match(/^(\s*)([-*+])\s(.+)/);
    if (unorderedMatch) {
        return unorderedMatch[1] + unorderedMatch[2] + ' ';
    }

    // Match ordered list: 1. item, 2. item (with optional indent)
    const orderedMatch = currentLine.match(/^(\s*)(\d+)\.\s(.+)/);
    if (orderedMatch) {
        const nextNum = parseInt(orderedMatch[2]) + 1;
        return orderedMatch[1] + nextNum + '. ';
    }

    // Match empty unordered list item: just "- " or "* " or "+ " (with optional indent)
    const emptyUnorderedMatch = currentLine.match(/^(\s*)([-*+])\s*$/);
    if (emptyUnorderedMatch) {
        return '';
    }

    // Match empty ordered list item: just "1. " (with optional indent)
    const emptyOrderedMatch = currentLine.match(/^(\s*)\d+\.\s*$/);
    if (emptyOrderedMatch) {
        return '';
    }

    return null;
}

/**
 * Indent a block of text by 4 spaces per line.
 * @param {string} block - The text block (may contain newlines)
 * @returns {string} The indented block
 */
function indentLines(block) {
    return block.split('\n').map(line => '    ' + line).join('\n');
}

/**
 * Unindent a block of text by removing up to 4 leading spaces per line.
 * @param {string} block - The text block (may contain newlines)
 * @returns {string} The unindented block
 */
function unindentLines(block) {
    return block.split('\n').map(line => {
        const match = line.match(/^ {1,4}/);
        return match ? line.substring(match[0].length) : line;
    }).join('\n');
}

/**
 * Toggle an HTML comment on a single line.
 * @param {string} line - The line of text
 * @returns {string} The toggled line
 */
function toggleLineComment(line) {
    const trimmed = line.trim();
    if (trimmed.startsWith('<!-- ') && trimmed.endsWith(' -->')) {
        return line.replace(/^(\s*)<!-- /, '$1').replace(/ -->(\s*)$/, '$1');
    }
    const indent = line.match(/^(\s*)/)[1];
    const content = line.substring(indent.length);
    return indent + '<!-- ' + content + ' -->';
}

/**
 * B1: Analyze document and return comprehensive statistics.
 * @param {string} text - The full document text
 * @returns {Object} Document statistics
 */
function analyzeDocument(text) {
    const chars = text.length;
    const charsNoSpaces = text.replace(/\s/g, '').length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text.split('\n');
    const lineCount = lines.length;

    // Sentences: split on .!? followed by space or end
    const sentences = text.trim() ? (text.match(/[.!?]+(?:\s|$)/g) || []).length : 0;

    // Paragraphs: blocks separated by blank lines
    const paragraphs = text.trim() ? text.split(/\n\s*\n/).filter(p => p.trim()).length : 0;

    // Headings by level
    const headings = { total: 0, h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
    for (const line of lines) {
        const m = line.match(/^(#{1,6})\s+/);
        if (m) {
            headings.total++;
            headings[`h${m[1].length}`]++;
        }
    }

    // Images
    const images = (text.match(/!\[([^\]]*)\]\([^)]+\)/g) || []).length;

    // Links (excluding images)
    const links = (text.match(/(?<!!)\[([^\]]+)\]\([^)]+\)/g) || []).length;

    // Code blocks (fenced)
    const codeBlocks = (text.match(/^```/gm) || []).length / 2;

    // Reading time: ~200 words per minute
    const readingTimeMin = Math.max(1, Math.ceil(words / 200));

    return { chars, charsNoSpaces, words, sentences, paragraphs, lineCount, headings, images, links, codeBlocks, readingTimeMin };
}

/**
 * B7: Lint markdown text and return warnings.
 * @param {string} text - The full document text
 * @returns {Array<{line: number, message: string, type: string}>} List of warnings
 */
function lintMarkdown(text) {
    const warnings = [];
    const lines = text.split('\n');
    let lastHeadingLevel = 0;
    const headingTexts = new Set();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Heading level jumps (e.g., H1 → H3)
        const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const headingText = headingMatch[2].trim();

            if (lastHeadingLevel > 0 && level > lastHeadingLevel + 1) {
                warnings.push({ line: lineNum, message: `Heading-Sprung: H${lastHeadingLevel} → H${level}`, type: 'warning' });
            }
            lastHeadingLevel = level;

            // Duplicate headings
            if (headingTexts.has(headingText.toLowerCase())) {
                warnings.push({ line: lineNum, message: `Doppelte Überschrift: "${headingText}"`, type: 'info' });
            }
            headingTexts.add(headingText.toLowerCase());
        }

        // Empty links: [text]() or []()
        if (/\[[^\]]*\]\(\s*\)/.test(line)) {
            warnings.push({ line: lineNum, message: 'Leerer Link (kein URL)', type: 'error' });
        }

        // Broken relative image references (can't check file existence, but can flag suspicious patterns)
        const imgMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
        if (imgMatch) {
            const src = imgMatch[2];
            // Flag relative paths with spaces (common mistake)
            if (!src.startsWith('http') && !src.startsWith('data:') && src.includes(' ') && !src.includes('%20')) {
                warnings.push({ line: lineNum, message: `Bild-Pfad mit Leerzeichen: "${src}"`, type: 'warning' });
            }
        }
    }

    return warnings;
}

// --- K6: Paste-as-Markdown — pure Entscheidungs- und Aufräum-Logik ---

// Tags, deren Vorkommen bedeutet, dass die HTML-Zwischenablage echte Struktur/
// Formatierung trägt, die im reinen Text verloren ginge. Reine Wrapper
// (div/span/p/br) zählen NICHT — dort ist text/plain gleichwertig und der
// normale Paste-Pfad das erwartete Verhalten.
const HTML_PASTE_MEANINGFUL_TAGS = /<(a|b|strong|em|i|u|s|strike|del|mark|h[1-6]|ul|ol|li|table|thead|tbody|tr|td|th|blockquote|pre|code|img|hr|dl|dt|dd|sup|sub)[\s/>]/i;

// Entscheidet, ob eine HTML-Zwischenablage in Markdown konvertiert werden soll.
// Konservativ: im Zweifel false → normaler Paste (kein Datenverlust möglich).
function shouldConvertHtmlPaste(html, plainText) {
    if (!html || !html.trim()) return false;
    // Copy aus dem eigenen CodeMirror-Editor: die HTML-Variante ist nur
    // gestyltes Editor-DOM — konvertieren würde den Quelltext zerstören.
    if (/class="[^"]*\bcm-(line|editor|content)\b/.test(html)) return false;
    // Ohne text/plain-Fallback konvertieren wir, sobald überhaupt HTML da ist
    // (sonst würde gar nichts eingefügt); mit Fallback nur bei echter Struktur.
    if (!HTML_PASTE_MEANINGFUL_TAGS.test(html)) return false;
    return true;
}

// Nachbearbeitung des von Turndown erzeugten Markdowns: überzählige Leerzeilen
// eindampfen, Ränder trimmen. Bewusst minimal — zwei trailing Spaces (harte
// Zeilenumbrüche) und Einrückungen bleiben unangetastet.
function cleanupPastedMarkdown(markdown) {
    if (!markdown) return '';
    return markdown
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        // Turndown padded Listen-Marker auf 4 Zeichen ("-   x", "1.  x") —
        // normalisieren auf ein Leerzeichen, wie es der Editor selbst schreibt.
        // (Theoretisch träfe das auch Zeilen in Code-Fences; reale Code-Zeilen
        // beginnen aber praktisch nie mit "-␣␣␣" — bewusster Trade-off.)
        .replace(/^(\s*)([-*+])[ ]{2,}(?=\S)/gm, '$1$2 ')
        .replace(/^(\s*)(\d+\.)[ ]{2,}(?=\S)/gm, '$1$2 ')
        .replace(/^\n+/, '')
        .replace(/\s+$/, '');
}

// --- K4: Slide-Export — pure Folien-Split-Logik ---

// Zerlegt Markdown (OHNE Frontmatter — vorher extrahieren!) an Folientrennern:
// eine Zeile aus --- oder === (3+), der eine LEERE Zeile vorausgeht. Die
// Leerzeilen-Bedingung löst beide Kollisionen: Setext-Headings ("Text\n---")
// und den Frontmatter-Delimiter. Trenner in Code-Fences zählen nie.
// Speaker-Notes: ein <!-- notes: ... -->-Kommentar pro Folie wird extrahiert.
// Rückgabe: [{ markdown, notes }] — leere Folien (Doppel-Trenner) fallen raus.
function splitSlides(markdown) {
    const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n');
    const rawSlides = [];
    let current = [];
    let inFence = false;
    let prevBlank = true; // Dokumentanfang zählt wie Leerzeile

    for (const line of lines) {
        if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
        const isSeparator = !inFence && prevBlank && /^ {0,3}(-{3,}|={3,})\s*$/.test(line);
        if (isSeparator) {
            rawSlides.push(current.join('\n'));
            current = [];
            prevBlank = true;
            continue;
        }
        current.push(line);
        prevBlank = line.trim() === '';
    }
    rawSlides.push(current.join('\n'));

    const slides = rawSlides.map(md => {
        let notes = null;
        const cleaned = md.replace(/<!--\s*notes?:\s*([\s\S]*?)-->/i, (m, n) => {
            notes = n.trim();
            return '';
        });
        return { markdown: cleaned.trim(), notes };
    }).filter(s => s.markdown || s.notes);

    // Ein leeres Dokument ist EINE leere Folie, kein leeres Deck
    return slides.length > 0 ? slides : [{ markdown: '', notes: null }];
}

// --- E2: Slash-Commands & Snippets — pure Expansions-Logik ---

// Expandiert einen Snippet-Body: {{date}} (ISO), {{time}} (HH:MM), {{title}}
// (Dokumenttitel), {{cursor}} = Cursor-Stop (erstes Vorkommen; Marker werden
// entfernt). ctx = { now?: Date, title?: string }. Rückgabe:
// { text, cursorOffset } — cursorOffset = -1 heißt "ans Ende".
function expandSnippet(body, ctx) {
    const now = (ctx && ctx.now instanceof Date) ? ctx.now : new Date();
    const pad = n => String(n).padStart(2, '0');
    const date = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    const time = pad(now.getHours()) + ':' + pad(now.getMinutes());
    const title = (ctx && ctx.title) ? String(ctx.title) : '';

    let text = String(body || '')
        .replace(/\{\{date\}\}/gi, date)
        .replace(/\{\{time\}\}/gi, time)
        .replace(/\{\{title\}\}/gi, title);

    let cursorOffset = -1;
    const cursorIdx = text.indexOf('{{cursor}}');
    if (cursorIdx !== -1) {
        cursorOffset = cursorIdx;
        text = text.replace(/\{\{cursor\}\}/g, '');
    }
    return { text, cursorOffset };
}

// Eingebaute Slash-Befehle. Reine Daten — body nutzt dieselben Platzhalter wie
// eigene Snippets; das UI (05-editor.js) filtert nach name/keywords.
const SLASH_COMMANDS = [
    { id: 'tabelle', label: 'Tabelle', hint: '3×2-Grundgerüst', body: '| Spalte 1 | Spalte 2 | Spalte 3 |\n|----------|----------|----------|\n| {{cursor}}         |          |          |\n' },
    { id: 'codeblock', label: 'Code-Block', hint: '``` mit Sprachwahl', body: '```{{cursor}}\n\n```\n' },
    { id: 'hinweis', label: 'Callout: Hinweis', hint: '> [!NOTE]', body: '> [!NOTE]\n> {{cursor}}\n' },
    { id: 'tipp', label: 'Callout: Tipp', hint: '> [!TIP]', body: '> [!TIP]\n> {{cursor}}\n' },
    { id: 'wichtig', label: 'Callout: Wichtig', hint: '> [!IMPORTANT]', body: '> [!IMPORTANT]\n> {{cursor}}\n' },
    { id: 'warnung', label: 'Callout: Warnung', hint: '> [!WARNING]', body: '> [!WARNING]\n> {{cursor}}\n' },
    { id: 'achtung', label: 'Callout: Achtung', hint: '> [!CAUTION]', body: '> [!CAUTION]\n> {{cursor}}\n' },
    { id: 'zitat', label: 'Zitat', hint: '> …', body: '> {{cursor}}\n' },
    { id: 'aufgabe', label: 'Aufgabenliste', hint: '- [ ]', body: '- [ ] {{cursor}}\n' },
    { id: 'liste', label: 'Liste', hint: '- …', body: '- {{cursor}}\n' },
    { id: 'nummeriert', label: 'Nummerierte Liste', hint: '1. …', body: '1. {{cursor}}\n' },
    { id: 'linie', label: 'Horizontale Linie', hint: '---', body: '---\n\n{{cursor}}' },
    { id: 'datum', label: 'Datum', hint: 'heute (ISO)', body: '{{date}}' },
    { id: 'zeit', label: 'Uhrzeit', hint: 'jetzt (HH:MM)', body: '{{time}}' },
    { id: 'frontmatter', label: 'Frontmatter', hint: 'title/author/date', body: '---\ntitle: {{title}}\nauthor: {{cursor}}\ndate: {{date}}\n---\n\n' },
    { id: 'bild', label: 'Bild', hint: '![]()', body: '![{{cursor}}]()' },
    { id: 'link', label: 'Link', hint: '[]()', body: '[{{cursor}}]()' },
    { id: 'mermaid', label: 'Mermaid-Diagramm', hint: 'flowchart', body: '```mermaid\nflowchart TD\n    A[{{cursor}}] --> B[Ende]\n```\n' },
    { id: 'mathe', label: 'Mathe-Block', hint: '$$ … $$', body: '$$\n{{cursor}}\n$$\n' },
    { id: 'wikilink', label: 'Wiki-Link', hint: '[[…]]', body: '[[{{cursor}}]]' }
];

// Export for Node.js (tests), no-op in browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateHeadingId,
        getSmartEnterText,
        indentLines,
        unindentLines,
        toggleLineComment,
        analyzeDocument,
        lintMarkdown,
        shouldConvertHtmlPaste,
        cleanupPastedMarkdown,
        splitSlides,
        expandSnippet,
        SLASH_COMMANDS
    };
}

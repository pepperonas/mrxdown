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

// Export for Node.js (tests), no-op in browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateHeadingId,
        getSmartEnterText,
        indentLines,
        unindentLines,
        toggleLineComment,
        analyzeDocument,
        lintMarkdown
    };
}

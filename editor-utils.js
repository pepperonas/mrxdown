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

// Export for Node.js (tests), no-op in browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateHeadingId,
        getSmartEnterText,
        indentLines,
        unindentLines,
        toggleLineComment
    };
}

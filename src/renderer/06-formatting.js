// MrxDown Renderer — Modul 06-formatting.js
// Formatierung (fett/kursiv/…), Zeilen-Operationen, Einrücken, Kommentare, Bild einfügen
// Classic Script (kein ESM): Top-Level-Deklarationen sind global über alle
// Renderer-Module hinweg; die Ladereihenfolge in index.html ist verbindlich.

// Undo-safe text replacement using execCommand to preserve browser undo stack
function replaceRange(start, end, newText) {
    editor.focus();
    editor.selectionStart = start;
    editor.selectionEnd = end;
    editor.execCommand('insertText', false, newText);
}

// Formatting Functions
function insertAtCursor(text) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    replaceRange(start, end, text);
    editor.selectionStart = editor.selectionEnd = start + text.length;
}

function wrapSelection(prefix, suffix = '') {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.substring(start, end);
    const text = editor.value;

    if (selectedText) {
        // Check if the selection is already wrapped with prefix/suffix
        const beforeStart = start - prefix.length;
        const afterEnd = end + suffix.length;
        if (beforeStart >= 0 && afterEnd <= text.length &&
            text.substring(beforeStart, start) === prefix &&
            text.substring(end, afterEnd) === suffix) {
            // Unwrap: remove prefix before and suffix after selection
            replaceRange(beforeStart, afterEnd, selectedText);
            editor.selectionStart = beforeStart;
            editor.selectionEnd = beforeStart + selectedText.length;
        } else if (selectedText.startsWith(prefix) && selectedText.endsWith(suffix) &&
                   selectedText.length >= prefix.length + suffix.length) {
            // Selection includes the wrapper - unwrap
            const inner = selectedText.slice(prefix.length, -suffix.length || undefined);
            replaceRange(start, end, inner);
            editor.selectionStart = start;
            editor.selectionEnd = start + inner.length;
        } else {
            // Wrap
            const wrappedText = prefix + selectedText + suffix;
            replaceRange(start, end, wrappedText);
            editor.selectionStart = start + prefix.length;
            editor.selectionEnd = start + prefix.length + selectedText.length;
        }
    } else {
        insertAtCursor(prefix + suffix);
        editor.selectionStart = editor.selectionEnd = start + prefix.length;
    }

    editor.focus();
}

function formatBold() {
    wrapSelection('**', '**');
}

function formatItalic() {
    wrapSelection('*', '*');
}

function formatStrikethrough() {
    wrapSelection('~~', '~~');
}

function formatCode() {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.substring(start, end);
    
    if (selectedText.includes('\n')) {
        wrapSelection('```\n', '\n```');
    } else {
        wrapSelection('`', '`');
    }
}

async function insertLink() {
    const url = await showInputDialog('Link einfügen', 'https://...', '');
    if (url) {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);
        const linkText = selectedText || 'Link Text';

        insertAtCursor(`[${linkText}](${url})`);
    }
}

function insertHeading(level) {
    const start = editor.selectionStart;
    const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = editor.value.indexOf('\n', start);
    const actualLineEnd = lineEnd === -1 ? editor.value.length : lineEnd;
    const currentLine = editor.value.substring(lineStart, actualLineEnd);

    const headingPrefix = '#'.repeat(level) + ' ';
    const newLine = currentLine.replace(/^#+\s*/, '') || 'Überschrift';

    replaceRange(lineStart, actualLineEnd, headingPrefix + newLine);
    editor.selectionStart = editor.selectionEnd = lineStart + headingPrefix.length + newLine.length;
    editor.focus();
}

// --- Line Utilities ---

function getCurrentLineRange(pos) {
    const text = editor.value;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    return { lineStart, lineEnd };
}

function getSelectedLinesRange() {
    const text = editor.value;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = text.indexOf('\n', end - (end > start && text[end - 1] === '\n' ? 1 : 0));
    if (lineEnd === -1) lineEnd = text.length;
    return { lineStart, lineEnd };
}

// --- Line Operations ---

function deleteLine() {
    const text = editor.value;
    const { lineStart, lineEnd } = getSelectedLinesRange();

    // Determine what to delete: include the trailing newline or leading newline
    let delStart = lineStart;
    let delEnd = lineEnd;
    if (delEnd < text.length) {
        delEnd++; // include trailing \n
    } else if (delStart > 0) {
        delStart--; // include leading \n
    }

    replaceRange(delStart, delEnd, '');
    editor.selectionStart = editor.selectionEnd = delStart;
    handleEditorInput();
}

function moveLineUp() {
    const text = editor.value;
    const { lineStart, lineEnd } = getSelectedLinesRange();

    if (lineStart === 0) return; // already at top

    const prevLineStart = text.lastIndexOf('\n', lineStart - 2) + 1;
    const selectedBlock = text.substring(lineStart, lineEnd);
    const prevLine = text.substring(prevLineStart, lineStart - 1); // exclude \n

    const selStartOffset = editor.selectionStart - lineStart;
    const selEndOffset = editor.selectionEnd - lineStart;

    const newText = selectedBlock + '\n' + prevLine;
    replaceRange(prevLineStart, lineEnd, newText);

    editor.selectionStart = prevLineStart + selStartOffset;
    editor.selectionEnd = prevLineStart + selEndOffset;
    handleEditorInput();
}

function moveLineDown() {
    const text = editor.value;
    const { lineStart, lineEnd } = getSelectedLinesRange();

    if (lineEnd >= text.length) return; // already at bottom

    let nextLineEnd = text.indexOf('\n', lineEnd + 1);
    if (nextLineEnd === -1) nextLineEnd = text.length;
    const nextLine = text.substring(lineEnd + 1, nextLineEnd);
    const selectedBlock = text.substring(lineStart, lineEnd);

    const selStartOffset = editor.selectionStart - lineStart;
    const selEndOffset = editor.selectionEnd - lineStart;
    const newStart = lineStart + nextLine.length + 1;

    const newText = nextLine + '\n' + selectedBlock;
    replaceRange(lineStart, nextLineEnd, newText);

    editor.selectionStart = newStart + selStartOffset;
    editor.selectionEnd = newStart + selEndOffset;
    handleEditorInput();
}

function duplicateLine() {
    const text = editor.value;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;

    if (start !== end) {
        // Duplicate selection
        const selected = text.substring(start, end);
        replaceRange(end, end, selected);
        editor.selectionStart = end;
        editor.selectionEnd = end + selected.length;
    } else {
        // Duplicate current line
        const { lineStart, lineEnd } = getCurrentLineRange(start);
        const line = text.substring(lineStart, lineEnd);
        const offset = start - lineStart;
        replaceRange(lineEnd, lineEnd, '\n' + line);
        editor.selectionStart = editor.selectionEnd = lineEnd + 1 + offset;
    }
    handleEditorInput();
}

function selectCurrentLine() {
    const { lineStart, lineEnd } = getCurrentLineRange(editor.selectionStart);
    editor.selectionStart = lineStart;
    editor.selectionEnd = lineEnd;
    editor.focus();
}

// --- Indent / Unindent ---

function indentSelection() {
    const text = editor.value;
    const { lineStart, lineEnd } = getSelectedLinesRange();
    const block = text.substring(lineStart, lineEnd);
    const indented = indentLines(block);

    const selStart = editor.selectionStart;
    const selEnd = editor.selectionEnd;

    replaceRange(lineStart, lineEnd, indented);

    // Adjust selection: first line gets 4 chars added at start
    const firstLineOffset = 4;
    editor.selectionStart = selStart + firstLineOffset;
    editor.selectionEnd = selEnd + (indented.length - block.length);
}

function unindentSelection() {
    const text = editor.value;
    const { lineStart, lineEnd } = getSelectedLinesRange();
    const block = text.substring(lineStart, lineEnd);
    const unindented = unindentLines(block);

    const selStart = editor.selectionStart;
    const selEnd = editor.selectionEnd;
    const diff = block.length - unindented.length;

    replaceRange(lineStart, lineEnd, unindented);

    // Adjust selection
    const firstLine = block.split('\n')[0];
    const firstLineSpaces = Math.min(firstLine.match(/^ */)[0].length, 4);
    editor.selectionStart = Math.max(lineStart, selStart - firstLineSpaces);
    editor.selectionEnd = Math.max(editor.selectionStart, selEnd - diff);
}

// indentLines() and unindentLines() are provided by editor-utils.js

// --- Toggle Comment ---

function toggleComment() {
    const text = editor.value;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;

    if (start !== end) {
        // Wrap selection in comment
        const selected = text.substring(start, end);
        const toggled = toggleBlockComment(selected);
        replaceRange(start, end, toggled);
        editor.selectionStart = start;
        editor.selectionEnd = start + toggled.length;
    } else {
        // Toggle comment on current line
        const { lineStart, lineEnd } = getCurrentLineRange(start);
        const line = text.substring(lineStart, lineEnd);
        const toggled = toggleLineComment(line);
        replaceRange(lineStart, lineEnd, toggled);
        editor.selectionStart = editor.selectionEnd = lineStart + toggled.length;
    }
    handleEditorInput();
}

// toggleLineComment() is provided by editor-utils.js

function toggleBlockComment(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('<!--') && trimmed.endsWith('-->')) {
        return text.replace(/^\s*<!--\s?/, '').replace(/\s?-->\s*$/, '');
    }
    return '<!-- ' + text + ' -->';
}

// getSmartEnterText() is provided by editor-utils.js

async function insertImage() {
    // Try native file picker first (Electron), fall back to URL input
    if (window.electronAPI && window.electronAPI.selectImage) {
        const imagePath = await window.electronAPI.selectImage();
        if (imagePath) {
            const alt = (await showInputDialog('Alt-Text eingeben', 'Beschreibung...', 'Bild')) || 'Bild';
            // Use relative path if possible
            const activeTab = tabs.find(tab => tab.id === activeTabId);
            let insertPath = imagePath;
            if (activeTab && activeTab.filePath) {
                const lastSep = Math.max(activeTab.filePath.lastIndexOf('/'), activeTab.filePath.lastIndexOf('\\'));
                const fileDir = lastSep >= 0 ? activeTab.filePath.substring(0, lastSep) : '';
                if (imagePath.startsWith(fileDir)) {
                    insertPath = imagePath.substring(fileDir.length + 1);
                }
            }
            insertAtCursor(`![${alt}](${insertPath})`);
            handleEditorInput();
            return;
        }
    }
    // Fallback: input dialog for URL
    const url = await showInputDialog('Bild einfügen', 'https://...', '');
    if (url) {
        const alt = (await showInputDialog('Alt-Text eingeben', 'Beschreibung...', 'Bild')) || 'Bild';
        insertAtCursor(`![${alt}](${url})`);
        handleEditorInput();
    }
}

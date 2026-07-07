// Tests für die Paste-as-Markdown-Logik (K6) in editor-utils.js
const { shouldConvertHtmlPaste, cleanupPastedMarkdown } = require('../editor-utils');

describe('shouldConvertHtmlPaste', () => {
    test('empty/undefined html never converts', () => {
        expect(shouldConvertHtmlPaste('', 'text')).toBe(false);
        expect(shouldConvertHtmlPaste(null, 'text')).toBe(false);
        expect(shouldConvertHtmlPaste('   ', 'text')).toBe(false);
    });

    test('plain wrappers (div/span/p/br) do not convert — text/plain is equivalent', () => {
        expect(shouldConvertHtmlPaste('<div>Hallo Welt</div>', 'Hallo Welt')).toBe(false);
        expect(shouldConvertHtmlPaste('<p>Eins</p><p>Zwei</p>', 'Eins\n\nZwei')).toBe(false);
        expect(shouldConvertHtmlPaste('<span style="color:red">rot</span>', 'rot')).toBe(false);
        expect(shouldConvertHtmlPaste('Zeile<br>Umbruch', 'Zeile\nUmbruch')).toBe(false);
    });

    test('structural markup converts', () => {
        expect(shouldConvertHtmlPaste('<h1>Titel</h1>', 'Titel')).toBe(true);
        expect(shouldConvertHtmlPaste('<ul><li>a</li></ul>', 'a')).toBe(true);
        expect(shouldConvertHtmlPaste('<table><tr><td>x</td></tr></table>', 'x')).toBe(true);
        expect(shouldConvertHtmlPaste('<blockquote>Zitat</blockquote>', 'Zitat')).toBe(true);
        expect(shouldConvertHtmlPaste('<pre><code>x=1</code></pre>', 'x=1')).toBe(true);
    });

    test('inline formatting converts', () => {
        expect(shouldConvertHtmlPaste('<strong>fett</strong>', 'fett')).toBe(true);
        expect(shouldConvertHtmlPaste('<em>kursiv</em>', 'kursiv')).toBe(true);
        expect(shouldConvertHtmlPaste('<a href="https://x.de">Link</a>', 'Link')).toBe(true);
        expect(shouldConvertHtmlPaste('<img src="a.png">', '')).toBe(true);
    });

    test('word-boundary: <address>/<script> etc. do not false-positive on the a/s tags', () => {
        expect(shouldConvertHtmlPaste('<address>Musterweg 1</address>', 'Musterweg 1')).toBe(false);
        expect(shouldConvertHtmlPaste('<section><div>x</div></section>', 'x')).toBe(false);
    });

    test('copy from own CodeMirror editor never converts', () => {
        const cmHtml = '<div class="cm-line"><span class="tok-heading"># Titel</span></div>';
        expect(shouldConvertHtmlPaste(cmHtml, '# Titel')).toBe(false);
        const cmEditor = '<div class="cm-editor"><h1>x</h1></div>';
        expect(shouldConvertHtmlPaste(cmEditor, 'x')).toBe(false);
    });
});

describe('cleanupPastedMarkdown', () => {
    test('collapses 3+ blank lines to one blank line', () => {
        expect(cleanupPastedMarkdown('a\n\n\n\nb')).toBe('a\n\nb');
    });

    test('normalizes CRLF and trims edges', () => {
        expect(cleanupPastedMarkdown('\n\r\nHallo\r\nWelt\n\n')).toBe('Hallo\nWelt');
    });

    test('normalizes Turndown list-marker padding to one space', () => {
        expect(cleanupPastedMarkdown('-   eins\n-   zwei')).toBe('- eins\n- zwei');
        expect(cleanupPastedMarkdown('1.  eins\n2.  zwei')).toBe('1. eins\n2. zwei');
        expect(cleanupPastedMarkdown('    -   verschachtelt')).toBe('    - verschachtelt');
    });

    test('keeps hard line breaks (two trailing spaces) inside lines', () => {
        expect(cleanupPastedMarkdown('Zeile eins  \nZeile zwei')).toBe('Zeile eins  \nZeile zwei');
    });

    test('empty input yields empty string', () => {
        expect(cleanupPastedMarkdown('')).toBe('');
        expect(cleanupPastedMarkdown(null)).toBe('');
    });
});

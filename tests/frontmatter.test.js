// Tests für src/main/export/frontmatter.js — pure Funktionen, laufen in Node.
const { parseFrontmatterYaml, extractFrontmatter, escHtml } = require('../src/main/export/frontmatter');

describe('parseFrontmatterYaml', () => {
    test('parses simple key-value pairs', () => {
        expect(parseFrontmatterYaml('title: Mein Dokument\nauthor: Martin')).toEqual({
            title: 'Mein Dokument',
            author: 'Martin'
        });
    });

    test('strips surrounding quotes', () => {
        expect(parseFrontmatterYaml('title: "Quoted"\nsubtitle: \'Single\'')).toEqual({
            title: 'Quoted',
            subtitle: 'Single'
        });
    });

    test('ignores comments and blank lines', () => {
        expect(parseFrontmatterYaml('# Kommentar\n\ntitle: X')).toEqual({ title: 'X' });
    });

    test('block scalar | keeps line breaks', () => {
        const raw = 'abstract: |\n  Zeile eins\n  Zeile zwei';
        expect(parseFrontmatterYaml(raw)).toEqual({ abstract: 'Zeile eins\nZeile zwei' });
    });

    test('block scalar > folds lines with spaces', () => {
        const raw = 'abstract: >\n  Zeile eins\n  Zeile zwei';
        expect(parseFrontmatterYaml(raw)).toEqual({ abstract: 'Zeile eins Zeile zwei' });
    });

    test('empty/undefined input returns empty object', () => {
        expect(parseFrontmatterYaml('')).toEqual({});
        expect(parseFrontmatterYaml(null)).toEqual({});
    });
});

describe('extractFrontmatter', () => {
    test('splits frontmatter from body', () => {
        const md = '---\ntitle: Test\n---\n# Hallo';
        const { frontmatter, body } = extractFrontmatter(md);
        expect(frontmatter).toEqual({ title: 'Test' });
        expect(body).toBe('# Hallo');
    });

    test('no frontmatter returns full body', () => {
        const { frontmatter, body } = extractFrontmatter('# Nur Inhalt');
        expect(frontmatter).toEqual({});
        expect(body).toBe('# Nur Inhalt');
    });

    test('CRLF line endings are handled', () => {
        const md = '---\r\ntitle: CRLF\r\n---\r\nBody';
        expect(extractFrontmatter(md).frontmatter).toEqual({ title: 'CRLF' });
    });

    test('L3: UTF-8 BOM does not break frontmatter detection', () => {
        const md = '﻿---\ntitle: BOM\n---\nBody';
        expect(extractFrontmatter(md).frontmatter).toEqual({ title: 'BOM' });
    });

    test('empty input yields empty result', () => {
        expect(extractFrontmatter('')).toEqual({ frontmatter: {}, body: '' });
        expect(extractFrontmatter(null)).toEqual({ frontmatter: {}, body: '' });
    });

    test('horizontal rule mid-document is not frontmatter', () => {
        const md = '# Titel\n\n---\n\nText';
        expect(extractFrontmatter(md).frontmatter).toEqual({});
        expect(extractFrontmatter(md).body).toBe(md);
    });
});

describe('escHtml', () => {
    test('escapes &, <, >, "', () => {
        expect(escHtml('<b>"A & B"</b>')).toBe('&lt;b&gt;&quot;A &amp; B&quot;&lt;/b&gt;');
    });

    test('null/undefined become empty string', () => {
        expect(escHtml(null)).toBe('');
        expect(escHtml(undefined)).toBe('');
    });
});

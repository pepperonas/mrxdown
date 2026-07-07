// Tests für callouts.js (E4) — Header-Parsing (pure) + marked-Integration
const { parseCalloutHeader, createCalloutExtension, CALLOUT_TYPES } = require('../callouts');
const { marked } = require('marked');

describe('parseCalloutHeader', () => {
    test('recognizes all five GitHub callout types', () => {
        for (const type of ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']) {
            expect(parseCalloutHeader(`[!${type}]`)).toEqual({ type: type.toLowerCase(), title: null });
        }
    });

    test('is case-insensitive', () => {
        expect(parseCalloutHeader('[!note]')).toEqual({ type: 'note', title: null });
        expect(parseCalloutHeader('[!Warning]')).toEqual({ type: 'warning', title: null });
    });

    test('supports custom titles (Obsidian-style)', () => {
        expect(parseCalloutHeader('[!TIP] Profi-Trick')).toEqual({ type: 'tip', title: 'Profi-Trick' });
    });

    test('rejects unknown types and non-headers', () => {
        expect(parseCalloutHeader('[!FOO]')).toBeNull();
        expect(parseCalloutHeader('Normales Zitat')).toBeNull();
        expect(parseCalloutHeader('')).toBeNull();
        expect(parseCalloutHeader(null)).toBeNull();
    });

    test('every type has a German label and an icon', () => {
        for (const meta of Object.values(CALLOUT_TYPES)) {
            expect(meta.label.length).toBeGreaterThan(0);
            expect(meta.icon).toContain('<svg');
        }
    });
});

describe('marked callout extension', () => {
    let md;
    beforeAll(() => {
        marked.use(createCalloutExtension());
        md = (src) => marked.parse(src);
    });

    test('renders a callout div with title and body', () => {
        const html = md('> [!NOTE]\n> Das ist ein Hinweis.');
        expect(html).toContain('class="callout callout-note"');
        expect(html).toContain('<span>Hinweis</span>');
        expect(html).toContain('Das ist ein Hinweis.');
        expect(html).toContain('<svg');
        expect(html).not.toContain('<blockquote>');
    });

    test('custom title is HTML-escaped', () => {
        const html = md('> [!WARNING] Achtung <b>böse</b>\n> Text');
        expect(html).toContain('<span>Achtung &lt;b&gt;böse&lt;/b&gt;</span>');
    });

    test('markdown inside the callout body is rendered', () => {
        const html = md('> [!TIP]\n> Mit **fett** und einer Liste:\n> - eins\n> - zwei');
        expect(html).toContain('<strong>fett</strong>');
        expect(html).toContain('<li>eins</li>');
    });

    test('plain blockquotes stay blockquotes', () => {
        const html = md('> Nur ein Zitat.');
        expect(html).toContain('<blockquote>');
        expect(html).not.toContain('callout');
    });

    test('callout mid-document (after paragraph) is recognized', () => {
        const html = md('Absatz davor.\n\n> [!CAUTION]\n> Gefahr!\n\nAbsatz danach.');
        expect(html).toContain('class="callout callout-caution"');
        expect(html).toContain('Absatz davor.');
        expect(html).toContain('Absatz danach.');
    });

    test('unknown type falls back to a normal blockquote', () => {
        const html = md('> [!BANANA]\n> Text');
        expect(html).toContain('<blockquote>');
        expect(html).not.toContain('callout-');
    });
});

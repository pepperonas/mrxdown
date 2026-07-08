// Tests für den Slide-Export (K4): splitSlides (pure, editor-utils.js) +
// generateSlides (formats/slides.js — läuft in purem Node, reveal-Assets
// kommen aus node_modules, Bilder-Pfad wird ohne Bilder nie berührt).
const { splitSlides } = require('../editor-utils');
const { generateSlides, REVEAL_THEMES } = require('../src/main/export/formats/slides');

describe('splitSlides', () => {
    test('splits on --- preceded by a blank line', () => {
        const slides = splitSlides('# Eins\n\n---\n\n# Zwei');
        expect(slides).toHaveLength(2);
        expect(slides[0].markdown).toBe('# Eins');
        expect(slides[1].markdown).toBe('# Zwei');
    });

    test('=== works as separator too', () => {
        expect(splitSlides('a\n\n===\n\nb')).toHaveLength(2);
    });

    test('setext heading (text directly above ---) does NOT split', () => {
        const slides = splitSlides('Überschrift\n---\n\nText');
        expect(slides).toHaveLength(1);
        expect(slides[0].markdown).toContain('Überschrift\n---');
    });

    test('--- inside code fences does NOT split', () => {
        const md = 'Vorher\n\n```\ncode\n\n---\n\nmehr code\n```\n\nNachher';
        expect(splitSlides(md)).toHaveLength(1);
    });

    test('frontmatter-like start: caller strips frontmatter, leading --- creates no empty slide', () => {
        const slides = splitSlides('---\n\n# Inhalt');
        expect(slides).toHaveLength(1);
        expect(slides[0].markdown).toBe('# Inhalt');
    });

    test('extracts speaker notes per slide', () => {
        const slides = splitSlides('# A\n<!-- notes: Hallo Sprecher -->\n\n---\n\n# B');
        expect(slides[0].notes).toBe('Hallo Sprecher');
        expect(slides[0].markdown).toBe('# A');
        expect(slides[1].notes).toBeNull();
    });

    test('multi-line notes', () => {
        const slides = splitSlides('# A\n<!-- notes:\nZeile 1\nZeile 2\n-->');
        expect(slides[0].notes).toBe('Zeile 1\nZeile 2');
    });

    test('no separator → one slide; empty input → one empty slide', () => {
        expect(splitSlides('# Nur eine Folie')).toHaveLength(1);
        expect(splitSlides('')).toEqual([{ markdown: '', notes: null }]);
    });

    test('double separator produces no empty slide', () => {
        const slides = splitSlides('a\n\n---\n\n---\n\nb');
        expect(slides).toHaveLength(2);
    });
});

describe('generateSlides', () => {
    const MD = '---\ntitle: Mein Deck\ntheme: white\n---\n\n# Folie 1\n\nInhalt **fett**\n<!-- notes: Notiz eins -->\n\n---\n\n## Folie 2\n\n- Punkt';

    test('produces self-contained reveal.js HTML', async () => {
        const buf = await generateSlides({ rawMarkdown: MD });
        const html = buf.toString('utf-8');
        expect(html).toContain('<title>Mein Deck</title>');
        expect((html.match(/<section>/g) || []).length).toBe(2);
        expect(html).toContain('<strong>fett</strong>');
        expect(html).toContain('<aside class="notes">');
        expect(html).toContain('Notiz eins');
        expect(html).toContain('Reveal.initialize');
        expect(html).toContain('RevealNotes');
        // self-contained: keine externen Ressourcen
        expect(html).not.toMatch(/(src|href)="https?:\/\//);
    }, 20000);

    test('frontmatter theme wins over default, dialog option wins over frontmatter', async () => {
        const fromFm = (await generateSlides({ rawMarkdown: MD })).toString();
        // white-Theme-CSS ist drin (Kennung: reveal-Themes tragen ihren Namen nicht,
        // aber white hat #fff-Background-Deklaration und black #191919 — robuster:
        // Option überschreibt Frontmatter und ändert das Dokument)
        const fromOpt = (await generateSlides({ rawMarkdown: MD, options: { theme: 'night' } })).toString();
        expect(fromOpt).not.toBe(fromFm);
        const invalid = (await generateSlides({ rawMarkdown: MD, options: { theme: '../../etc/passwd' } })).toString();
        expect(invalid).toBe(fromFm); // ungültig → Fallback auf Frontmatter/Default
    }, 20000);

    test('all advertised themes resolve to real CSS files', async () => {
        for (const theme of REVEAL_THEMES) {
            const buf = await generateSlides({ rawMarkdown: '# X', options: { theme } });
            expect(buf.length).toBeGreaterThan(10000);
        }
    }, 30000);
});

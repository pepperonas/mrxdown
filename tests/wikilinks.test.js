// Tests für wikilinks.js (E1) — Parsing, Resolver, marked-Extension, Target-Scan
const { parseWikiLinkText, resolveWikiTarget, createWikiLinkExtension, extractWikiTargets } = require('../wikilinks');
const { marked } = require('marked');

describe('parseWikiLinkText', () => {
    test('plain target', () => {
        expect(parseWikiLinkText('Notiz')).toEqual({ target: 'Notiz', heading: null, alias: null });
    });
    test('target with heading', () => {
        expect(parseWikiLinkText('Notiz#Abschnitt')).toEqual({ target: 'Notiz', heading: 'Abschnitt', alias: null });
    });
    test('target with alias', () => {
        expect(parseWikiLinkText('Notiz|Anzeige')).toEqual({ target: 'Notiz', heading: null, alias: 'Anzeige' });
    });
    test('target with heading AND alias', () => {
        expect(parseWikiLinkText('Notiz#Teil|Text')).toEqual({ target: 'Notiz', heading: 'Teil', alias: 'Text' });
    });
    test('empty/whitespace → null', () => {
        expect(parseWikiLinkText('')).toBeNull();
        expect(parseWikiLinkText('   ')).toBeNull();
        expect(parseWikiLinkText(null)).toBeNull();
    });
});

describe('resolveWikiTarget', () => {
    const files = [
        { name: 'Projekt Alpha.md', path: '/vault/Projekt Alpha.md' },
        { name: 'notizen.markdown', path: '/vault/sub/notizen.markdown' },
        { name: 'README.md', path: '/vault/README.md' }
    ];
    test('matches basename without extension, case-insensitive', () => {
        expect(resolveWikiTarget('projekt alpha', files)).toBe('/vault/Projekt Alpha.md');
        expect(resolveWikiTarget('Notizen', files)).toBe('/vault/sub/notizen.markdown');
    });
    test('matches full filename', () => {
        expect(resolveWikiTarget('README.md', files)).toBe('/vault/README.md');
    });
    test('no match → null', () => {
        expect(resolveWikiTarget('Unbekannt', files)).toBeNull();
        expect(resolveWikiTarget('', files)).toBeNull();
        expect(resolveWikiTarget('x', null)).toBeNull();
    });
});

describe('marked wikilink extension', () => {
    let md;
    beforeAll(() => {
        const resolver = (target) => target.toLowerCase() === 'existiert' ? '/vault/Existiert.md' : null;
        marked.use(createWikiLinkExtension(resolver));
        md = (src) => marked.parse(src);
    });

    test('resolved link carries path + class', () => {
        const html = md('Siehe [[Existiert]].');
        expect(html).toContain('class="wiki-link"');
        expect(html).toContain('data-wiki-path="/vault/Existiert.md"');
        expect(html).toContain('>Existiert</a>');
    });

    test('missing link gets wiki-link-missing class, no path', () => {
        const html = md('Siehe [[Fehlt]].');
        expect(html).toContain('wiki-link-missing');
        expect(html).not.toContain('data-wiki-path');
    });

    test('alias is the label, heading lands in data attribute', () => {
        const html = md('[[Existiert#Teil|Klick mich]]');
        expect(html).toContain('>Klick mich</a>');
        expect(html).toContain('data-wiki-heading="Teil"');
        expect(html).toContain('data-wiki-target="Existiert"');
    });

    test('label is HTML-escaped', () => {
        const html = md('[[Fehlt|<b>x</b>]]');
        expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    });

    test('wiki links inside inline code stay literal', () => {
        const html = md('Code: `[[Existiert]]`');
        expect(html).toContain('<code>[[Existiert]]</code>');
    });

    test('normal markdown links are untouched', () => {
        const html = md('[normal](https://x.de)');
        expect(html).toContain('href="https://x.de"');
    });
});

describe('extractWikiTargets', () => {
    test('collects targets, skips code fences', () => {
        const md = '[[Alpha]] und [[Beta#H|A]]\n\n```\n[[NichtZählen]]\n```\n\n[[Gamma]]';
        expect(extractWikiTargets(md)).toEqual(['Alpha', 'Beta', 'Gamma']);
    });
    test('empty input → empty array', () => {
        expect(extractWikiTargets('')).toEqual([]);
    });
});

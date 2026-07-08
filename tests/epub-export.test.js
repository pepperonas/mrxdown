// Tests für K5: Kapitel-Split (pure) + EPUB-Generierung mit struktureller
// Validierung — jede XML/XHTML-Datei wird mit @xmldom/xmldom geparst
// (wohlgeformt oder Test rot), mimetype-Spec-Regeln werden geprüft.
const fs = require('fs');
const os = require('os');
const path = require('path');
const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');
const { splitEpubChapters } = require('../editor-utils');
const { generateEpub } = require('../src/main/export/formats/epub');

function parseXmlStrict(source, name) {
    let error = null;
    const parser = new DOMParser({ onError: (level, msg) => { if (level === 'fatalError' || level === 'error') error = msg; } });
    const doc = parser.parseFromString(source, 'text/xml');
    if (error) throw new Error(`${name} ist kein wohlgeformtes XML: ${error}`);
    return doc;
}

describe('splitEpubChapters', () => {
    test('splits at H1 when there are 2+', () => {
        const ch = splitEpubChapters('# Eins\n\ntext\n\n# Zwei\n\nmehr');
        expect(ch.map(c => c.title)).toEqual(['Eins', 'Zwei']);
        expect(ch[0].markdown).toContain('# Eins');
    });

    test('falls back to H2 when fewer than 2 H1s', () => {
        const ch = splitEpubChapters('# Buch\n\n## Kapitel A\n\na\n\n## Kapitel B\n\nb');
        expect(ch.map(c => c.title)).toEqual(['Einleitung', 'Kapitel A', 'Kapitel B']);
        expect(ch[0].markdown).toContain('# Buch');
    });

    test('single chapter when no split level qualifies', () => {
        const ch = splitEpubChapters('# Nur eins\n\ntext');
        expect(ch).toHaveLength(1);
        expect(ch[0].title).toBeNull();
    });

    test('headings inside code fences never split', () => {
        const md = '# A\n\n```\n# kein Kapitel\n```\n\n# B';
        expect(splitEpubChapters(md).map(c => c.title)).toEqual(['A', 'B']);
    });

    test('content before first heading becomes Einleitung', () => {
        const ch = splitEpubChapters('Vorwort-Text.\n\n# Eins\n\n# Zwei');
        expect(ch[0].title).toBe('Einleitung');
        expect(ch[0].markdown).toBe('Vorwort-Text.');
    });
});

describe('generateEpub', () => {
    const MD = '---\ntitle: Mein Buch\nauthor: Martin\n---\n\n# Kapitel Eins\n\nText mit **fett**.\n\n- [ ] Aufgabe\n\n# Kapitel Zwei\n\n| A | B |\n|---|---|\n| 1 | 2 |\n';

    let zip;
    let rawBuf;
    beforeAll(async () => {
        rawBuf = await generateEpub({ rawMarkdown: MD });
        zip = await JSZip.loadAsync(rawBuf);
    }, 20000);

    test('mimetype is the first entry, stored uncompressed, correct content', async () => {
        // Spec-Prüfung an den rohen Zip-Bytes: erster Local-File-Header muss
        // 'mimetype' heißen (Offset 30) und Methode 0 = STORE haben (Offset 8).
        expect(rawBuf.readUInt32LE(0)).toBe(0x04034b50); // Local-File-Header-Magic
        expect(rawBuf.readUInt16LE(8)).toBe(0); // compression method: stored
        expect(rawBuf.toString('ascii', 30, 38)).toBe('mimetype');
        expect(await zip.file('mimetype').async('string')).toBe('application/epub+zip');
    });

    test('container.xml points to the OPF', async () => {
        const xml = await zip.file('META-INF/container.xml').async('string');
        parseXmlStrict(xml, 'container.xml');
        expect(xml).toContain('OEBPS/content.opf');
    });

    test('OPF is well-formed with metadata, manifest, spine', async () => {
        const opf = await zip.file('OEBPS/content.opf').async('string');
        parseXmlStrict(opf, 'content.opf');
        expect(opf).toContain('<dc:title>Mein Buch</dc:title>');
        expect(opf).toContain('<dc:creator>Martin</dc:creator>');
        expect(opf).toContain('properties="nav"');
        expect(opf).toContain('<itemref idref="ch1"/>');
        expect(opf).toContain('<itemref idref="ch2"/>');
    });

    test('chapters are well-formed XHTML (incl. task checkbox + table)', async () => {
        for (const name of ['OEBPS/chapter1.xhtml', 'OEBPS/chapter2.xhtml', 'OEBPS/nav.xhtml']) {
            const xhtml = await zip.file(name).async('string');
            parseXmlStrict(xhtml, name);
        }
        const ch1 = await zip.file('OEBPS/chapter1.xhtml').async('string');
        expect(ch1).toContain('<strong>fett</strong>');
        expect(ch1).toMatch(/<input[^>]*\/>/); // Task-Checkbox selbst geschlossen
    });

    test('nav lists both chapters', async () => {
        const nav = await zip.file('OEBPS/nav.xhtml').async('string');
        expect(nav).toContain('Kapitel Eins');
        expect(nav).toContain('Kapitel Zwei');
    });

    test('local images land as manifest files, cover from frontmatter', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrxdown-epub-'));
        // 1x1-PNG
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
        fs.writeFileSync(path.join(dir, 'bild.png'), png);
        fs.writeFileSync(path.join(dir, 'cover.png'), png);
        const md = '---\ntitle: T\ncover: cover.png\n---\n\n# Eins\n\n![alt](bild.png)\n\n# Zwei\n\nx';
        try {
            const buf = await generateEpub({ rawMarkdown: md, filePath: path.join(dir, 'buch.md') });
            const z = await JSZip.loadAsync(buf);
            const ch1 = await z.file('OEBPS/chapter1.xhtml').async('string');
            expect(ch1).toContain('src="images/img1.png"');
            expect(ch1).not.toContain('data:image');
            expect(z.file('OEBPS/images/img1.png')).toBeTruthy();
            const opf = await z.file('OEBPS/content.opf').async('string');
            expect(opf).toContain('properties="cover-image"');
            expect(z.file('OEBPS/cover.xhtml')).toBeTruthy();
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }, 20000);
});

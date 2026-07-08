// Tests für K3: Pandoc-Detection + Konvertierung. Die Konvertierungs-Tests
// laufen nur, wenn Pandoc installiert ist (lokal + GitHub-Ubuntu-Runner haben
// es; wo nicht, wird sauber geskippt — genau das Fallback-Verhalten der App).
const { detectPandoc, PANDOC_FORMATS, convertWithPandoc, createPandocFormats } = require('../src/main/export/pandoc');

let pandoc = null;
beforeAll(async () => {
    pandoc = await detectPandoc();
    if (!pandoc) console.warn('Pandoc nicht installiert — Konvertierungs-Tests werden übersprungen.');
}, 15000);

const MD = '---\ntitle: Pandoc-Test\nauthor: Martin\n---\n\n# Überschrift\n\nText mit **fett**.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n';

describe('pandoc format definitions', () => {
    test('all formats are marked as requiring pandoc', () => {
        expect(PANDOC_FORMATS.length).toBe(4);
        for (const f of PANDOC_FORMATS) {
            expect(f.description).toContain('benötigt Pandoc');
            expect(f.label).toContain('Pandoc');
        }
    });

    test('createPandocFormats yields registry-compatible objects', () => {
        for (const f of createPandocFormats()) {
            expect(typeof f.id).toBe('string');
            expect(typeof f.toBuffer).toBe('function');
            expect(f.needs).toEqual(['rawMarkdown']);
            expect(Array.isArray(f.filters)).toBe(true);
        }
    });

    test('detectPandoc is cached (same promise result)', async () => {
        expect(await detectPandoc()).toBe(await detectPandoc());
    });
});

describe('convertWithPandoc (skipped ohne Pandoc)', () => {
    const maybe = (name, fn) => test(name, async () => {
        if (!pandoc) return; // Fallback-Verhalten: Feature existiert nicht
        await fn();
    }, 30000);

    maybe('latex: standalone with title + bold + table', async () => {
        const buf = await convertWithPandoc({ rawMarkdown: MD, to: 'latex', ext: 'tex' });
        const tex = buf.toString('utf-8');
        expect(tex).toContain('\\documentclass');
        expect(tex).toContain('Pandoc-Test');
        expect(tex).toContain('\\textbf{fett}');
        expect(tex).toMatch(/longtable|tabular/);
    });

    maybe('rst: heading + bold survive', async () => {
        const rst = (await convertWithPandoc({ rawMarkdown: MD, to: 'rst', ext: 'rst' })).toString('utf-8');
        expect(rst).toContain('Überschrift');
        expect(rst).toContain('**fett**');
    });

    maybe('odt: valid zip container with mimetype', async () => {
        const buf = await convertWithPandoc({ rawMarkdown: MD, to: 'odt', ext: 'odt' });
        expect(buf.readUInt32LE(0)).toBe(0x04034b50); // Zip-Magic
        expect(buf.toString('ascii', 30, 38)).toBe('mimetype');
        const JSZip = require('jszip');
        const zip = await JSZip.loadAsync(buf);
        expect(await zip.file('mimetype').async('string')).toContain('opendocument.text');
    });

    maybe('beamer: frame markup present', async () => {
        const tex = (await convertWithPandoc({ rawMarkdown: MD, to: 'beamer', ext: 'tex' })).toString('utf-8');
        expect(tex).toContain('\\documentclass');
        expect(tex).toContain('beamer');
    });
});

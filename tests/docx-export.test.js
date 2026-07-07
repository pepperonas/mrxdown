// Tests für src/main/export/formats/docx.js (K2) — läuft in purem Node:
// das Modul zieht Electron nur lazy (nativeImage beim Bild-Downscale), der
// Testpfad mit data:-URLs berührt das nie. mammoth dient als Roundtrip-Prüfer.
const { generateDocx, prepareHtmlForDocx } = require('../src/main/export/formats/docx');
const mammoth = require('mammoth');
const JSZip = require('jszip');

const SAMPLE_HTML =
    '<h1 id="titel">Titel H1</h1>' +
    '<p>Absatz mit <strong>fett</strong> und <a href="https://celox.io">Link</a>.</p>' +
    '<h2 id="tabelle">Tabelle</h2>' +
    '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>a1</td><td>b1</td></tr></tbody></table>' +
    '<ul><li>eins</li><li>zwei</li></ul>' +
    '<pre><code>const x = 42;</code></pre>';

const FRONTMATTER_MD = '---\ntitle: Mein Word-Titel\nauthor: Martin\nkeywords: alpha, beta\n---\n# Titel';

describe('prepareHtmlForDocx', () => {
    test('strips the preview frontmatter box', () => {
        const html = '<div class="frontmatter-box"><pre>title: x</pre></div><h1>Rest</h1>';
        expect(prepareHtmlForDocx(html)).toBe('<h1>Rest</h1>');
    });

    test('removes duplicated KaTeX MathML but keeps the rendered HTML part', () => {
        const html = '<span class="katex"><span class="katex-mathml"><math><mi>x</mi></math></span>' +
            '<span class="katex-html">x</span></span>';
        const out = prepareHtmlForDocx(html);
        expect(out).not.toContain('katex-mathml');
        expect(out).toContain('katex-html');
    });

    test('replaces mermaid blocks with a placeholder', () => {
        const out = prepareHtmlForDocx('<div class="mermaid"><svg><g/></svg></div>');
        expect(out).not.toContain('<svg');
        expect(out).toContain('Mermaid-Diagramm');
    });
});

describe('generateDocx', () => {
    test('produces a valid docx that mammoth can read back (headings, table, bold)', async () => {
        const buffer = await generateDocx({ previewHtml: SAMPLE_HTML, rawMarkdown: FRONTMATTER_MD });
        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect(buffer.length).toBeGreaterThan(1000);

        const back = await mammoth.convertToHtml({ buffer });
        expect(back.value).toContain('<h1>Titel H1</h1>');
        expect(back.value).toContain('<strong>fett</strong>');
        expect(back.value).toContain('<td><p>a1</p></td>');
        expect(back.value).toContain('<li>eins</li>');
        expect(back.value).toContain('const x = 42;');
    }, 20000);

    test('frontmatter maps to Word document properties', async () => {
        const buffer = await generateDocx({ previewHtml: SAMPLE_HTML, rawMarkdown: FRONTMATTER_MD });
        const zip = await JSZip.loadAsync(buffer);
        const core = await zip.file('docProps/core.xml').async('string');
        expect(core).toContain('<dc:title>Mein Word-Titel</dc:title>');
        expect(core).toContain('Martin');
        expect(core).toContain('alpha');
    }, 20000);

    test('code blocks get a monospace font', async () => {
        const buffer = await generateDocx({ previewHtml: SAMPLE_HTML, rawMarkdown: '' });
        const zip = await JSZip.loadAsync(buffer);
        const doc = await zip.file('word/document.xml').async('string');
        expect(doc).toMatch(/w:rFonts[^>]*Courier/);
    }, 20000);

    test('options.toc injects a real Word TOC field + updateFields', async () => {
        const buffer = await generateDocx({
            previewHtml: SAMPLE_HTML, rawMarkdown: '', options: { toc: true }
        });
        const zip = await JSZip.loadAsync(buffer);
        const doc = await zip.file('word/document.xml').async('string');
        expect(doc).toContain('TOC \\o "1-3"');
        expect(doc).toContain('Inhaltsverzeichnis');
        const settings = await zip.file('word/settings.xml').async('string');
        expect(settings).toContain('<w:updateFields w:val="true"/>');
        // Roundtrip bleibt lesbar
        const back = await mammoth.convertToHtml({ buffer });
        expect(back.value).toContain('Titel H1');
    }, 20000);

    test('without options no TOC field is injected', async () => {
        const buffer = await generateDocx({ previewHtml: SAMPLE_HTML, rawMarkdown: '' });
        const zip = await JSZip.loadAsync(buffer);
        const doc = await zip.file('word/document.xml').async('string');
        expect(doc).not.toContain('TOC \\o');
    }, 20000);
});

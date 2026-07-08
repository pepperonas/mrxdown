#!/usr/bin/env node
// K7: CLI-Konverter-Roundtrip — `electron . --to html|docx <file…>` muss valide
// Ausgaben erzeugen (HTML: Inhalt + Standalone-Gerüst; DOCX: mammoth liest
// Headings/fett zurück), Mehrfach-Argumente (Shell-Glob) funktionieren, und
// unbekannte Formate enden mit Exit-Code != 0. PDF deckt cli-pdf.js ab.

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const electronBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrxdown-e2e-conv-'));
let failures = 0;

function check(name, cond, detail) {
    if (cond) {
        console.log(`✓ ${name}`);
    } else {
        failures++;
        console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`);
    }
}

function run(cliArgs, timeout = 60000) {
    return spawnSync(electronBin, ['.', ...cliArgs], { cwd: root, timeout, encoding: 'utf-8' });
}

async function main() {
    const md = '---\ntitle: Konverter-Test\nauthor: Martin\n---\n\n# Überschrift\n\nText mit **fett**.\n\n> [!NOTE]\n> Ein Callout.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n';
    fs.writeFileSync(path.join(dir, 'doc.md'), md);
    fs.writeFileSync(path.join(dir, 'zwei.md'), '# Zwei\n\nInhalt zwei.\n');

    // --- --to html ---
    const html = run(['--to', 'html', path.join(dir, 'doc.md')]);
    check('--to html Exit-Code 0', html.status === 0, 'status=' + html.status + ' ' + (html.stderr || ''));
    const htmlOut = path.join(dir, 'doc.html');
    check('HTML-Datei erzeugt', fs.existsSync(htmlOut));
    if (fs.existsSync(htmlOut)) {
        const content = fs.readFileSync(htmlOut, 'utf-8');
        check('HTML: Standalone-Gerüst + Titel', content.startsWith('<!DOCTYPE html>') && content.includes('<title>Konverter-Test</title>'));
        check('HTML: Inhalt + Heading-ID', content.includes('id="überschrift"') && content.includes('<strong>fett</strong>'));
        check('HTML: Callout gerendert', content.includes('callout-note'));
        check('HTML: GFM-Tabelle', content.includes('<table>'));
    }

    // --- --to docx (mammoth-Roundtrip) ---
    const docx = run(['--to', 'docx', path.join(dir, 'doc.md')]);
    check('--to docx Exit-Code 0', docx.status === 0, 'status=' + docx.status + ' ' + (docx.stderr || ''));
    const docxOut = path.join(dir, 'doc.docx');
    check('DOCX-Datei erzeugt', fs.existsSync(docxOut));
    if (fs.existsSync(docxOut)) {
        const mammoth = require('mammoth');
        const back = await mammoth.convertToHtml({ path: docxOut });
        check('DOCX: Heading-Style zurücklesbar', back.value.includes('<h1>'), back.value.slice(0, 200));
        check('DOCX: fett + Tabelle', back.value.includes('<strong>fett</strong>') && back.value.includes('<table>'));
        const JSZip = require('jszip');
        const zip = await JSZip.loadAsync(fs.readFileSync(docxOut));
        const core = await zip.file('docProps/core.xml').async('string');
        check('DOCX: Frontmatter → docProps', core.includes('Konverter-Test') && core.includes('Martin'));
    }

    // --- --to slides (self-contained reveal.js) ---
    fs.writeFileSync(path.join(dir, 'deck.md'), '---\ntitle: Deck\n---\n\n# Folie 1\n<!-- notes: Sprechernotiz -->\n\n---\n\n# Folie 2\n');
    const slides = run(['--to', 'slides', path.join(dir, 'deck.md')]);
    check('--to slides Exit-Code 0', slides.status === 0, 'status=' + slides.status + ' ' + (slides.stderr || ''));
    const slidesOut = path.join(dir, 'deck.slides.html');
    check('Slides-Datei erzeugt (.slides.html)', fs.existsSync(slidesOut));
    if (fs.existsSync(slidesOut)) {
        const deck = fs.readFileSync(slidesOut, 'utf-8');
        check('Slides: 2 Sections + Reveal + Notes',
            (deck.match(/<section>/g) || []).length === 2 && deck.includes('Reveal.initialize') && deck.includes('Sprechernotiz'));
        check('Slides: self-contained (keine externen Ressourcen)', !/(src|href)="https?:\/\//.test(deck));
    }

    // --- Mehrere Datei-Argumente (Shell-Glob-Muster) ---
    fs.rmSync(htmlOut, { force: true });
    const multi = run(['--to', 'html', path.join(dir, 'doc.md'), path.join(dir, 'zwei.md')]);
    check('Mehrfach-Argumente Exit-Code 0', multi.status === 0, 'status=' + multi.status);
    check('Mehrfach: beide HTML-Dateien', fs.existsSync(htmlOut) && fs.existsSync(path.join(dir, 'zwei.html')));

    // --- Fehlerfälle ---
    const bad = run(['--to', 'yaml', path.join(dir, 'doc.md')]);
    check('Unbekanntes Format → Exit != 0', bad.status !== 0, 'status=' + bad.status);
    const missing = run(['--to', 'html', path.join(dir, 'gibtsnicht.md')]);
    check('Fehlende Datei → Exit != 0', missing.status !== 0, 'status=' + missing.status);
}

main()
    .catch(err => { failures++; console.log('✗ FATAL: ' + (err && err.stack || err)); })
    .finally(() => {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
        console.log(failures === 0 ? 'CLI-Konverter: alles grün' : `CLI-Konverter: ${failures} Fehler`);
        process.exit(failures === 0 ? 0 : 1);
    });

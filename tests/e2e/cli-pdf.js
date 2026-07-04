#!/usr/bin/env node
// CLI-PDF-Roundtrip: `electron . <file> --pdf` (Einzeldatei) und
// `electron . <dir>` (Batch) müssen valide PDFs erzeugen.
// Regression für: Batch-Abbruch nach erster Datei (v0.3.1), Headless-Modus.

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const electronBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrxdown-e2e-cli-'));
let failures = 0;

function check(name, cond, detail) {
    if (cond) {
        console.log(`✓ ${name}`);
    } else {
        failures++;
        console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`);
    }
}

function isPdf(p) {
    try {
        const fd = fs.openSync(p, 'r');
        const buf = Buffer.alloc(5);
        fs.readSync(fd, buf, 0, 5, 0);
        fs.closeSync(fd);
        return buf.toString('latin1') === '%PDF-';
    } catch (e) { return false; }
}

async function main() {
    const md = '---\ntitle: E2E\ntemplate: minimal\n---\n\n# Test\n\nText mit **fett**, $x^2$ und Tabelle:\n\n| A | B |\n|---|---|\n| 1 | 2 |\n';
    fs.writeFileSync(path.join(dir, 'eins.md'), md);
    fs.writeFileSync(path.join(dir, 'ZWEI.MD'), md); // Regression: Groß-Endung im Batch

    // Einzeldatei
    const single = spawnSync(electronBin, ['.', path.join(dir, 'eins.md'), '--pdf'],
        { cwd: root, timeout: 60000, encoding: 'utf-8' });
    check('Einzeldatei-CLI Exit-Code 0', single.status === 0, 'status=' + single.status);
    check('Einzeldatei-PDF erzeugt und valide', isPdf(path.join(dir, 'eins.pdf')));

    // PDF-Qualität (Audit 2026-07-04): Metadaten aus Frontmatter, Bookmarks, Seitenzahlen-Fähigkeit
    await (async () => {
        const { PDFDocument, PDFName } = require('@cantoo/pdf-lib');
        const raw = fs.readFileSync(path.join(dir, 'eins.pdf'));
        const doc = await PDFDocument.load(raw, { updateMetadata: false });
        check('PDF-Metadaten: Title aus Frontmatter', doc.getTitle() === 'E2E', 'title=' + doc.getTitle());
        check('PDF-Metadaten: Creator gesetzt', (doc.getCreator() || '').startsWith('MrxDown'));
        check('PDF-Outline (Bookmarks) vorhanden', !!doc.catalog.get(PDFName.of('Outlines')));
        check('Tagged PDF (StructTreeRoot)', !!doc.catalog.get(PDFName.of('StructTreeRoot')));
    })();

    fs.rmSync(path.join(dir, 'eins.pdf'), { force: true });

    // Batch (Verzeichnis) — beide Dateien, auch .MD
    const batch = spawnSync(electronBin, ['.', dir],
        { cwd: root, timeout: 90000, encoding: 'utf-8' });
    check('Batch-CLI Exit-Code 0', batch.status === 0, 'status=' + batch.status);
    check('Batch: eins.pdf valide', isPdf(path.join(dir, 'eins.pdf')));
    check('Batch: ZWEI.pdf valide (.MD-Endung, L5)', isPdf(path.join(dir, 'ZWEI.pdf')));
}

main()
    .catch(err => { failures++; console.log('✗ FATAL: ' + (err && err.stack || err)); })
    .finally(() => {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
        console.log(failures === 0 ? 'CLI-PDF: alles grün' : `CLI-PDF: ${failures} Fehler`);
        process.exit(failures === 0 ? 0 : 1);
    });

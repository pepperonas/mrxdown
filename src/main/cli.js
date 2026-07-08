// MrxDown Main — CLI/Headless-Konverter (K7)
// `mrxdown --to pdf|html|docx <datei|verzeichnis …>` bzw. legacy `--pdf`.
// Konsolidiert die früheren runCLI/runCLIBatch aus main.js: EIN Datei-Loop
// für beliebig viele Datei-/Verzeichnis-Argumente (Shell-Globs kommen als
// mehrere Argumente an), Exit-Code 0 nur wenn alles gelang.
const path = require('path');
const fs = require('fs').promises;
const { app } = require('electron');

const { extractFrontmatter } = require('./export/frontmatter');
const { buildPdfHtml, renderMathForCLI, renderMermaidForCLI } = require('./export/pdf-html');
const { renderHtmlToPdf } = require('./export/pdf-render');
const { convertImagesToBase64 } = require('./export/images');

const SUPPORTED_FORMATS = ['pdf', 'html', 'docx', 'slides', 'epub'];
// K3: optionale Pandoc-Formate (nur nutzbar, wenn Pandoc installiert ist)
const { PANDOC_FORMATS, convertWithPandoc, detectPandoc } = require('./export/pandoc');

// Geteilte marked-Instanz (Callouts + Heading-IDs) — src/main/export/markdown.js
const { getSharedMarked, resetHeadingIds } = require('./export/markdown');

// Eine Markdown-Datei in das Zielformat konvertieren; gibt den Ausgabepfad zurück.
async function convertMarkdownFile(filePath, format) {
    const markdownContent = await fs.readFile(filePath, 'utf-8');
    const { frontmatter, body } = extractFrontmatter(markdownContent);
    const marked = getSharedMarked();
    resetHeadingIds(); // Duplikat-Zähler pro Dokument
    const baseDir = path.dirname(filePath);
    const outBase = filePath.replace(/\.(md|markdown)$/i, '');

    if (format === 'pdf') {
        // D2: KaTeX serverseitig; D1-CLI: Mermaid-Fences rendert das Druckfenster
        // selbst (buildPdfHtml injiziert vendor-Mermaid, PDF_SMART_WAIT_JS wartet).
        const withMath = renderMermaidForCLI(renderMathForCLI(body));
        const html = await convertImagesToBase64(marked.parse(withMath), baseDir);
        const pdfData = await renderHtmlToPdf(
            buildPdfHtml({ bodyContent: html, frontmatter }),
            {},
            { frontmatter, filePath }
        );
        const outputPath = outBase + '.pdf';
        await fs.writeFile(outputPath, pdfData);
        return outputPath;
    }

    if (format === 'html') {
        // Portables Standalone-HTML: Bilder als base64. Math bleibt bewusst
        // TeX-Quelltext (KaTeX-HTML wäre ohne mitgeliefertes CSS/Fonts kaputt),
        // Mermaid bleibt Code-Fence (kein JS in der portablen Datei).
        const { buildStandaloneHtml } = require('./export/formats/html');
        const html = await convertImagesToBase64(marked.parse(body), baseDir);
        const title = frontmatter.title || path.basename(outBase);
        const outputPath = outBase + '.html';
        await fs.writeFile(outputPath, buildStandaloneHtml(html, title), 'utf-8');
        return outputPath;
    }

    if (format === 'docx') {
        const { generateDocx } = require('./export/formats/docx');
        // Mermaid → <div class="mermaid"> → prepareHtmlForDocx ersetzt es durch
        // einen Platzhalter (Word kann kein SVG); KaTeX serverseitig.
        const withMath = renderMermaidForCLI(renderMathForCLI(body));
        const html = marked.parse(withMath);
        const buffer = await generateDocx({ previewHtml: html, rawMarkdown: markdownContent, filePath });
        const outputPath = outBase + '.docx';
        await fs.writeFile(outputPath, buffer);
        return outputPath;
    }

    if (format === 'epub') {
        // K5: EPUB 3 nativ (jszip) — Kapitel an H1/H2, Cover aus Frontmatter
        const { generateEpub } = require('./export/formats/epub');
        const buffer = await generateEpub({ rawMarkdown: markdownContent, filePath });
        const outputPath = outBase + '.epub';
        await fs.writeFile(outputPath, buffer);
        return outputPath;
    }

    if (format === 'slides') {
        // K4: self-contained reveal.js-Präsentation; --- (mit Leerzeile davor)
        // trennt Folien, <!-- notes: … --> wird zu Speaker-Notes.
        const { generateSlides } = require('./export/formats/slides');
        const buffer = await generateSlides({ rawMarkdown: markdownContent, filePath });
        const outputPath = outBase + '.slides.html';
        await fs.writeFile(outputPath, buffer);
        return outputPath;
    }

    const pandocDef = PANDOC_FORMATS.find(f => f.id === format);
    if (pandocDef) {
        const buffer = await convertWithPandoc({
            rawMarkdown: markdownContent, filePath, to: pandocDef.to, ext: pandocDef.ext
        });
        const outputPath = outBase + '.' + pandocDef.ext;
        await fs.writeFile(outputPath, buffer);
        return outputPath;
    }

    throw new Error(`Format nicht implementiert: ${format}`);
}

// Datei-/Verzeichnis-Argumente zu einer flachen Liste von Markdown-Dateien
// auflösen. Verzeichnisse expandieren (nicht rekursiv, wie der alte Batch);
// Nicht-Markdown-Dateien zählen als Fehler.
async function collectInputFiles(inputPaths) {
    const files = [];
    let errors = 0;
    for (const p of inputPaths) {
        const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
        let stat;
        try {
            stat = await fs.stat(abs);
        } catch {
            console.error(`Fehler: Nicht gefunden: ${abs}`);
            errors++;
            continue;
        }
        if (stat.isDirectory()) {
            const entries = await fs.readdir(abs);
            const mdFiles = entries.filter(f => /\.(md|markdown)$/i.test(f)).sort();
            if (mdFiles.length === 0) {
                console.log(`Keine Markdown-Dateien in ${abs} gefunden.`);
            }
            for (const f of mdFiles) files.push(path.join(abs, f));
        } else if (/\.(md|markdown)$/i.test(abs)) {
            files.push(abs);
        } else {
            console.error(`Fehler: Keine Markdown-Datei: ${abs}`);
            errors++;
        }
    }
    return { files, errors };
}

// Einstieg aus main.js. Beendet den Prozess IMMER selbst via app.exit()
// (window-all-closed ist im Headless-Modus abgeschaltet).
async function runCli({ paths, format }) {
    try {
        const isPandocFormat = PANDOC_FORMATS.some(f => f.id === format);
        if (!SUPPORTED_FORMATS.includes(format) && !isPandocFormat) {
            const all = [...SUPPORTED_FORMATS, ...PANDOC_FORMATS.map(f => f.id + '*')];
            console.error(`Fehler: Unbekanntes Zielformat "${format}". Unterstützt: ${all.join(', ')} (* benötigt Pandoc)`);
            app.exit(1);
            return;
        }
        if (isPandocFormat && !(await detectPandoc())) {
            console.error(`Fehler: Das Format "${format}" benötigt Pandoc. Installation: https://pandoc.org/installing.html (macOS: brew install pandoc)`);
            app.exit(1);
            return;
        }
        const { files, errors: collectErrors } = await collectInputFiles(paths);
        if (files.length === 0) {
            app.exit(collectErrors > 0 ? 1 : 0);
            return;
        }
        if (files.length > 1) {
            console.log(`Gefunden: ${files.length} Markdown-Datei(en)`);
        }

        let successCount = 0;
        let errorCount = collectErrors;
        for (const file of files) {
            try {
                console.log(`Konvertiere: ${file}`);
                const out = await convertMarkdownFile(file, format);
                console.log(`  ✓ ${path.basename(out)}`);
                successCount++;
            } catch (error) {
                console.error(`  ✗ ${path.basename(file)}: ${error.message}`);
                errorCount++;
            }
        }

        if (files.length > 1 || errorCount > 0) {
            console.log(`\nFertig: ${successCount} erfolgreich, ${errorCount} fehlgeschlagen`);
        }
        app.exit(errorCount > 0 ? 1 : 0);
    } catch (error) {
        console.error(`Fehler: ${error.message}`);
        app.exit(1);
    }
}

module.exports = { runCli, SUPPORTED_FORMATS, convertMarkdownFile };

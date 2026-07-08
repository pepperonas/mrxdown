// MrxDown Main — K3: Pandoc als OPTIONALER Power-Backend.
// Wird Pandoc gefunden, schalten sich zusätzliche Zielformate frei (LaTeX,
// Beamer, ODT, reStructuredText); ohne Pandoc existieren sie schlicht nicht —
// nie eine harte Dependency, alle Kern-Formate bleiben nativ.
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');
const { execFile } = require('child_process');

// GUI-Apps bekommen auf macOS ein minimales PATH (kein /opt/homebrew/bin) —
// deshalb feste Kandidaten zusätzlich zum PATH-Lookup.
const PANDOC_CANDIDATES = process.platform === 'win32'
    ? ['pandoc.exe',
       path.join(process.env.LOCALAPPDATA || '', 'Pandoc', 'pandoc.exe'),
       path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Pandoc', 'pandoc.exe')]
    : ['pandoc', '/opt/homebrew/bin/pandoc', '/usr/local/bin/pandoc', '/usr/bin/pandoc'];

let _pandocPromise = null;

function _tryPandoc(bin) {
    return new Promise((resolve) => {
        execFile(bin, ['--version'], { timeout: 5000 }, (err, stdout) => {
            if (err) { resolve(null); return; }
            const m = /^pandoc(?:\.exe)?\s+([\d.]+)/.exec(String(stdout));
            resolve({ path: bin, version: m ? m[1] : 'unbekannt' });
        });
    });
}

// Einmalige Detection (gecacht). null = kein Pandoc verfügbar.
function detectPandoc() {
    if (_pandocPromise) return _pandocPromise;
    _pandocPromise = (async () => {
        for (const candidate of PANDOC_CANDIDATES) {
            const found = await _tryPandoc(candidate);
            if (found) return found;
        }
        return null;
    })();
    return _pandocPromise;
}

// Zielformate, die Pandoc freischaltet. gfm als Quellformat (Tabellen,
// Task-Listen, Strikethrough) + YAML-Metadaten-Block (Frontmatter → Titel etc.).
const PANDOC_FORMATS = [
    { id: 'latex', label: 'LaTeX (Pandoc)', ext: 'tex', mime: 'application/x-tex', to: 'latex', description: 'LaTeX-Dokument — benötigt Pandoc' },
    { id: 'beamer', label: 'LaTeX Beamer (Pandoc)', ext: 'tex', mime: 'application/x-tex', to: 'beamer', description: 'Beamer-Folien (LaTeX) — benötigt Pandoc' },
    { id: 'odt', label: 'OpenDocument (Pandoc)', ext: 'odt', mime: 'application/vnd.oasis.opendocument.text', to: 'odt', description: 'LibreOffice/OpenOffice-Dokument — benötigt Pandoc' },
    { id: 'rst', label: 'reStructuredText (Pandoc)', ext: 'rst', mime: 'text/x-rst', to: 'rst', description: 'reStructuredText — benötigt Pandoc' }
];

// Konvertierung über eine Temp-Ausgabedatei (binärsicher für ODT), execFile
// ohne Shell, Input via stdin — kein Nutzertext landet je in einer Kommandozeile.
async function convertWithPandoc({ rawMarkdown, filePath = null, to, ext }) {
    const pandoc = await detectPandoc();
    if (!pandoc) {
        throw new Error('Pandoc nicht gefunden. Installation: https://pandoc.org/installing.html (macOS: brew install pandoc)');
    }
    const outFile = path.join(os.tmpdir(), `mrxdown-pandoc-${process.pid}-${Date.now()}.${ext}`);
    const args = [
        '--from', 'gfm+yaml_metadata_block',
        '--to', to,
        '--standalone',
        '--output', outFile
    ];
    if (filePath) {
        // Bilder/Ressourcen relativ zur Quelldatei auflösen (relevant für ODT)
        args.push('--resource-path', path.dirname(filePath));
    }
    try {
        await new Promise((resolve, reject) => {
            const child = execFile(pandoc.path, args, { timeout: 60000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
                if (err) reject(new Error(`Pandoc fehlgeschlagen: ${String(stderr || err.message).slice(0, 400)}`));
                else resolve();
            });
            child.stdin.on('error', () => { /* EPIPE bei frühem Pandoc-Exit — Fehler kommt aus dem Callback */ });
            child.stdin.end(rawMarkdown || '', 'utf-8');
        });
        return await fs.readFile(outFile);
    } finally {
        fsSync.rmSync(outFile, { force: true });
    }
}

// Registry-Format-Objekte für alle Pandoc-Ziele
function createPandocFormats() {
    return PANDOC_FORMATS.map(def => ({
        id: def.id,
        label: def.label,
        description: def.description,
        ext: def.ext,
        mime: def.mime,
        filters: [{ name: def.label, extensions: [def.ext] }],
        needs: ['rawMarkdown'],
        optionsPanel: null,
        async toBuffer(doc) {
            return convertWithPandoc({ rawMarkdown: doc.rawMarkdown, filePath: doc.filePath, to: def.to, ext: def.ext });
        }
    }));
}

// Einmalig: detecten und (falls vorhanden) in die Registry hängen.
let _registered = false;
async function ensurePandocFormatsRegistered(registry) {
    if (_registered) return;
    const pandoc = await detectPandoc();
    if (pandoc) {
        for (const format of createPandocFormats()) {
            registry.registerFormat(format);
        }
        console.log(`[pandoc] gefunden (${pandoc.version}, ${pandoc.path}) — LaTeX/Beamer/ODT/RST freigeschaltet`);
    }
    _registered = true;
}

module.exports = { detectPandoc, PANDOC_FORMATS, convertWithPandoc, createPandocFormats, ensurePandocFormatsRegistered };

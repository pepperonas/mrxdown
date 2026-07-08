#!/usr/bin/env node
// Q2 (Supply-Chain): kopiert alle nicht-esbuild-gebundelten Vendor-Dateien
// reproduzierbar aus node_modules nach vendor/. Damit stammt JEDE vendor-Datei
// nachvollziehbar aus der package-lock-gepinnten Dependency:
//   npm run build:vendor   (ruft build:editor + build:hljs + build:turndown + dieses Skript)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const nm = (...p) => path.join(root, 'node_modules', ...p);
const vendor = (...p) => path.join(root, 'vendor', ...p);

const FILES = [
    [nm('marked', 'marked.min.js'), vendor('marked.min.js')],
    [nm('dompurify', 'dist', 'purify.min.js'), vendor('purify.min.js')],
    [nm('morphdom', 'dist', 'morphdom-umd.min.js'), vendor('morphdom.min.js')],
    [nm('mermaid', 'dist', 'mermaid.min.js'), vendor('mermaid.min.js')],
    [nm('katex', 'dist', 'katex.min.js'), vendor('katex', 'katex.min.js')],
    [nm('katex', 'dist', 'katex.min.css'), vendor('katex', 'katex.min.css')],
    [nm('katex', 'dist', 'contrib', 'auto-render.min.js'), vendor('katex', 'auto-render.min.js')]
];

let copied = 0;
for (const [src, dest] of FILES) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`✓ ${path.relative(root, dest)}  (${fs.statSync(dest).size} B)`);
    copied++;
}

// KaTeX-Fonts (Verzeichnis)
const fontSrc = nm('katex', 'dist', 'fonts');
const fontDest = vendor('katex', 'fonts');
fs.mkdirSync(fontDest, { recursive: true });
for (const f of fs.readdirSync(fontSrc)) {
    fs.copyFileSync(path.join(fontSrc, f), path.join(fontDest, f));
    copied++;
}
console.log(`✓ vendor/katex/fonts (${fs.readdirSync(fontDest).length} Dateien)`);
console.log(`Fertig: ${copied} Dateien kopiert.`);

// Standalone-Electron-Renderer: SVG → 1024×1024-PNG mit Alphakanal.
// Aufruf: electron render-icon.js <icon.svg> <out.png>
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const svgPath = path.resolve(process.argv[2]);
const outPath = path.resolve(process.argv[3]);

app.whenReady().then(async () => {
    const win = new BrowserWindow({
        width: 1024, height: 1024,
        show: false, frame: false, transparent: true,
        webPreferences: { offscreen: true }
    });
    const svg = fs.readFileSync(svgPath, 'utf-8');
    const html = `<!DOCTYPE html><html><head><style>
        html,body{margin:0;padding:0;background:transparent;overflow:hidden}
        svg{display:block}
    </style></head><body>${svg}</body></html>`;
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await new Promise(r => setTimeout(r, 400));
    // Exakte Größe erzwingen (Retina-Scaling umgehen)
    win.webContents.setZoomFactor(1);
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
    const resized = img.getSize().width !== 1024 ? img.resize({ width: 1024, height: 1024 }) : img;
    fs.writeFileSync(outPath, resized.toPNG());
    console.log('written', outPath, JSON.stringify(img.getSize()));
    app.exit(0);
});

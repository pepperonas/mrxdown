const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const fsWatchers = new Map();
const packageJson = require('./package.json');

// --- Settings & Recent Files Persistence ---
const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');
const recentFilesPath = path.join(userDataPath, 'recent-files.json');

function loadSettingsFromDisk() {
    try {
        if (fsSync.existsSync(settingsPath)) {
            const data = fsSync.readFileSync(settingsPath, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
    return {};
}

async function saveSettingsToDisk() {
    try {
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

function loadRecentFilesFromDisk() {
    try {
        if (fsSync.existsSync(recentFilesPath)) {
            const data = fsSync.readFileSync(recentFilesPath, 'utf-8');
            const files = JSON.parse(data);
            // Filter out files that no longer exist
            return files.filter(f => fsSync.existsSync(f));
        }
    } catch (error) {
        console.error('Error loading recent files:', error);
    }
    return [];
}

async function saveRecentFilesToDisk() {
    try {
        await fs.writeFile(recentFilesPath, JSON.stringify(recentFiles, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error saving recent files:', error);
    }
}

// Shared PDF stylesheet used by single export, batch export, and CLI
function getPdfStylesheet() {
    return `
        @page {
            margin: 20mm 15mm;
            size: A4 portrait;
        }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
                         'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
                         'Noto Color Emoji', sans-serif;
            color: #1a1a1a !important;
            background: #fff !important;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.7;
            font-size: 11pt;
            orphans: 3;
            widows: 3;
            text-rendering: optimizeLegibility;
        }
        h1, h2, h3, h4, h5, h6 {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
                         'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
                         'Noto Color Emoji', sans-serif;
            color: #1a1a1a !important;
            font-weight: 600;
            margin-top: 2rem;
            margin-bottom: 1rem;
            page-break-after: avoid;
            page-break-inside: avoid;
            text-rendering: optimizeLegibility;
            -webkit-font-smoothing: subpixel-antialiased;
            font-feature-settings: "kern" 1;
            white-space: pre-wrap;
        }
        h1 { font-size: 2.25rem; border-bottom: 2px solid #333; padding-bottom: 0.5rem; margin-top: 0; page-break-before: auto; }
        h2 { font-size: 1.875rem; }
        h3 { font-size: 1.5rem; }
        h4 { font-size: 1.25rem; }
        h5 { font-size: 1.125rem; }
        h6 { font-size: 1rem; color: #666 !important; }
        p { color: #1a1a1a !important; margin: 0; text-align: justify; hyphens: auto; }
        p + p { margin-top: 1rem; }
        h1 + p, h2 + p, h3 + p, h4 + p, h5 + p, h6 + p { margin-top: 0; }
        .line-break { display: block; height: 0; }
        .line-break + .line-break { height: 1em; }
        br { display: block; height: 0; }
        br + br { height: 1em; }
        p:empty { margin: 1em 0; }
        strong, b { color: #1a1a1a !important; font-weight: 700; }
        em, i { color: #1a1a1a !important; font-style: italic; }
        code {
            background: #f5f5f5 !important;
            color: #d14 !important;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Courier New', monospace;
            font-size: 0.9em;
            border: 1px solid #e0e0e0;
        }
        pre {
            background: #f8f8f8 !important;
            color: #1a1a1a !important;
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
            border: 1px solid #ddd;
            margin: 1em 0;
            page-break-inside: avoid;
            line-height: 1.5;
        }
        pre code { background: none !important; color: #1a1a1a !important; padding: 0; border: none; font-size: 0.85em; }
        blockquote {
            border-left: 4px solid #666;
            padding-left: 16px; padding-top: 8px; padding-bottom: 8px;
            color: #555 !important;
            margin: 1.2em 0;
            font-style: italic;
            background: #f9f9f9;
            page-break-inside: avoid;
        }
        ul, ol { color: #1a1a1a !important; margin-bottom: 1rem; padding-left: 1.5rem; }
        li { color: #1a1a1a !important; margin-bottom: 0.5rem; page-break-inside: avoid; }
        li > ul, li > ol { margin-top: 0.3em; margin-bottom: 0.3em; }
        li input[type="checkbox"] { margin-right: 0.5em; }
        a { color: #0066cc !important; text-decoration: underline; word-wrap: break-word; }
        a[href^="#"] { color: #0066cc !important; text-decoration: underline; cursor: pointer; }
        h1[id], h2[id], h3[id], h4[id], h5[id], h6[id] { scroll-margin-top: 2em; }
        table { border-collapse: collapse; width: 100%; margin: 1.2em 0; page-break-inside: auto; font-size: 0.9em; }
        tr { page-break-inside: avoid; page-break-after: auto; }
        thead { display: table-header-group; }
        th, td { border: 1px solid #ddd; padding: 10px 12px; text-align: left; color: #1a1a1a !important; }
        th { background: #f5f5f5 !important; color: #1a1a1a !important; font-weight: 600; }
        tr:nth-child(even) { background: #fafafa !important; }
        img { max-width: 100%; height: auto; margin: 1.5em 0; page-break-inside: avoid; }
        hr { border: none; border-top: 2px solid #ddd; margin: 2em 0; page-break-after: avoid; }
        @media print { body { margin: 0; padding: 0; } a { text-decoration: underline; } }
    `;
}

function buildPdfHtml(bodyContent) {
    return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${getPdfStylesheet()}</style>
</head>
<body>${bodyContent}</body>
</html>`;
}

// Helper function to convert images to base64 for PDF export
async function convertImagesToBase64(htmlContent) {
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
    let match;
    const imagePromises = [];

    while ((match = imgRegex.exec(htmlContent)) !== null) {
        const fullImgTag = match[0];
        const imgSrc = match[1];
        
        // Skip if already base64
        if (imgSrc.startsWith('data:')) {
            continue;
        }

        imagePromises.push(
            convertImageToBase64(imgSrc).then(base64 => ({
                originalTag: fullImgTag,
                originalSrc: imgSrc,
                base64: base64
            })).catch(err => {
                console.log(`Failed to convert image ${imgSrc}:`, err);
                return null;
            })
        );
    }

    const results = await Promise.all(imagePromises);
    
    for (const result of results) {
        if (result && result.base64) {
            htmlContent = htmlContent.replace(
                result.originalTag,
                result.originalTag.replace(result.originalSrc, result.base64)
            );
        }
    }

    return htmlContent;
}

async function convertImageToBase64(imagePath) {
    try {
        // Handle different types of paths
        let fullPath;
        
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            // Web URL - use https module for Node.js
            const https = require('https');
            const http = require('http');
            
            return new Promise((resolve, reject) => {
                const client = imagePath.startsWith('https://') ? https : http;
                client.get(imagePath, (response) => {
                    const chunks = [];
                    response.on('data', chunk => chunks.push(chunk));
                    response.on('end', () => {
                        const buffer = Buffer.concat(chunks);
                        const mimeType = response.headers['content-type'] || 'image/png';
                        const base64 = buffer.toString('base64');
                        resolve(`data:${mimeType};base64,${base64}`);
                    });
                }).on('error', reject);
            });
        } else if (path.isAbsolute(imagePath)) {
            // Absolute path
            fullPath = imagePath;
        } else {
            // Relative path - resolve relative to current file or working directory
            if (currentFilePath) {
                fullPath = path.resolve(path.dirname(currentFilePath), imagePath);
            } else {
                fullPath = path.resolve(imagePath);
            }
        }

        // Read local file
        const imageBuffer = await fs.readFile(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        
        let mimeType = 'image/png';
        if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        else if (ext === '.gif') mimeType = 'image/gif';
        else if (ext === '.svg') mimeType = 'image/svg+xml';
        else if (ext === '.webp') mimeType = 'image/webp';

        const base64 = imageBuffer.toString('base64');
        return `data:${mimeType};base64,${base64}`;
    } catch (error) {
        console.log(`Error converting image ${imagePath}:`, error);
        return null;
    }
}

let mainWindow;
let currentFilePath = null;
let documentEdited = false;
let lastSaveDirectory = null;

// Store for app settings - load from disk, merge with defaults
const defaultSettings = {
    theme: 'dark',
    fontSize: 14,
    autoSave: false,
    autoSaveInterval: 5,
    showLineNumbers: true,
    wordWrap: true,
    tabSize: 4
};
let settings = { ...defaultSettings, ...loadSettingsFromDisk() };
const recentFiles = loadRecentFilesFromDisk();

function buildRecentFilesSubmenu() {
    const items = recentFiles.map(file => ({
        label: path.basename(file),
        sublabel: file,
        click: () => {
            if (mainWindow) {
                mainWindow.webContents.send('menu-action', { action: 'open-recent', filePath: file });
            }
        }
    }));
    if (items.length > 0) {
        items.push({ type: 'separator' });
        items.push({
            label: 'Liste leeren',
            click: () => {
                recentFiles.length = 0;
                saveRecentFilesToDisk();
                updateRecentFilesMenu();
            }
        });
    } else {
        items.push({ label: 'Keine Dateien', enabled: false });
    }
    return items;
}

function updateRecentFilesMenu() {
    const menu = Menu.getApplicationMenu();
    if (!menu) return;
    // Rebuild the entire menu to update the recent files submenu
    // (Electron menus are immutable after creation)
    createApplicationMenu();
}

function createApplicationMenu() {
    const template = getMenuTemplate();
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function getMenuTemplate() {
    const isMac = process.platform === 'darwin';
    const template = [];

    // macOS app menu (first menu item is handled specially by macOS)
    if (isMac) {
        template.push({
            label: 'MrxDown',
            submenu: [
                {
                    label: 'Über MrxDown',
                    click: () => {
                        if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'show-about', version: packageJson.version });
                    }
                },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        });
    }

    // File menu — on Windows, add About + Quit here since there's no app menu
    const fileSubmenu = [
        {
            label: 'Neue Datei',
            accelerator: 'CmdOrCtrl+N',
            click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'new-file' }); }
        },
        {
            label: 'Neues Fenster',
            accelerator: 'CmdOrCtrl+Shift+N',
            click: () => { createWindow(); }
        },
        { type: 'separator' },
        {
            label: 'Öffnen...',
            accelerator: 'CmdOrCtrl+O',
            click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'open-file' }); }
        },
        {
            label: 'Zuletzt verwendet',
            id: 'recent-files',
            submenu: buildRecentFilesSubmenu()
        },
        { type: 'separator' },
        {
            label: 'Speichern',
            accelerator: 'CmdOrCtrl+S',
            click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'save-file' }); }
        },
        {
            label: 'Speichern unter...',
            accelerator: 'CmdOrCtrl+Shift+S',
            click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'save-file-as' }); }
        },
        { type: 'separator' },
        {
            label: 'Als HTML exportieren',
            accelerator: 'CmdOrCtrl+E',
            click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'export-html' }); }
        },
        {
            label: 'Als PDF exportieren',
            accelerator: 'CmdOrCtrl+P',
            click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'export-pdf' }); }
        }
    ];

    if (!isMac) {
        fileSubmenu.push(
            { type: 'separator' },
            {
                label: 'Über MrxDown',
                click: () => {
                    if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'show-about', version: packageJson.version });
                }
            },
            { type: 'separator' },
            { role: 'quit', label: 'Beenden' }
        );
    }

    template.push({ label: 'Datei', submenu: fileSubmenu });

    template.push({
        label: 'Bearbeiten',
        submenu: [
            { role: 'undo', label: 'Rückgängig' },
            { role: 'redo', label: 'Wiederholen' },
            { type: 'separator' },
            { role: 'cut', label: 'Ausschneiden' },
            { role: 'copy', label: 'Kopieren' },
            { role: 'paste', label: 'Einfügen' },
            { role: 'selectAll', label: 'Alles auswählen' },
            { type: 'separator' },
            {
                label: 'Suchen',
                accelerator: 'CmdOrCtrl+F',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'find' }); }
            },
            {
                label: 'Ersetzen',
                accelerator: 'CmdOrCtrl+R',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'replace' }); }
            },
            { type: 'separator' },
            {
                label: 'Zeile löschen',
                accelerator: 'CmdOrCtrl+Shift+K',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'delete-line' }); }
            },
            {
                label: 'Zeile duplizieren',
                accelerator: 'CmdOrCtrl+D',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'duplicate-line' }); }
            },
            {
                label: 'Zeile nach oben',
                accelerator: 'Alt+Up',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'move-line-up' }); }
            },
            {
                label: 'Zeile nach unten',
                accelerator: 'Alt+Down',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'move-line-down' }); }
            },
            {
                label: 'Kommentar umschalten',
                accelerator: 'CmdOrCtrl+/',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'toggle-comment' }); }
            },
            {
                label: 'Zeile markieren',
                accelerator: 'CmdOrCtrl+L',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'select-line' }); }
            }
        ]
    });

    template.push({
        label: 'Format',
        submenu: [
            {
                label: 'Fett',
                accelerator: 'CmdOrCtrl+B',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'format-bold' }); }
            },
            {
                label: 'Kursiv',
                accelerator: 'CmdOrCtrl+I',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'format-italic' }); }
            },
            {
                label: 'Code',
                accelerator: 'CmdOrCtrl+`',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'format-code' }); }
            },
            { type: 'separator' },
            {
                label: 'Link einfügen',
                accelerator: 'CmdOrCtrl+K',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'insert-link' }); }
            },
            {
                label: 'Bild einfügen',
                accelerator: 'CmdOrCtrl+Shift+I',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'insert-image' }); }
            },
            {
                label: 'Tabelle einfügen',
                accelerator: 'CmdOrCtrl+T',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'insert-table' }); }
            },
            { type: 'separator' },
            {
                label: 'Überschrift 1',
                accelerator: 'CmdOrCtrl+1',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'heading-1' }); }
            },
            {
                label: 'Überschrift 2',
                accelerator: 'CmdOrCtrl+2',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'heading-2' }); }
            },
            {
                label: 'Überschrift 3',
                accelerator: 'CmdOrCtrl+3',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'heading-3' }); }
            }
        ]
    });

    template.push({
        label: 'Ansicht',
        submenu: [
            {
                label: 'Sidebar umschalten',
                accelerator: 'CmdOrCtrl+\\',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'toggle-sidebar' }); }
            },
            { type: 'separator' },
            { role: 'reload', label: 'Neu laden' },
            { role: 'forceReload', label: 'Erzwungen neu laden' },
            { role: 'toggleDevTools', label: 'Entwicklertools' },
            { type: 'separator' },
            { role: 'resetZoom', label: 'Tatsächliche Größe' },
            { role: 'zoomIn', label: 'Vergrößern' },
            { role: 'zoomOut', label: 'Verkleinern' },
            { type: 'separator' },
            { role: 'togglefullscreen', label: 'Vollbild' }
        ]
    });

    // Window menu — macOS uses 'front', Windows/Linux use 'zoom'
    const windowSubmenu = [
        { role: 'minimize', label: 'Minimieren' },
        { role: 'close', label: 'Schließen' }
    ];
    if (isMac) {
        windowSubmenu.push(
            { type: 'separator' },
            { role: 'front', label: 'Alle nach vorne' }
        );
    }
    template.push({ label: 'Fenster', submenu: windowSubmenu });

    return template;
}

function createWindow() {
    const isMac = process.platform === 'darwin';
    const windowOptions = {
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        backgroundColor: '#2B2E3B',
        icon: path.join(__dirname, 'assets/icon.png')
    };

    if (isMac) {
        windowOptions.titleBarStyle = 'hiddenInset';
        windowOptions.trafficLightPosition = { x: 20, y: 20 };
    }

    mainWindow = new BrowserWindow(windowOptions);

    mainWindow.loadFile('index.html');

    // Add platform class to body for platform-specific CSS
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(
            `document.body.classList.add('platform-${process.platform}')`
        );
    });

    // Enable drag and drop
    mainWindow.webContents.on('will-navigate', (event, url) => {
        event.preventDefault();
    });

    createApplicationMenu();

    mainWindow.on('close', async (event) => {
        if (documentEdited) {
            event.preventDefault();
            const response = await dialog.showMessageBox(mainWindow, {
                type: 'question',
                buttons: ['Speichern & Beenden', 'Nicht speichern', 'Abbrechen'],
                defaultId: 0,
                cancelId: 2,
                message: 'Es gibt ungespeicherte Änderungen.',
                detail: 'Möchten Sie vor dem Beenden speichern?'
            });
            if (response.response === 0) {
                // Save then close
                mainWindow.webContents.send('menu-action', { action: 'save-file' });
                // Wait a moment for save to complete, then force close
                setTimeout(() => {
                    documentEdited = false;
                    mainWindow.close();
                }, 500);
            } else if (response.response === 1) {
                // Don't save, just close
                documentEdited = false;
                mainWindow.close();
            }
            // response === 2: Cancel, do nothing
        }
    });

    mainWindow.on('closed', () => {
        // Clean up all file watchers
        for (const [filePath, watcher] of fsWatchers.entries()) {
            console.log('Cleaning up file watcher for:', filePath);
            if (watcher && watcher.type === 'watchFile') {
                fsSync.unwatchFile(watcher.filePath);
            }
        }
        fsWatchers.clear();

        mainWindow = null;
    });
}

// IPC Handlers
ipcMain.on('new-file', async (event) => {
    if (documentEdited) {
        const response = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['Speichern', 'Nicht speichern', 'Abbrechen'],
            defaultId: 0,
            message: 'Möchten Sie die Änderungen speichern?'
        });

        if (response.response === 0) {
            // Save then create new
            event.reply('menu-action', { action: 'save-file' });
        } else if (response.response === 2) {
            return; // Cancel
        }
    }
    
    currentFilePath = null;
    documentEdited = false;
    event.reply('new-file-created', { filePath: null });
});

ipcMain.on('open-file', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        defaultPath: lastSaveDirectory || undefined,
        filters: [
            { name: 'Markdown', extensions: ['md', 'markdown'] },
            { name: 'Text', extensions: ['txt'] },
            { name: 'Alle Dateien', extensions: ['*'] }
        ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        for (const filePath of result.filePaths) {
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                currentFilePath = filePath;
                lastSaveDirectory = path.dirname(filePath);
                documentEdited = false;
                event.reply('file-opened', { filePath, content });
                addToRecentFiles(filePath);
            } catch (error) {
                dialog.showErrorBox('Fehler', `Datei konnte nicht geöffnet werden: ${error.message}`);
            }
        }
    }
});

ipcMain.on('save-file', async (event, { content, filePath }) => {
    const targetPath = filePath || currentFilePath;
    
    if (!targetPath) {
        // No file path, trigger save as
        return ipcMain.emit('save-file-as', event, { content });
    }

    try {
        // Check if file exists and is read-only
        try {
            await fs.access(targetPath, fsSync.constants.W_OK);
        } catch (accessError) {
            // File is read-only or doesn't exist, prompt for Save As
            const response = await dialog.showMessageBox(mainWindow, {
                type: 'warning',
                buttons: ['Speichern unter...', 'Abbrechen'],
                defaultId: 0,
                message: 'Diese Datei ist schreibgeschützt.',
                detail: 'Möchten Sie die Datei unter einem anderen Namen speichern?'
            });
            
            if (response.response === 0) {
                return ipcMain.emit('save-file-as', event, { content });
            } else {
                return; // User cancelled
            }
        }
        
        await fs.writeFile(targetPath, content, 'utf-8');
        currentFilePath = targetPath;
        documentEdited = false;
        event.reply('file-saved', { filePath: targetPath });
        addToRecentFiles(targetPath);
    } catch (error) {
        dialog.showErrorBox('Fehler', `Datei konnte nicht gespeichert werden: ${error.message}`);
    }
});

ipcMain.on('save-file-as', async (event, { content, filePath, tabTitle }) => {
    // Use the provided filePath from the active tab or fall back to currentFilePath
    const baseFilePath = filePath || currentFilePath;
    let defaultFileName;
    
    if (tabTitle && tabTitle !== 'Unbenannt') {
        // Prioritize tab title (works for both existing files and new files)
        defaultFileName = tabTitle.endsWith('.md') || tabTitle.endsWith('.txt') ? 
            tabTitle : 
            `${tabTitle}.md`;
    } else if (baseFilePath) {
        // If no meaningful tab title, use file path
        defaultFileName = path.basename(baseFilePath);
    } else {
        // Default fallback
        defaultFileName = 'untitled.md';
    }
    
    // Determine the best default path for Save As dialog
    let defaultSavePath = defaultFileName;
    if (baseFilePath) {
        defaultSavePath = path.join(path.dirname(baseFilePath), defaultFileName);
    } else if (lastSaveDirectory) {
        defaultSavePath = path.join(lastSaveDirectory, defaultFileName);
    }

    const result = await dialog.showSaveDialog(mainWindow, {
        filters: [
            { name: 'Markdown', extensions: ['md'] },
            { name: 'Text', extensions: ['txt'] }
        ],
        defaultPath: defaultSavePath
    });

    if (!result.canceled) {
        try {
            await fs.writeFile(result.filePath, content, 'utf-8');
            currentFilePath = result.filePath;
            lastSaveDirectory = path.dirname(result.filePath);
            documentEdited = false;
            event.reply('file-saved', { filePath: result.filePath });
            addToRecentFiles(result.filePath);
        } catch (error) {
            dialog.showErrorBox('Fehler', `Datei konnte nicht gespeichert werden: ${error.message}`);
        }
    }
});

ipcMain.on('export-html', async (event, { content, filePath }) => {
    // Use the provided filePath from the active tab or fall back to currentFilePath
    const baseFilePath = filePath || currentFilePath;
    const defaultFileName = baseFilePath ? 
        path.basename(baseFilePath, path.extname(baseFilePath)) + '.html' : 
        'Untitled.html';
    
    const result = await dialog.showSaveDialog(mainWindow, {
        filters: [
            { name: 'HTML', extensions: ['html'] }
        ],
        defaultPath: defaultFileName
    });

    if (!result.canceled) {
        try {
            // Convert file:// image URLs to base64 data URLs
            let processedContent = content;
            const imgRegex = /<img[^>]+src="file:\/\/([^"]+)"[^>]*>/g;
            let match;
            
            while ((match = imgRegex.exec(content)) !== null) {
                const imagePath = decodeURIComponent(match[1]);
                try {
                    const imageData = await fs.readFile(imagePath);
                    const extension = path.extname(imagePath).toLowerCase().slice(1);
                    const mimeType = extension === 'jpg' ? 'jpeg' : extension;
                    const base64 = imageData.toString('base64');
                    const dataUrl = `data:image/${mimeType};base64,${base64}`;
                    processedContent = processedContent.replace(match[0], match[0].replace(`file://${match[1]}`, dataUrl));
                } catch (err) {
                    console.error(`Failed to convert image ${imagePath}:`, err);
                }
            }
            
            await fs.writeFile(result.filePath, processedContent, 'utf-8');
        } catch (error) {
            dialog.showErrorBox('Fehler', `Export fehlgeschlagen: ${error.message}`);
        }
    }
});

ipcMain.on('print-to-pdf', async (event, { filePath } = {}) => {
    try {
        // Create a new window for PDF generation with proper styling
        const pdfWindow = new BrowserWindow({
            width: 800,
            height: 1000,
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            }
        });

        // Get the current content from the main window
        let content = await mainWindow.webContents.executeJavaScript(`
            (function() {
                const previewElement = document.querySelector('#preview');
                if (!previewElement) {
                    console.error('Preview element not found');
                    return '';
                }
                const html = previewElement.innerHTML;
                console.log('Preview HTML length:', html.length);
                return html;
            })()
        `);

        // Check if content is empty
        if (!content || content.trim().length === 0) {
            console.error('PDF Export: Preview content is empty');
            dialog.showErrorBox('PDF-Export Fehler', 'Der Dokumentinhalt ist leer. Bitte schreiben Sie etwas in den Editor, bevor Sie ein PDF exportieren.');
            pdfWindow.close();
            return;
        }

        // Convert images to base64 for embedding
        content = await convertImagesToBase64(content);

        // Keep <br> tags - styled via CSS

        // Load HTML with optimized print styles
        await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildPdfHtml(content))}`);

        await pdfWindow.webContents.once('did-finish-load', () => {});
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for emoji rendering

        const pdfData = await pdfWindow.webContents.printToPDF({
            marginsType: 0, // Use custom margins from @page
            pageSize: 'A4',
            printBackground: true,
            landscape: false,
            preferCSSPageSize: true,
            printSelectionOnly: false,
            generateTaggedPDF: true, // Enable tagged PDF for better accessibility and structure
            generateDocumentOutline: true // Try to generate document outline from headings
        });

        pdfWindow.close();
        
        // Use the provided filePath from the active tab or fall back to currentFilePath
        const baseFilePath = filePath || currentFilePath;
        const defaultFileName = baseFilePath ? 
            path.basename(baseFilePath, path.extname(baseFilePath)) + '.pdf' : 
            'Untitled.pdf';
        
        const result = await dialog.showSaveDialog(mainWindow, {
            filters: [
                { name: 'PDF', extensions: ['pdf'] }
            ],
            defaultPath: defaultFileName
        });
        
        if (!result.canceled) {
            await fs.writeFile(result.filePath, pdfData);
        }
    } catch (error) {
        dialog.showErrorBox('Fehler', `PDF-Export fehlgeschlagen: ${error.message}`);
    }
});

ipcMain.on('batch-print-to-pdf', async (event, { tabData } = {}) => {
    try {
        if (!tabData || tabData.length === 0) {
            dialog.showErrorBox('Fehler', 'Keine Tabs zum Exportieren gefunden.');
            return;
        }
        
        console.log(`Starting batch PDF export for ${tabData.length} files`);
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        for (const tab of tabData) {
            try {
                console.log(`Exporting PDF for: ${tab.filePath}`);
                
                // Send IPC message to renderer to switch tab and render content
                mainWindow.webContents.send('batch-export-prepare-tab', {
                    filePath: tab.filePath,
                    content: tab.content
                });
                
                // Wait for the tab to be prepared and rendered
                let htmlContent = await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Timeout waiting for tab preparation'));
                    }, 10000);
                    
                    // Listen for the rendered content
                    ipcMain.once('batch-export-tab-ready', (event, data) => {
                        clearTimeout(timeout);
                        if (data.error) {
                            reject(new Error(data.error));
                        } else {
                            resolve(data.htmlContent);
                        }
                    });
                });
                
                // Convert images to base64 for embedding
                htmlContent = await convertImagesToBase64(htmlContent);

                // Keep <br> tags - styled via CSS

                // Create a new window for PDF generation
                const pdfWindow = new BrowserWindow({
                    width: 800,
                    height: 1000,
                    show: false,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        preload: path.join(__dirname, 'preload.js')
                    }
                });
                
                // Load HTML with shared print styles
                await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildPdfHtml(htmlContent))}`);

                await pdfWindow.webContents.once('did-finish-load', () => {});
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for emoji rendering

                const pdfData = await pdfWindow.webContents.printToPDF({
                    marginsType: 0, // Use custom margins from @page
                    pageSize: 'A4',
                    printBackground: true,
                    landscape: false,
                    preferCSSPageSize: true,
                    printSelectionOnly: false,
                    generateTaggedPDF: true, // Enable tagged PDF for better accessibility and structure
                    generateDocumentOutline: true // Try to generate document outline from headings
                });
                
                pdfWindow.close();
                
                // Generate PDF path in same directory as MD file
                const pdfPath = tab.filePath.replace(/\.(md|markdown)$/i, '.pdf');
                console.log(`Saving PDF to: ${pdfPath}`);
                
                await fs.writeFile(pdfPath, pdfData);
                successCount++;
                console.log(`Successfully exported: ${pdfPath}`);
                
            } catch (fileError) {
                console.error(`Error exporting ${tab.filePath}:`, fileError);
                errorCount++;
                errors.push(`${tab.title}: ${fileError.message}`);
            }
        }
        
        // Show summary
        let message = `PDF-Batch-Export abgeschlossen!\n\n`;
        message += `✅ Erfolgreich exportiert: ${successCount}\n`;
        if (errorCount > 0) {
            message += `❌ Fehler: ${errorCount}\n\n`;
            message += errors.join('\n');
        }
        
        dialog.showMessageBox(mainWindow, {
            type: errorCount > 0 ? 'warning' : 'info',
            title: 'PDF-Batch-Export',
            message: message,
            buttons: ['OK']
        });
        
    } catch (error) {
        console.error('Batch PDF export error:', error);
        dialog.showErrorBox('Fehler', `Batch-PDF-Export fehlgeschlagen: ${error.message}`);
    }
});

// Settings handlers
ipcMain.handle('get-settings', () => {
    return settings;
});

ipcMain.on('save-settings', (event, newSettings) => {
    settings = { ...settings, ...newSettings };
    saveSettingsToDisk();
});

// Recent files handlers
ipcMain.handle('get-recent-files', () => {
    return recentFiles;
});

function addToRecentFiles(filePath) {
    const index = recentFiles.indexOf(filePath);
    if (index > -1) {
        recentFiles.splice(index, 1);
    }
    recentFiles.unshift(filePath);
    if (recentFiles.length > 10) {
        recentFiles.pop();
    }
    saveRecentFilesToDisk();
    updateRecentFilesMenu();
}

// Open a specific file by path (for recent files)
ipcMain.on('open-file-path', async (event, filePath) => {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        currentFilePath = filePath;
        lastSaveDirectory = path.dirname(filePath);
        documentEdited = false;
        event.reply('file-opened', { filePath, content });
        addToRecentFiles(filePath);
    } catch (error) {
        dialog.showErrorBox('Fehler', `Datei konnte nicht geöffnet werden: ${error.message}`);
    }
});

// Directory listing for sidebar file tree
ipcMain.handle('list-directory', async (event, dirPath) => {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries
            .filter(e => !e.name.startsWith('.'))
            .map(e => ({
                name: e.name,
                path: path.join(dirPath, e.name),
                isDirectory: e.isDirectory()
            }))
            .sort((a, b) => {
                if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
    } catch (error) {
        console.error('Error listing directory:', error);
        return [];
    }
});

// Image file picker dialog
ipcMain.handle('select-image', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Bilder', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'] }
        ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// Session state persistence for crash recovery
const sessionPath = path.join(userDataPath, 'session.json');

ipcMain.on('save-session', async (event, sessionData) => {
    try {
        await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error saving session:', error);
    }
});

ipcMain.handle('get-session', () => {
    try {
        if (fsSync.existsSync(sessionPath)) {
            const data = fsSync.readFileSync(sessionPath, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading session:', error);
    }
    return null;
});

ipcMain.on('clear-session', () => {
    try {
        if (fsSync.existsSync(sessionPath)) {
            fsSync.unlinkSync(sessionPath);
        }
    } catch (error) {
        console.error('Error clearing session:', error);
    }
});

// Shell operations
ipcMain.on('open-external', (event, url) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
        shell.openExternal(url);
    }
});

// Window controls
ipcMain.on('update-window-title', (event, title) => {
    mainWindow.setTitle(title);
});

ipcMain.on('set-document-edited', (event, edited) => {
    documentEdited = edited;
    mainWindow.setDocumentEdited(edited);
});

// File watching handlers
ipcMain.on('watch-file', (event, filePath) => {
    if (!filePath || fsWatchers.has(filePath)) return;

    // Limit total watchers to prevent resource exhaustion
    if (fsWatchers.size >= 50) {
        console.warn('File watcher limit reached (50), not adding:', filePath);
        return;
    }

    try {
        console.log('Setting up file watcher for:', filePath);

        if (!fsSync.existsSync(filePath)) {
            console.error('File does not exist:', filePath);
            return;
        }

        fsSync.watchFile(filePath, {
            persistent: true,
            interval: 2000
        }, (curr, prev) => {
            // File was deleted (nlink === 0 or size === 0 with zero mtime)
            if (curr.nlink === 0) {
                console.log('File was deleted:', filePath);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('file-deleted-externally', { filePath });
                }
                // Stop watching deleted file
                fsSync.unwatchFile(filePath);
                fsWatchers.delete(filePath);
                return;
            }

            if (curr.mtime > prev.mtime) {
                console.log('File was modified, reading content...');
                setTimeout(() => {
                    fs.readFile(filePath, 'utf-8').then(content => {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('file-changed-externally', { filePath, content });
                        }
                    }).catch(err => {
                        console.error('Error reading changed file:', err);
                    });
                }, 200);
            }
        });

        const watcher = { filePath, type: 'watchFile' };
        fsWatchers.set(filePath, watcher);
        console.log('File watcher added, total watchers:', fsWatchers.size);
    } catch (error) {
        console.error('Error setting up file watcher:', error);
    }
});

ipcMain.on('unwatch-file', (event, filePath) => {
    if (fsWatchers.has(filePath)) {
        console.log('Removing file watcher for:', filePath);
        const watcher = fsWatchers.get(filePath);
        if (watcher && watcher.type === 'watchFile') {
            fsSync.unwatchFile(watcher.filePath);
        }
        fsWatchers.delete(filePath);
        console.log('File watcher removed, total watchers:', fsWatchers.size);
    }
});

// About Dialog
function showAboutDialog() {
    const aboutOptions = {
        type: 'info',
        title: 'Über MrxDown',
        message: 'MrxDown',
        detail: `Version ${packageJson.version}

Ein moderner Markdown-Editor mit Live-Vorschau

Entwickler: Martin Pfeffer © 2025

Open Source unter MIT-Lizenz
GitHub: https://github.com/pepperonas/mrxdown

Features:
• Live-Vorschau
• Tabs und Drag & Drop
• Syntax-Highlighting
• Export-Funktionen
• Tabellen-Editor

Entwickelt mit Electron`,
        buttons: ['OK', 'GitHub öffnen'],
        defaultId: 0,
        icon: path.join(__dirname, 'assets/icon.png')
    };

    dialog.showMessageBox(mainWindow, aboutOptions).then((result) => {
        if (result.response === 1) {
            // GitHub öffnen
            shell.openExternal('https://github.com/pepperonas/mrxdown');
        }
    });
}

// CLI Support - convert markdown to PDF from command line
async function runCLI(inputFile) {
    const marked = require('marked');
    const os = require('os');

    try {
        // Resolve absolute path
        const absolutePath = path.isAbsolute(inputFile)
            ? inputFile
            : path.resolve(process.cwd(), inputFile);

        // Check if file exists
        try {
            await fs.access(absolutePath);
        } catch {
            console.error(`Fehler: Datei nicht gefunden: ${absolutePath}`);
            app.exit(1);
            return;
        }

        // Check if it's a markdown file
        const ext = path.extname(absolutePath).toLowerCase();
        if (ext !== '.md' && ext !== '.markdown') {
            console.error(`Fehler: Keine Markdown-Datei: ${absolutePath}`);
            app.exit(1);
            return;
        }

        console.log(`Konvertiere: ${absolutePath}`);

        // Read markdown content
        const markdownContent = await fs.readFile(absolutePath, 'utf-8');

        // Convert to HTML
        const htmlContent = marked.parse(markdownContent);

        // Convert images to base64
        currentFilePath = absolutePath;
        const htmlWithImages = await convertImagesToBase64(htmlContent);

        // Create temporary HTML file (data URLs are too long for Electron)
        const tempHtmlPath = path.join(os.tmpdir(), `mrxdown-cli-${Date.now()}.html`);
        await fs.writeFile(tempHtmlPath, buildPdfHtml(htmlWithImages), 'utf-8');

        // Create hidden window for PDF generation
        const pdfWindow = new BrowserWindow({
            width: 800,
            height: 1000,
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        // Load HTML from temp file
        await pdfWindow.loadFile(tempHtmlPath);

        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Generate PDF
        const pdfData = await pdfWindow.webContents.printToPDF({
            marginsType: 0,
            pageSize: 'A4',
            printBackground: true,
            landscape: false,
            preferCSSPageSize: true
        });

        pdfWindow.close();

        // Clean up temp file
        await fs.unlink(tempHtmlPath).catch(() => {});

        // Save PDF with same name as input file
        const outputPath = absolutePath.replace(/\.(md|markdown)$/i, '.pdf');
        await fs.writeFile(outputPath, pdfData);

        console.log(`PDF erstellt: ${outputPath}`);
        app.exit(0);

    } catch (error) {
        console.error(`Fehler bei der Konvertierung: ${error.message}`);
        app.exit(1);
    }
}

// CLI Batch mode - convert all markdown files in a directory
async function runCLIBatch(inputDir) {
    const marked = require('marked');
    const os = require('os');

    try {
        // Resolve absolute path
        const absolutePath = path.isAbsolute(inputDir)
            ? inputDir
            : path.resolve(process.cwd(), inputDir);

        // Check if directory exists
        try {
            const stat = await fs.stat(absolutePath);
            if (!stat.isDirectory()) {
                console.error(`Fehler: Kein Verzeichnis: ${absolutePath}`);
                app.exit(1);
                return;
            }
        } catch {
            console.error(`Fehler: Verzeichnis nicht gefunden: ${absolutePath}`);
            app.exit(1);
            return;
        }

        // Find all markdown files
        const files = await fs.readdir(absolutePath);
        const mdFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.markdown'));

        if (mdFiles.length === 0) {
            console.log(`Keine Markdown-Dateien in ${absolutePath} gefunden.`);
            app.exit(0);
            return;
        }

        console.log(`Gefunden: ${mdFiles.length} Markdown-Datei(en) in ${absolutePath}`);

        let successCount = 0;
        let errorCount = 0;

        for (const mdFile of mdFiles) {
            const filePath = path.join(absolutePath, mdFile);
            try {
                console.log(`Konvertiere: ${mdFile}`);

                // Read markdown content
                const markdownContent = await fs.readFile(filePath, 'utf-8');

                // Convert to HTML
                const htmlContent = marked.parse(markdownContent);

                // Convert images to base64
                currentFilePath = filePath;
                const htmlWithImages = await convertImagesToBase64(htmlContent);

                // Create temporary HTML file
                const tempHtmlPath = path.join(os.tmpdir(), `mrxdown-cli-${Date.now()}.html`);
                await fs.writeFile(tempHtmlPath, buildPdfHtml(htmlWithImages), 'utf-8');

                // Create hidden window for PDF generation
                const pdfWindow = new BrowserWindow({
                    width: 800,
                    height: 1000,
                    show: false,
                    webPreferences: { nodeIntegration: false, contextIsolation: true }
                });

                await pdfWindow.loadFile(tempHtmlPath);
                await new Promise(resolve => setTimeout(resolve, 500));

                const pdfData = await pdfWindow.webContents.printToPDF({
                    marginsType: 0,
                    pageSize: 'A4',
                    printBackground: true,
                    landscape: false,
                    preferCSSPageSize: true
                });

                pdfWindow.close();
                await fs.unlink(tempHtmlPath).catch(() => {});

                const outputPath = filePath.replace(/\.(md|markdown)$/i, '.pdf');
                await fs.writeFile(outputPath, pdfData);

                console.log(`  ✓ ${mdFile.replace(/\.(md|markdown)$/i, '.pdf')}`);
                successCount++;

            } catch (error) {
                console.error(`  ✗ ${mdFile}: ${error.message}`);
                errorCount++;
            }
        }

        console.log(`\nFertig: ${successCount} erfolgreich, ${errorCount} fehlgeschlagen`);
        app.exit(errorCount > 0 ? 1 : 0);

    } catch (error) {
        console.error(`Fehler: ${error.message}`);
        app.exit(1);
    }
}

// Check for CLI arguments
const args = process.argv.slice(2);
const cliArg = args.find(arg => !arg.startsWith('-'));

// App lifecycle
if (cliArg) {
    const absolutePath = path.isAbsolute(cliArg) ? cliArg : path.resolve(process.cwd(), cliArg);

    try {
        const stat = fsSync.statSync(absolutePath);
        if (stat.isDirectory()) {
            // CLI mode - batch convert directory
            app.whenReady().then(() => runCLIBatch(cliArg));
        } else if (cliArg.endsWith('.md') || cliArg.endsWith('.markdown')) {
            // CLI mode - convert single file
            app.whenReady().then(() => runCLI(cliArg));
        } else {
            // GUI mode
            app.whenReady().then(createWindow);
        }
    } catch {
        // File doesn't exist, try as single file (will show error)
        if (cliArg.endsWith('.md') || cliArg.endsWith('.markdown')) {
            app.whenReady().then(() => runCLI(cliArg));
        } else {
            app.whenReady().then(createWindow);
        }
    }
} else {
    // GUI mode
    app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// Simple test to verify file watching works
if (process.env.NODE_ENV === 'development') {
    app.whenReady().then(() => {
        console.log('App is ready, file watching system initialized');
    });
}
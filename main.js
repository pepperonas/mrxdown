const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsWatchers = new Map();
const packageJson = require('./package.json');

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
const recentFiles = [];

// Store for app settings
let settings = {
    theme: 'dark',
    fontSize: 14,
    autoSave: false,
    autoSaveInterval: 5,
    showLineNumbers: true,
    wordWrap: true,
    tabSize: 4
};

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 20, y: 20 },
        backgroundColor: '#2B2E3B',
        icon: path.join(__dirname, 'assets/icon.png')
    });

    mainWindow.loadFile('index.html');

    // Enable drag and drop
    mainWindow.webContents.on('will-navigate', (event, url) => {
        event.preventDefault();
    });

    // macOS Menu
    const template = [
        {
            label: 'MrxDown',
            submenu: [
                {
                    label: 'Über MrxDown',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'show-about', version: packageJson.version });
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
        },
        {
            label: 'Datei',
            submenu: [
                {
                    label: 'Neue Datei',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'new-file' });
                    }
                },
                {
                    label: 'Neues Fenster',
                    accelerator: 'CmdOrCtrl+Shift+N',
                    click: () => {
                        createWindow();
                    }
                },
                { type: 'separator' },
                {
                    label: 'Öffnen...',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'open-file' });
                    }
                },
                {
                    label: 'Zuletzt verwendet',
                    submenu: recentFiles.map(file => ({
                        label: path.basename(file),
                        click: () => {
                            mainWindow.webContents.send('menu-action', { action: 'open-recent', filePath: file });
                        }
                    }))
                },
                { type: 'separator' },
                {
                    label: 'Speichern',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'save-file' });
                    }
                },
                {
                    label: 'Speichern unter...',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'save-file-as' });
                    }
                },
                { type: 'separator' },
                {
                    label: 'Als HTML exportieren',
                    accelerator: 'CmdOrCtrl+E',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'export-html' });
                    }
                },
                {
                    label: 'Als PDF exportieren',
                    accelerator: 'CmdOrCtrl+P',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'export-pdf' });
                    }
                }
            ]
        },
        {
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
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'find' });
                    }
                },
                {
                    label: 'Ersetzen',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'replace' });
                    }
                }
            ]
        },
        {
            label: 'Format',
            submenu: [
                {
                    label: 'Fett',
                    accelerator: 'CmdOrCtrl+B',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'format-bold' });
                    }
                },
                {
                    label: 'Kursiv',
                    accelerator: 'CmdOrCtrl+I',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'format-italic' });
                    }
                },
                {
                    label: 'Code',
                    accelerator: 'CmdOrCtrl+`',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'format-code' });
                    }
                },
                { type: 'separator' },
                {
                    label: 'Link einfügen',
                    accelerator: 'CmdOrCtrl+K',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'insert-link' });
                    }
                },
                {
                    label: 'Bild einfügen',
                    accelerator: 'CmdOrCtrl+Shift+I',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'insert-image' });
                    }
                },
                {
                    label: 'Tabelle einfügen',
                    accelerator: 'CmdOrCtrl+T',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'insert-table' });
                    }
                },
                { type: 'separator' },
                {
                    label: 'Überschrift 1',
                    accelerator: 'CmdOrCtrl+1',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'heading-1' });
                    }
                },
                {
                    label: 'Überschrift 2',
                    accelerator: 'CmdOrCtrl+2',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'heading-2' });
                    }
                },
                {
                    label: 'Überschrift 3',
                    accelerator: 'CmdOrCtrl+3',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'heading-3' });
                    }
                }
            ]
        },
        {
            label: 'Ansicht',
            submenu: [
                {
                    label: 'Sidebar umschalten',
                    accelerator: 'CmdOrCtrl+\\',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'toggle-sidebar' });
                    }
                },
                {
                    label: 'Zen-Modus',
                    accelerator: 'CmdOrCtrl+Shift+Z',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'toggle-zen-mode' });
                    }
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
        },
        {
            label: 'Fenster',
            submenu: [
                { role: 'minimize', label: 'Minimieren' },
                { role: 'close', label: 'Schließen' },
                { type: 'separator' },
                { role: 'front', label: 'Alle nach vorne' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    mainWindow.on('closed', () => {
        // Clean up all file watchers
        const fsNode = require('fs');
        for (const [filePath, watcher] of fsWatchers.entries()) {
            console.log('Cleaning up file watcher for:', filePath);
            if (watcher && watcher.type === 'watchFile') {
                fsNode.unwatchFile(watcher.filePath);
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
        properties: ['openFile'],
        filters: [
            { name: 'Markdown', extensions: ['md', 'markdown'] },
            { name: 'Text', extensions: ['txt'] },
            { name: 'Alle Dateien', extensions: ['*'] }
        ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            currentFilePath = filePath;
            documentEdited = false;
            event.reply('file-opened', { filePath, content });
            addToRecentFiles(filePath);
        } catch (error) {
            dialog.showErrorBox('Fehler', `Datei konnte nicht geöffnet werden: ${error.message}`);
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
            await fs.access(targetPath, fs.constants.W_OK);
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
    
    const result = await dialog.showSaveDialog(mainWindow, {
        filters: [
            { name: 'Markdown', extensions: ['md'] },
            { name: 'Text', extensions: ['txt'] }
        ],
        defaultPath: defaultFileName
    });

    if (!result.canceled) {
        try {
            await fs.writeFile(result.filePath, content, 'utf-8');
            currentFilePath = result.filePath;
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
            document.querySelector('#preview').innerHTML
        `);

        // Convert images to base64 for embedding
        content = await convertImagesToBase64(content);

        // Load HTML with proper print styles
        await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        color: #000 !important;
                        background: #fff !important;
                        max-width: 800px;
                        margin: 20px auto;
                        padding: 20px;
                        line-height: 1.6;
                    }
                    h1, h2, h3, h4, h5, h6 {
                        color: #000 !important;
                        margin-top: 24px;
                        margin-bottom: 16px;
                    }
                    h1 { border-bottom: 2px solid #eee; padding-bottom: 8px; }
                    p { color: #000 !important; margin: 16px 0; }
                    code {
                        background: #f4f4f4 !important;
                        color: #000 !important;
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-family: monospace;
                    }
                    pre {
                        background: #f4f4f4 !important;
                        color: #000 !important;
                        padding: 16px;
                        border-radius: 6px;
                        overflow-x: auto;
                        border: 1px solid #ddd;
                    }
                    blockquote {
                        border-left: 4px solid #ddd;
                        padding-left: 16px;
                        color: #666 !important;
                        margin: 16px 0;
                    }
                    table {
                        border-collapse: collapse;
                        width: 100%;
                        margin: 16px 0;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 8px 12px;
                        text-align: left;
                        color: #000 !important;
                    }
                    th {
                        background: #f4f4f4 !important;
                        color: #000 !important;
                    }
                    ul, ol { color: #000 !important; }
                    li { color: #000 !important; }
                    strong { color: #000 !important; }
                    em { color: #000 !important; }
                    a { color: #0066cc !important; }
                    img {
                        max-width: 100%;
                        height: auto;
                        margin: 16px 0;
                        border-radius: 4px;
                    }
                </style>
            </head>
            <body>
                ${content}
            </body>
            </html>
        `)}`);

        await pdfWindow.webContents.once('did-finish-load', () => {});
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for rendering

        const pdfData = await pdfWindow.webContents.printToPDF({
            marginsType: 1,
            pageSize: 'A4',
            printBackground: true,
            landscape: false
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
                
                // Load HTML with proper print styles
                await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <style>
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                color: #000 !important;
                                background: #fff !important;
                                max-width: 800px;
                                margin: 20px auto;
                                padding: 20px;
                                line-height: 1.6;
                            }
                            h1, h2, h3, h4, h5, h6 {
                                color: #000 !important;
                                margin-top: 24px;
                                margin-bottom: 16px;
                            }
                            h1 { border-bottom: 2px solid #eee; padding-bottom: 8px; }
                            p { color: #000 !important; margin: 16px 0; }
                            code {
                                background: #f4f4f4 !important;
                                color: #000 !important;
                                padding: 2px 6px;
                                border-radius: 3px;
                                font-family: monospace;
                            }
                            pre {
                                background: #f4f4f4 !important;
                                color: #000 !important;
                                padding: 16px;
                                border-radius: 6px;
                                overflow-x: auto;
                                border: 1px solid #ddd;
                            }
                            strong { color: #000 !important; }
                            em { color: #000 !important; }
                            img {
                                max-width: 100%;
                                height: auto;
                                margin: 16px 0;
                                border-radius: 4px;
                            }
                        </style>
                    </head>
                    <body>
                        ${htmlContent}
                    </body>
                    </html>
                `)}`);
                
                await pdfWindow.webContents.once('did-finish-load', () => {});
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for rendering
                
                const pdfData = await pdfWindow.webContents.printToPDF({
                    pageSize: 'A4',
                    printBackground: true,
                    landscape: false
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
    // Save to file in future implementation
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
    // Update menu in future implementation
}

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
    
    try {
        const fsNode = require('fs');
        console.log('Setting up file watcher for:', filePath);
        
        // Check if file exists first
        if (!fsNode.existsSync(filePath)) {
            console.error('File does not exist:', filePath);
            return;
        }
        
        // Use fs.watchFile with less aggressive polling to avoid file locking issues
        fsNode.watchFile(filePath, { 
            persistent: true,
            interval: 2000  // Check every 2 seconds instead of 500ms to reduce file access
        }, (curr, prev) => {
            console.log('File stats changed for:', filePath);
            console.log('Previous mtime:', prev.mtime, 'Current mtime:', curr.mtime);
            
            // Check if file was actually modified (not just accessed)
            if (curr.mtime > prev.mtime) {
                console.log('File was modified, reading content...');
                
                // Add a small delay to ensure write is complete
                setTimeout(() => {
                    fs.readFile(filePath, 'utf-8').then(content => {
                        console.log('Sending file-changed-externally event');
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('file-changed-externally', { filePath, content });
                        }
                    }).catch(err => {
                        console.error('Error reading changed file:', err);
                    });
                }, 200);
            }
        });
        
        // Store the file path for cleanup (fs.watchFile doesn't return a watcher object)
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
            // Use fs.unwatchFile for fs.watchFile watchers
            const fsNode = require('fs');
            fsNode.unwatchFile(watcher.filePath);
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
        detail: `Version 0.0.2

Ein moderner Markdown-Editor mit Live-Vorschau

Entwickler: Martin Pfeffer © 2025

Open Source unter MIT-Lizenz
GitHub: https://github.com/pepperonas/mrxdown

Features:
• Live-Vorschau
• Tabs und Drag & Drop
• Syntax-Highlighting
• Export-Funktionen
• Zen-Modus
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

// App lifecycle
app.whenReady().then(createWindow);

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
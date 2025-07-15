const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;

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
                        showAboutDialog();
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
                    accelerator: 'CmdOrCtrl+Shift+E',
                    click: () => {
                        mainWindow.webContents.send('menu-action', { action: 'export-html' });
                    }
                },
                {
                    label: 'Als PDF exportieren',
                    accelerator: 'CmdOrCtrl+Shift+P',
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
                    accelerator: 'CmdOrCtrl+H',
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
        await fs.writeFile(targetPath, content, 'utf-8');
        currentFilePath = targetPath;
        documentEdited = false;
        event.reply('file-saved', { filePath: targetPath });
        addToRecentFiles(targetPath);
    } catch (error) {
        dialog.showErrorBox('Fehler', `Datei konnte nicht gespeichert werden: ${error.message}`);
    }
});

ipcMain.on('save-file-as', async (event, { content }) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        filters: [
            { name: 'Markdown', extensions: ['md'] },
            { name: 'Text', extensions: ['txt'] }
        ],
        defaultPath: currentFilePath || 'untitled.md'
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
    const result = await dialog.showSaveDialog(mainWindow, {
        filters: [
            { name: 'HTML', extensions: ['html'] }
        ],
        defaultPath: currentFilePath ? path.basename(currentFilePath, path.extname(currentFilePath)) + '.html' : 'export.html'
    });

    if (!result.canceled) {
        try {
            await fs.writeFile(result.filePath, content, 'utf-8');
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                message: 'HTML erfolgreich exportiert!',
                detail: `Die Datei wurde gespeichert unter: ${result.filePath}`
            });
        } catch (error) {
            dialog.showErrorBox('Fehler', `Export fehlgeschlagen: ${error.message}`);
        }
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

// About Dialog
function showAboutDialog() {
    const aboutOptions = {
        type: 'info',
        title: 'Über MrxDown',
        message: 'MrxDown',
        detail: `Version 0.0.1

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
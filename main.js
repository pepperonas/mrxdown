const { app, BrowserWindow, Menu, dialog, ipcMain, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const fsWatchers = new Map();
// M8: Own saves trigger the fs.watch callback ~200 ms later and used to surface a
// spurious "Datei wurde extern geändert"-prompt. Saves stamp the path here; watcher
// events inside the window are ignored.
const watcherSuppressUntil = new Map();
function suppressWatcher(filePath) {
    watcherSuppressUntil.set(filePath, Date.now() + 1500);
}
function isWatcherSuppressed(filePath) {
    const until = watcherSuppressUntil.get(filePath);
    if (!until) return false;
    if (Date.now() > until) {
        watcherSuppressUntil.delete(filePath);
        return false;
    }
    return true;
}
const packageJson = require('./package.json');

// Export-Kern (Q1-Split): Frontmatter, PDF-Templates, PDF-HTML-Aufbereitung,
// PDF-Rendering und Bild-Einbettung leben in src/main/export/ — main.js
// registriert darauf nur noch IPC-Handler und die CLI-Pfade.
const exportContext = require('./src/main/export/context');
const { extractFrontmatter } = require('./src/main/export/frontmatter');
const { getPdfTemplatesManifest } = require('./src/main/export/pdf-templates');
const { buildPdfHtml, renderMathForCLI, renderMermaidForCLI } = require('./src/main/export/pdf-html');
const { PDF_SMART_WAIT_JS, renderHtmlToPdf, finalizePdfMetadata } = require('./src/main/export/pdf-render');
const { convertImagesToBase64 } = require('./src/main/export/images');
// K1: Export-Registry — Katalog aller Zielformate + die Format-Implementierungen,
// die auch die Legacy-IPC-Pfade (export-html, print-to-pdf*) antreiben.
const exportRegistry = require('./src/main/export/registry');
const htmlFormat = require('./src/main/export/formats/html');
const pdfFormat = require('./src/main/export/formats/pdf');

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
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading recent files:', error);
    }
    return [];
}

// Async existence filter with per-file timeout. Used post-startup so that
// recent files on offline network drives don't block app launch for 20-30s.
async function pruneMissingRecentFiles() {
    const PER_FILE_TIMEOUT = 300; // ms — short enough that pruning fully completes quickly
    const checks = recentFiles.map(async (f) => {
        const check = fs.access(f).then(() => true).catch(() => false);
        const timeout = new Promise((resolve) => setTimeout(() => resolve(null), PER_FILE_TIMEOUT));
        const result = await Promise.race([check, timeout]);
        // Keep the entry on timeout (unknown) — only drop confirmed-missing files
        return result === false ? null : f;
    });
    const resolved = await Promise.all(checks);
    const filtered = resolved.filter(f => f !== null);
    if (filtered.length !== recentFiles.length) {
        recentFiles.length = 0;
        recentFiles.push(...filtered);
        saveRecentFilesToDisk();
        updateRecentFilesMenu();
    }
}

async function saveRecentFilesToDisk() {
    try {
        await fs.writeFile(recentFilesPath, JSON.stringify(recentFiles, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error saving recent files:', error);
    }
}

let mainWindow;
let currentFilePath = null;
let documentEdited = false;
let lastSaveDirectory = null;
let pendingOpenFile = null; // A7: file to open when app finishes launching
let isCleanShutdown = false; // Prevents beforeunload race: blocks session save during clean close

// Store for app settings - load from disk, merge with defaults
const defaultSettings = {
    theme: 'dark',
    fontSize: 14,
    autoSave: false,
    autoSaveInterval: 5,
    showLineNumbers: true,
    wordWrap: true,
    tabSize: 4,
    pdfTemplate: 'default',
    pasteHtmlAsMarkdown: true
};
let settings = { ...defaultSettings, ...loadSettingsFromDisk() };
const recentFiles = loadRecentFilesFromDisk();

// Export-Module lesen veränderlichen App-Zustand über Getter (nie direkt):
// settings für die Template-Wahl, currentFilePath als Bild-Basisverzeichnis-Fallback.
exportContext.configure({
    getSettings: () => settings,
    getCurrentFilePath: () => currentFilePath
});

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
                {
                    label: 'Nach Updates suchen…',
                    click: () => triggerManualUpdateCheck()
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
        // M9: "Neues Fenster" removed — the app's state (mainWindow global, watchers,
        // currentFilePath) is single-window; a second window silently broke the first.
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
        },
        {
            label: 'Exportieren…',
            accelerator: 'CmdOrCtrl+Shift+E',
            click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'export-dialog' }); }
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
            {
                label: 'Nach Updates suchen…',
                click: () => triggerManualUpdateCheck()
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
            {
                label: 'Einfügen ohne Formatierung',
                accelerator: 'CmdOrCtrl+Shift+V',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'paste-plain' }); }
            },
            { role: 'selectAll', label: 'Alles auswählen' },
            { type: 'separator' },
            {
                label: 'Suchen',
                accelerator: 'CmdOrCtrl+F',
                click: () => { if (mainWindow) mainWindow.webContents.send('menu-action', { action: 'find' }); }
            },
            {
                label: 'Ersetzen',
                // M1: was CmdOrCtrl+R, which collided with the reload role's default
                // accelerator. Convention: ⌥⌘F on macOS, Ctrl+H on Windows/Linux.
                accelerator: process.platform === 'darwin' ? 'Cmd+Alt+F' : 'Ctrl+H',
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

// E1: Window state persistence
const windowStatePath = path.join(userDataPath, 'window-state.json');

function loadWindowState() {
    try {
        if (fsSync.existsSync(windowStatePath)) {
            return JSON.parse(fsSync.readFileSync(windowStatePath, 'utf-8'));
        }
    } catch (e) { /* ignore */ }
    return null;
}

let saveWindowStateTimer = null;
function saveWindowState() {
    // L10: resize/move fire continuously during a drag — debounce the sync disk write
    if (saveWindowStateTimer) clearTimeout(saveWindowStateTimer);
    saveWindowStateTimer = setTimeout(saveWindowStateNow, 300);
}

function saveWindowStateNow() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
        const bounds = mainWindow.getBounds();
        const state = {
            x: bounds.x, y: bounds.y,
            width: bounds.width, height: bounds.height,
            isMaximized: mainWindow.isMaximized()
        };
        fsSync.writeFileSync(windowStatePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) { /* ignore */ }
}

function createWindow() {
    const isMac = process.platform === 'darwin';
    const savedState = loadWindowState();
    const windowOptions = {
        width: savedState ? savedState.width : 1400,
        height: savedState ? savedState.height : 900,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            spellcheck: true,
            preload: path.join(__dirname, 'preload.js')
        },
        backgroundColor: '#2B2E3B',
        icon: path.join(__dirname, 'assets/icon.png')
    };

    // E1: Restore window position
    if (savedState && savedState.x !== undefined) {
        windowOptions.x = savedState.x;
        windowOptions.y = savedState.y;
    }

    if (isMac) {
        windowOptions.titleBarStyle = 'hiddenInset';
        windowOptions.trafficLightPosition = { x: 20, y: 20 };
    }

    mainWindow = new BrowserWindow(windowOptions);

    // H3: Re-arm crash-recovery for reopened windows (macOS Dock reopen). Without this,
    // every save-session after the first window close was silently discarded.
    isCleanShutdown = false;

    // H4: Never let web content open child windows. Middle-click on an external link in
    // the preview would otherwise spawn a window that inherits preload.js — handing
    // window.electronAPI (arbitrary file write!) to a remote page.
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    // E1: Restore maximized state
    if (savedState && savedState.isMaximized) {
        mainWindow.maximize();
    }

    // E1: Save window state on resize/move
    mainWindow.on('resize', saveWindowState);
    mainWindow.on('move', saveWindowState);
    mainWindow.on('maximize', saveWindowState);
    mainWindow.on('unmaximize', saveWindowState);

    mainWindow.loadFile('index.html');

    // Add platform class to body for platform-specific CSS + A7: open pending file
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(
            `document.body.classList.add('platform-${process.platform}')`
        );
        // A7: Open file that was requested before app was ready
        if (pendingOpenFile) {
            const filePath = pendingOpenFile;
            pendingOpenFile = null;
            fs.readFile(filePath, 'utf-8').then(content => {
                mainWindow.webContents.send('file-opened', { filePath, content });
                addToRecentFiles(filePath);
            }).catch(err => console.error('Error opening pending file:', err));
        }
    });

    // Enable drag and drop
    mainWindow.webContents.on('will-navigate', (event, url) => {
        event.preventDefault();
    });

    createApplicationMenu();

    // C3/E5: Spellcheck + native editor context menu
    mainWindow.webContents.session.setSpellCheckerLanguages(['de', 'en-US']);
    mainWindow.webContents.on('context-menu', (event, params) => {
        const menuItems = [];

        // Spellcheck suggestions
        if (params.misspelledWord) {
            for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
                menuItems.push({
                    label: suggestion,
                    click: () => mainWindow.webContents.replaceMisspelling(suggestion)
                });
            }
            if (menuItems.length > 0) menuItems.push({ type: 'separator' });
            menuItems.push({
                label: 'Zum Wörterbuch hinzufügen',
                click: () => mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
            });
            menuItems.push({ type: 'separator' });
        }

        // E5: Standard edit actions
        menuItems.push(
            { label: 'Ausschneiden', accelerator: 'CmdOrCtrl+X', role: 'cut' },
            { label: 'Kopieren', accelerator: 'CmdOrCtrl+C', role: 'copy' },
            { label: 'Einfügen', accelerator: 'CmdOrCtrl+V', role: 'paste' },
            { label: 'Einfügen ohne Formatierung', accelerator: 'CmdOrCtrl+Shift+V', click: () => mainWindow.webContents.send('menu-action', { action: 'paste-plain' }) },
            { type: 'separator' },
            { label: 'Fett', accelerator: 'CmdOrCtrl+B', click: () => mainWindow.webContents.send('menu-action', { action: 'format-bold' }) },
            { label: 'Kursiv', accelerator: 'CmdOrCtrl+I', click: () => mainWindow.webContents.send('menu-action', { action: 'format-italic' }) },
            { label: 'Code', accelerator: 'CmdOrCtrl+`', click: () => mainWindow.webContents.send('menu-action', { action: 'format-code' }) },
            { label: 'Link einfügen', accelerator: 'CmdOrCtrl+K', click: () => mainWindow.webContents.send('menu-action', { action: 'insert-link' }) },
            { type: 'separator' },
            { label: 'Alles auswählen', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
        );

        const menu = Menu.buildFromTemplate(menuItems);
        menu.popup();
    });

    // A1: Race-condition-free close handler — saves synchronously before closing.
    // C2/H1 rework: the single documentEdited flag only mirrored the LAST-touched tab,
    // so a dirty background tab used to be discarded without any prompt (and the session
    // backup cleared with it). We now always ask the renderer for ALL dirty tabs, save
    // each of them, and refuse to close if any write fails.
    let closeConfirmed = false;
    const confirmClose = () => {
        closeConfirmed = true;
        isCleanShutdown = true;
        clearSessionFile();
        documentEdited = false;
        mainWindow.close();
    };
    const handleCloseRequest = async () => {
        let dirtyTabs = [];
        try {
            dirtyTabs = await mainWindow.webContents.executeJavaScript(`
                (function() {
                    if (typeof saveCurrentTabState === 'function') saveCurrentTabState();
                    return tabs.filter(t => t.isModified).map(t => ({
                        content: t.id === activeTabId ? editor.value : (t.content || ''),
                        filePath: t.filePath || null,
                        title: t.title || 'Unbenannt'
                    }));
                })()
            `);
        } catch (err) {
            // Renderer unreachable (crashed/hung) — nothing we can save; let the
            // session file survive as crash recovery instead of clearing it.
            console.error('Close: could not query dirty tabs:', err);
            isCleanShutdown = false;
            closeConfirmed = true;
            mainWindow.close();
            return;
        }
        if (dirtyTabs.length === 0) {
            confirmClose();
            return;
        }
        const fileList = dirtyTabs.map(t => `• ${t.title}`).join('\n');
        const response = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['Speichern & Beenden', 'Nicht speichern', 'Abbrechen'],
            defaultId: 0,
            cancelId: 2,
            message: dirtyTabs.length === 1
                ? 'Es gibt ungespeicherte Änderungen.'
                : `Es gibt ungespeicherte Änderungen in ${dirtyTabs.length} Tabs.`,
            detail: `${fileList}\n\nMöchten Sie vor dem Beenden speichern?`
        });
        if (response.response === 2) return; // Abbrechen
        if (response.response === 1) { confirmClose(); return; } // Nicht speichern
        // Speichern & Beenden — save every dirty tab; abort close on any failure
        for (const tab of dirtyTabs) {
            try {
                let targetPath = tab.filePath;
                if (!targetPath) {
                    const result = await dialog.showSaveDialog(mainWindow, {
                        filters: [
                            { name: 'Markdown', extensions: ['md'] },
                            { name: 'Text', extensions: ['txt'] }
                        ],
                        defaultPath: /\.(md|txt)$/i.test(tab.title) ? tab.title : `${tab.title}.md`
                    });
                    if (result.canceled) return; // user aborted — keep window open
                    targetPath = result.filePath;
                }
                await writeFileAtomic(targetPath, tab.content);
                suppressWatcher(targetPath);
                addToRecentFiles(targetPath);
            } catch (err) {
                dialog.showErrorBox(
                    'Fehler beim Speichern',
                    `„${tab.filePath || tab.title}" konnte nicht gespeichert werden: ${err.message}\n\nDas Fenster bleibt geöffnet, damit keine Daten verloren gehen.`
                );
                return; // H1: never close after a failed save
            }
        }
        confirmClose();
    };
    mainWindow.on('close', (event) => {
        if (closeConfirmed) return; // second pass after confirmation — let it through
        event.preventDefault();
        handleCloseRequest();
    });

    mainWindow.on('closed', () => {
        // F2: Clean up all file watchers
        for (const [filePath, watcher] of fsWatchers.entries()) {
            if (watcher && watcher.close) {
                watcher.close();
            }
        }
        fsWatchers.clear();

        mainWindow = null;
    });
}

// IPC Handlers
// L1: dead 'new-file' IPC handler removed — the renderer's menu action calls
// createNewTab() directly and never sent on this channel (its save branch also raced).

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

// M10: Atomic write — write to a temp file in the same directory, then rename over
// the target. A crash mid-write can no longer truncate the user's file.
async function writeFileAtomic(targetPath, content) {
    const tmpPath = targetPath + '.mrxdown-tmp';
    await fs.writeFile(tmpPath, content, 'utf-8');
    try {
        await fs.rename(tmpPath, targetPath);
    } catch (err) {
        await fs.unlink(tmpPath).catch(() => {});
        throw err;
    }
}

// Shared save-file implementation — returns { success, filePath?, error?, cancelled? } and
// optionally emits the 'file-saved' event for callers that rely on the event bus.
// Pragmatic: attempt writeFile directly and catch EACCES, rather than access() + write (TOCTOU race).
// updateGlobals=false is for the -sync invoke paths used to save BACKGROUND tabs on close:
// they must not rebind currentFilePath/documentEdited to the background tab, and must not
// broadcast 'file-saved' (the renderer would apply it to the ACTIVE tab and then overwrite
// the wrong file on the next Cmd+S).
async function doSaveFile({ content, filePath, event, updateGlobals = true }) {
    const targetPath = filePath || currentFilePath;
    if (!targetPath) {
        return doSaveFileAs({ content, filePath: null, tabTitle: null, event, updateGlobals });
    }
    try {
        await writeFileAtomic(targetPath, content);
        suppressWatcher(targetPath);
        if (updateGlobals) {
            currentFilePath = targetPath;
            documentEdited = false;
            if (mainWindow) mainWindow.webContents.send('file-saved', { filePath: targetPath });
        }
        addToRecentFiles(targetPath);
        return { success: true, filePath: targetPath };
    } catch (error) {
        if (error.code === 'EACCES' || error.code === 'EPERM' || error.code === 'EROFS') {
            const response = await dialog.showMessageBox(mainWindow, {
                type: 'warning',
                buttons: ['Speichern unter...', 'Abbrechen'],
                defaultId: 0,
                message: 'Diese Datei ist schreibgeschützt.',
                detail: 'Möchten Sie die Datei unter einem anderen Namen speichern?'
            });
            if (response.response === 0) {
                return doSaveFileAs({ content, filePath: null, tabTitle: null, event, updateGlobals });
            }
            return { success: false, cancelled: true };
        }
        dialog.showErrorBox('Fehler', `Datei konnte nicht gespeichert werden: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function doSaveFileAs({ content, filePath, tabTitle, event, updateGlobals = true }) {
    const baseFilePath = filePath || currentFilePath;
    let defaultFileName;

    if (tabTitle && tabTitle !== 'Unbenannt') {
        defaultFileName = tabTitle.endsWith('.md') || tabTitle.endsWith('.txt') ? tabTitle : `${tabTitle}.md`;
    } else if (baseFilePath) {
        defaultFileName = path.basename(baseFilePath);
    } else {
        defaultFileName = 'untitled.md';
    }

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

    if (result.canceled) {
        return { success: false, cancelled: true };
    }
    try {
        await writeFileAtomic(result.filePath, content);
        suppressWatcher(result.filePath);
        lastSaveDirectory = path.dirname(result.filePath);
        if (updateGlobals) {
            currentFilePath = result.filePath;
            documentEdited = false;
            if (mainWindow) mainWindow.webContents.send('file-saved', { filePath: result.filePath });
        }
        addToRecentFiles(result.filePath);
        return { success: true, filePath: result.filePath };
    } catch (error) {
        dialog.showErrorBox('Fehler', `Datei konnte nicht gespeichert werden: ${error.message}`);
        return { success: false, error: error.message };
    }
}

ipcMain.on('save-file', (event, { content, filePath }) => {
    doSaveFile({ content, filePath, event });
});

// The -sync variants save background tabs during close flows — they must not touch
// the active-tab globals or broadcast 'file-saved' (see doSaveFile comment).
ipcMain.handle('save-file-sync', (event, { content, filePath }) => {
    return doSaveFile({ content, filePath, event, updateGlobals: false });
});

ipcMain.handle('save-file-as-sync', (event, { content, filePath, tabTitle }) => {
    return doSaveFileAs({ content, filePath, tabTitle, event, updateGlobals: false });
});

ipcMain.on('save-file-as', (event, { content, filePath, tabTitle }) => {
    doSaveFileAs({ content, filePath, tabTitle, event });
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
            // K1: Bild-Einbettung (file:// -> base64) lebt im HTML-Format-Modul
            const processedContent = await htmlFormat.embedFileImagesAsBase64(content);
            await fs.writeFile(result.filePath, processedContent, 'utf-8');
        } catch (error) {
            dialog.showErrorBox('Fehler', `Export fehlgeschlagen: ${error.message}`);
        }
    }
});

// D4: PDF export with user-specified options (page size, margins, orientation, TOC)
// K1: Kern lebt in src/main/export/formats/pdf.js (generatePdfWithOptions)
ipcMain.on('print-to-pdf-options', async (event, { filePath, pdfOptions } = {}) => {
    try {
        const pageData = await mainWindow.webContents.executeJavaScript(
            '(function() { var p = document.querySelector("#preview"); var html = p ? p.innerHTML : ""; var raw = (typeof editor !== "undefined" && editor && editor.value) ? editor.value : ""; return { previewHtml: html, rawMarkdown: raw }; })()'
        );
        const previewHtml = pageData && pageData.previewHtml ? pageData.previewHtml : '';
        const rawMarkdown = pageData && pageData.rawMarkdown ? pageData.rawMarkdown : '';

        if (!previewHtml || previewHtml.trim().length === 0) {
            dialog.showErrorBox('PDF-Export Fehler', 'Der Dokumentinhalt ist leer.');
            return;
        }

        const pdfData = await pdfFormat.generatePdfWithOptions({
            previewHtml, rawMarkdown, filePath, options: pdfOptions
        });

        const baseFilePath = filePath || currentFilePath;
        const defaultFileName = baseFilePath ?
            path.basename(baseFilePath, path.extname(baseFilePath)) + '.pdf' :
            'Untitled.pdf';

        const result = await dialog.showSaveDialog(mainWindow, {
            filters: [{ name: 'PDF', extensions: ['pdf'] }],
            defaultPath: defaultFileName
        });

        if (!result.canceled) {
            await fs.writeFile(result.filePath, pdfData);
        }
    } catch (error) {
        dialog.showErrorBox('Fehler', 'PDF-Export fehlgeschlagen: ' + error.message);
    }
});

// K1: einfacher PDF-Pfad (Cmd+P) — Kern in formats/pdf.js (generatePdfSimple)
ipcMain.on('print-to-pdf', async (event, { filePath } = {}) => {
    try {
        // Pull preview HTML and raw editor markdown so we can extract frontmatter
        // for template selection + title-page rendering.
        const pageData = await mainWindow.webContents.executeJavaScript(`
            (function() {
                const previewElement = document.querySelector('#preview');
                const previewHtml = previewElement ? previewElement.innerHTML : '';
                const rawMarkdown = (typeof editor !== 'undefined' && editor && editor.value) ? editor.value : '';
                return { previewHtml, rawMarkdown };
            })()
        `);
        const previewHtml = pageData && pageData.previewHtml ? pageData.previewHtml : '';
        const rawMarkdown = pageData && pageData.rawMarkdown ? pageData.rawMarkdown : '';

        if (!previewHtml || previewHtml.trim().length === 0) {
            console.error('PDF Export: Preview content is empty');
            dialog.showErrorBox('PDF-Export Fehler', 'Der Dokumentinhalt ist leer. Bitte schreiben Sie etwas in den Editor, bevor Sie ein PDF exportieren.');
            return;
        }

        const pdfData = await pdfFormat.generatePdfSimple({ previewHtml, rawMarkdown, filePath });

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
                
                // Wait for the tab to be prepared and rendered.
                // Named listener so we can remove it on timeout — without this, a dangling
                // `ipcMain.once` would fire on the NEXT tab's ready event and corrupt its Promise.
                // M5: replies are correlated by filePath — a late reply from a timed-out
                // previous tab must not be consumed as this tab's HTML.
                let htmlContent = await new Promise((resolve, reject) => {
                    const onReady = (event, data) => {
                        if (!data || (data.filePath && data.filePath !== tab.filePath)) return; // stale reply
                        clearTimeout(timeout);
                        ipcMain.removeListener('batch-export-tab-ready', onReady);
                        if (data.error) reject(new Error(data.error));
                        else resolve(data.htmlContent);
                    };
                    const timeout = setTimeout(() => {
                        ipcMain.removeListener('batch-export-tab-ready', onReady);
                        reject(new Error('Timeout waiting for tab preparation'));
                    }, 10000);
                    ipcMain.on('batch-export-tab-ready', onReady);
                });

                // Convert images to base64 — H2: relative to THIS tab's directory
                htmlContent = await convertImagesToBase64(htmlContent, path.dirname(tab.filePath));

                // Extract frontmatter from tab's source markdown for template selection
                const { frontmatter: tabFrontmatter } = extractFrontmatter(tab.content || '');

                const pdfData = await renderHtmlToPdf(
                    buildPdfHtml({ bodyContent: htmlContent, frontmatter: tabFrontmatter }),
                    {},
                    { frontmatter: tabFrontmatter, filePath: tab.filePath }
                );

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

// PDF template catalog for the export dialog (and whoever else wants it)
ipcMain.handle('get-pdf-templates', () => {
    const manifest = getPdfTemplatesManifest();
    return Object.entries(manifest).map(([key, meta]) => ({
        key,
        name: meta.name || key,
        description: meta.description || '',
        supportsTitlePage: meta.supportsTitlePage !== false,
        titlePageFields: meta.titlePageFields || []
    }));
});

// K1: Export-Registry — Format-Katalog für den gemeinsamen Export-Dialog
ipcMain.handle('get-export-formats', () => exportRegistry.listFormats());

// K1: Generischer Export über die Registry. Der Renderer schickt die vom
// jeweiligen Format benötigten Dokument-Felder (siehe format.needs) mit;
// Save-Dialog + Schreiben passieren hier. Inputs werden validiert — der
// Handler vertraut dem Renderer-Payload nicht blind.
const EXPORT_DOC_FIELD_MAX = 64 * 1024 * 1024; // 64 MB pro Feld — großzügig, aber endlich
ipcMain.handle('export-document', async (event, payload) => {
    try {
        if (!payload || typeof payload !== 'object') {
            return { success: false, error: 'Ungültige Export-Anfrage.' };
        }
        const format = exportRegistry.getFormat(typeof payload.formatId === 'string' ? payload.formatId : '');
        if (!format) {
            return { success: false, error: `Unbekanntes Exportformat: ${payload.formatId}` };
        }
        const filePath = typeof payload.filePath === 'string' ? payload.filePath : null;

        const doc = { filePath, options: (payload.options && typeof payload.options === 'object') ? payload.options : null };
        for (const field of (format.needs || [])) {
            const value = payload[field];
            if (typeof value !== 'string' || value.length > EXPORT_DOC_FIELD_MAX) {
                return { success: false, error: `Ungültiges Dokumentfeld: ${field}` };
            }
            doc[field] = value;
        }
        const contentSource = doc.fullHtml || doc.previewHtml || '';
        if (!contentSource.trim()) {
            return { success: false, error: 'Der Dokumentinhalt ist leer.' };
        }

        const buffer = await format.toBuffer(doc);

        const baseFilePath = filePath || currentFilePath;
        const defaultFileName = baseFilePath
            ? path.basename(baseFilePath, path.extname(baseFilePath)) + '.' + format.ext
            : 'Untitled.' + format.ext;
        const result = await dialog.showSaveDialog(mainWindow, {
            filters: format.filters,
            defaultPath: defaultFileName
        });
        if (result.canceled) return { success: false, cancelled: true };

        await fs.writeFile(result.filePath, buffer);
        return { success: true, filePath: result.filePath };
    } catch (error) {
        console.error('Export fehlgeschlagen:', error);
        return { success: false, error: error.message };
    }
});

// K6: DOCX → HTML für den Import (mammoth, lazy-required — ~3 MB nur bei Bedarf).
// Der Renderer schickt den Datei-Inhalt als Uint8Array, weil File.path unter
// Electron 43 nicht mehr existiert. Inputs werden validiert (Typ + Größen-Cap).
const DOCX_IMPORT_MAX_BYTES = 50 * 1024 * 1024;
ipcMain.handle('convert-docx-to-html', async (event, payload) => {
    try {
        if (!payload || typeof payload !== 'object') return { error: 'Ungültige Anfrage.' };
        const data = payload.data;
        if (!(data instanceof Uint8Array) || data.byteLength === 0) {
            return { error: 'Ungültige Datei-Daten.' };
        }
        if (data.byteLength > DOCX_IMPORT_MAX_BYTES) {
            return { error: 'Datei zu groß (max. 50 MB).' };
        }
        const mammoth = require('mammoth');
        const result = await mammoth.convertToHtml({
            buffer: Buffer.from(data.buffer, data.byteOffset, data.byteLength)
        });
        return { html: result.value, warnings: (result.messages || []).map(m => m.message) };
    } catch (error) {
        console.error('DOCX-Import fehlgeschlagen:', error);
        return { error: error.message };
    }
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

// A2: Electron dialog replacements for confirm/alert
ipcMain.handle('show-confirm-dialog', async (event, { message, detail, buttons, defaultId, cancelId }) => {
    const response = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: buttons || ['OK', 'Abbrechen'],
        defaultId: defaultId || 0,
        cancelId: cancelId !== undefined ? cancelId : 1,
        message: message || '',
        detail: detail || undefined
    });
    return response.response;
});

ipcMain.handle('show-alert-dialog', async (event, { message, detail, type }) => {
    await dialog.showMessageBox(mainWindow, {
        type: type || 'info',
        buttons: ['OK'],
        message: message || '',
        detail: detail || undefined
    });
});

// File stats for info panel (B3)
ipcMain.handle('get-file-stats', async (event, filePath) => {
    try {
        const stat = await fs.stat(filePath);
        return {
            size: stat.size,
            created: stat.birthtime.toISOString(),
            modified: stat.mtime.toISOString()
        };
    } catch (error) {
        return null;
    }
});

// C2: Save pasted clipboard image to disk
ipcMain.handle('save-clipboard-image', async (event, { dirPath, buffer, filename }) => {
    try {
        const imagesDir = path.join(dirPath, 'images');
        try { await fs.mkdir(imagesDir, { recursive: true }); } catch (e) { /* exists */ }
        // L7: defense in depth — never let a crafted filename escape images/
        filename = path.basename(filename);
        const filePath = path.join(imagesDir, filename);
        await fs.writeFile(filePath, Buffer.from(buffer));
        return `images/${filename}`;
    } catch (error) {
        console.error('Error saving clipboard image:', error);
        return null;
    }
});

// C7: Copy dropped image file to images/ subfolder
ipcMain.handle('copy-image-file', async (event, { sourcePath, dirPath }) => {
    try {
        const imagesDir = path.join(dirPath, 'images');
        try { await fs.mkdir(imagesDir, { recursive: true }); } catch (e) { /* exists */ }
        const fileName = path.basename(sourcePath);
        const destPath = path.join(imagesDir, fileName);
        await fs.copyFile(sourcePath, destPath);
        return `images/${fileName}`;
    } catch (error) {
        console.error('Error copying image file:', error);
        return null;
    }
});

// Session state persistence for crash recovery
const sessionPath = path.join(userDataPath, 'session.json');

ipcMain.on('save-session', async (event, sessionData) => {
    // During clean shutdown the beforeunload fires after clearSessionFile() — ignore it
    if (isCleanShutdown) {
        clearSessionFile();
        return;
    }
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
    clearSessionFile();
});

function clearSessionFile() {
    try {
        if (fsSync.existsSync(sessionPath)) {
            fsSync.unlinkSync(sessionPath);
        }
    } catch (error) {
        console.error('Error clearing session:', error);
    }
}

// Shell operations — external links are confirmed per host (session-scoped allowlist).
// Protects against phishing/tracking embedded in untrusted markdown documents.
const trustedHosts = new Set();

ipcMain.on('open-external', async (event, url) => {
    if (typeof url !== 'string') return;
    if (!url.startsWith('https://') && !url.startsWith('http://')) return;

    let host;
    try {
        host = new URL(url).host;
    } catch {
        return; // malformed URL — drop silently
    }

    if (!trustedHosts.has(host)) {
        const result = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['Öffnen', 'Abbrechen'],
            defaultId: 0,
            cancelId: 1,
            checkboxLabel: `Für diese Sitzung ${host} vertrauen`,
            checkboxChecked: false,
            title: 'Externen Link öffnen?',
            message: `Möchtest du diesen Link im Browser öffnen?`,
            detail: url
        });
        if (result.response !== 0) return;
        if (result.checkboxChecked) trustedHosts.add(host);
    }

    shell.openExternal(url);
});

// Window controls
// Theme "System": renderer fragt den OS-Zustand ab und bekommt Änderungen gepusht
ipcMain.handle('get-system-theme', () => (nativeTheme.shouldUseDarkColors ? 'dark' : 'light'));
nativeTheme.on('updated', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('system-theme-changed',
            nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
    }
});

ipcMain.on('update-window-title', (event, title) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setTitle(title);
});

ipcMain.on('set-document-edited', (event, edited) => {
    documentEdited = edited;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setDocumentEdited(edited);
});

// F2: File watching handlers — fs.watch (event-based, no polling)
ipcMain.on('watch-file', (event, filePath) => {
    if (!filePath || fsWatchers.has(filePath)) return;

    if (fsWatchers.size >= 50) {
        console.warn('File watcher limit reached (50), not adding:', filePath);
        return;
    }

    try {
        if (!fsSync.existsSync(filePath)) {
            console.error('File does not exist:', filePath);
            return;
        }

        let debounceTimer = null;
        const watcher = fsSync.watch(filePath, { persistent: true }, (eventType) => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (!fsSync.existsSync(filePath)) {
                    // File was deleted
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('file-deleted-externally', { filePath });
                    }
                    watcher.close();
                    fsWatchers.delete(filePath);
                    return;
                }
                if (eventType === 'change') {
                    if (isWatcherSuppressed(filePath)) return; // own save, not external
                    fs.readFile(filePath, 'utf-8').then(content => {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('file-changed-externally', { filePath, content });
                        }
                    }).catch(err => {
                        console.error('Error reading changed file:', err);
                    });
                }
            }, 200);
        });

        watcher.on('error', (err) => {
            console.error('File watcher error:', err);
            watcher.close();
            fsWatchers.delete(filePath);
        });

        fsWatchers.set(filePath, watcher);
    } catch (error) {
        console.error('Error setting up file watcher:', error);
    }
});

ipcMain.on('unwatch-file', (event, filePath) => {
    if (fsWatchers.has(filePath)) {
        const watcher = fsWatchers.get(filePath);
        if (watcher && watcher.close) {
            watcher.close();
        }
        fsWatchers.delete(filePath);
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
    // E4: Callouts auch im CLI-PDF — dieselbe Extension wie die Preview (callouts.js)
    marked.use(require('./callouts').createCalloutExtension());
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

        // Extract frontmatter once — drives both KaTeX rendering and PDF template selection
        const { frontmatter, body: markdownBody } = extractFrontmatter(markdownContent);

        // D2: KaTeX server-seitig; D1-CLI: Mermaid-Fences als <div class="mermaid">
        // (das Druckfenster rendert sie via buildPdfHtml-Injektion selbst)
        const markdownWithMath = renderMermaidForCLI(renderMathForCLI(markdownBody));

        // Convert to HTML
        const htmlContent = marked.parse(markdownWithMath);

        // Convert images to base64
        currentFilePath = absolutePath;
        const htmlWithImages = await convertImagesToBase64(htmlContent);

        // Create temporary HTML file (data URLs are too long for Electron)
        const tempHtmlPath = path.join(os.tmpdir(), `mrxdown-cli-${Date.now()}.html`);
        await fs.writeFile(tempHtmlPath, buildPdfHtml({ bodyContent: htmlWithImages, frontmatter }), 'utf-8');

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

        // Fonts/Bilder/Mermaid wirklich fertig (statt blinder 1000-ms-Wartezeit)
        await pdfWindow.webContents.executeJavaScript(PDF_SMART_WAIT_JS);

        // Generate PDF — Tagged + Outline jetzt auch im CLI-Pfad
        const pdfData = await pdfWindow.webContents.printToPDF({
            marginsType: 0,
            pageSize: 'A4',
            printBackground: true,
            landscape: false,
            preferCSSPageSize: true,
            generateTaggedPDF: true,
            generateDocumentOutline: true
        });

        pdfWindow.close();

        // Clean up temp file
        await fs.unlink(tempHtmlPath).catch(() => {});

        // Save PDF with same name as input file (mit Metadaten-Nachpass)
        const outputPath = absolutePath.replace(/\.(md|markdown)$/i, '.pdf');
        await fs.writeFile(outputPath, await finalizePdfMetadata(pdfData, { frontmatter, filePath: absolutePath }));

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
    // E4: Callouts auch im CLI-PDF — dieselbe Extension wie die Preview (callouts.js)
    marked.use(require('./callouts').createCalloutExtension());
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
        const mdFiles = files.filter(f => /\.(md|markdown)$/i.test(f));

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

                // Extract frontmatter — drives KaTeX + PDF template choice
                const { frontmatter, body: markdownBody } = extractFrontmatter(markdownContent);

                // D2: Server-side KaTeX for CLI batch mode (same as single-file CLI)
                const markdownWithMath = renderMermaidForCLI(renderMathForCLI(markdownBody));

                // Convert to HTML
                const htmlContent = marked.parse(markdownWithMath);

                // Convert images to base64
                currentFilePath = filePath;
                const htmlWithImages = await convertImagesToBase64(htmlContent);

                // Create temporary HTML file
                const tempHtmlPath = path.join(os.tmpdir(), `mrxdown-cli-${Date.now()}.html`);
                await fs.writeFile(tempHtmlPath, buildPdfHtml({ bodyContent: htmlWithImages, frontmatter }), 'utf-8');

                // Create hidden window for PDF generation
                const pdfWindow = new BrowserWindow({
                    width: 800,
                    height: 1000,
                    show: false,
                    webPreferences: { nodeIntegration: false, contextIsolation: true }
                });

                await pdfWindow.loadFile(tempHtmlPath);
                await pdfWindow.webContents.executeJavaScript(PDF_SMART_WAIT_JS);

                const pdfData = await pdfWindow.webContents.printToPDF({
                    marginsType: 0,
                    pageSize: 'A4',
                    printBackground: true,
                    landscape: false,
                    preferCSSPageSize: true,
                    generateTaggedPDF: true,
                    generateDocumentOutline: true
                });

                pdfWindow.close();
                await fs.unlink(tempHtmlPath).catch(() => {});

                const outputPath = filePath.replace(/\.(md|markdown)$/i, '.pdf');
                await fs.writeFile(outputPath, await finalizePdfMetadata(pdfData, { frontmatter, filePath }));

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
// In packaged mode process.argv has no script path at [1], so user args start at [1].
// In dev mode (electron main.js) they start at [2].
const args = process.argv.slice(app.isPackaged ? 1 : 2);
// --pdf flag explicitly requests PDF conversion (used by context menu and mrxdown.cmd wrapper)
const hasPdfFlag = args.includes('--pdf');
const cliArg = args.find(arg => !arg.startsWith('-'));

// Determine whether this invocation is headless PDF conversion or GUI mode
function isHeadlessMode() {
    if (!cliArg) return false;
    if (hasPdfFlag) return true;
    try {
        return fsSync.statSync(path.isAbsolute(cliArg) ? cliArg : path.resolve(process.cwd(), cliArg)).isDirectory();
    } catch { return false; }
}

if (isHeadlessMode()) {
    // Headless PDF conversion — skip single-instance lock so it always runs
    app.whenReady().then(() => {
        if (fsSync.existsSync(path.isAbsolute(cliArg) ? cliArg : path.resolve(process.cwd(), cliArg)) &&
            fsSync.statSync(path.isAbsolute(cliArg) ? cliArg : path.resolve(process.cwd(), cliArg)).isDirectory()) {
            runCLIBatch(cliArg);
        } else {
            runCLI(cliArg);
        }
    });
} else {
    // GUI mode — enforce single instance so file-opens go to the running window
    const gotSingleInstanceLock = app.requestSingleInstanceLock();
    if (!gotSingleInstanceLock) {
        app.quit();
    } else {
        app.on('second-instance', (event, commandLine, workingDirectory) => {
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.focus();
            }
            // Open the file passed to the second instance in the already-running editor.
            // Same argv-slicing convention as startup: packaged builds don't have the script path at [1].
            // Filter for markdown/text files explicitly instead of "first non-flag arg" to skip
            // any injected Electron flags (--enable-features=..., --enable-logging, etc.).
            const sliceStart = app.isPackaged ? 1 : 2;
            const secondArg = commandLine.slice(sliceStart).find(a => !a.startsWith('-') && /\.(md|markdown|txt)$/i.test(a));
            if (secondArg && mainWindow && !commandLine.includes('--pdf')) {
                const absPath = path.isAbsolute(secondArg) ? secondArg : path.resolve(workingDirectory, secondArg);
                fs.readFile(absPath, 'utf-8').then(content => {
                    mainWindow.webContents.send('file-opened', { filePath: absPath, content });
                    addToRecentFiles(absPath);
                }).catch(err => console.error('Error opening file from second instance:', err));
            }
        });

        if (cliArg) {
            // GUI mode with a file argument (file association / double-click)
            const absolutePath = path.isAbsolute(cliArg) ? cliArg : path.resolve(process.cwd(), cliArg);
            pendingOpenFile = absolutePath;
        }
        app.whenReady().then(() => {
            createWindow();
            // Prune missing recent files async — deferred so offline network drives don't block startup
            setTimeout(() => pruneMissingRecentFiles(), 1000);
            // Auto-update check: only in packaged builds, deferred so the window is interactive first.
            // Dev builds can't update themselves; CLI mode is already excluded by the surrounding else-branch.
            if (app.isPackaged) {
                setTimeout(() => initAutoUpdater().catch(err => console.warn('AutoUpdater init failed:', err.message)), 3000);
            }
        });
    }
}

// --- Auto-Updater Integration (electron-updater) ---
// Lazy-loaded so dev mode doesn't pull the dependency at startup.
let _autoUpdater = null;
let _autoUpdaterReady = false;

async function initAutoUpdater() {
    if (_autoUpdaterReady) return _autoUpdater;
    try {
        const mod = require('electron-updater');
        _autoUpdater = mod.autoUpdater;
    } catch (err) {
        console.warn('electron-updater not available:', err.message);
        return null;
    }

    _autoUpdater.autoDownload = true;
    _autoUpdater.autoInstallOnAppQuit = true;

    _autoUpdater.on('checking-for-update', () => console.log('[updater] checking…'));
    _autoUpdater.on('update-available', (info) => {
        console.log('[updater] update available:', info && info.version);
        if (mainWindow) mainWindow.webContents.send('updater-status', { state: 'available', version: info && info.version });
    });
    _autoUpdater.on('update-not-available', () => {
        console.log('[updater] up to date');
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updater-status', { state: 'none' });
    });
    _autoUpdater.on('error', (err) => {
        console.warn('[updater] error:', err && err.message);
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updater-status', { state: 'error', message: err && err.message });
    });
    _autoUpdater.on('download-progress', (p) => {
        if (mainWindow) mainWindow.webContents.send('updater-status', {
            state: 'downloading',
            percent: Math.round(p.percent),
            bytesPerSecond: p.bytesPerSecond
        });
    });
    _autoUpdater.on('update-downloaded', async (info) => {
        console.log('[updater] downloaded:', info && info.version);
        if (mainWindow) mainWindow.webContents.send('updater-status', { state: 'downloaded', version: info && info.version });
        const choice = await dialog.showMessageBox(mainWindow, {
            type: 'info',
            buttons: ['Jetzt neu starten', 'Später'],
            defaultId: 0,
            cancelId: 1,
            title: 'Update bereit',
            message: `MrxDown ${info && info.version} ist heruntergeladen.`,
            detail: 'Beim Neustart wird die neue Version installiert.'
        });
        if (choice.response === 0) {
            _autoUpdater.quitAndInstall();
        }
    });

    _autoUpdaterReady = true;
    try {
        await _autoUpdater.checkForUpdates();
    } catch (err) {
        console.warn('[updater] check failed:', err.message);
    }
    return _autoUpdater;
}

// Manual update check from the menu. Shows a dialog with the result instead of
// silently hoping the auto-download fires; user-initiated checks expect feedback.
async function triggerManualUpdateCheck() {
    if (!app.isPackaged) {
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update-Prüfung',
            message: 'Dev-Build',
            detail: 'Auto-Updates sind nur in installierten Builds verfügbar.'
        });
        return;
    }
    const upd = await initAutoUpdater();
    if (!upd) {
        dialog.showErrorBox('Update-Prüfung', 'Auto-Updater nicht verfügbar.');
        return;
    }
    try {
        const result = await upd.checkForUpdates();
        if (!result || !result.updateInfo || result.updateInfo.version === packageJson.version) {
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Update-Prüfung',
                message: `Du hast bereits die neueste Version (${packageJson.version}).`
            });
        }
        // If there IS an update, the auto-download + downloaded handler takes over.
    } catch (err) {
        dialog.showErrorBox('Update-Prüfung fehlgeschlagen', err.message);
    }
}

// Manual "check for updates" trigger (wired to menu)
ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged) {
        return { ok: false, reason: 'dev-build' };
    }
    const upd = await initAutoUpdater();
    if (!upd) return { ok: false, reason: 'updater-unavailable' };
    try {
        const result = await upd.checkForUpdates();
        return { ok: true, updateInfo: result && result.updateInfo };
    } catch (err) {
        return { ok: false, reason: 'check-failed', error: err.message };
    }
});

// A7: macOS file association — handle open-file before and after ready
app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
        // App is running — open file in new tab
        mainWindow.webContents.send('file-opened-external', { filePath });
        fs.readFile(filePath, 'utf-8').then(content => {
            mainWindow.webContents.send('file-opened', { filePath, content });
            addToRecentFiles(filePath);
        }).catch(err => console.error('Error opening file:', err));
    } else {
        // App not ready yet — remember for later
        pendingOpenFile = filePath;
    }
});

// A3: Crash handlers
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showErrorBox('Unerwarteter Fehler', `${error.message}\n\nDie App versucht weiterzulaufen.`);
    }
});

app.on('render-process-gone', (event, webContents, details) => {
    console.error('Render process gone:', details.reason);
    if (details.reason !== 'clean-exit') {
        // Recreate window on crash
        createWindow();
    }
});

app.on('window-all-closed', () => {
    // CLI batch mode opens + closes a hidden pdfWindow per file. After the first
    // close fires window-all-closed, app.quit() would kill the loop before iteration 2.
    // Each CLI path explicitly calls app.exit() when done, so we just opt out here.
    if (isHeadlessMode()) return;
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
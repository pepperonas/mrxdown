const { contextBridge, ipcRenderer } = require('electron');

// Idempotent listener registration: clears any prior listener on the channel before
// attaching a new one. Guards against listener accumulation on renderer reload
// (Ansicht > Neu laden), which previously caused events to fire N times after N reloads.
function onOnce(channel, callback) {
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, callback);
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // File operations
    openFile: () => ipcRenderer.send('open-file'),
    openFilePath: (filePath) => ipcRenderer.send('open-file-path', filePath),
    saveFile: (content, filePath) => ipcRenderer.send('save-file', { content, filePath }),
    saveFileAs: (content, filePath, tabTitle) => ipcRenderer.send('save-file-as', { content, filePath, tabTitle }),
    // Awaitable variants for save-on-close flow; resolve with { success, filePath } or { success: false, cancelled|error }
    saveFileSync: (content, filePath) => ipcRenderer.invoke('save-file-sync', { content, filePath }),
    saveFileAsSync: (content, filePath, tabTitle) => ipcRenderer.invoke('save-file-as-sync', { content, filePath, tabTitle }),
    exportHTML: (content, filePath) => ipcRenderer.send('export-html', { content, filePath }),
    printToPDF: (filePath) => ipcRenderer.send('print-to-pdf', { filePath }),
    batchPrintToPDF: (tabData) => ipcRenderer.send('batch-print-to-pdf', { tabData }),
    
    // File dialog handlers
    onFileOpened: (callback) => onOnce('file-opened', callback),
    onFileSaved: (callback) => onOnce('file-saved', callback),

    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
    
    // Recent files
    getRecentFiles: () => ipcRenderer.invoke('get-recent-files'),

    // Menu actions
    onMenuAction: (callback) => onOnce('menu-action', callback),
    
    // Update UI state
    updateWindowTitle: (title) => ipcRenderer.send('update-window-title', title),
    setDocumentEdited: (edited) => ipcRenderer.send('set-document-edited', edited),
    
    // File watching
    watchFile: (filePath) => ipcRenderer.send('watch-file', filePath),
    unwatchFile: (filePath) => ipcRenderer.send('unwatch-file', filePath),
    onFileChangedExternally: (callback) => onOnce('file-changed-externally', callback),
    onFileDeletedExternally: (callback) => onOnce('file-deleted-externally', callback),

    // Batch export
    onBatchExportPrepareTab: (callback) => onOnce('batch-export-prepare-tab', callback),
    sendBatchExportTabReady: (data) => ipcRenderer.send('batch-export-tab-ready', data),

    // Directory listing (for sidebar file tree)
    listDirectory: (dirPath) => ipcRenderer.invoke('list-directory', dirPath),

    // Image picker
    selectImage: () => ipcRenderer.invoke('select-image'),

    // Session recovery
    saveSession: (sessionData) => ipcRenderer.send('save-session', sessionData),
    getSession: () => ipcRenderer.invoke('get-session'),
    clearSession: () => ipcRenderer.send('clear-session'),

    // Shell operations
    openExternal: (url) => ipcRenderer.send('open-external', url),

    // A2: Electron dialog replacements
    showConfirmDialog: (options) => ipcRenderer.invoke('show-confirm-dialog', options),
    showAlertDialog: (options) => ipcRenderer.invoke('show-alert-dialog', options),

    // B3: File stats
    getFileStats: (filePath) => ipcRenderer.invoke('get-file-stats', filePath),

    // C2: Save clipboard image
    saveClipboardImage: (data) => ipcRenderer.invoke('save-clipboard-image', data),

    // C7: Copy image file
    copyImageFile: (data) => ipcRenderer.invoke('copy-image-file', data),

    // D4: PDF export with options
    printToPDFOptions: (data) => ipcRenderer.send('print-to-pdf-options', data),

    // Phase C: PDF template catalog for the export dialog
    getPdfTemplates: () => ipcRenderer.invoke('get-pdf-templates'),

    // K1: Export-Registry — Format-Katalog + generischer Export
    getExportFormats: () => ipcRenderer.invoke('get-export-formats'),
    exportDocument: (payload) => ipcRenderer.invoke('export-document', payload),

    // K6: DOCX-Import (mammoth im Main-Prozess)
    convertDocxToHtml: (payload) => ipcRenderer.invoke('convert-docx-to-html', payload),

    // E1: Wiki-Links — Vault-Index + Backlinks
    getVaultIndex: (vaultRoot) => ipcRenderer.invoke('get-vault-index', vaultRoot),
    findBacklinks: (payload) => ipcRenderer.invoke('find-backlinks', payload),

    // I1: KI-Assistent (opt-in) — Streaming über Events, Key write-only
    getAiActions: () => ipcRenderer.invoke('get-ai-actions'),
    aiRun: (payload) => ipcRenderer.send('ai-run', payload),
    aiCancel: (requestId) => ipcRenderer.send('ai-cancel', requestId),
    onAiChunk: (callback) => onOnce('ai-chunk', callback),
    onAiDone: (callback) => onOnce('ai-done', callback),
    onAiError: (callback) => onOnce('ai-error', callback),
    setAiApiKey: (key) => ipcRenderer.invoke('set-ai-api-key', key),
    hasAiApiKey: () => ipcRenderer.invoke('has-ai-api-key'),

    // Theme "System"
    getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
    onSystemThemeChanged: (callback) => onOnce('system-theme-changed', callback),

    // Auto-updater bridge
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    onUpdaterStatus: (callback) => onOnce('updater-status', callback)
});
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // File operations
    newFile: () => ipcRenderer.send('new-file'),
    openFile: () => ipcRenderer.send('open-file'),
    saveFile: (content, filePath) => ipcRenderer.send('save-file', { content, filePath }),
    saveFileAs: (content, filePath, tabTitle) => ipcRenderer.send('save-file-as', { content, filePath, tabTitle }),
    exportHTML: (content, filePath) => ipcRenderer.send('export-html', { content, filePath }),
    printToPDF: (filePath) => ipcRenderer.send('print-to-pdf', { filePath }),
    batchPrintToPDF: (tabData) => ipcRenderer.send('batch-print-to-pdf', { tabData }),
    
    // File dialog handlers
    onFileOpened: (callback) => ipcRenderer.on('file-opened', callback),
    onFileSaved: (callback) => ipcRenderer.on('file-saved', callback),
    onNewFile: (callback) => ipcRenderer.on('new-file-created', callback),
    
    // Window operations
    closeWindow: () => ipcRenderer.send('close-window'),
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    
    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
    
    // Recent files
    getRecentFiles: () => ipcRenderer.invoke('get-recent-files'),
    addRecentFile: (filePath) => ipcRenderer.send('add-recent-file', filePath),
    
    // Drag and drop
    onFilesDropped: (callback) => ipcRenderer.on('files-dropped', callback),
    
    // Menu actions
    onMenuAction: (callback) => ipcRenderer.on('menu-action', callback),
    
    // Update UI state
    updateWindowTitle: (title) => ipcRenderer.send('update-window-title', title),
    setDocumentEdited: (edited) => ipcRenderer.send('set-document-edited', edited),
    
    // File watching
    watchFile: (filePath) => ipcRenderer.send('watch-file', filePath),
    unwatchFile: (filePath) => ipcRenderer.send('unwatch-file', filePath),
    onFileChangedExternally: (callback) => ipcRenderer.on('file-changed-externally', callback),
    
    // Batch export
    onBatchExportPrepareTab: (callback) => ipcRenderer.on('batch-export-prepare-tab', callback),
    sendBatchExportTabReady: (data) => ipcRenderer.send('batch-export-tab-ready', data)
});
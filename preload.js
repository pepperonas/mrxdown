const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // File operations
    newFile: () => ipcRenderer.send('new-file'),
    openFile: () => ipcRenderer.send('open-file'),
    saveFile: (content, filePath) => ipcRenderer.send('save-file', { content, filePath }),
    saveFileAs: (content) => ipcRenderer.send('save-file-as', { content }),
    exportHTML: (content, filePath) => ipcRenderer.send('export-html', { content, filePath }),
    printToPDF: (filePath) => ipcRenderer.send('print-to-pdf', { filePath }),
    
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
    setDocumentEdited: (edited) => ipcRenderer.send('set-document-edited', edited)
});
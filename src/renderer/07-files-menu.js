// MrxDown Renderer — Modul 07-files-menu.js
// Menü-Aktionen, Datei öffnen/speichern, Sidebar-Dateibaum
// Classic Script (kein ESM): Top-Level-Deklarationen sind global über alle
// Renderer-Module hinweg; die Ladereihenfolge in index.html ist verbindlich.

// Menu Actions
function handleMenuAction(action, data = {}) {
    switch (action) {
        case 'new-file':
            createNewTab();
            break;
        case 'open-file':
            if (window.electronAPI) {
                window.electronAPI.openFile();
            }
            break;
        case 'save-file':
            saveCurrentFile();
            break;
        case 'save-file-as':
            saveCurrentFileAs();
            break;
        case 'export-html':
            exportHTML();
            break;
        case 'export-pdf':
            exportPDF();
            break;
        case 'batch-export-pdf':
            batchExportPDF();
            break;
        case 'format-bold':
            formatBold();
            break;
        case 'format-italic':
            formatItalic();
            break;
        case 'format-code':
            formatCode();
            break;
        case 'insert-link':
            insertLink();
            break;
        case 'insert-image':
            insertImage();
            break;
        case 'insert-table':
            showTableEditor();
            break;
        case 'heading-1':
            insertHeading(1);
            break;
        case 'heading-2':
            insertHeading(2);
            break;
        case 'heading-3':
            insertHeading(3);
            break;
        case 'find':
            showSearchDialog();
            break;
        case 'replace':
            showReplaceDialog();
            break;
        case 'toggle-sidebar':
            toggleSidebar();
            break;
        case 'open-recent':
            if (data.filePath) {
                openRecentFile(data.filePath);
            }
            break;
        case 'delete-line':
            deleteLine();
            return; // deleteLine calls handleEditorInput
        case 'duplicate-line':
            duplicateLine();
            return;
        case 'move-line-up':
            moveLineUp();
            return;
        case 'move-line-down':
            moveLineDown();
            return;
        case 'toggle-comment':
            toggleComment();
            return;
        case 'select-line':
            selectCurrentLine();
            return;
        case 'show-about':
            showAboutDialog(data.version);
            break;
        case 'undo':
            if (editor && editor.undo) editor.undo();
            break;
        case 'redo':
            if (editor && editor.redo) editor.redo();
            break;
        case 'print-to-pdf':
            exportPDF();
            break;
    }
    // H1 fix: no blanket handleEditorInput() here — it marked tabs as modified for
    // non-mutating actions (new tab, open, search, about, export …). Text-mutating
    // actions already trigger it through the editor's own input event.
}

// File Operations
function saveCurrentFile() {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (!activeTab) return;
    
    if (window.electronAPI) {
        window.electronAPI.saveFile(editor.value, activeTab.filePath);
    }
}

function saveCurrentFileAs() {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (window.electronAPI) {
        window.electronAPI.saveFileAs(editor.value, activeTab ? activeTab.filePath : null, activeTab ? activeTab.title : null);
    }
}

async function openFileContent(filePath, content) {
    // Warn about very large files
    if (content.length > 1024 * 1024) { // > 1MB
        const proceed = await showConfirm(`Die Datei ist sehr groß (${(content.length / 1024 / 1024).toFixed(1)} MB). Das Öffnen könnte langsam sein. Fortfahren?`);
        if (!proceed) return;
    }

    const existingTab = tabs.find(tab => tab.filePath === filePath);

    if (existingTab) {
        switchTab(existingTab.id);
    } else {
        const tab = createNewTab(content, filePath);
        // For large files (>100KB), disable live preview by default
        if (content.length > 100 * 1024) {
            tab.largeFile = true;
        }
    }
    
    // Start watching the file for external changes
    if (filePath && window.electronAPI) {
        console.log('Starting file watch for:', filePath);
        window.electronAPI.watchFile(filePath);

        // Load the file tree for the directory of the opened file
        const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
        const dirPath = lastSep >= 0 ? filePath.substring(0, lastSep) : '';
        if (dirPath) {
            loadFileTree(dirPath);
        }
    }
}

function openRecentFile(filePath) {
    const existingTab = tabs.find(tab => tab.filePath === filePath);
    if (existingTab) {
        switchTab(existingTab.id);
        return;
    }
    if (window.electronAPI) {
        window.electronAPI.openFilePath(filePath);
    }
}

// E3: Sidebar File Tree — fully recursive with lazy loading and active file highlighting
let fileTreeRootDir = '';

function getFileIcon(name, isDirectory) {
    if (isDirectory) return 'folder-closed';
    if (name.endsWith('.md') || name.endsWith('.markdown')) return 'file-text';
    return 'file';
}

async function loadFileTree(dirPath) {
    if (!window.electronAPI || !window.electronAPI.listDirectory) return;
    const fileExplorer = document.getElementById('fileExplorer');
    if (!fileExplorer) return;

    fileTreeRootDir = dirPath;

    try {
        const entries = await window.electronAPI.listDirectory(dirPath);
        fileExplorer.textContent = '';
        renderFileTreeEntries(entries, fileExplorer, 0);
        highlightActiveFileInTree();
    } catch (error) {
        console.error('Error loading file tree:', error);
    }
}

function renderFileTreeEntries(entries, container, depth) {
    for (const entry of entries) {
        if (entry.isDirectory) {
            renderFolderNode(entry, container, depth);
        } else {
            renderFileNode(entry, container, depth);
        }
    }
}

function renderFolderNode(entry, container, depth) {
    const item = document.createElement('div');
    item.className = 'file-item file-tree-folder';
    item.style.paddingLeft = (8 + depth * 16) + 'px';

    const icon = document.createElement('div');
    icon.className = 'file-icon';
    // Safe: getIcon() returns static SVG from hardcoded ICON_PATHS
    icon.innerHTML = getIcon('folder-closed', 14);

    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = entry.name;

    item.appendChild(icon);
    item.appendChild(name);

    const children = document.createElement('div');
    children.className = 'file-tree-children collapsed';
    let loaded = false;

    item.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!loaded) {
            try {
                const subEntries = await window.electronAPI.listDirectory(entry.path);
                renderFileTreeEntries(subEntries, children, depth + 1);
                loaded = true;
            } catch (err) {
                console.error('Error loading subdirectory:', err);
                return;
            }
        }
        children.classList.toggle('collapsed');
        // Safe: getIcon() returns static SVG from hardcoded ICON_PATHS
        icon.innerHTML = children.classList.contains('collapsed') ? getIcon('folder-closed', 14) : getIcon('folder-open', 14);
    });

    container.appendChild(item);
    container.appendChild(children);
}

function renderFileNode(entry, container, depth) {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.dataset.filepath = entry.path;
    item.style.paddingLeft = (8 + depth * 16) + 'px';

    const icon = document.createElement('div');
    icon.className = 'file-icon';
    // Safe: getIcon() returns static SVG from hardcoded ICON_PATHS
    icon.innerHTML = getIcon(getFileIcon(entry.name, false), 14);

    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = entry.name;

    item.appendChild(icon);
    item.appendChild(name);

    item.addEventListener('click', (e) => {
        e.stopPropagation();
        window.electronAPI.openFilePath(entry.path);
    });

    container.appendChild(item);
}

function highlightActiveFileInTree() {
    const activeTab = tabs.find(t => t.id === activeTabId);
    const activeFilePath = activeTab ? activeTab.filePath : null;
    const fileExplorer = document.getElementById('fileExplorer');
    if (!fileExplorer) return;

    const fileItems = fileExplorer.querySelectorAll('.file-item[data-filepath]');
    fileItems.forEach(item => {
        if (item.dataset.filepath === activeFilePath) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function refreshFileTree() {
    if (fileTreeRootDir) {
        loadFileTree(fileTreeRootDir);
    } else {
        // Try to determine root from active tab
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab && activeTab.filePath) {
            const lastSep = Math.max(activeTab.filePath.lastIndexOf('/'), activeTab.filePath.lastIndexOf('\\'));
            if (lastSep >= 0) {
                loadFileTree(activeTab.filePath.substring(0, lastSep));
            }
        }
    }
}

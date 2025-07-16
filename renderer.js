// Application State
let tabs = [];
let activeTabId = 0;
let nextTabId = 1;
let isZenMode = false;
let sidebarVisible = true;
let lineNumbers = false;
let wordWrap = true;
let currentViewMode = 'split';
let isResizing = false;
let startX = 0;
let startWidth = 0;
let isScrollSyncing = false;
let settings = {
    theme: 'dark',
    fontSize: 14,
    autoSave: false,
    autoSaveInterval: 5,
    showLineNumbers: false,
    wordWrap: true,
    tabSize: 4,
    syncScroll: true
};

// DOM Elements
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const charCount = document.getElementById('charCount');
const wordCount = document.getElementById('wordCount');
const lineCount = document.getElementById('lineCount');
const fileName = document.getElementById('fileName');
const tabBar = document.getElementById('tabBar');
const sidebar = document.getElementById('sidebar');
const dropZone = document.getElementById('dropZone');
const fileExplorer = document.getElementById('fileExplorer');
const contextMenu = document.getElementById('contextMenu');
const aboutModal = document.getElementById('aboutModal');
const tableEditor = document.getElementById('tableEditor');

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    
    // Make functions globally available for onclick handlers
    window.handleMenuAction = handleMenuAction;
    window.toggleSidebar = toggleSidebar;
    window.toggleZenMode = toggleZenMode;
    window.closeTab = closeTab;
    window.toggleLineNumbers = toggleLineNumbers;
    window.toggleWordWrap = toggleWordWrap;
    window.showSettings = showSettings;
    window.showAboutDialog = showAboutDialog;
    window.closeAboutDialog = closeAboutDialog;
    window.insertTable = insertTable;
    window.closeTableEditor = closeTableEditor;
    window.setViewMode = setViewMode;
    window.toggleScrollSync = toggleScrollSync;
});

function initializeApp() {
    // Create initial tab
    createNewTab();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load settings
    loadSettings();
    
    // Setup drag and drop
    setupDragAndDrop();
    
    // Setup IPC listeners
    setupIPCListeners();
    
    // Setup tooltip delay
    setupTooltipDelay();
    
    // Setup external links
    handleExternalLinks();
    
    // Setup resizable divider
    setupResizableDivider();
    
    // Initial render
    renderMarkdown();
}

function setupEventListeners() {
    // Editor events
    editor.addEventListener('input', handleEditorInput);
    editor.addEventListener('keydown', handleEditorKeydown);
    editor.addEventListener('scroll', syncScroll);
    
    // Preview events
    preview.addEventListener('scroll', syncScroll);
    
    // Window events
    window.addEventListener('resize', handleWindowResize);
    
    // Global keyboard shortcuts
    document.addEventListener('keydown', handleGlobalShortcuts);
    
    // Context menu events
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleDocumentClick);
}

function setupIPCListeners() {
    if (window.electronAPI) {
        window.electronAPI.onFileOpened((event, data) => {
            openFileContent(data.filePath, data.content);
        });
        
        window.electronAPI.onFileSaved((event, data) => {
            handleFileSaved(data.filePath);
        });
        
        window.electronAPI.onNewFile((event, data) => {
            createNewTab();
        });
        
        window.electronAPI.onMenuAction((event, data) => {
            handleMenuAction(data.action, data);
        });
    }
}

function setupDragAndDrop() {
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Highlight drop area
    ['dragenter', 'dragover'].forEach(eventName => {
        document.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        document.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight(e) {
        dropZone.classList.add('active');
    }
    
    function unhighlight(e) {
        dropZone.classList.remove('active');
    }
    
    // Handle dropped files
    document.addEventListener('drop', handleDrop, false);
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        Array.from(files).forEach(file => {
            if (file.type === 'text/markdown' || file.type === 'text/plain' || file.name.endsWith('.md')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    openFileContent(file.name, event.target.result);
                };
                reader.readAsText(file);
            }
        });
    }
}

// Tab Management
function createNewTab(content = '', filePath = null) {
    const tab = {
        id: nextTabId++,
        title: filePath ? getFileName(filePath) : 'Unbenannt',
        content: content,
        filePath: filePath,
        isModified: false,
        cursorPosition: 0,
        scrollPosition: 0
    };
    
    tabs.push(tab);
    activeTabId = tab.id;
    
    renderTabs();
    loadTabContent(tab.id);
    
    return tab;
}

function closeTab(tabId) {
    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) return;
    
    const tab = tabs[tabIndex];
    
    if (tab.isModified) {
        const shouldSave = confirm('Ungespeicherte Änderungen gehen verloren. Trotzdem schließen?');
        if (!shouldSave) return;
    }
    
    tabs.splice(tabIndex, 1);
    
    if (tabs.length === 0) {
        createNewTab();
    } else {
        if (activeTabId === tabId) {
            activeTabId = tabs[Math.max(0, tabIndex - 1)].id;
        }
        renderTabs();
        loadTabContent(activeTabId);
    }
}

function switchTab(tabId) {
    if (activeTabId === tabId) return;
    
    // Save current tab state
    saveCurrentTabState();
    
    // Switch to new tab
    activeTabId = tabId;
    loadTabContent(tabId);
    renderTabs();
}

function saveCurrentTabState() {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (activeTab) {
        activeTab.content = editor.value;
        activeTab.cursorPosition = editor.selectionStart;
        activeTab.scrollPosition = editor.scrollTop;
    }
}

function loadTabContent(tabId) {
    const tab = tabs.find(tab => tab.id === tabId);
    if (!tab) return;
    
    editor.value = tab.content;
    editor.selectionStart = tab.cursorPosition;
    editor.selectionEnd = tab.cursorPosition;
    editor.scrollTop = tab.scrollPosition;
    
    fileName.textContent = tab.title;
    
    if (window.electronAPI) {
        window.electronAPI.updateWindowTitle(tab.title + (tab.isModified ? ' •' : ''));
    }
    
    renderMarkdown();
}

function renderTabs() {
    tabBar.innerHTML = '';
    
    tabs.forEach(tab => {
        const tabElement = document.createElement('div');
        tabElement.className = `tab ${tab.id === activeTabId ? 'active' : ''} ${tab.isModified ? 'unsaved' : ''}`;
        tabElement.setAttribute('data-tab-id', tab.id);
        tabElement.onclick = () => switchTab(tab.id);
        
        tabElement.innerHTML = `
            <div class="tab-title">${tab.title}</div>
            <div class="tab-close" onclick="event.stopPropagation(); closeTab(${tab.id})">×</div>
        `;
        
        tabBar.appendChild(tabElement);
    });
}

function markTabAsModified(tabId, isModified) {
    const tab = tabs.find(tab => tab.id === tabId);
    if (tab) {
        tab.isModified = isModified;
        renderTabs();
        
        if (window.electronAPI) {
            window.electronAPI.setDocumentEdited(isModified);
        }
    }
}

// Editor Functions
function handleEditorInput() {
    markTabAsModified(activeTabId, true);
    renderMarkdown();
    updateStats();
}

function handleEditorKeydown(e) {
    // Handle Tab key
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const spaces = '    '; // 4 spaces
        
        editor.value = editor.value.substring(0, start) + spaces + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + spaces.length;
        
        handleEditorInput();
    }
    
    // Handle Ctrl+Enter for new line
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        insertAtCursor('\n');
        handleEditorInput();
    }
}

function renderMarkdown() {
    const markdown = editor.value;
    const html = marked.parse(markdown);
    preview.innerHTML = DOMPurify.sanitize(html);
}

function updateStats() {
    const text = editor.value;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text.split('\n').length;
    
    charCount.textContent = `${chars} Zeichen`;
    wordCount.textContent = `${words} Wörter`;
    lineCount.textContent = `${lines} Zeilen`;
}

function syncScroll(event) {
    // Prevent sync during resizing, if already syncing, not in split mode, or sync disabled
    if (isResizing || isScrollSyncing || currentViewMode !== 'split' || !settings.syncScroll) {
        return;
    }
    
    const sourceElement = event.target;
    const targetElement = sourceElement === editor ? preview : editor;
    
    if (sourceElement && targetElement) {
        // Check if elements have scrollable content
        const sourceScrollHeight = sourceElement.scrollHeight - sourceElement.clientHeight;
        const targetScrollHeight = targetElement.scrollHeight - targetElement.clientHeight;
        
        if (sourceScrollHeight <= 0 || targetScrollHeight <= 0) {
            return;
        }
        
        // Set sync flag to prevent infinite loops
        isScrollSyncing = true;
        
        const scrollRatio = sourceElement.scrollTop / sourceScrollHeight;
        const targetScrollTop = scrollRatio * targetScrollHeight;
        
        // Only sync if there's a meaningful difference
        if (Math.abs(targetElement.scrollTop - targetScrollTop) > 5) {
            targetElement.scrollTop = targetScrollTop;
        }
        
        // Reset sync flag after a short delay
        setTimeout(() => {
            isScrollSyncing = false;
        }, 50);
    }
}

// Formatting Functions
function insertAtCursor(text) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const before = editor.value.substring(0, start);
    const after = editor.value.substring(end);
    
    editor.value = before + text + after;
    editor.selectionStart = editor.selectionEnd = start + text.length;
    editor.focus();
}

function wrapSelection(prefix, suffix = '') {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.substring(start, end);
    
    if (selectedText) {
        const wrappedText = prefix + selectedText + suffix;
        editor.value = editor.value.substring(0, start) + wrappedText + editor.value.substring(end);
        editor.selectionStart = start + prefix.length;
        editor.selectionEnd = start + prefix.length + selectedText.length;
    } else {
        insertAtCursor(prefix + suffix);
        editor.selectionStart = editor.selectionEnd = start + prefix.length;
    }
    
    editor.focus();
}

function formatBold() {
    wrapSelection('**', '**');
}

function formatItalic() {
    wrapSelection('*', '*');
}

function formatCode() {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.substring(start, end);
    
    if (selectedText.includes('\n')) {
        wrapSelection('```\n', '\n```');
    } else {
        wrapSelection('`', '`');
    }
}

function insertLink() {
    const url = prompt('URL eingeben:');
    if (url) {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);
        const linkText = selectedText || 'Link Text';
        
        insertAtCursor(`[${linkText}](${url})`);
    }
}

function insertHeading(level) {
    const start = editor.selectionStart;
    const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = editor.value.indexOf('\n', start);
    const currentLine = editor.value.substring(lineStart, lineEnd === -1 ? editor.value.length : lineEnd);
    
    const headingPrefix = '#'.repeat(level) + ' ';
    const newLine = currentLine.replace(/^#+\s*/, '') || 'Überschrift';
    
    editor.value = editor.value.substring(0, lineStart) + headingPrefix + newLine + editor.value.substring(lineEnd === -1 ? editor.value.length : lineEnd);
    editor.selectionStart = editor.selectionEnd = lineStart + headingPrefix.length + newLine.length;
    editor.focus();
}

function insertImage() {
    const url = prompt('Bild-URL eingeben:');
    if (url) {
        const alt = prompt('Alt-Text eingeben:') || 'Bild';
        insertAtCursor(`![${alt}](${url})`);
    }
}

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
            showFindDialog();
            break;
        case 'replace':
            showReplaceDialog();
            break;
        case 'toggle-sidebar':
            toggleSidebar();
            break;
        case 'toggle-zen-mode':
            toggleZenMode();
            break;
        case 'open-recent':
            if (data.filePath) {
                openRecentFile(data.filePath);
            }
            break;
        case 'show-about':
            showAboutDialog();
            break;
    }
    
    handleEditorInput();
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
    if (window.electronAPI) {
        window.electronAPI.saveFileAs(editor.value);
    }
}

function openFileContent(filePath, content) {
    const existingTab = tabs.find(tab => tab.filePath === filePath);
    
    if (existingTab) {
        switchTab(existingTab.id);
    } else {
        createNewTab(content, filePath);
    }
}

function handleFileSaved(filePath) {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (activeTab) {
        activeTab.filePath = filePath;
        activeTab.title = getFileName(filePath);
        activeTab.isModified = false;
        
        renderTabs();
        fileName.textContent = activeTab.title;
        
        if (window.electronAPI) {
            window.electronAPI.updateWindowTitle(activeTab.title);
        }
    }
}

function exportHTML() {
    const htmlContent = generateHTMLExport();
    if (window.electronAPI) {
        window.electronAPI.exportHTML(htmlContent);
    }
}

function generateHTMLExport() {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    const title = activeTab ? activeTab.title : 'Export';
    
    return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            color: #333;
            line-height: 1.6;
        }
        h1, h2, h3 { margin-top: 24px; margin-bottom: 16px; }
        h1 { border-bottom: 2px solid #eee; padding-bottom: 8px; }
        code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
        }
        pre {
            background: #f4f4f4;
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
        }
        blockquote {
            border-left: 4px solid #ddd;
            padding-left: 16px;
            color: #666;
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
        }
        th {
            background: #f4f4f4;
        }
    </style>
</head>
<body>
    ${preview.innerHTML}
</body>
</html>`;
}

// UI Functions
function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    sidebar.classList.toggle('hidden', !sidebarVisible);
}

function toggleZenMode() {
    isZenMode = !isZenMode;
    document.body.classList.toggle('zen-mode', isZenMode);
}

function toggleLineNumbers() {
    lineNumbers = !lineNumbers;
    // Implementation would require a more advanced editor
    console.log('Line numbers toggled:', lineNumbers);
}

function toggleWordWrap() {
    wordWrap = !wordWrap;
    editor.style.whiteSpace = wordWrap ? 'pre-wrap' : 'pre';
}

function toggleScrollSync() {
    settings.syncScroll = !settings.syncScroll;
    const toggle = document.getElementById('scrollSyncToggle');
    
    if (settings.syncScroll) {
        toggle.style.opacity = '1';
        toggle.setAttribute('data-tooltip', 'Scroll-Synchronisation ausschalten');
    } else {
        toggle.style.opacity = '0.5';
        toggle.setAttribute('data-tooltip', 'Scroll-Synchronisation einschalten');
    }
    
    saveSettings();
}

function showFindDialog() {
    const searchText = prompt('Suchen nach:');
    if (searchText) {
        const content = editor.value;
        const index = content.indexOf(searchText);
        if (index !== -1) {
            editor.selectionStart = index;
            editor.selectionEnd = index + searchText.length;
            editor.focus();
        } else {
            alert('Text nicht gefunden');
        }
    }
}

function showReplaceDialog() {
    const searchText = prompt('Suchen nach:');
    if (!searchText) return;
    
    const replaceText = prompt('Ersetzen durch:');
    if (replaceText === null) return;
    
    const content = editor.value;
    const newContent = content.replace(new RegExp(searchText, 'g'), replaceText);
    editor.value = newContent;
    handleEditorInput();
}

function showSettings() {
    // Simple settings dialog (in a real app, this would be a proper modal)
    const fontSize = prompt('Schriftgröße (14-24):', settings.fontSize);
    if (fontSize && !isNaN(fontSize)) {
        settings.fontSize = parseInt(fontSize);
        editor.style.fontSize = settings.fontSize + 'px';
        
        if (window.electronAPI) {
            window.electronAPI.saveSettings(settings);
        }
    }
}

// Global Shortcuts
function handleGlobalShortcuts(e) {
    if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
            case 'n':
                if (e.shiftKey) {
                    // Cmd+Shift+N - New window (handled by menu)
                    return;
                }
                e.preventDefault();
                handleMenuAction('new-file');
                break;
            case 'o':
                e.preventDefault();
                handleMenuAction('open-file');
                break;
            case 's':
                e.preventDefault();
                if (e.shiftKey) {
                    handleMenuAction('save-file-as');
                } else {
                    handleMenuAction('save-file');
                }
                break;
            case 'b':
                e.preventDefault();
                formatBold();
                break;
            case 'i':
                e.preventDefault();
                formatItalic();
                break;
            case 'k':
                e.preventDefault();
                insertLink();
                break;
            case 't':
                e.preventDefault();
                showTableEditor();
                break;
            case '`':
                e.preventDefault();
                formatCode();
                break;
            case 'f':
                e.preventDefault();
                showFindDialog();
                break;
            case 'h':
                e.preventDefault();
                showReplaceDialog();
                break;
            case '\\':
                e.preventDefault();
                toggleSidebar();
                break;
            case 'z':
                if (e.shiftKey) {
                    e.preventDefault();
                    toggleZenMode();
                }
                break;
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
                e.preventDefault();
                insertHeading(parseInt(e.key));
                break;
            case 'e':
                if (e.shiftKey) {
                    e.preventDefault();
                    exportHTML();
                }
                break;
            case 'p':
                if (e.shiftKey) {
                    e.preventDefault();
                    exportPDF();
                }
                break;
            case 'Tab':
                e.preventDefault();
                // Cycle through tabs
                const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
                const nextIndex = e.shiftKey ? 
                    (currentIndex - 1 + tabs.length) % tabs.length : 
                    (currentIndex + 1) % tabs.length;
                switchTab(tabs[nextIndex].id);
                break;
        }
    }
    
    // F11 for fullscreen
    if (e.key === 'F11') {
        e.preventDefault();
        toggleZenMode();
    }
}

// Utility Functions
function getFileName(filePath) {
    if (!filePath) return 'Unbenannt';
    return filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
}

function handleWindowResize() {
    // Handle responsive behavior
    if (window.innerWidth < 768) {
        sidebar.classList.add('hidden');
        sidebarVisible = false;
    }
}

async function loadSettings() {
    try {
        if (window.electronAPI) {
            const loadedSettings = await window.electronAPI.getSettings();
            settings = { ...settings, ...loadedSettings };
            
            // Apply settings
            editor.style.fontSize = settings.fontSize + 'px';
            editor.style.whiteSpace = settings.wordWrap ? 'pre-wrap' : 'pre';
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Auto-save functionality
let autoSaveTimeout;
function scheduleAutoSave() {
    if (settings.autoSave) {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            saveCurrentFile();
        }, settings.autoSaveInterval * 1000);
    }
}

// Context Menu Functions
function handleContextMenu(e) {
    e.preventDefault();
    
    contextMenu.style.left = e.pageX + 'px';
    contextMenu.style.top = e.pageY + 'px';
    contextMenu.classList.add('visible');
}

function handleDocumentClick(e) {
    if (!contextMenu.contains(e.target)) {
        contextMenu.classList.remove('visible');
    }
    
    if (!tableEditor.contains(e.target) && !e.target.closest('[data-tooltip="Tabelle (⌘T)"]')) {
        closeTableEditor();
    }
    
    if (!aboutModal.contains(e.target) && aboutModal.classList.contains('visible')) {
        closeAboutDialog();
    }
}

// About Dialog Functions
function showAboutDialog() {
    contextMenu.classList.remove('visible');
    aboutModal.classList.add('visible');
}

function closeAboutDialog() {
    aboutModal.classList.remove('visible');
}

// Table Editor Functions
function showTableEditor() {
    const tableButton = document.querySelector('[data-tooltip="Tabelle (⌘T)"]');
    if (tableButton) {
        const rect = tableButton.getBoundingClientRect();
        tableEditor.style.left = rect.left + 'px';
        tableEditor.style.top = (rect.bottom + 5) + 'px';
        tableEditor.classList.add('visible');
        
        // Focus on first input
        document.getElementById('tableRows').focus();
    }
}

function closeTableEditor() {
    tableEditor.classList.remove('visible');
}

function insertTable() {
    const rows = parseInt(document.getElementById('tableRows').value) || 3;
    const cols = parseInt(document.getElementById('tableCols').value) || 3;
    
    if (rows < 1 || rows > 20 || cols < 1 || cols > 10) {
        alert('Ungültige Tabellengröße. Zeilen: 1-20, Spalten: 1-10');
        return;
    }
    
    let table = '\n';
    
    // Header row
    table += '|';
    for (let col = 1; col <= cols; col++) {
        table += ` Spalte ${col} |`;
    }
    table += '\n';
    
    // Separator row
    table += '|';
    for (let col = 1; col <= cols; col++) {
        table += ' --- |';
    }
    table += '\n';
    
    // Data rows
    for (let row = 1; row < rows; row++) {
        table += '|';
        for (let col = 1; col <= cols; col++) {
            table += ` Zeile ${row} |`;
        }
        table += '\n';
    }
    
    table += '\n';
    
    insertAtCursor(table);
    closeTableEditor();
    handleEditorInput();
}

// Enhanced tooltip delay
function setupTooltipDelay() {
    const tooltips = document.querySelectorAll('.tooltip');
    
    tooltips.forEach(tooltip => {
        let timeoutId;
        
        tooltip.addEventListener('mouseenter', () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                tooltip.classList.add('show-tooltip');
            }, 500);
        });
        
        tooltip.addEventListener('mouseleave', () => {
            clearTimeout(timeoutId);
            tooltip.classList.remove('show-tooltip');
        });
    });
}

// Enhanced external link handling
function handleExternalLinks() {
    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' && e.target.target === '_blank') {
            e.preventDefault();
            if (window.electronAPI && window.require) {
                // In Electron, open external links in default browser
                window.require('electron').shell.openExternal(e.target.href);
            } else {
                // In browser environment or fallback
                window.open(e.target.href, '_blank');
            }
        }
    });
}

// View Mode Management
function setViewMode(mode) {
    currentViewMode = mode;
    const editorContainer = document.querySelector('.editor-container');
    
    // Remove existing view mode classes
    editorContainer.classList.remove('view-mode-editor', 'view-mode-split', 'view-mode-preview');
    
    // Add new view mode class
    editorContainer.classList.add(`view-mode-${mode}`);
    
    // Update button states
    document.querySelectorAll('[id^="viewMode"]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`viewMode${mode.charAt(0).toUpperCase() + mode.slice(1)}`).classList.add('active');
    
    // Adjust editor dimensions
    setTimeout(() => {
        if (editor) {
            editor.style.height = 'auto';
            editor.style.height = editor.scrollHeight + 'px';
        }
    }, 100);
}

// Resizable Divider Setup
function setupResizableDivider() {
    const divider = document.getElementById('resizableDivider');
    const editorPane = document.getElementById('editorPane');
    const previewPane = document.getElementById('previewPane');
    
    if (!divider || !editorPane || !previewPane) return;
    
    divider.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isResizing = true;
        startX = e.clientX;
        startWidth = editorPane.offsetWidth;
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        // Add resizing cursor to body
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });
    
    function handleMouseMove(e) {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const containerWidth = editorPane.parentElement.offsetWidth;
        const dividerWidth = divider.offsetWidth;
        
        // Calculate new width as percentage
        const newWidth = startWidth + deltaX;
        const minWidth = 200; // Minimum width for each pane
        const maxWidth = containerWidth - dividerWidth - minWidth;
        
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            const percentage = (newWidth / containerWidth) * 100;
            const previewPercentage = ((containerWidth - newWidth - dividerWidth) / containerWidth) * 100;
            
            editorPane.style.flex = `0 0 ${percentage}%`;
            previewPane.style.flex = `0 0 ${previewPercentage}%`;
        }
    }
    
    function handleMouseUp() {
        isResizing = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        
        // Remove resizing cursor
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
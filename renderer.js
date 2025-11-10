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

// DOM Elements - will be initialized in initializeApp
let editor, preview, charCount, wordCount, lineCount, fileName, tabBar, sidebar, dropZone, fileExplorer, contextMenu, aboutModal, tableEditor, searchModal, replaceModal;

// Search state
let currentSearchTerm = '';
let searchMatches = [];
let currentMatchIndex = -1;

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
    window.showSearchDialog = showSearchDialog;
    window.closeSearchDialog = closeSearchDialog;
    window.showReplaceDialog = showReplaceDialog;
    window.closeReplaceDialog = closeReplaceDialog;
    window.findNext = findNext;
    window.findPrevious = findPrevious;
    window.replaceNext = replaceNext;
    window.replaceAll = replaceAll;
    window.findNextReplace = findNextReplace;
});

function initializeApp() {
    // Initialize DOM elements
    editor = document.getElementById('editor');
    preview = document.getElementById('preview');
    charCount = document.getElementById('charCount');
    wordCount = document.getElementById('wordCount');
    lineCount = document.getElementById('lineCount');
    fileName = document.getElementById('fileName');
    tabBar = document.getElementById('tabBar');
    sidebar = document.getElementById('sidebar');
    dropZone = document.getElementById('dropZone');
    fileExplorer = document.getElementById('fileExplorer');
    contextMenu = document.getElementById('contextMenu');
    aboutModal = document.getElementById('aboutModal');
    tableEditor = document.getElementById('tableEditor');
    searchModal = document.getElementById('searchModal');
    replaceModal = document.getElementById('replaceModal');
    
    // Check if critical elements exist
    if (!editor || !preview || !tabBar) {
        console.error('Critical DOM elements not found');
        return;
    }
    
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
    if (editor) {
        editor.addEventListener('input', handleEditorInput);
        editor.addEventListener('keydown', handleEditorKeydown);
        editor.addEventListener('scroll', syncScroll);
    }
    
    // Preview events
    if (preview) {
        preview.addEventListener('scroll', syncScroll);
    }
    
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
        
        window.electronAPI.onFileChangedExternally((event, data) => {
            handleFileChangedExternally(data.filePath, data.content);
        });
        
        window.electronAPI.onBatchExportPrepareTab((event, data) => {
            handleBatchExportPrepareTab(data.filePath, data.content);
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
                    // Use file.path for the full path, fallback to file.name if not available
                    const filePath = file.path || file.name;
                    console.log('Drag & Drop file:', filePath);
                    openFileContent(filePath, event.target.result);
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
    
    // Stop watching the file if it has one
    if (tab.filePath && window.electronAPI) {
        console.log('Stopping file watch for closed tab:', tab.filePath);
        window.electronAPI.unwatchFile(tab.filePath);
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
    
    // Update UI based on file type
    updateUIForFileType(tab);
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
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    const isTextFile = activeTab && activeTab.filePath && activeTab.filePath.toLowerCase().endsWith('.txt');

    if (isTextFile) {
        // For .txt files, hide preview and show only editor
        preview.style.display = 'none';
        editor.parentElement.style.width = '100%';
        return;
    } else {
        // For .md files, show preview and render markdown
        preview.style.display = 'block';
        editor.parentElement.style.width = '';
        const markdown = editor.value;

        // Configure marked with a custom renderer to add IDs to headings
        if (typeof marked !== 'undefined') {
            const renderer = new marked.Renderer();
            const headingIds = {}; // Track heading IDs to handle duplicates

            // Override heading renderer to add IDs
            renderer.heading = function(text, level, raw) {
                // Check if heading starts with emoji BEFORE processing
                const startsWithEmoji = /^[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(raw.trim());

                // Generate base ID from heading text (GitHub-compatible)
                // GitHub's algorithm:
                // 1. Replace spaces with dashes FIRST
                // 2. Replace emojis with dash (before removing other chars)
                // 3. Remove special characters (NOT replace with dash)
                // 4. DON'T collapse multiple dashes
                let baseId = raw
                    .toLowerCase()
                    .trim()
                    // Step 1: Replace emojis with dash (do this before space replacement)
                    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '-')
                    // Step 2: Replace all whitespace with single dash
                    .replace(/\s+/g, '-')
                    // Step 3: Remove all non-word characters (except hyphens and German umlauts)
                    // This removes &, /, :, etc. WITHOUT replacing them
                    .replace(/[^\wäöüßÄÖÜ-]/g, '')
                    // Step 4: Trim leading/trailing hyphens (but keep one if started with emoji)
                    .replace(/-+$/g, '')
                    .replace(/^-+/, startsWithEmoji ? '-' : '');

                // Handle duplicate IDs by adding a counter
                let id = baseId;
                if (headingIds[baseId]) {
                    headingIds[baseId]++;
                    id = `${baseId}-${headingIds[baseId]}`;
                } else {
                    headingIds[baseId] = 0;
                }

                return `<h${level} id="${id}">${text}</h${level}>`;
            };

            marked.use({
                gfm: true,
                breaks: false,
                headerIds: false,  // Disable automatic ID generation
                mangle: false,     // Don't mangle IDs
                renderer: renderer,
                sanitize: false,   // Don't sanitize HTML (we use DOMPurify instead)
                pedantic: false    // Allow inline HTML
            });
        }

        const html = marked.parse(markdown);
        console.log('Marked HTML output:', html.substring(0, 500)); // Debug

        const sanitized = DOMPurify.sanitize(html, {
            ADD_ATTR: ['id'], // Allow id attribute for heading anchors
            ADD_TAGS: ['br'], // Explicitly allow br tags
            KEEP_CONTENT: true
        });
        console.log('Sanitized HTML:', sanitized.substring(0, 500)); // Debug

        preview.innerHTML = sanitized;

        // Post-processing: Fix heading IDs to match GitHub algorithm
        // This runs AFTER rendering to ensure IDs are correct regardless of marked.js behavior
        const headings = preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const idCounts = {};

        headings.forEach(heading => {
            const text = heading.textContent || '';
            const startsWithEmoji = /^[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(text.trim());

            // Generate ID using GitHub algorithm
            let id = text
                .toLowerCase()
                .trim()
                .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '-')
                .replace(/\s+/g, '-')
                .replace(/[^\wäöüßÄÖÜ-]/g, '')
                .replace(/-+$/g, '')
                .replace(/^-+/, startsWithEmoji ? '-' : '');

            // Handle duplicates
            if (idCounts[id] !== undefined) {
                idCounts[id]++;
                id = `${id}-${idCounts[id]}`;
            } else {
                idCounts[id] = 0;
            }

            heading.id = id;
        });
    }
}

function updateUIForFileType(tab) {
    const isTextFile = tab && tab.filePath && tab.filePath.toLowerCase().endsWith('.txt');
    const container = document.querySelector('.editor-layout');
    
    if (isTextFile) {
        container.classList.add('text-mode');
    } else {
        container.classList.remove('text-mode');
    }
}

function updateStats() {
    if (!editor || !charCount || !wordCount || !lineCount) return;
    
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
        case 'toggle-zen-mode':
            toggleZenMode();
            break;
        case 'open-recent':
            if (data.filePath) {
                openRecentFile(data.filePath);
            }
            break;
        case 'show-about':
            showAboutDialog(data.version);
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
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (window.electronAPI) {
        window.electronAPI.saveFileAs(editor.value, activeTab ? activeTab.filePath : null, activeTab ? activeTab.title : null);
    }
}

function openFileContent(filePath, content) {
    const existingTab = tabs.find(tab => tab.filePath === filePath);
    
    if (existingTab) {
        switchTab(existingTab.id);
    } else {
        createNewTab(content, filePath);
    }
    
    // Start watching the file for external changes
    if (filePath && window.electronAPI) {
        console.log('Starting file watch for:', filePath);
        window.electronAPI.watchFile(filePath);
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
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    const htmlContent = generateHTMLExport();
    if (window.electronAPI) {
        window.electronAPI.exportHTML(htmlContent, activeTab ? activeTab.filePath : null);
    }
}

function generateHTMLExport() {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    const title = activeTab ? activeTab.title : 'Export';

    // Get the preview element
    const previewElement = document.getElementById('preview');
    console.log('Preview element:', previewElement);
    console.log('Preview innerHTML length:', previewElement ? previewElement.innerHTML.length : 0);

    if (!previewElement || !previewElement.innerHTML || previewElement.innerHTML.trim().length === 0) {
        console.error('Preview is empty!');
        alert('Der Preview-Bereich ist leer. Bitte stellen Sie sicher, dass Markdown-Inhalt vorhanden ist.');
        return null;
    }

    // Get just the HTML content, not a clone
    const htmlContent = previewElement.innerHTML;

    // Debug: Check if headings have IDs
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const headingsWithIds = tempDiv.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');
    console.log('Headings with IDs in export:', headingsWithIds.length);
    headingsWithIds.forEach(h => console.log(`${h.tagName}: id="${h.id}"`));

    const images = tempDiv.querySelectorAll('img');

    images.forEach(img => {
        const src = img.src;
        // Keep base64 images as is, convert file:// URLs to base64
        if (src.startsWith('file://')) {
            // For file:// URLs, we need to keep them as is since we can't convert them client-side
            // The browser will handle them when the HTML is opened locally
        }
    });
    
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
        img {
            max-width: 100%;
            height: auto;
            margin: 16px 0;
        }
        /* Style anchor links */
        a[href^="#"] {
            color: #688db1;
            text-decoration: none;
            border-bottom: 1px solid transparent;
            transition: border-color 0.3s ease;
        }
        a[href^="#"]:hover {
            border-bottom-color: #688db1;
        }
        /* Smooth scroll for anchor navigation */
        html {
            scroll-behavior: smooth;
        }
        /* Ensure headings with IDs are accessible */
        h1[id], h2[id], h3[id], h4[id], h5[id], h6[id] {
            scroll-margin-top: 2em;
        }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>`;
}

function exportPDF() {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    // PDF export using browser's print functionality
    if (window.electronAPI && window.electronAPI.printToPDF) {
        window.electronAPI.printToPDF(activeTab ? activeTab.filePath : null);
    } else {
        // Fallback: Open print dialog
        window.print();
    }
}

function batchExportPDF() {
    // Get all tabs that have file paths (saved files)
    const tabsWithFiles = tabs.filter(tab => tab.filePath && tab.filePath !== null);
    
    if (tabsWithFiles.length === 0) {
        alert('Keine gespeicherten Dateien gefunden. Speichern Sie zuerst Ihre Markdown-Dateien.');
        return;
    }
    
    const confirmExport = confirm(`${tabsWithFiles.length} Markdown-Dateien als PDF exportieren?`);
    if (!confirmExport) return;
    
    console.log('Batch exporting PDFs for tabs:', tabsWithFiles.map(tab => tab.filePath));
    
    if (window.electronAPI && window.electronAPI.batchPrintToPDF) {
        // Prepare tab data for export
        const tabData = tabsWithFiles.map(tab => ({
            filePath: tab.filePath,
            content: tab.content,
            title: tab.title
        }));
        
        window.electronAPI.batchPrintToPDF(tabData);
    } else {
        alert('PDF-Batch-Export nicht verfügbar.');
    }
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
    // ESC to close dialogs
    if (e.key === 'Escape') {
        if (searchModal && searchModal.classList.contains('visible')) {
            e.preventDefault();
            closeSearchDialog();
            return;
        }
        if (replaceModal && replaceModal.classList.contains('visible')) {
            e.preventDefault();
            closeReplaceDialog();
            return;
        }
        if (aboutModal && aboutModal.classList.contains('visible')) {
            e.preventDefault();
            closeAboutDialog();
            return;
        }
        if (tableEditor && tableEditor.classList.contains('visible')) {
            e.preventDefault();
            closeTableEditor();
            return;
        }
    }

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
                showSearchDialog();
                break;
            case 'r':
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
                e.preventDefault();
                exportHTML();
                break;
            case 'p':
                e.preventDefault();
                exportPDF();
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
function showAboutDialog(version) {
    contextMenu.classList.remove('visible');
    
    // Update version in about dialog
    if (version) {
        const versionElement = document.querySelector('.modal-version');
        if (versionElement) {
            versionElement.textContent = `Version ${version}`;
        }
    }
    
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

// File change detection
function handleFileChangedExternally(filePath, newContent) {
    console.log('handleFileChangedExternally called with:', filePath);
    const tab = tabs.find(tab => tab.filePath === filePath);
    if (!tab) {
        console.log('No tab found for file:', filePath);
        return;
    }
    
    console.log('Tab found:', tab.title, 'isModified:', tab.isModified);
    
    // Check if the current tab has unsaved changes
    if (tab.isModified) {
        const result = confirm(
            `Die Datei "${tab.title}" wurde extern geändert und hat auch ungespeicherte Änderungen.\n\n` +
            'Möchten Sie die externe Version laden? (Ungespeicherte Änderungen gehen verloren)'
        );
        if (!result) return;
    } else {
        // Show a notification for clean files
        console.log('File changed externally, reloading:', tab.title);
    }
    
    // Update tab content
    tab.content = newContent;
    tab.isModified = false;
    
    // If this is the active tab, update the editor
    if (tab.id === activeTabId) {
        console.log('Updating active tab content');
        editor.value = newContent;
        renderMarkdown();
    }
    
    // Update tab display
    renderTabs();
}

// Batch export helper
function handleBatchExportPrepareTab(filePath, content) {
    try {
        console.log('Preparing tab for batch export:', filePath);
        
        // Find the tab with this file path
        const targetTab = tabs.find(tab => tab.filePath === filePath);
        
        if (!targetTab) {
            console.error('Tab not found for file:', filePath);
            window.electronAPI.sendBatchExportTabReady({
                error: `Tab not found for file: ${filePath}`
            });
            return;
        }
        
        // Save current tab state before switching
        saveCurrentTabState();

        // Switch to the tab (this will load the correct content)
        switchTab(targetTab.id);

        // DON'T overwrite the content - use what's already in the tab
        // The switchTab function already loads the correct content

        // Render markdown and wait a moment
        renderMarkdown();
        
        // Wait for rendering to complete, then send the HTML content
        setTimeout(() => {
            try {
                const htmlContent = preview.innerHTML;
                console.log('Sending rendered HTML for:', filePath);
                window.electronAPI.sendBatchExportTabReady({
                    htmlContent: htmlContent
                });
            } catch (error) {
                console.error('Error getting preview content:', error);
                window.electronAPI.sendBatchExportTabReady({
                    error: `Error getting preview content: ${error.message}`
                });
            }
        }, 1000); // Give more time for rendering
        
    } catch (error) {
        console.error('Error in handleBatchExportPrepareTab:', error);
        window.electronAPI.sendBatchExportTabReady({
            error: `Error preparing tab: ${error.message}`
        });
    }
}

// Search functionality
function showSearchDialog() {
    if (searchModal) {
        searchModal.classList.add('visible');
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
            // Trigger search to update count
            if (searchInput.value) {
                updateSearchResults();
            }
        }
    }
}

function closeSearchDialog() {
    if (searchModal) {
        searchModal.classList.remove('visible');
        clearSearchHighlights();
    }
}

function showReplaceDialog() {
    if (replaceModal) {
        replaceModal.classList.add('visible');
        const replaceSearchInput = document.getElementById('replaceSearchInput');
        if (replaceSearchInput) {
            replaceSearchInput.focus();
            replaceSearchInput.select();
            // Trigger search to update count
            if (replaceSearchInput.value) {
                updateReplaceResults();
            }
        }
    }
}

function closeReplaceDialog() {
    if (replaceModal) {
        replaceModal.classList.remove('visible');
        clearSearchHighlights();
    }
}

function updateSearchResults() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput?.value || '';
    const resultInfo = document.getElementById('searchResultInfo');

    if (!searchTerm) {
        if (resultInfo) resultInfo.textContent = '';
        return;
    }

    currentSearchTerm = searchTerm;
    searchMatches = performSearch(searchTerm);

    if (resultInfo) {
        if (searchMatches.length === 0) {
            resultInfo.textContent = 'Keine Treffer gefunden';
            resultInfo.style.color = 'var(--accent-red)';
        } else {
            const current = currentMatchIndex >= 0 ? currentMatchIndex + 1 : 0;
            resultInfo.textContent = `${searchMatches.length} Treffer gefunden${current > 0 ? ` (${current}/${searchMatches.length})` : ''}`;
            resultInfo.style.color = 'var(--text-secondary)';
        }
    }
}

function updateReplaceResults() {
    const replaceSearchInput = document.getElementById('replaceSearchInput');
    const searchTerm = replaceSearchInput?.value || '';
    const resultInfo = document.getElementById('replaceResultInfo');

    if (!searchTerm) {
        if (resultInfo) resultInfo.textContent = '';
        return;
    }

    currentSearchTerm = searchTerm;
    searchMatches = performSearch(searchTerm, true);

    if (resultInfo) {
        if (searchMatches.length === 0) {
            resultInfo.textContent = 'Keine Treffer gefunden';
            resultInfo.style.color = 'var(--accent-red)';
        } else {
            const current = currentMatchIndex >= 0 ? currentMatchIndex + 1 : 0;
            resultInfo.textContent = `${searchMatches.length} Treffer gefunden${current > 0 ? ` (${current}/${searchMatches.length})` : ''}`;
            resultInfo.style.color = 'var(--text-secondary)';
        }
    }
}

function getSearchOptions(isReplace = false) {
    const prefix = isReplace ? 'replace' : 'search';
    return {
        caseSensitive: document.getElementById(`${prefix}CaseSensitive`)?.checked || false,
        regex: document.getElementById(`${prefix}Regex`)?.checked || false,
        wholeWord: document.getElementById(`${prefix}WholeWord`)?.checked || false
    };
}

function performSearch(searchTerm, isReplace = false) {
    if (!searchTerm) return [];
    
    const text = editor.value;
    const options = getSearchOptions(isReplace);
    const matches = [];
    
    let pattern;
    try {
        if (options.regex) {
            const flags = options.caseSensitive ? 'g' : 'gi';
            pattern = new RegExp(searchTerm, flags);
        } else {
            const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let regexTerm = escapedTerm;
            
            if (options.wholeWord) {
                regexTerm = `\\b${regexTerm}\\b`;
            }
            
            const flags = options.caseSensitive ? 'g' : 'gi';
            pattern = new RegExp(regexTerm, flags);
        }
    } catch (e) {
        // Invalid regex, treat as literal text
        const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const flags = options.caseSensitive ? 'g' : 'gi';
        pattern = new RegExp(escapedTerm, flags);
    }
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
        matches.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[0]
        });
        
        // Prevent infinite loop with zero-width matches
        if (match.index === pattern.lastIndex) {
            pattern.lastIndex++;
        }
    }
    
    return matches;
}

function highlightMatches(matches) {
    // For now, we'll just select the current match
    // In a full implementation, you'd want to add highlighting to the editor
}

function clearSearchHighlights() {
    searchMatches = [];
    currentMatchIndex = -1;
}

function findNext() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput?.value || '';

    if (!searchTerm) return;

    if (searchTerm !== currentSearchTerm) {
        updateSearchResults();
    }

    if (searchMatches.length === 0) {
        updateSearchResults();
        return;
    }

    currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
    const match = searchMatches[currentMatchIndex];

    editor.focus();
    editor.setSelectionRange(match.start, match.end);
    editor.scrollTop = editor.scrollHeight * (match.start / editor.value.length) - (editor.clientHeight / 2);

    // Update the counter
    updateSearchResults();
}

function findPrevious() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput?.value || '';

    if (!searchTerm) return;

    if (searchTerm !== currentSearchTerm) {
        updateSearchResults();
        currentMatchIndex = searchMatches.length;
    }

    if (searchMatches.length === 0) {
        updateSearchResults();
        return;
    }

    currentMatchIndex = currentMatchIndex <= 0 ? searchMatches.length - 1 : currentMatchIndex - 1;
    const match = searchMatches[currentMatchIndex];

    editor.focus();
    editor.setSelectionRange(match.start, match.end);
    editor.scrollTop = editor.scrollHeight * (match.start / editor.value.length) - (editor.clientHeight / 2);

    // Update the counter
    updateSearchResults();
}

function findNextReplace() {
    const replaceSearchInput = document.getElementById('replaceSearchInput');
    const searchTerm = replaceSearchInput?.value || '';

    if (!searchTerm) return;

    if (searchTerm !== currentSearchTerm) {
        updateReplaceResults();
    }

    if (searchMatches.length === 0) {
        updateReplaceResults();
        return;
    }

    currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
    const match = searchMatches[currentMatchIndex];

    editor.focus();
    editor.setSelectionRange(match.start, match.end);
    editor.scrollTop = editor.scrollHeight * (match.start / editor.value.length) - (editor.clientHeight / 2);

    // Update the counter
    updateReplaceResults();
}

function replaceNext() {
    const replaceSearchInput = document.getElementById('replaceSearchInput');
    const replaceInput = document.getElementById('replaceInput');
    const searchTerm = replaceSearchInput?.value || '';
    const replaceTerm = replaceInput?.value || '';

    if (!searchTerm) return;

    // Get current selection
    const selectionStart = editor.selectionStart;
    const selectionEnd = editor.selectionEnd;
    const selectedText = editor.value.substring(selectionStart, selectionEnd);

    // Check if current selection matches search term
    const options = getSearchOptions(true);
    let matches = false;

    if (options.regex) {
        try {
            const flags = options.caseSensitive ? '' : 'i';
            const pattern = new RegExp(`^${searchTerm}$`, flags);
            matches = pattern.test(selectedText);
        } catch (e) {
            matches = selectedText === searchTerm;
        }
    } else {
        matches = options.caseSensitive ?
            selectedText === searchTerm :
            selectedText.toLowerCase() === searchTerm.toLowerCase();
    }

    if (matches) {
        // Replace current selection
        const newValue = editor.value.substring(0, selectionStart) + replaceTerm + editor.value.substring(selectionEnd);
        editor.value = newValue;
        editor.setSelectionRange(selectionStart, selectionStart + replaceTerm.length);

        // Mark tab as modified
        const activeTab = tabs.find(tab => tab.id === activeTabId);
        if (activeTab) {
            markTabAsModified(activeTabId, true);
        }

        renderMarkdown();

        // Reset search to account for text change
        currentSearchTerm = '';
    }

    // Find next match
    findNextReplace();
}

function replaceAll() {
    const replaceSearchInput = document.getElementById('replaceSearchInput');
    const replaceInput = document.getElementById('replaceInput');
    const searchTerm = replaceSearchInput?.value || '';
    const replaceTerm = replaceInput?.value || '';

    if (!searchTerm) return;

    const matches = performSearch(searchTerm, true);
    if (matches.length === 0) {
        updateReplaceResults();
        return;
    }

    const confirmReplace = confirm(`${matches.length} Treffer gefunden. Alle ersetzen?`);
    if (!confirmReplace) return;

    let newValue = editor.value;

    // Replace from end to start to maintain indices
    for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        newValue = newValue.substring(0, match.start) + replaceTerm + newValue.substring(match.end);
    }

    editor.value = newValue;

    // Mark tab as modified
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (activeTab) {
        markTabAsModified(activeTabId, true);
    }

    renderMarkdown();
    clearSearchHighlights();

    // Show success message
    const resultInfo = document.getElementById('replaceResultInfo');
    if (resultInfo) {
        resultInfo.textContent = `${matches.length} Ersetzungen vorgenommen`;
        resultInfo.style.color = 'var(--accent-green)';
    }
}


// Initialize when DOM is ready - removed duplicate initialization
// Already handled by DOMContentLoaded listener at the top of the file
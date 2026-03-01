// Application State
let tabs = [];
let activeTabId = 0;
let nextTabId = 1;
let sidebarVisible = true;
let lineNumbers = false;
let wordWrap = true;
let currentViewMode = 'split';
let isResizing = false;
let startX = 0;
let startWidth = 0;
let isScrollSyncing = false;
let renderDebounceTimer = null;
let autoSaveTimer = null;
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
let searchDebounceTimer = null;
let replaceDebounceTimer = null;

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    
    // Make functions globally available for onclick handlers
    window.handleMenuAction = handleMenuAction;
    window.toggleSidebar = toggleSidebar;
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
    window.deleteLine = deleteLine;
    window.duplicateLine = duplicateLine;
    window.moveLineUp = moveLineUp;
    window.moveLineDown = moveLineDown;
    window.selectCurrentLine = selectCurrentLine;
    window.toggleComment = toggleComment;
    window.indentSelection = indentSelection;
    window.unindentSelection = unindentSelection;
    window.debouncedSearchUpdate = debouncedSearchUpdate;
    window.debouncedReplaceUpdate = debouncedReplaceUpdate;
    window.formatStrikethrough = formatStrikethrough;
    window.applySettings = applySettings;
    window.closeSettingsDialog = closeSettingsDialog;
    window.toggleTheme = toggleTheme;
    window.closeOtherTabs = closeOtherTabs;
    window.closeAllTabs = closeAllTabs;
});

function initializeApp() {
    // Initialize CodeMirror editor via adapter
    const editorContainer = document.getElementById('editor');
    if (editorContainer) {
        editor = new EditorAdapter(editorContainer, {
            initialDoc: '',
            isDark: true,
            showLineNumbers: false,
            wordWrap: true,
            tabSize: 4,
            fontSize: 14,
        });
    }

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

    // Start session saver for crash recovery
    startSessionSaver();

    // Check for session restore (after a brief delay to let UI initialize)
    setTimeout(() => {
        checkSessionRestore();
    }, 500);
}

function setupEventListeners() {
    // Editor events (via CM6 adapter)
    if (editor) {
        editor.addEventListener('input', handleEditorInput);
        editor.addEventListener('keydown', handleEditorKeydown);
        editor.addEventListener('scroll', (event) => {
            syncScroll(event);
        });
        // Update cursor position on click/keyup
        editor.addEventListener('click', updateCursorPosition);
        editor.addEventListener('keyup', updateCursorPosition);
    }
    
    // Preview events
    if (preview) {
        preview.addEventListener('scroll', syncScroll);
    }
    
    // Window events
    window.addEventListener('resize', handleWindowResize);

    // Auto-save on focus loss
    window.addEventListener('blur', () => {
        if (settings.autoSave) {
            const activeTab = tabs.find(tab => tab.id === activeTabId);
            if (activeTab && activeTab.filePath && activeTab.isModified) {
                saveCurrentFile();
                showAutoSaveIndicator();
            }
        }
    });
    
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

        window.electronAPI.onFileDeletedExternally((event, data) => {
            handleFileDeletedExternally(data.filePath);
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
            const filePath = file.path || file.name;

            // Check if it's a directory (Electron provides file.path for directories too)
            // Directories won't have a meaningful type and typically no extension
            if (filePath && window.electronAPI && window.electronAPI.listDirectory) {
                // Try to detect if it's a directory by checking if there's no extension
                // and the type is empty (common for directories in Electron drag-drop)
                if (!file.type && !file.name.includes('.')) {
                    // Likely a directory - load all .md files from it
                    handleDroppedFolder(filePath);
                    return;
                }
            }

            if (file.type === 'text/markdown' || file.type === 'text/plain' ||
                file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    console.log('Drag & Drop file:', filePath);
                    openFileContent(filePath, event.target.result);
                };
                reader.readAsText(file);
            }
        });
    }
}

async function handleDroppedFolder(dirPath) {
    if (!window.electronAPI || !window.electronAPI.listDirectory) return;
    try {
        const entries = await window.electronAPI.listDirectory(dirPath);
        const mdFiles = entries.filter(e =>
            !e.isDirectory &&
            (e.name.endsWith('.md') || e.name.endsWith('.markdown'))
        );

        for (const file of mdFiles) {
            window.electronAPI.openFilePath(file.path);
        }

        // Also load the sidebar file tree with this folder
        loadFileTree(dirPath);
    } catch (error) {
        console.error('Error handling dropped folder:', error);
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

function showTabContextMenu(x, y, tabId) {
    // Remove any existing tab context menu
    const existing = document.getElementById('tabContextMenu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'tabContextMenu';
    menu.className = 'context-menu visible';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    const items = [
        { label: 'Tab schließen', action: () => closeTab(tabId) },
        { label: 'Andere Tabs schließen', action: () => closeOtherTabs(tabId) },
        { label: 'Alle Tabs schließen', action: () => closeAllTabs() }
    ];

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'context-menu-item';
        el.textContent = item.label;
        el.addEventListener('click', () => {
            menu.remove();
            item.action();
        });
        menu.appendChild(el);
    });

    document.body.appendChild(menu);

    // Remove on click outside
    const removeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', removeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', removeMenu), 0);
}

function closeOtherTabs(keepTabId) {
    const tabsToClose = tabs.filter(t => t.id !== keepTabId);
    const hasUnsaved = tabsToClose.some(t => t.isModified);
    if (hasUnsaved) {
        if (!confirm('Ungespeicherte Änderungen in anderen Tabs gehen verloren. Fortfahren?')) return;
    }
    // Stop watchers for closing tabs
    tabsToClose.forEach(t => {
        if (t.filePath && window.electronAPI) {
            window.electronAPI.unwatchFile(t.filePath);
        }
    });
    tabs = tabs.filter(t => t.id === keepTabId);
    activeTabId = keepTabId;
    renderTabs();
    loadTabContent(keepTabId);
}

function closeAllTabs() {
    const hasUnsaved = tabs.some(t => t.isModified);
    if (hasUnsaved) {
        if (!confirm('Ungespeicherte Änderungen gehen verloren. Alle Tabs schließen?')) return;
    }
    tabs.forEach(t => {
        if (t.filePath && window.electronAPI) {
            window.electronAPI.unwatchFile(t.filePath);
        }
    });
    tabs = [];
    createNewTab();
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

        // Drag-to-reorder
        tabElement.draggable = true;
        tabElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', tab.id.toString());
            tabElement.classList.add('dragging');
        });
        tabElement.addEventListener('dragend', () => {
            tabElement.classList.remove('dragging');
            document.querySelectorAll('.tab.drag-over').forEach(el => el.classList.remove('drag-over'));
        });
        tabElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            tabElement.classList.add('drag-over');
        });
        tabElement.addEventListener('dragleave', () => {
            tabElement.classList.remove('drag-over');
        });
        tabElement.addEventListener('drop', (e) => {
            e.preventDefault();
            tabElement.classList.remove('drag-over');
            const draggedTabId = parseInt(e.dataTransfer.getData('text/plain'));
            if (draggedTabId === tab.id) return;
            const fromIndex = tabs.findIndex(t => t.id === draggedTabId);
            const toIndex = tabs.findIndex(t => t.id === tab.id);
            if (fromIndex === -1 || toIndex === -1) return;
            const [moved] = tabs.splice(fromIndex, 1);
            tabs.splice(toIndex, 0, moved);
            renderTabs();
        });

        const titleDiv = document.createElement('div');
        titleDiv.className = 'tab-title';
        titleDiv.textContent = tab.title;

        const closeDiv = document.createElement('div');
        closeDiv.className = 'tab-close';
        closeDiv.textContent = '×';
        closeDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            closeTab(tab.id);
        });

        // Tab context menu (right-click)
        tabElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showTabContextMenu(e.pageX, e.pageY, tab.id);
        });

        tabElement.appendChild(titleDiv);
        tabElement.appendChild(closeDiv);

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
    updateStats();
    // CM6 handles syntax highlighting natively
    // Check for autocomplete triggers
    checkAutocomplete();
    // Debounce markdown rendering - longer delay for large files
    clearTimeout(renderDebounceTimer);
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    const debounceMs = (activeTab && activeTab.largeFile) ? 500 : 150;
    renderDebounceTimer = setTimeout(() => {
        renderMarkdown();
    }, debounceMs);
    // Schedule auto-save
    scheduleAutoSave();
}

function handleEditorKeydown(e) {
    // Handle autocomplete keys first
    if (handleAutocompleteKeydown(e)) return;

    // Handle Tab / Shift+Tab key
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;

        // Check if cursor is inside a markdown table
        const cursorInTable = isCursorInTable(start);
        if (cursorInTable) {
            if (e.shiftKey) {
                navigateTableCell(-1);
            } else {
                navigateTableCell(1);
            }
            return;
        }

        if (start !== end) {
            // Selection exists — indent/unindent block
            if (e.shiftKey) {
                unindentSelection();
            } else {
                indentSelection();
            }
        } else if (e.shiftKey) {
            unindentSelection();
        } else {
            replaceRange(start, end, '    ');
            editor.selectionStart = editor.selectionEnd = start + 4;
        }
        handleEditorInput();
        return;
    }

    // Smart Enter — auto-continue lists
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const pos = editor.selectionStart;
        const text = editor.value;
        const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
        const currentLine = text.substring(lineStart, pos);

        const smartText = getSmartEnterText(currentLine);
        if (smartText !== null) {
            e.preventDefault();
            if (smartText === '') {
                // Empty list item — remove it and insert newline
                replaceRange(lineStart, pos, '');
                // After removing, insert a newline at the new position
                const newPos = editor.selectionStart;
                replaceRange(newPos, newPos, '\n');
            } else {
                replaceRange(pos, pos, '\n' + smartText);
            }
            handleEditorInput();
            return;
        }
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

        const sanitized = DOMPurify.sanitize(html, {
            ADD_ATTR: ['id'], // Allow id attribute for heading anchors
            ADD_TAGS: ['br'], // Explicitly allow br tags
            KEEP_CONTENT: true
        });

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

        // Update document outline in sidebar
        updateDocumentOutline();
    }
}

function updateDocumentOutline() {
    const outline = document.getElementById('documentOutline');
    if (!outline) return;

    const text = editor.value;
    const lines = text.split('\n');
    outline.textContent = '';

    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^(#{1,6})\s+(.+)/);
        if (match) {
            const level = match[1].length;
            const title = match[2].replace(/[*_`~]/g, '');
            const lineIndex = i;

            const item = document.createElement('div');
            item.className = `outline-item outline-h${level}`;
            item.textContent = title;
            item.addEventListener('click', () => {
                // Jump to that line in the editor
                let charPos = 0;
                for (let j = 0; j < lineIndex; j++) {
                    charPos += lines[j].length + 1;
                }
                editor.focus();
                editor.setSelectionRange(charPos, charPos + lines[lineIndex].length);
                // Scroll editor to that position
                const lineHeight = parseFloat(getComputedStyle(editor.contentDOM).lineHeight) || 20;
                editor.scrollTop = lineIndex * lineHeight - editor.clientHeight / 3;
            });
            outline.appendChild(item);
        }
    }

    if (outline.children.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'outline-item';
        empty.textContent = 'Keine Überschriften';
        empty.style.fontStyle = 'italic';
        outline.appendChild(empty);
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

    updateLineNumbers();
    updateCursorPosition();
}

function updateCursorPosition() {
    if (!editor) return;
    const pos = editor.selectionStart;
    const text = editor.value.substring(0, pos);
    const line = text.split('\n').length;
    const lastNewline = text.lastIndexOf('\n');
    const col = pos - lastNewline;

    const cursorEl = document.getElementById('cursorPosition');
    if (cursorEl) {
        cursorEl.textContent = `Ln ${line}, Col ${col}`;
    }

    // Update file type indicator
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    const fileTypeEl = document.getElementById('fileTypeInfo');
    if (fileTypeEl && activeTab) {
        if (activeTab.filePath && activeTab.filePath.toLowerCase().endsWith('.txt')) {
            fileTypeEl.textContent = 'Text';
        } else {
            fileTypeEl.textContent = 'Markdown';
        }
    }
}

let scrollSyncRAF = null;
function syncScroll(event) {
    if (isResizing || isScrollSyncing || currentViewMode !== 'split' || !settings.syncScroll) {
        return;
    }

    const sourceElement = event.target;
    const targetElement = sourceElement === editor ? preview : editor;

    if (sourceElement && targetElement) {
        // Use requestAnimationFrame for throttled scroll sync
        if (scrollSyncRAF) cancelAnimationFrame(scrollSyncRAF);
        scrollSyncRAF = requestAnimationFrame(() => {
            const sourceScrollHeight = sourceElement.scrollHeight - sourceElement.clientHeight;
            const targetScrollHeight = targetElement.scrollHeight - targetElement.clientHeight;

            if (sourceScrollHeight <= 0 || targetScrollHeight <= 0) return;

            isScrollSyncing = true;

            const scrollRatio = sourceElement.scrollTop / sourceScrollHeight;
            const targetScrollTop = scrollRatio * targetScrollHeight;

            if (Math.abs(targetElement.scrollTop - targetScrollTop) > 5) {
                targetElement.scrollTop = targetScrollTop;
            }

            setTimeout(() => {
                isScrollSyncing = false;
            }, 50);
        });
    }
}

// --- Autocomplete ---
let autocompleteVisible = false;
let autocompleteSelectedIndex = 0;
const autocompleteRules = [
    { trigger: '[', completion: ']()', cursorOffset: -1, label: '[Link](url)', hint: 'Link' },
    { trigger: '![', completion: ']()', cursorOffset: -1, label: '![alt](url)', hint: 'Bild' },
    { trigger: '```', completion: '\n\n```', cursorOffset: -4, label: '```sprache```', hint: 'Code-Block',
      languages: ['javascript', 'python', 'bash', 'html', 'css', 'json', 'typescript', 'java', 'c', 'sql', 'markdown'] },
];

function checkAutocomplete() {
    const pos = editor.selectionStart;
    const text = editor.value;
    const popup = document.getElementById('autocompletePopup');
    if (!popup) return;

    // Check for code block language suggestions
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    const lineText = text.substring(lineStart, pos);

    if (lineText === '```') {
        showAutocompleteLanguages(pos);
        return;
    }

    // Check if we should show completion hints
    const charBefore = text.substring(Math.max(0, pos - 2), pos);

    if (charBefore === '![') {
        showAutocompleteSuggestion(pos, '![alt](url)', ']()', -1);
        return;
    }

    // Hide autocomplete for other cases
    hideAutocomplete();
}

function showAutocompleteLanguages(pos) {
    const popup = document.getElementById('autocompletePopup');
    if (!popup) return;

    const languages = ['javascript', 'python', 'bash', 'html', 'css', 'json', 'typescript', 'java', 'sql', 'markdown'];

    popup.textContent = '';
    languages.forEach((lang, index) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item' + (index === 0 ? ' selected' : '');
        item.textContent = lang;
        item.addEventListener('click', () => {
            replaceRange(pos, pos, lang + '\n\n```');
            editor.selectionStart = editor.selectionEnd = pos + lang.length + 1;
            hideAutocomplete();
            handleEditorInput();
        });
        popup.appendChild(item);
    });

    autocompleteSelectedIndex = 0;
    positionAutocomplete(pos);
    popup.style.display = 'block';
    autocompleteVisible = true;
}

function showAutocompleteSuggestion(pos, label, completion, cursorOffset) {
    const popup = document.getElementById('autocompletePopup');
    if (!popup) return;

    popup.textContent = '';
    const item = document.createElement('div');
    item.className = 'autocomplete-item selected';
    item.textContent = label;
    item.addEventListener('click', () => {
        replaceRange(pos, pos, completion);
        editor.selectionStart = editor.selectionEnd = pos + completion.length + cursorOffset;
        hideAutocomplete();
        handleEditorInput();
    });
    popup.appendChild(item);

    autocompleteSelectedIndex = 0;
    positionAutocomplete(pos);
    popup.style.display = 'block';
    autocompleteVisible = true;
}

function positionAutocomplete(pos) {
    const popup = document.getElementById('autocompletePopup');
    if (!popup) return;

    // Approximate cursor position
    const editorRect = editor.getBoundingClientRect();
    const text = editor.value.substring(0, pos);
    const lines = text.split('\n');
    const lineIndex = lines.length - 1;
    const colIndex = lines[lines.length - 1].length;

    const lineHeight = parseFloat(getComputedStyle(editor.contentDOM).lineHeight) || 22;
    const charWidth = 8.4; // Approximate monospace char width

    const scrollTop = editor.scrollTop;
    const top = editorRect.top + (lineIndex * lineHeight) - scrollTop + lineHeight + 24;
    const left = editorRect.left + (colIndex * charWidth) + 24;

    popup.style.top = Math.min(top, window.innerHeight - 160) + 'px';
    popup.style.left = Math.min(left, window.innerWidth - 220) + 'px';
}

function hideAutocomplete() {
    const popup = document.getElementById('autocompletePopup');
    if (popup) {
        popup.style.display = 'none';
    }
    autocompleteVisible = false;
}

function handleAutocompleteKeydown(e) {
    if (!autocompleteVisible) return false;
    const popup = document.getElementById('autocompletePopup');
    if (!popup) return false;

    const items = popup.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return false;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[autocompleteSelectedIndex].classList.remove('selected');
        autocompleteSelectedIndex = (autocompleteSelectedIndex + 1) % items.length;
        items[autocompleteSelectedIndex].classList.add('selected');
        return true;
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[autocompleteSelectedIndex].classList.remove('selected');
        autocompleteSelectedIndex = (autocompleteSelectedIndex - 1 + items.length) % items.length;
        items[autocompleteSelectedIndex].classList.add('selected');
        return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        items[autocompleteSelectedIndex].click();
        return true;
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        hideAutocomplete();
        return true;
    }
    return false;
}

// Syntax highlighting overlay
function updateSyntaxHighlight() {
    // No-op: CM6 handles syntax highlighting natively
}

// Undo-safe text replacement using execCommand to preserve browser undo stack
function replaceRange(start, end, newText) {
    editor.focus();
    editor.selectionStart = start;
    editor.selectionEnd = end;
    editor.execCommand('insertText', false, newText);
}

// Formatting Functions
function insertAtCursor(text) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    replaceRange(start, end, text);
    editor.selectionStart = editor.selectionEnd = start + text.length;
}

function wrapSelection(prefix, suffix = '') {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.substring(start, end);
    const text = editor.value;

    if (selectedText) {
        // Check if the selection is already wrapped with prefix/suffix
        const beforeStart = start - prefix.length;
        const afterEnd = end + suffix.length;
        if (beforeStart >= 0 && afterEnd <= text.length &&
            text.substring(beforeStart, start) === prefix &&
            text.substring(end, afterEnd) === suffix) {
            // Unwrap: remove prefix before and suffix after selection
            replaceRange(beforeStart, afterEnd, selectedText);
            editor.selectionStart = beforeStart;
            editor.selectionEnd = beforeStart + selectedText.length;
        } else if (selectedText.startsWith(prefix) && selectedText.endsWith(suffix) &&
                   selectedText.length >= prefix.length + suffix.length) {
            // Selection includes the wrapper - unwrap
            const inner = selectedText.slice(prefix.length, -suffix.length || undefined);
            replaceRange(start, end, inner);
            editor.selectionStart = start;
            editor.selectionEnd = start + inner.length;
        } else {
            // Wrap
            const wrappedText = prefix + selectedText + suffix;
            replaceRange(start, end, wrappedText);
            editor.selectionStart = start + prefix.length;
            editor.selectionEnd = start + prefix.length + selectedText.length;
        }
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

function formatStrikethrough() {
    wrapSelection('~~', '~~');
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
    const actualLineEnd = lineEnd === -1 ? editor.value.length : lineEnd;
    const currentLine = editor.value.substring(lineStart, actualLineEnd);

    const headingPrefix = '#'.repeat(level) + ' ';
    const newLine = currentLine.replace(/^#+\s*/, '') || 'Überschrift';

    replaceRange(lineStart, actualLineEnd, headingPrefix + newLine);
    editor.selectionStart = editor.selectionEnd = lineStart + headingPrefix.length + newLine.length;
    editor.focus();
}

// --- Line Utilities ---

function getCurrentLineRange(pos) {
    const text = editor.value;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    return { lineStart, lineEnd };
}

function getSelectedLinesRange() {
    const text = editor.value;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = text.indexOf('\n', end - (end > start && text[end - 1] === '\n' ? 1 : 0));
    if (lineEnd === -1) lineEnd = text.length;
    return { lineStart, lineEnd };
}

// --- Line Operations ---

function deleteLine() {
    const text = editor.value;
    const { lineStart, lineEnd } = getSelectedLinesRange();

    // Determine what to delete: include the trailing newline or leading newline
    let delStart = lineStart;
    let delEnd = lineEnd;
    if (delEnd < text.length) {
        delEnd++; // include trailing \n
    } else if (delStart > 0) {
        delStart--; // include leading \n
    }

    replaceRange(delStart, delEnd, '');
    editor.selectionStart = editor.selectionEnd = delStart;
    handleEditorInput();
}

function moveLineUp() {
    const text = editor.value;
    const { lineStart, lineEnd } = getSelectedLinesRange();

    if (lineStart === 0) return; // already at top

    const prevLineStart = text.lastIndexOf('\n', lineStart - 2) + 1;
    const selectedBlock = text.substring(lineStart, lineEnd);
    const prevLine = text.substring(prevLineStart, lineStart - 1); // exclude \n

    const selStartOffset = editor.selectionStart - lineStart;
    const selEndOffset = editor.selectionEnd - lineStart;

    const newText = selectedBlock + '\n' + prevLine;
    replaceRange(prevLineStart, lineEnd, newText);

    editor.selectionStart = prevLineStart + selStartOffset;
    editor.selectionEnd = prevLineStart + selEndOffset;
    handleEditorInput();
}

function moveLineDown() {
    const text = editor.value;
    const { lineStart, lineEnd } = getSelectedLinesRange();

    if (lineEnd >= text.length) return; // already at bottom

    let nextLineEnd = text.indexOf('\n', lineEnd + 1);
    if (nextLineEnd === -1) nextLineEnd = text.length;
    const nextLine = text.substring(lineEnd + 1, nextLineEnd);
    const selectedBlock = text.substring(lineStart, lineEnd);

    const selStartOffset = editor.selectionStart - lineStart;
    const selEndOffset = editor.selectionEnd - lineStart;
    const newStart = lineStart + nextLine.length + 1;

    const newText = nextLine + '\n' + selectedBlock;
    replaceRange(lineStart, nextLineEnd, newText);

    editor.selectionStart = newStart + selStartOffset;
    editor.selectionEnd = newStart + selEndOffset;
    handleEditorInput();
}

function duplicateLine() {
    const text = editor.value;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;

    if (start !== end) {
        // Duplicate selection
        const selected = text.substring(start, end);
        replaceRange(end, end, selected);
        editor.selectionStart = end;
        editor.selectionEnd = end + selected.length;
    } else {
        // Duplicate current line
        const { lineStart, lineEnd } = getCurrentLineRange(start);
        const line = text.substring(lineStart, lineEnd);
        const offset = start - lineStart;
        replaceRange(lineEnd, lineEnd, '\n' + line);
        editor.selectionStart = editor.selectionEnd = lineEnd + 1 + offset;
    }
    handleEditorInput();
}

function selectCurrentLine() {
    const { lineStart, lineEnd } = getCurrentLineRange(editor.selectionStart);
    editor.selectionStart = lineStart;
    editor.selectionEnd = lineEnd;
    editor.focus();
}

// --- Indent / Unindent ---

function indentSelection() {
    const text = editor.value;
    const { lineStart, lineEnd } = getSelectedLinesRange();
    const block = text.substring(lineStart, lineEnd);
    const indented = indentLines(block);

    const selStart = editor.selectionStart;
    const selEnd = editor.selectionEnd;

    replaceRange(lineStart, lineEnd, indented);

    // Adjust selection: first line gets 4 chars added at start
    const firstLineOffset = selStart === lineStart ? 4 : 4;
    editor.selectionStart = selStart + firstLineOffset;
    editor.selectionEnd = selEnd + (indented.length - block.length);
}

function unindentSelection() {
    const text = editor.value;
    const { lineStart, lineEnd } = getSelectedLinesRange();
    const block = text.substring(lineStart, lineEnd);
    const unindented = unindentLines(block);

    const selStart = editor.selectionStart;
    const selEnd = editor.selectionEnd;
    const diff = block.length - unindented.length;

    replaceRange(lineStart, lineEnd, unindented);

    // Adjust selection
    const firstLine = block.split('\n')[0];
    const firstLineSpaces = Math.min(firstLine.match(/^ */)[0].length, 4);
    editor.selectionStart = Math.max(lineStart, selStart - firstLineSpaces);
    editor.selectionEnd = Math.max(editor.selectionStart, selEnd - diff);
}

// indentLines() and unindentLines() are provided by editor-utils.js

// --- Toggle Comment ---

function toggleComment() {
    const text = editor.value;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;

    if (start !== end) {
        // Wrap selection in comment
        const selected = text.substring(start, end);
        const toggled = toggleBlockComment(selected);
        replaceRange(start, end, toggled);
        editor.selectionStart = start;
        editor.selectionEnd = start + toggled.length;
    } else {
        // Toggle comment on current line
        const { lineStart, lineEnd } = getCurrentLineRange(start);
        const line = text.substring(lineStart, lineEnd);
        const toggled = toggleLineComment(line);
        replaceRange(lineStart, lineEnd, toggled);
        editor.selectionStart = editor.selectionEnd = lineStart + toggled.length;
    }
    handleEditorInput();
}

// toggleLineComment() is provided by editor-utils.js

function toggleBlockComment(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('<!--') && trimmed.endsWith('-->')) {
        return text.replace(/^\s*<!--\s?/, '').replace(/\s?-->\s*$/, '');
    }
    return '<!-- ' + text + ' -->';
}

// getSmartEnterText() is provided by editor-utils.js

async function insertImage() {
    // Try native file picker first (Electron), fall back to URL prompt
    if (window.electronAPI && window.electronAPI.selectImage) {
        const imagePath = await window.electronAPI.selectImage();
        if (imagePath) {
            const alt = prompt('Alt-Text eingeben:') || 'Bild';
            // Use relative path if possible
            const activeTab = tabs.find(tab => tab.id === activeTabId);
            let insertPath = imagePath;
            if (activeTab && activeTab.filePath) {
                const lastSep = Math.max(activeTab.filePath.lastIndexOf('/'), activeTab.filePath.lastIndexOf('\\'));
                const fileDir = lastSep >= 0 ? activeTab.filePath.substring(0, lastSep) : '';
                if (imagePath.startsWith(fileDir)) {
                    insertPath = imagePath.substring(fileDir.length + 1);
                }
            }
            insertAtCursor(`![${alt}](${insertPath})`);
            handleEditorInput();
            return;
        }
    }
    // Fallback: prompt for URL
    const url = prompt('Bild-URL eingeben:');
    if (url) {
        const alt = prompt('Alt-Text eingeben:') || 'Bild';
        insertAtCursor(`![${alt}](${url})`);
        handleEditorInput();
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
    // Warn about very large files
    if (content.length > 1024 * 1024) { // > 1MB
        const proceed = confirm(`Die Datei ist sehr groß (${(content.length / 1024 / 1024).toFixed(1)} MB). Das Offnen konnte langsam sein. Fortfahren?`);
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

// Sidebar File Tree
async function loadFileTree(dirPath) {
    if (!window.electronAPI || !window.electronAPI.listDirectory) return;
    const fileExplorer = document.getElementById('fileExplorer');
    if (!fileExplorer) return;

    try {
        const entries = await window.electronAPI.listDirectory(dirPath);
        fileExplorer.textContent = '';

        for (const entry of entries) {
            const item = document.createElement('div');
            item.className = 'file-item';
            if (entry.isDirectory) {
                item.className += ' file-tree-folder';
            }

            const icon = document.createElement('div');
            icon.className = 'file-icon';
            // Safe: getIcon() returns static SVG from hardcoded ICON_PATHS, no user input
            if (entry.isDirectory) {
                icon.innerHTML = getIcon('folder-closed', 14);
            } else if (entry.name.endsWith('.md') || entry.name.endsWith('.markdown')) {
                icon.innerHTML = getIcon('file-text', 14);
            } else if (entry.name.endsWith('.txt')) {
                icon.innerHTML = getIcon('file', 14);
            } else {
                icon.innerHTML = getIcon('file', 14);
            }

            const name = document.createElement('div');
            name.className = 'file-name';
            name.textContent = entry.name;

            item.appendChild(icon);
            item.appendChild(name);

            if (entry.isDirectory) {
                const children = document.createElement('div');
                children.className = 'file-tree-children collapsed';
                let loaded = false;

                item.addEventListener('click', async () => {
                    if (!loaded) {
                        const subEntries = await window.electronAPI.listDirectory(entry.path);
                        for (const sub of subEntries) {
                            const subItem = document.createElement('div');
                            subItem.className = 'file-item';
                            const subIcon = document.createElement('div');
                            subIcon.className = 'file-icon';
                            // Safe: getIcon() returns static SVG from hardcoded ICON_PATHS
                            subIcon.innerHTML = sub.isDirectory ? getIcon('folder-closed', 14) :
                                (sub.name.endsWith('.md') || sub.name.endsWith('.markdown')) ? getIcon('file-text', 14) : getIcon('file', 14);
                            const subName = document.createElement('div');
                            subName.className = 'file-name';
                            subName.textContent = sub.name;
                            subItem.appendChild(subIcon);
                            subItem.appendChild(subName);
                            if (!sub.isDirectory) {
                                subItem.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    window.electronAPI.openFilePath(sub.path);
                                });
                            }
                            children.appendChild(subItem);
                        }
                        loaded = true;
                    }
                    children.classList.toggle('collapsed');
                    // Safe: getIcon() returns static SVG from hardcoded ICON_PATHS
                    icon.innerHTML = children.classList.contains('collapsed') ? getIcon('folder-closed', 14) : getIcon('folder-open', 14);
                });

                fileExplorer.appendChild(item);
                fileExplorer.appendChild(children);
            } else {
                item.addEventListener('click', () => {
                    window.electronAPI.openFilePath(entry.path);
                });
                fileExplorer.appendChild(item);
            }
        }
    } catch (error) {
        console.error('Error loading file tree:', error);
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

    if (!previewElement || !previewElement.innerHTML || previewElement.innerHTML.trim().length === 0) {
        alert('Der Preview-Bereich ist leer. Bitte stellen Sie sicher, dass Markdown-Inhalt vorhanden ist.');
        return null;
    }

    // Get just the HTML content, not a clone
    const htmlContent = previewElement.innerHTML;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
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

function toggleLineNumbers() {
    lineNumbers = !lineNumbers;
    editor.setLineNumbers(lineNumbers);
}

function updateLineNumbers() {
    // No-op: CM6 handles line numbers natively
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    settings.theme = isLight ? 'light' : 'dark';
    editor.setTheme(!isLight);
    saveSettings();
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

function showSettings() {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;

    // Populate current values
    document.getElementById('settingsFontSize').value = settings.fontSize || 14;
    document.getElementById('settingsTabSize').value = settings.tabSize || 4;
    document.getElementById('settingsAutoSave').checked = settings.autoSave || false;
    document.getElementById('settingsLineNumbers').checked = settings.showLineNumbers || false;
    document.getElementById('settingsWordWrap').checked = settings.wordWrap !== false;
    document.getElementById('settingsSyncScroll').checked = settings.syncScroll !== false;
    document.getElementById('settingsAutoSaveInterval').value = settings.autoSaveInterval || 5;

    modal.classList.add('visible');
}

function closeSettingsDialog() {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.remove('visible');
}

function applySettings() {
    const newFontSize = parseInt(document.getElementById('settingsFontSize').value);
    const newTabSize = parseInt(document.getElementById('settingsTabSize').value);
    const newAutoSave = document.getElementById('settingsAutoSave').checked;
    const newLineNumbers = document.getElementById('settingsLineNumbers').checked;
    const newWordWrap = document.getElementById('settingsWordWrap').checked;
    const newSyncScroll = document.getElementById('settingsSyncScroll').checked;
    const newAutoSaveInterval = parseInt(document.getElementById('settingsAutoSaveInterval').value);

    settings.fontSize = Math.max(10, Math.min(32, newFontSize || 14));
    settings.tabSize = Math.max(1, Math.min(8, newTabSize || 4));
    settings.autoSave = newAutoSave;
    settings.showLineNumbers = newLineNumbers;
    settings.wordWrap = newWordWrap;
    settings.syncScroll = newSyncScroll;
    settings.autoSaveInterval = Math.max(1, Math.min(60, newAutoSaveInterval || 5));

    // Apply font size
    editor.style.fontSize = settings.fontSize + 'px';

    // Apply tab size
    editor.style.tabSize = settings.tabSize;

    // Apply word wrap
    wordWrap = settings.wordWrap;
    editor.style.whiteSpace = wordWrap ? 'pre-wrap' : 'pre';

    // Apply line numbers
    if (settings.showLineNumbers !== lineNumbers) {
        toggleLineNumbers();
    }

    // Apply sync scroll indicator
    const syncToggle = document.getElementById('scrollSyncToggle');
    if (syncToggle) {
        syncToggle.style.opacity = settings.syncScroll ? '1' : '0.5';
    }

    saveSettings();
    closeSettingsDialog();
}

function saveSettings() {
    if (window.electronAPI) {
        window.electronAPI.saveSettings(settings);
    }
}

// Global Shortcuts
function handleGlobalShortcuts(e) {
    // ESC to close dialogs
    if (e.key === 'Escape') {
        if (autocompleteVisible) {
            e.preventDefault();
            hideAutocomplete();
            return;
        }
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
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal && settingsModal.classList.contains('visible')) {
            e.preventDefault();
            closeSettingsDialog();
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
                if (e.shiftKey) {
                    deleteLine();
                } else {
                    insertLink();
                }
                break;
            case 'd':
                e.preventDefault();
                duplicateLine();
                break;
            case 'l':
                e.preventDefault();
                selectCurrentLine();
                break;
            case '/':
                e.preventDefault();
                toggleComment();
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
            case 'x':
                if (e.shiftKey) {
                    e.preventDefault();
                    formatStrikethrough();
                }
                break;
            case 'z':
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

    // Alt+Arrow shortcuts for line movement
    if (e.altKey && !e.metaKey && !e.ctrlKey) {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveLineUp();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveLineDown();
        }
    }

}

// Utility Functions
function getFileName(filePath) {
    if (!filePath) return 'Unbenannt';
    return filePath.split(/[/\\]/).pop() || filePath;
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

            // Apply all settings
            editor.style.fontSize = settings.fontSize + 'px';
            editor.style.whiteSpace = settings.wordWrap ? 'pre-wrap' : 'pre';
            wordWrap = settings.wordWrap !== false;
            editor.style.tabSize = settings.tabSize || 4;

            // Apply line numbers
            if (settings.showLineNumbers && !lineNumbers) {
                toggleLineNumbers();
            }

            // Apply sync scroll
            const syncToggle = document.getElementById('scrollSyncToggle');
            if (syncToggle) {
                syncToggle.style.opacity = settings.syncScroll !== false ? '1' : '0.5';
            }

            // Apply theme
            if (settings.theme === 'light') {
                document.body.classList.add('light-theme');
                editor.setTheme(false);
            } else {
                document.body.classList.remove('light-theme');
                editor.setTheme(true);
            }
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Auto-save functionality
function scheduleAutoSave() {
    if (!settings.autoSave) return;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        const activeTab = tabs.find(tab => tab.id === activeTabId);
        // Only auto-save if the tab has a file path and is modified
        if (activeTab && activeTab.filePath && activeTab.isModified) {
            saveCurrentFile();
            showAutoSaveIndicator();
        }
    }, (settings.autoSaveInterval || 5) * 1000);
}

// Session save (for crash recovery) - runs every 30 seconds
function startSessionSaver() {
    setInterval(() => {
        saveSessionState();
    }, 30000);

    // Also save on beforeunload
    window.addEventListener('beforeunload', () => {
        saveSessionState();
    });
}

function saveSessionState() {
    if (!window.electronAPI || !window.electronAPI.saveSession) return;
    saveCurrentTabState();
    const sessionData = {
        tabs: tabs.map(tab => ({
            title: tab.title,
            content: tab.content,
            filePath: tab.filePath,
            isModified: tab.isModified,
            cursorPosition: tab.cursorPosition,
            scrollPosition: tab.scrollPosition
        })),
        activeTabId: activeTabId,
        timestamp: Date.now()
    };
    window.electronAPI.saveSession(sessionData);
}

async function checkSessionRestore() {
    if (!window.electronAPI || !window.electronAPI.getSession) return;
    try {
        const session = await window.electronAPI.getSession();
        if (!session || !session.tabs || session.tabs.length === 0) return;

        // Only restore if session is less than 24 hours old
        const maxAge = 24 * 60 * 60 * 1000;
        if (Date.now() - session.timestamp > maxAge) {
            window.electronAPI.clearSession();
            return;
        }

        // Check if any tabs had unsaved content
        const hasUnsaved = session.tabs.some(t => t.isModified || !t.filePath);
        if (!hasUnsaved) {
            window.electronAPI.clearSession();
            return;
        }

        const restore = confirm('Es wurde eine vorherige Sitzung gefunden. Mochten Sie sie wiederherstellen?');
        if (restore) {
            // Clear the default empty tab
            tabs.length = 0;
            nextTabId = 1;

            for (const savedTab of session.tabs) {
                const tab = {
                    id: nextTabId++,
                    title: savedTab.title || 'Unbenannt',
                    content: savedTab.content || '',
                    filePath: savedTab.filePath || null,
                    isModified: savedTab.isModified || false,
                    cursorPosition: savedTab.cursorPosition || 0,
                    scrollPosition: savedTab.scrollPosition || 0
                };
                tabs.push(tab);
            }

            if (tabs.length > 0) {
                activeTabId = tabs[0].id;
                renderTabs();
                loadTabContent(activeTabId);
            }
        }
        window.electronAPI.clearSession();
    } catch (error) {
        console.error('Error restoring session:', error);
    }
}

function showAutoSaveIndicator() {
    const indicator = document.getElementById('autoSaveStatus');
    if (indicator) {
        indicator.textContent = 'Auto-saved';
        indicator.style.color = 'var(--accent-green)';
        setTimeout(() => {
            indicator.textContent = '';
        }, 2000);
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

// --- Table Navigation Helpers ---

function isCursorInTable(pos) {
    const text = editor.value;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    const currentLine = text.substring(lineStart, lineEnd);
    return currentLine.trimStart().startsWith('|') && currentLine.trimEnd().endsWith('|');
}

function navigateTableCell(direction) {
    const text = editor.value;
    const pos = editor.selectionStart;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    const currentLine = text.substring(lineStart, lineEnd);

    // Find all pipe positions in the current line
    const pipes = [];
    for (let i = 0; i < currentLine.length; i++) {
        if (currentLine[i] === '|') pipes.push(lineStart + i);
    }

    const cursorOffset = pos - lineStart;

    if (direction > 0) {
        // Move to next cell: find the next pipe after cursor
        const nextPipe = pipes.find(p => p > pos);
        if (nextPipe !== undefined) {
            // Position cursor after the pipe + space
            const target = Math.min(nextPipe + 2, lineEnd);
            editor.selectionStart = editor.selectionEnd = target;
        } else {
            // Move to first cell of next row
            const nextLineStart = lineEnd + 1;
            if (nextLineStart < text.length) {
                const nextLineEnd = text.indexOf('\n', nextLineStart);
                const nl = text.substring(nextLineStart, nextLineEnd === -1 ? text.length : nextLineEnd);
                // Skip separator rows (| --- | --- |)
                if (nl.match(/^\|[\s-:|]+\|$/)) {
                    const skipLineEnd = text.indexOf('\n', nextLineEnd + 1);
                    if (skipLineEnd !== -1 || nextLineEnd + 1 < text.length) {
                        const targetStart = (nextLineEnd + 1);
                        const targetLine = text.substring(targetStart, skipLineEnd === -1 ? text.length : skipLineEnd);
                        const firstPipe = targetLine.indexOf('|');
                        if (firstPipe !== -1) {
                            editor.selectionStart = editor.selectionEnd = targetStart + firstPipe + 2;
                        }
                    }
                } else {
                    const firstPipe = nl.indexOf('|');
                    if (firstPipe !== -1) {
                        editor.selectionStart = editor.selectionEnd = nextLineStart + firstPipe + 2;
                    }
                }
            }
        }
    } else {
        // Move to previous cell: find the pipe before cursor
        const prevPipes = pipes.filter(p => p < pos - 1);
        if (prevPipes.length >= 2) {
            const target = prevPipes[prevPipes.length - 1] + 2;
            editor.selectionStart = editor.selectionEnd = target;
        }
    }
    editor.focus();
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
        const link = e.target.closest('a[href]');
        if (!link) return;
        const href = link.getAttribute('href');
        if (!href) return;

        // Handle internal anchor links — scroll preview and jump to heading in editor
        if (href.startsWith('#')) {
            e.preventDefault();
            const targetId = href.slice(1);
            // Scroll preview to the heading
            const targetHeading = preview.querySelector(`#${CSS.escape(targetId)}`);
            if (targetHeading) {
                targetHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            // Also jump editor to matching heading line
            const lines = editor.value.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const match = lines[i].match(/^(#{1,6})\s+(.+)/);
                if (match) {
                    const headingText = match[2];
                    const generatedId = headingText
                        .toLowerCase()
                        .trim()
                        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '-')
                        .replace(/\s+/g, '-')
                        .replace(/[^\wäöüßÄÖÜ-]/g, '')
                        .replace(/-+$/g, '');
                    if (generatedId === targetId) {
                        let charPos = 0;
                        for (let j = 0; j < i; j++) charPos += lines[j].length + 1;
                        editor.focus();
                        editor.setSelectionRange(charPos, charPos + lines[i].length);
                        const lineHeight = parseFloat(getComputedStyle(editor.contentDOM).lineHeight) || 20;
                        editor.scrollTop = i * lineHeight - editor.clientHeight / 3;
                        break;
                    }
                }
            }
            return;
        }

        // External links: open in default browser
        if (href.startsWith('http://') || href.startsWith('https://')) {
            e.preventDefault();
            if (window.electronAPI && window.electronAPI.openExternal) {
                window.electronAPI.openExternal(href);
            } else {
                window.open(href, '_blank');
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
    
    // CM6 handles its own dimensions
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

// Handle file deleted externally
function handleFileDeletedExternally(filePath) {
    const tab = tabs.find(tab => tab.filePath === filePath);
    if (!tab) return;

    // Mark as modified (unsaved) and update title to show deletion
    tab.isModified = true;
    tab.title = tab.title + ' (geloscht)';
    tab.filePath = null; // Clear file path so save triggers Save As
    renderTabs();

    if (tab.id === activeTabId) {
        fileName.textContent = tab.title;
    }
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

// Search debounce wrappers
function debouncedSearchUpdate() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        updateSearchResults();
    }, 200);
}

function debouncedReplaceUpdate() {
    clearTimeout(replaceDebounceTimer);
    replaceDebounceTimer = setTimeout(() => {
        updateReplaceResults();
    }, 200);
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
        // Show regex error to user
        const prefix = isReplace ? 'replace' : 'search';
        const resultInfo = document.getElementById(`${prefix}ResultInfo`);
        if (resultInfo) {
            resultInfo.textContent = `Regex-Fehler: ${e.message}`;
            resultInfo.style.color = 'var(--accent-red)';
        }
        return [];
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
        // Replace current selection (undo-safe)
        replaceRange(selectionStart, selectionEnd, replaceTerm);
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

    // Build new value by replacing from end to start to maintain indices
    let newValue = editor.value;
    for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        newValue = newValue.substring(0, match.start) + replaceTerm + newValue.substring(match.end);
    }

    replaceRange(0, editor.value.length, newValue);

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
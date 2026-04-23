// A2: Electron dialog helpers (replace browser confirm/prompt/alert)
async function showConfirm(message, detail) {
    if (window.electronAPI && window.electronAPI.showConfirmDialog) {
        const result = await window.electronAPI.showConfirmDialog({
            message,
            detail,
            buttons: ['OK', 'Abbrechen'],
            defaultId: 0,
            cancelId: 1
        });
        return result === 0;
    }
    return confirm(message); // fallback
}

async function showAlert(message, detail) {
    if (window.electronAPI && window.electronAPI.showAlertDialog) {
        await window.electronAPI.showAlertDialog({ message, detail });
        return;
    }
    alert(message); // fallback
}

function showInputDialog(title, placeholder, defaultValue) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('inputDialog');
        const titleEl = document.getElementById('inputDialogTitle');
        const field = document.getElementById('inputDialogField');
        const okBtn = document.getElementById('inputDialogOk');
        const cancelBtn = document.getElementById('inputDialogCancel');
        if (!overlay || !field) { resolve(null); return; }

        titleEl.textContent = title;
        field.placeholder = placeholder || '';
        field.value = defaultValue || '';
        overlay.style.display = '';
        overlay.classList.add('visible');
        field.focus();
        field.select();

        function cleanup() {
            overlay.style.display = 'none';
            overlay.classList.remove('visible');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            field.removeEventListener('keydown', onKey);
        }
        function onOk() { cleanup(); resolve(field.value); }
        function onCancel() { cleanup(); resolve(null); }
        function onKey(e) {
            if (e.key === 'Enter') { e.preventDefault(); onOk(); }
            if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        }

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        field.addEventListener('keydown', onKey);
    });
}

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
    syncScroll: true,
    writingGoal: 0
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
    window.showInputDialog = showInputDialog;
});

// Per-render heading-id counter map. Reset at the top of each renderMarkdown call.
// Declared at module scope so the custom marked renderer (configured once at startup)
// can see it via closure without needing to be rebuilt per render.
let markedHeadingIds = {};

function configureMarkedOnce() {
    if (typeof marked === 'undefined') return;
    const renderer = new marked.Renderer();
    renderer.heading = function(text, level, raw) {
        const id = generateHeadingId(raw, markedHeadingIds);
        return `<h${level} id="${id}">${text}</h${level}>`;
    };
    marked.use({
        gfm: true,
        breaks: false,
        headerIds: false,
        mangle: false,
        renderer: renderer,
        sanitize: false,
        pedantic: false
    });
}

function initializeApp() {
    // Configure marked once — was previously rebuilt on every renderMarkdown call,
    // which thrashed global state and made batch-export susceptible to races.
    configureMarkedOnce();

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
    
    // E2: Setup sidebar resize
    setupSidebarResize();

    // C2: Setup image paste handler
    setupImagePaste();

    // C7: Setup image drag & drop
    setupImageDragDrop();

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

// Promise-based save for close-flow. Resolves with { success, cancelled? }.
// Uses the tab's own content, not editor.value, so we can save inactive tabs too.
async function saveTabAndWait(tab) {
    if (!window.electronAPI) return { success: false };
    const content = (tab.id === activeTabId) ? editor.value : (tab.content || '');
    if (tab.filePath) {
        return await window.electronAPI.saveFileSync(content, tab.filePath);
    }
    return await window.electronAPI.saveFileAsSync(content, null, tab.title);
}

async function closeTab(tabId) {
    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) return;

    const tab = tabs[tabIndex];

    if (tab.isModified) {
        const choice = await window.electronAPI.showConfirmDialog({
            message: `Änderungen in "${tab.title}" speichern?`,
            detail: 'Ungespeicherte Änderungen gehen sonst verloren.',
            buttons: ['Speichern', 'Verwerfen', 'Abbrechen'],
            defaultId: 0,
            cancelId: 2
        });
        if (choice === 2) return; // Abbrechen
        if (choice === 0) {
            const result = await saveTabAndWait(tab);
            if (!result || !result.success) return; // Save failed or user cancelled Save-As
        }
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

// Returns true if all unsaved tabs in `candidates` were handled (saved/discarded),
// false if the user cancelled. Saves sequentially to avoid save-dialog stacking.
async function handleUnsavedTabs(candidates) {
    const unsaved = candidates.filter(t => t.isModified);
    if (unsaved.length === 0) return true;

    const message = unsaved.length === 1
        ? `Änderungen in "${unsaved[0].title}" speichern?`
        : `${unsaved.length} Tabs mit ungespeicherten Änderungen — alle speichern?`;

    const choice = await window.electronAPI.showConfirmDialog({
        message,
        detail: 'Ungespeicherte Änderungen gehen sonst verloren.',
        buttons: ['Alle speichern', 'Verwerfen', 'Abbrechen'],
        defaultId: 0,
        cancelId: 2
    });
    if (choice === 2) return false; // Abbrechen
    if (choice === 1) return true;  // Verwerfen
    // Alle speichern — sequentiell
    for (const t of unsaved) {
        const result = await saveTabAndWait(t);
        if (!result || !result.success) return false;
    }
    return true;
}

async function closeOtherTabs(keepTabId) {
    const tabsToClose = tabs.filter(t => t.id !== keepTabId);
    if (!(await handleUnsavedTabs(tabsToClose))) return;
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

async function closeAllTabs() {
    if (!(await handleUnsavedTabs(tabs))) return;
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
        // F3: Save preview scroll position per tab
        if (preview) activeTab.previewScrollPosition = preview.scrollTop;
        // A6: Save full CM6 EditorState (includes undo history)
        if (editor.getState) {
            activeTab.editorState = editor.getState();
        }
    }
}

function loadTabContent(tabId) {
    const tab = tabs.find(tab => tab.id === tabId);
    if (!tab) return;

    // A6: Restore full CM6 EditorState if available (preserves undo history)
    if (tab.editorState && editor.setState) {
        editor.setState(tab.editorState);
    } else {
        editor.value = tab.content;
        editor.selectionStart = tab.cursorPosition;
        editor.selectionEnd = tab.cursorPosition;
    }
    editor.scrollTop = tab.scrollPosition;

    // F3: Restore preview scroll position per tab
    if (preview && tab.previewScrollPosition !== undefined) {
        // Defer to after renderMarkdown fills the preview content
        setTimeout(() => { preview.scrollTop = tab.previewScrollPosition; }, 50);
    }

    fileName.textContent = tab.title;

    if (window.electronAPI) {
        window.electronAPI.updateWindowTitle(tab.title + (tab.isModified ? ' •' : ''));
    }

    // Update UI based on file type
    updateUIForFileType(tab);
    renderMarkdown();
    // Refresh stats immediately on tab-switch — no debounce, user expects to see correct counters
    updateLineNumbers();
    updateCursorPosition();
    clearTimeout(statsDebounceTimer);
    updateStatsHeavy();

    // E3: Highlight active file in sidebar tree
    highlightActiveFileInTree();
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

        // E6: Tab preview tooltip — show first 5 lines
        const previewContent = (tab.id === activeTabId ? editor.value : (tab.content || ''));
        const previewLines = previewContent.split('\n').slice(0, 5).join('\n');
        tabElement.title = previewLines || tab.title;

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
        let markdown = editor.value;

        // D7: Parse YAML frontmatter
        let frontmatter = null;
        const fmMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
        if (fmMatch) {
            frontmatter = fmMatch[1];
            markdown = markdown.substring(fmMatch[0].length);
        }

        // Reset per-render heading-id counter. The custom renderer (configured once
        // at startup via configureMarkedOnce) reads this via closure, so we just clear it.
        markedHeadingIds = {};

        const html = marked.parse(markdown);

        const sanitized = DOMPurify.sanitize(html, {
            ADD_ATTR: ['id'], // Allow id attribute for heading anchors
            ADD_TAGS: ['br'], // Explicitly allow br tags
            KEEP_CONTENT: true
        });

        // F1: Build new content in temporary container for morphdom diffing
        const newPreview = document.createElement('div');
        newPreview.id = 'preview';
        newPreview.className = preview.className;

        // D7: Render frontmatter as info box if present
        if (frontmatter) {
            const fmBox = document.createElement('div');
            fmBox.className = 'frontmatter-box';
            const fmTitle = document.createElement('div');
            fmTitle.className = 'frontmatter-title';
            fmTitle.textContent = 'Frontmatter';
            fmBox.appendChild(fmTitle);
            const fmPre = document.createElement('pre');
            fmPre.textContent = frontmatter;
            fmBox.appendChild(fmPre);
            newPreview.appendChild(fmBox);
        }

        // Set sanitized content
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = sanitized;
        while (contentDiv.firstChild) {
            newPreview.appendChild(contentDiv.firstChild);
        }

        // D1/D2: Post-processing passes on newPreview before morphdom
        renderMathInPreview(newPreview);
        highlightCodeBlocksInPreview(newPreview);
        // Mermaid blocks extracted here, rendered async after morphdom lands
        const mermaidBlocks = extractMermaidBlocks(newPreview);

        // F1: Use morphdom for incremental DOM updates (preserves scroll, less layout thrashing)
        if (typeof morphdom !== 'undefined') {
            morphdom(preview, newPreview, {
                onBeforeElUpdated: function(fromEl, toEl) {
                    // Preserve scroll position of preview
                    return true;
                }
            });
        } else {
            // Fallback: full replacement
            preview.textContent = '';
            while (newPreview.firstChild) {
                preview.appendChild(newPreview.firstChild);
            }
        }

        // E4: Add data-source-line attributes to block-level elements for scroll sync
        addSourceLineAttributes(markdown, frontmatter ? fmMatch[0].split('\n').length - 1 : 0);

        // C6: Setup checkbox toggle — map preview checkboxes to source lines
        setupCheckboxToggle();

        // Update document outline in sidebar
        updateDocumentOutline();

        // D1: Render mermaid diagrams async (lazy-loads mermaid on first block)
        if (mermaidBlocks.length > 0) {
            renderMermaidBlocks(mermaidBlocks);
        }
    }
}

// D2: KaTeX math renderer, applied to newPreview before morphdom.
// renderMathInElement is from KaTeX's auto-render contrib, loaded via script defer in index.html.
function renderMathInPreview(root) {
    if (typeof renderMathInElement !== 'function') return;
    try {
        renderMathInElement(root, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '\\[', right: '\\]', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false }
            ],
            throwOnError: false,
            errorColor: '#e06c75',
            ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
        });
    } catch (e) {
        console.warn('KaTeX render failed:', e);
    }
}

// D3: Syntax-highlight fenced code blocks via hljs (mirrors the PDF pipeline).
// hljs.highlight() emits well-formed HTML with only <span class="hljs-*"> wrappers;
// output is still piped through DOMPurify as defense in depth.
function highlightCodeBlocksInPreview(root) {
    if (typeof hljs === 'undefined') return;
    root.querySelectorAll('pre > code[class*="language-"]').forEach(codeEl => {
        const langMatch = codeEl.className.match(/language-(\S+)/);
        if (!langMatch) return;
        const lang = langMatch[1];
        if (lang === 'mermaid') return; // handled by mermaid renderer
        try {
            const result = hljs.getLanguage(lang)
                ? hljs.highlight(codeEl.textContent, { language: lang, ignoreIllegals: true })
                : hljs.highlightAuto(codeEl.textContent);
            const safe = DOMPurify.sanitize(result.value, {
                ALLOWED_TAGS: ['span'],
                ALLOWED_ATTR: ['class']
            });
            codeEl.innerHTML = safe;
            codeEl.classList.add('hljs');
        } catch (_) { /* unknown language — leave as plain text */ }
    });
}

// D1: Mermaid integration. Mermaid is ~3 MB, so we lazy-load on first use
// and cache rendered SVG via source hash to avoid re-rendering unchanged blocks.
const mermaidSvgCache = new Map(); // source -> svgHtml
let _mermaidLoadPromise = null;

function loadMermaid() {
    if (typeof mermaid !== 'undefined') return Promise.resolve();
    if (_mermaidLoadPromise) return _mermaidLoadPromise;
    _mermaidLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'vendor/mermaid.min.js';
        script.onload = () => {
            if (typeof mermaid !== 'undefined') {
                mermaid.initialize({
                    startOnLoad: false,
                    theme: document.body.classList.contains('light-theme') ? 'default' : 'dark',
                    securityLevel: 'strict'
                });
            }
            resolve();
        };
        script.onerror = () => reject(new Error('Failed to load mermaid'));
        document.head.appendChild(script);
    });
    return _mermaidLoadPromise;
}

function extractMermaidBlocks(root) {
    const blocks = [];
    root.querySelectorAll('pre > code.language-mermaid, pre > code[class*="language-mermaid"]').forEach(codeEl => {
        const pre = codeEl.parentElement;
        const placeholder = document.createElement('div');
        placeholder.className = 'mermaid-placeholder';
        placeholder.dataset.mermaidSource = codeEl.textContent;
        pre.parentNode.replaceChild(placeholder, pre);
        blocks.push(placeholder);
    });
    return blocks;
}

async function renderMermaidBlocks(placeholders) {
    try {
        await loadMermaid();
    } catch (e) {
        console.warn('Mermaid load failed:', e);
        return;
    }
    if (typeof mermaid === 'undefined') return;
    // The placeholders were in newPreview; after morphdom they are in `preview`.
    // Re-query by the data attribute to get the live nodes.
    const live = preview.querySelectorAll('.mermaid-placeholder');
    for (let i = 0; i < live.length; i++) {
        const el = live[i];
        const source = el.dataset.mermaidSource;
        if (!source) continue;
        if (mermaidSvgCache.has(source)) {
            el.innerHTML = DOMPurify.sanitize(mermaidSvgCache.get(source), {
                USE_PROFILES: { svg: true, svgFilters: true }
            });
            continue;
        }
        try {
            const id = 'mermaid-' + Math.random().toString(36).slice(2, 10);
            const { svg } = await mermaid.render(id, source);
            mermaidSvgCache.set(source, svg);
            el.innerHTML = DOMPurify.sanitize(svg, {
                USE_PROFILES: { svg: true, svgFilters: true }
            });
        } catch (err) {
            el.textContent = 'Mermaid-Fehler: ' + (err && err.message ? err.message : String(err));
            el.style.color = '#e06c75';
        }
    }
}

// E4: Map preview block elements to source line numbers for paragraph-level scroll sync
function addSourceLineAttributes(markdown, lineOffset) {
    const lines = markdown.split('\n');
    const blockElements = preview.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, pre, blockquote, table, hr');
    let searchFromLine = 0;

    blockElements.forEach(el => {
        const text = (el.textContent || '').trim();
        if (!text && el.tagName !== 'HR') return;

        // For headings, match by heading marker + text
        if (/^H[1-6]$/.test(el.tagName)) {
            const level = parseInt(el.tagName[1]);
            const prefix = '#'.repeat(level) + ' ';
            for (let i = searchFromLine; i < lines.length; i++) {
                if (lines[i].startsWith(prefix)) {
                    el.setAttribute('data-source-line', i + lineOffset);
                    searchFromLine = i + 1;
                    return;
                }
            }
        }

        // For HRs, match --- or *** or ___
        if (el.tagName === 'HR') {
            for (let i = searchFromLine; i < lines.length; i++) {
                if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(lines[i])) {
                    el.setAttribute('data-source-line', i + lineOffset);
                    searchFromLine = i + 1;
                    return;
                }
            }
        }

        // For other blocks, find a line whose content overlaps the element text
        const firstWords = text.substring(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (firstWords.length < 3) return;
        for (let i = searchFromLine; i < lines.length; i++) {
            const lineClean = lines[i].replace(/^[>\-*+\d.]+\s*/, '').replace(/[`*_~\[\]()]/g, '');
            if (lineClean.length > 2 && text.includes(lineClean.trim().substring(0, 30))) {
                el.setAttribute('data-source-line', i + lineOffset);
                searchFromLine = i + 1;
                return;
            }
        }
    });
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

// Heavy stats (full-doc scan + lint) are debounced so they don't run on every keystroke.
// Cursor position and line-number gutter stay on the synchronous path — those must feel instant.
let statsDebounceTimer = null;
const STATS_DEBOUNCE_MS = 250;

function updateStats() {
    if (!editor || !charCount || !wordCount || !lineCount) return;
    // Cheap, synchronous updates — keep on the hot path
    updateLineNumbers();
    updateCursorPosition();
    // Heavy, debounced updates — analyzeDocument + lintMarkdown each scan the full document
    clearTimeout(statsDebounceTimer);
    statsDebounceTimer = setTimeout(updateStatsHeavy, STATS_DEBOUNCE_MS);
}

function updateStatsHeavy() {
    if (!editor || !charCount || !wordCount || !lineCount) return;
    const text = editor.value;

    if (typeof analyzeDocument === 'function') {
        const stats = analyzeDocument(text);
        charCount.textContent = `${stats.chars} Zeichen`;
        wordCount.textContent = `${stats.words} Wörter`;
        lineCount.textContent = `${stats.lineCount} Zeilen`;

        const paragraphEl = document.getElementById('paragraphCount');
        if (paragraphEl) paragraphEl.textContent = `${stats.paragraphs} Absätze`;

        const readingEl = document.getElementById('readingTime');
        if (readingEl) readingEl.textContent = `~${stats.readingTimeMin} Min.`;

        updateSessionStats(stats.words);
        updateLintWarnings(text);
    } else {
        const chars = text.length;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const lines = text.split('\n').length;
        charCount.textContent = `${chars} Zeichen`;
        wordCount.textContent = `${words} Wörter`;
        lineCount.textContent = `${lines} Zeilen`;
    }
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
    const fromEditor = (sourceElement === editor);

    if (scrollSyncRAF) cancelAnimationFrame(scrollSyncRAF);
    scrollSyncRAF = requestAnimationFrame(() => {
        isScrollSyncing = true;

        // E4: Paragraph-level scroll sync using data-source-line attributes
        const lineElements = preview.querySelectorAll('[data-source-line]');

        if (lineElements.length > 1 && fromEditor && editor.getFirstVisibleLine) {
            // Editor → Preview: find first visible line, scroll preview to matching element
            const visibleLine = editor.getFirstVisibleLine();
            let bestEl = null;
            let bestLine = -1;
            for (const el of lineElements) {
                const srcLine = parseInt(el.getAttribute('data-source-line'), 10);
                if (srcLine <= visibleLine && srcLine > bestLine) {
                    bestLine = srcLine;
                    bestEl = el;
                }
            }
            if (bestEl) {
                const elTop = bestEl.offsetTop - preview.offsetTop;
                if (Math.abs(preview.scrollTop - elTop) > 10) {
                    preview.scrollTop = elTop;
                }
            }
        } else if (lineElements.length > 1 && !fromEditor && editor.scrollToLine) {
            // Preview → Editor: find visible element in preview, scroll editor to that line
            const previewTop = preview.scrollTop;
            let bestEl = null;
            let bestDist = Infinity;
            for (const el of lineElements) {
                const dist = Math.abs(el.offsetTop - preview.offsetTop - previewTop);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestEl = el;
                }
            }
            if (bestEl) {
                const srcLine = parseInt(bestEl.getAttribute('data-source-line'), 10);
                editor.scrollToLine(srcLine);
            }
        } else {
            // Fallback: ratio-based scroll sync
            const src = fromEditor ? editor : preview;
            const tgt = fromEditor ? preview : editor;
            const srcMax = src.scrollHeight - src.clientHeight;
            const tgtMax = tgt.scrollHeight - tgt.clientHeight;
            if (srcMax > 0 && tgtMax > 0) {
                const ratio = src.scrollTop / srcMax;
                const targetTop = ratio * tgtMax;
                if (Math.abs(tgt.scrollTop - targetTop) > 5) {
                    tgt.scrollTop = targetTop;
                }
            }
        }

        setTimeout(() => {
            isScrollSyncing = false;
        }, 50);
    });
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

async function insertLink() {
    const url = await showInputDialog('Link einfügen', 'https://...', '');
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
    const firstLineOffset = 4;
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
    // Try native file picker first (Electron), fall back to URL input
    if (window.electronAPI && window.electronAPI.selectImage) {
        const imagePath = await window.electronAPI.selectImage();
        if (imagePath) {
            const alt = (await showInputDialog('Alt-Text eingeben', 'Beschreibung...', 'Bild')) || 'Bild';
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
    // Fallback: input dialog for URL
    const url = await showInputDialog('Bild einfügen', 'https://...', '');
    if (url) {
        const alt = (await showInputDialog('Alt-Text eingeben', 'Beschreibung...', 'Bild')) || 'Bild';
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

function handleFileSaved(filePath) {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (activeTab) {
        const previousPath = activeTab.filePath;
        activeTab.filePath = filePath;
        activeTab.title = getFileName(filePath);
        activeTab.isModified = false;

        // Keep the filesystem watcher in sync with the tab's new path.
        // Otherwise Save-As silently leaves the old path watched (and new unwatched),
        // so external changes to the freshly saved file wouldn't trigger the reload prompt.
        if (window.electronAPI && previousPath !== filePath) {
            if (previousPath) window.electronAPI.unwatchFile(previousPath);
            window.electronAPI.watchFile(filePath);
        }

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
        showAlert('Der Preview-Bereich ist leer.', 'Bitte stellen Sie sicher, dass Markdown-Inhalt vorhanden ist.');
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

async function batchExportPDF() {
    // Ensure current tab content is saved to the tabs array before exporting
    saveCurrentTabState();

    // Get all tabs that have file paths (saved files)
    const tabsWithFiles = tabs.filter(tab => tab.filePath && tab.filePath !== null);

    if (tabsWithFiles.length === 0) {
        await showAlert('Keine gespeicherten Dateien gefunden.', 'Speichern Sie zuerst Ihre Markdown-Dateien.');
        return;
    }

    const confirmExport = await showConfirm(`${tabsWithFiles.length} Markdown-Dateien als PDF exportieren?`);
    if (!confirmExport) return;

    console.log('Batch exporting PDFs for tabs:', tabsWithFiles.map(tab => tab.filePath));

    if (window.electronAPI && window.electronAPI.batchPrintToPDF) {
        const tabData = tabsWithFiles.map(tab => ({
            filePath: tab.filePath,
            content: tab.content,
            title: tab.title
        }));
        window.electronAPI.batchPrintToPDF(tabData);
    } else {
        await showAlert('PDF-Batch-Export nicht verfügbar.');
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
    // Keep hljs + mermaid themes in sync with the app theme
    const hljsLink = document.getElementById('hljs-theme');
    if (hljsLink) hljsLink.href = isLight ? 'vendor/hljs-light.css' : 'vendor/hljs-dark.css';
    if (typeof mermaid !== 'undefined') {
        mermaidSvgCache.clear();
        mermaid.initialize({
            startOnLoad: false,
            theme: isLight ? 'default' : 'dark',
            securityLevel: 'strict'
        });
    }
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
    document.getElementById('settingsWritingGoal').value = settings.writingGoal || 0;

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

    const newWritingGoal = parseInt(document.getElementById('settingsWritingGoal').value);
    settings.writingGoal = Math.max(0, Math.min(50000, newWritingGoal || 0));

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

    // B2: Apply writing goal
    updateWritingGoal();

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
        if (commandPaletteVisible) {
            e.preventDefault();
            closeCommandPalette();
            return;
        }
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
        const tabOverviewModal = document.getElementById('tabOverviewModal');
        if (tabOverviewModal && tabOverviewModal.classList.contains('visible')) {
            e.preventDefault();
            closeTabOverview();
            return;
        }
        const pdfOptionsModal = document.getElementById('pdfOptionsModal');
        if (pdfOptionsModal && pdfOptionsModal.classList.contains('visible')) {
            e.preventDefault();
            closePdfOptionsDialog();
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
                if (e.shiftKey) {
                    showTabOverview();
                } else {
                    showTableEditor();
                }
                break;
            case '`':
                e.preventDefault();
                formatCode();
                break;
            case 'f':
                e.preventDefault();
                if (e.shiftKey) {
                    toggleFocusMode();
                } else {
                    showSearchDialog();
                }
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
                if (e.shiftKey) {
                    showCommandPalette();
                } else {
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

            // E2: Apply sidebar width
            if (settings.sidebarWidth && sidebar) {
                sidebar.style.width = settings.sidebarWidth + 'px';
            }

            // Apply sync scroll
            const syncToggle = document.getElementById('scrollSyncToggle');
            if (syncToggle) {
                syncToggle.style.opacity = settings.syncScroll !== false ? '1' : '0.5';
            }

            // Apply theme
            const isLight = settings.theme === 'light';
            if (isLight) {
                document.body.classList.add('light-theme');
                editor.setTheme(false);
            } else {
                document.body.classList.remove('light-theme');
                editor.setTheme(true);
            }
            const hljsLink = document.getElementById('hljs-theme');
            if (hljsLink) hljsLink.href = isLight ? 'vendor/hljs-light.css' : 'vendor/hljs-dark.css';
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
        activeTabIndex: tabs.findIndex(t => t.id === activeTabId),
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

        // Only restore if there is real unsaved work: a modified tab, or a new tab with content
        const hasUnsaved = session.tabs.some(t => t.isModified || (!t.filePath && t.content && t.content.trim()));
        if (!hasUnsaved) {
            window.electronAPI.clearSession();
            return;
        }

        const restore = await showConfirm('Es wurde eine vorherige Sitzung gefunden. Möchten Sie sie wiederherstellen?');
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
                // Restore the previously active tab.
                // The saved activeTabId may not match restored IDs (tabs get new sequential IDs),
                // so we also save/restore the active tab index as a fallback.
                const matchingTab = tabs.find(t => t.id === session.activeTabId);
                if (matchingTab) {
                    activeTabId = matchingTab.id;
                } else if (session.activeTabIndex != null && session.activeTabIndex < tabs.length) {
                    activeTabId = tabs[session.activeTabIndex].id;
                } else {
                    activeTabId = tabs[0].id;
                }
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
    // E5: Let native Electron context menu handle editor and preview panes
    const editorPane = document.getElementById('editorPane');
    const previewPane = document.getElementById('previewPane');
    if ((editorPane && editorPane.contains(e.target)) || (previewPane && previewPane.contains(e.target))) {
        return; // Don't prevent default — let Electron's native context menu show
    }

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
        showAlert('Ungültige Tabellengröße.', 'Zeilen: 1-20, Spalten: 1-10');
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
            // Also jump editor to matching heading line.
            // idCounts must be maintained across the loop so duplicate headings resolve to foo / foo-1 / foo-2 like in the rendered DOM.
            const lines = editor.value.split('\n');
            const idCounts = {};
            for (let i = 0; i < lines.length; i++) {
                const match = lines[i].match(/^(#{1,6})\s+(.+)/);
                if (match) {
                    const generatedId = generateHeadingId(match[2], idCounts);
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
async function handleFileChangedExternally(filePath, newContent) {
    console.log('handleFileChangedExternally called with:', filePath);
    const tab = tabs.find(tab => tab.filePath === filePath);
    if (!tab) {
        console.log('No tab found for file:', filePath);
        return;
    }

    console.log('Tab found:', tab.title, 'isModified:', tab.isModified);

    // Check if the current tab has unsaved changes
    if (tab.isModified) {
        const result = await showConfirm(
            `Die Datei "${tab.title}" wurde extern geändert.`,
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
    tab.title = tab.title + ' (gelöscht)';
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
        }, 1500); // TODO: Replace with a promise-based approach (e.g., MutationObserver or render callback) instead of a fixed timeout
        
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

async function replaceAll() {
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

    const confirmReplace = await showConfirm(`${matches.length} Treffer gefunden. Alle ersetzen?`);
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


// --- E2: Sidebar Resize ---
function setupSidebarResize() {
    const handle = document.getElementById('sidebarResizeHandle');
    if (!handle || !sidebar) return;

    let startX = 0;
    let startWidth = 0;

    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        startX = e.clientX;
        startWidth = sidebar.offsetWidth;
        handle.classList.add('active');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        const delta = e.clientX - startX;
        const newWidth = Math.max(150, Math.min(500, startWidth + delta));
        sidebar.style.width = newWidth + 'px';
    }

    function onMouseUp() {
        handle.classList.remove('active');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        // Persist sidebar width in settings
        settings.sidebarWidth = sidebar.offsetWidth;
        saveSettings();
    }
}

// --- D4: PDF Options Dialog ---
function showPdfOptionsDialog() {
    const modal = document.getElementById('pdfOptionsModal');
    if (modal) modal.classList.add('visible');
}

function closePdfOptionsDialog() {
    const modal = document.getElementById('pdfOptionsModal');
    if (modal) modal.classList.remove('visible');
}

function exportPDFWithOptions() {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    const pdfOptions = {
        pageSize: document.getElementById('pdfPageSize').value,
        orientation: document.getElementById('pdfOrientation').value,
        margin: parseInt(document.getElementById('pdfMargin').value) || 20,
        fontSize: parseInt(document.getElementById('pdfFontSize').value) || 11,
        toc: document.getElementById('pdfToc').checked,
        pageNumbers: document.getElementById('pdfPageNumbers').checked
    };

    if (window.electronAPI && window.electronAPI.printToPDFOptions) {
        window.electronAPI.printToPDFOptions({
            filePath: activeTab ? activeTab.filePath : null,
            pdfOptions
        });
    }
    closePdfOptionsDialog();
}

// --- C4: Focus Mode ---
let focusModeActive = false;

function toggleFocusMode() {
    focusModeActive = !focusModeActive;
    if (editor && editor.setFocusMode) {
        editor.setFocusMode(focusModeActive);
    }
}

// --- C5: Typewriter Mode ---
let typewriterModeActive = false;

function toggleTypewriterMode() {
    typewriterModeActive = !typewriterModeActive;
    if (editor && editor.setTypewriterMode) {
        editor.setTypewriterMode(typewriterModeActive);
    }
}

// --- C6: Checkbox Toggle in Preview ---
function setupCheckboxToggle() {
    const checkboxes = preview.querySelectorAll('input[type="checkbox"]');
    const text = editor.value;
    const lines = text.split('\n');

    // Find all task list lines and map to checkboxes in order
    const taskLines = [];
    for (let i = 0; i < lines.length; i++) {
        if (/^\s*[-*+]\s+\[([ xX])\]/.test(lines[i])) {
            taskLines.push(i);
        }
    }

    checkboxes.forEach((cb, idx) => {
        if (idx < taskLines.length) {
            cb.dataset.line = taskLines[idx];
            cb.style.cursor = 'pointer';
            cb.disabled = false;
            cb.addEventListener('change', (e) => {
                const lineIdx = parseInt(e.target.dataset.line);
                const text = editor.value;
                const lines = text.split('\n');
                if (lineIdx < lines.length) {
                    // Calculate char position of this line
                    let lineStart = 0;
                    for (let i = 0; i < lineIdx; i++) lineStart += lines[i].length + 1;

                    // Find the exact position of [ ] or [x] within the line
                    const line = lines[lineIdx];
                    const bracketMatch = e.target.checked
                        ? line.match(/\[\s\]/)
                        : line.match(/\[[xX]\]/);
                    if (bracketMatch) {
                        const bracketStart = lineStart + bracketMatch.index;
                        const bracketEnd = bracketStart + 3; // [ ] or [x] is always 3 chars
                        const replacement = e.target.checked ? '[x]' : '[ ]';
                        replaceRange(bracketStart, bracketEnd, replacement);
                    }
                    handleEditorInput();
                }
            });
        }
    });
}

// --- C2: Image Paste Handler ---
function setupImagePaste() {
    document.addEventListener('paste', async (e) => {
        if (!e.clipboardData || !e.clipboardData.items) return;

        for (const item of e.clipboardData.items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const blob = item.getAsFile();
                if (!blob) return;

                const activeTab = tabs.find(tab => tab.id === activeTabId);
                const dirPath = activeTab && activeTab.filePath
                    ? activeTab.filePath.replace(/[/\\][^/\\]+$/, '')
                    : null;

                if (!dirPath || !window.electronAPI || !window.electronAPI.saveClipboardImage) {
                    await showAlert('Bitte speichern Sie die Datei zuerst, bevor Sie Bilder einfügen.');
                    return;
                }

                const ext = item.type.split('/')[1] === 'jpeg' ? 'jpg' : item.type.split('/')[1];
                const filename = `paste-${Date.now()}.${ext}`;
                const arrayBuffer = await blob.arrayBuffer();
                const buffer = Array.from(new Uint8Array(arrayBuffer));

                const relativePath = await window.electronAPI.saveClipboardImage({ dirPath, buffer, filename });
                if (relativePath) {
                    const { from, to } = editor.cmView.state.selection.main;
                    editor.cmView.dispatch({
                        changes: { from, to, insert: `![](${relativePath})` },
                        selection: { anchor: from + `![](${relativePath})`.length }
                    });
                }
                return;
            }
        }
    });
}

// --- C7: Image Drag & Drop ---
function setupImageDragDrop() {
    const editorEl = document.getElementById('editorPane');
    if (!editorEl) return;

    editorEl.addEventListener('drop', async (e) => {
        const files = e.dataTransfer ? e.dataTransfer.files : null;
        if (!files || files.length === 0) return;

        const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
        const imageFiles = Array.from(files).filter(f =>
            imageExts.some(ext => f.name.toLowerCase().endsWith(ext))
        );
        if (imageFiles.length === 0) return;

        e.preventDefault();
        e.stopPropagation();

        const activeTab = tabs.find(tab => tab.id === activeTabId);
        const dirPath = activeTab && activeTab.filePath
            ? activeTab.filePath.replace(/[/\\][^/\\]+$/, '')
            : null;

        if (!dirPath || !window.electronAPI || !window.electronAPI.copyImageFile) {
            await showAlert('Bitte speichern Sie die Datei zuerst, bevor Sie Bilder einfügen.');
            return;
        }

        let insertText = '';
        for (const file of imageFiles) {
            const relativePath = await window.electronAPI.copyImageFile({
                sourcePath: file.path,
                dirPath
            });
            if (relativePath) {
                insertText += `![${file.name}](${relativePath})\n`;
            }
        }

        if (insertText) {
            const { from, to } = editor.cmView.state.selection.main;
            editor.cmView.dispatch({
                changes: { from, to, insert: insertText },
                selection: { anchor: from + insertText.length }
            });
        }
    }, true);
}

// --- C1: Command Palette ---
let commandPaletteVisible = false;
let commandRegistry = [];

function registerCommands() {
    commandRegistry = [
        { id: 'new-file', label: 'Neue Datei', shortcut: '\u2318N', action: () => handleMenuAction('new-file') },
        { id: 'open-file', label: 'Datei \u00f6ffnen', shortcut: '\u2318O', action: () => handleMenuAction('open-file') },
        { id: 'save-file', label: 'Speichern', shortcut: '\u2318S', action: () => handleMenuAction('save-file') },
        { id: 'save-file-as', label: 'Speichern unter...', shortcut: '\u2318\u21e7S', action: () => handleMenuAction('save-file-as') },
        { id: 'export-html', label: 'Als HTML exportieren', shortcut: '\u2318E', action: () => handleMenuAction('export-html') },
        { id: 'export-pdf', label: 'Als PDF exportieren', shortcut: '\u2318P', action: () => handleMenuAction('print-to-pdf') },
        { id: 'batch-pdf', label: 'Alle Tabs als PDF exportieren', action: () => handleMenuAction('batch-export-pdf') },
        { id: 'format-bold', label: 'Fett', shortcut: '\u2318B', action: () => formatBold() },
        { id: 'format-italic', label: 'Kursiv', shortcut: '\u2318I', action: () => formatItalic() },
        { id: 'format-code', label: 'Code', shortcut: '\u2318`', action: () => formatCode() },
        { id: 'format-strike', label: 'Durchgestrichen', shortcut: '\u2318\u21e7X', action: () => formatStrikethrough() },
        { id: 'insert-link', label: 'Link einf\u00fcgen', shortcut: '\u2318K', action: () => insertLink() },
        { id: 'insert-table', label: 'Tabelle einf\u00fcgen', shortcut: '\u2318T', action: () => showTableEditor() },
        { id: 'heading-1', label: '\u00dcberschrift 1', shortcut: '\u23181', action: () => insertHeading(1) },
        { id: 'heading-2', label: '\u00dcberschrift 2', shortcut: '\u23182', action: () => insertHeading(2) },
        { id: 'heading-3', label: '\u00dcberschrift 3', shortcut: '\u23183', action: () => insertHeading(3) },
        { id: 'heading-4', label: '\u00dcberschrift 4', shortcut: '\u23184', action: () => insertHeading(4) },
        { id: 'find', label: 'Suchen', shortcut: '\u2318F', action: () => showSearchDialog() },
        { id: 'replace', label: 'Suchen und Ersetzen', shortcut: '\u2318R', action: () => showReplaceDialog() },
        { id: 'toggle-sidebar', label: 'Sidebar umschalten', shortcut: '\u2318\\', action: () => toggleSidebar() },
        { id: 'toggle-theme', label: 'Theme wechseln', action: () => toggleTheme() },
        { id: 'toggle-line-numbers', label: 'Zeilennummern umschalten', action: () => toggleLineNumbers() },
        { id: 'toggle-word-wrap', label: 'Zeilenumbruch umschalten', action: () => toggleWordWrap() },
        { id: 'toggle-comment', label: 'Zeile kommentieren', shortcut: '\u2318/', action: () => toggleComment() },
        { id: 'delete-line', label: 'Zeile l\u00f6schen', shortcut: '\u2318\u21e7K', action: () => deleteLine() },
        { id: 'duplicate-line', label: 'Zeile duplizieren', shortcut: '\u2318D', action: () => duplicateLine() },
        { id: 'indent', label: 'Einr\u00fccken', action: () => indentSelection() },
        { id: 'unindent', label: 'Ausr\u00fccken', action: () => unindentSelection() },
        { id: 'view-editor', label: 'Nur Editor', action: () => setViewMode('editor') },
        { id: 'view-split', label: 'Editor + Vorschau', action: () => setViewMode('split') },
        { id: 'view-preview', label: 'Nur Vorschau', action: () => setViewMode('preview') },
        { id: 'settings', label: 'Einstellungen', action: () => showSettings() },
        { id: 'about', label: '\u00dcber MrxDown', action: () => showAboutDialog() },
        { id: 'tab-overview', label: 'Tab-\u00dcbersicht', shortcut: '\u2318\u21e7T', action: () => showTabOverview() },
        { id: 'info-panel', label: 'Dokument-Info', action: () => toggleInfoPanel() },
        { id: 'focus-mode', label: 'Focus-Modus', shortcut: '\u2318\u21e7F', action: () => toggleFocusMode() },
        { id: 'typewriter-mode', label: 'Typewriter-Modus', action: () => toggleTypewriterMode() },
        { id: 'pdf-options', label: 'PDF mit Optionen exportieren', action: () => showPdfOptionsDialog() },
    ];
}

function showCommandPalette() {
    let overlay = document.getElementById('commandPalette');
    if (!overlay) {
        // Create command palette DOM using safe DOM methods
        overlay = document.createElement('div');
        overlay.id = 'commandPalette';
        overlay.className = 'command-palette-overlay';

        const palette = document.createElement('div');
        palette.className = 'command-palette';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'command-palette-input';
        input.id = 'commandPaletteInput';
        input.placeholder = 'Befehl eingeben...';

        const list = document.createElement('div');
        list.className = 'command-palette-list';
        list.id = 'commandPaletteList';

        palette.appendChild(input);
        palette.appendChild(list);
        overlay.appendChild(palette);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeCommandPalette();
        });

        input.addEventListener('input', () => renderCommandList(input.value));
        input.addEventListener('keydown', handleCommandPaletteKey);
    }

    if (commandRegistry.length === 0) registerCommands();

    overlay.style.display = 'flex';
    commandPaletteVisible = true;
    const input = document.getElementById('commandPaletteInput');
    input.value = '';
    input.focus();
    renderCommandList('');
}

function closeCommandPalette() {
    const overlay = document.getElementById('commandPalette');
    if (overlay) overlay.style.display = 'none';
    commandPaletteVisible = false;
    editor.focus();
}

let commandSelectedIndex = 0;

function renderCommandList(query) {
    const list = document.getElementById('commandPaletteList');
    if (!list) return;

    const q = query.toLowerCase();
    const filtered = commandRegistry.filter(cmd =>
        cmd.label.toLowerCase().includes(q) || cmd.id.toLowerCase().includes(q)
    );

    commandSelectedIndex = 0;
    list.textContent = '';

    filtered.forEach((cmd, idx) => {
        const item = document.createElement('div');
        item.className = 'command-palette-item' + (idx === 0 ? ' selected' : '');
        item.dataset.index = idx;

        const label = document.createElement('span');
        label.className = 'command-label';
        label.textContent = cmd.label;

        item.appendChild(label);

        if (cmd.shortcut) {
            const shortcut = document.createElement('span');
            shortcut.className = 'command-shortcut';
            shortcut.textContent = cmd.shortcut;
            item.appendChild(shortcut);
        }

        item.addEventListener('click', () => {
            closeCommandPalette();
            cmd.action();
        });

        item.addEventListener('mouseenter', () => {
            list.querySelectorAll('.command-palette-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            commandSelectedIndex = idx;
        });

        list.appendChild(item);
    });
}

function handleCommandPaletteKey(e) {
    const list = document.getElementById('commandPaletteList');
    if (!list) return;
    const items = list.querySelectorAll('.command-palette-item');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        commandSelectedIndex = Math.min(commandSelectedIndex + 1, items.length - 1);
        items.forEach((el, i) => el.classList.toggle('selected', i === commandSelectedIndex));
        items[commandSelectedIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        commandSelectedIndex = Math.max(commandSelectedIndex - 1, 0);
        items.forEach((el, i) => el.classList.toggle('selected', i === commandSelectedIndex));
        items[commandSelectedIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[commandSelectedIndex]) items[commandSelectedIndex].click();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        closeCommandPalette();
    }
}

// --- B5: Session Statistics ---
let sessionStartWords = -1;
let sessionTotalWordsWritten = 0;
let sessionLastWordCount = 0;
let sessionActiveSeconds = 0;
let sessionLastKeyTime = 0;
let sessionActiveTimer = null;

function initSessionStats() {
    // Start active writing time tracker
    sessionActiveTimer = setInterval(() => {
        if (Date.now() - sessionLastKeyTime < 30000) { // 30s inactivity threshold
            sessionActiveSeconds++;
            const el = document.getElementById('sessionActiveTime');
            if (el) {
                const min = Math.floor(sessionActiveSeconds / 60);
                const sec = sessionActiveSeconds % 60;
                el.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
            }
        }
    }, 1000);
}

function updateSessionStats(currentWords) {
    if (sessionStartWords === -1) {
        sessionStartWords = currentWords;
        sessionLastWordCount = currentWords;
    }

    // Track words written (only additions)
    const delta = currentWords - sessionLastWordCount;
    if (delta > 0) {
        sessionTotalWordsWritten += delta;
    }
    sessionLastWordCount = currentWords;
    sessionLastKeyTime = Date.now();

    const writtenEl = document.getElementById('sessionWordsWritten');
    if (writtenEl) writtenEl.textContent = sessionTotalWordsWritten.toString();

    const netEl = document.getElementById('sessionNetWords');
    if (netEl) {
        const net = currentWords - sessionStartWords;
        netEl.textContent = (net >= 0 ? '+' : '') + net;
        netEl.style.color = net >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    }

    // B2: Update writing goal progress
    updateWritingGoal();
}

// --- B3: Info Panel ---
let infoPanelVisible = false;

function toggleInfoPanel() {
    infoPanelVisible = !infoPanelVisible;
    const panel = document.getElementById('infoPanel');
    if (panel) {
        panel.style.display = infoPanelVisible ? 'block' : 'none';
        if (infoPanelVisible) {
            refreshInfoPanel();
        }
    }
}

async function refreshInfoPanel() {
    const text = editor.value;
    if (typeof analyzeDocument !== 'function') return;
    const stats = analyzeDocument(text);

    // Stats
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('infoChars', stats.chars.toLocaleString());
    set('infoCharsNoSpaces', stats.charsNoSpaces.toLocaleString());
    set('infoWords', stats.words.toLocaleString());
    set('infoSentences', stats.sentences.toString());
    set('infoParagraphs', stats.paragraphs.toString());
    set('infoLines', stats.lineCount.toLocaleString());
    set('infoReadingTime', `~${stats.readingTimeMin} Min.`);

    // Structure
    set('infoHeadings', `${stats.headings.total} (H1:${stats.headings.h1} H2:${stats.headings.h2} H3:${stats.headings.h3})`);
    set('infoImages', stats.images.toString());
    set('infoLinks', stats.links.toString());
    set('infoCodeBlocks', Math.floor(stats.codeBlocks).toString());

    // File info
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    const fileSection = document.getElementById('infoFileSection');
    if (activeTab && activeTab.filePath && window.electronAPI && window.electronAPI.getFileStats) {
        if (fileSection) fileSection.style.display = 'block';
        set('infoFilePath', activeTab.filePath);
        const fileStats = await window.electronAPI.getFileStats(activeTab.filePath);
        if (fileStats) {
            const kb = (fileStats.size / 1024).toFixed(1);
            set('infoFileSize', fileStats.size > 1024 ? `${kb} KB` : `${fileStats.size} B`);
            set('infoFileModified', new Date(fileStats.modified).toLocaleString('de-DE'));
        }
    } else {
        if (fileSection) fileSection.style.display = 'none';
    }
}

// --- B7: Lint Warnings ---
let lastLintWarnings = [];

function updateLintWarnings(text) {
    if (typeof lintMarkdown !== 'function') return;
    const warnings = lintMarkdown(text);
    lastLintWarnings = warnings;

    // Update badge in status bar
    const badge = document.getElementById('lintBadge');
    const countEl = document.getElementById('lintCount');
    if (badge && countEl) {
        if (warnings.length > 0) {
            badge.style.display = '';
            countEl.textContent = `${warnings.length} ${warnings.length === 1 ? 'Warnung' : 'Warnungen'}`;
            const hasError = warnings.some(w => w.type === 'error');
            countEl.style.color = hasError ? 'var(--accent-red)' : 'var(--accent-yellow)';
        } else {
            badge.style.display = 'none';
        }
    }

    // Update panel if visible
    if (infoPanelVisible) {
        renderLintWarnings(warnings);
    }
}

function renderLintWarnings(warnings) {
    const section = document.getElementById('lintSection');
    const container = document.getElementById('lintWarnings');
    if (!section || !container) return;

    if (warnings.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    container.textContent = '';

    for (const w of warnings) {
        const item = document.createElement('div');
        item.className = `lint-item lint-${w.type}`;

        const icon = document.createElement('span');
        icon.className = 'lint-icon';
        icon.textContent = w.type === 'error' ? '!' : w.type === 'warning' ? '!' : 'i';

        const line = document.createElement('span');
        line.className = 'lint-line';
        line.textContent = `Ln ${w.line}`;

        const msg = document.createElement('span');
        msg.textContent = w.message;

        item.appendChild(icon);
        item.appendChild(line);
        item.appendChild(msg);

        // Click to jump to line
        item.addEventListener('click', () => {
            const lines = editor.value.split('\n');
            let charPos = 0;
            for (let i = 0; i < w.line - 1 && i < lines.length; i++) {
                charPos += lines[i].length + 1;
            }
            editor.focus();
            editor.setSelectionRange(charPos, charPos + (lines[w.line - 1] || '').length);
        });

        container.appendChild(item);
    }
}

// --- B2: Writing Goal Tracker ---
function updateWritingGoal() {
    const goal = settings.writingGoal || 0;
    const item = document.getElementById('writingGoalItem');
    if (!item) return;

    if (goal <= 0) {
        item.style.display = 'none';
        return;
    }

    item.style.display = '';
    const written = sessionTotalWordsWritten;
    const pct = Math.min(100, Math.round((written / goal) * 100));

    const fill = document.getElementById('writingGoalFill');
    const text = document.getElementById('writingGoalText');
    if (fill) {
        fill.style.width = pct + '%';
        fill.classList.toggle('complete', pct >= 100);
    }
    if (text) text.textContent = `${written}/${goal}`;
}

// --- B6: Tab Overview ---
let tabOverviewSortCol = 'name';
let tabOverviewSortDir = 'asc';

function showTabOverview() {
    const modal = document.getElementById('tabOverviewModal');
    if (!modal) return;
    modal.classList.add('visible');
    renderTabOverview();
}

function closeTabOverview() {
    const modal = document.getElementById('tabOverviewModal');
    if (modal) modal.classList.remove('visible');
}

function renderTabOverview() {
    const tbody = document.getElementById('tabOverviewBody');
    if (!tbody) return;
    tbody.textContent = '';

    // Build rows data
    const rowData = tabs.map(tab => {
        const content = tab.id === activeTabId ? editor.value : (tab.content || '');
        const words = content.trim() ? content.trim().split(/\s+/).length : 0;
        const name = tab.filePath ? tab.filePath.split(/[/\\]/).pop() : 'Unbenannt';
        const dir = tab.filePath ? tab.filePath.replace(/[/\\][^/\\]+$/, '') : '-';
        return { id: tab.id, name, path: dir, words, modified: !!tab.isModified, active: tab.id === activeTabId };
    });

    // Sort
    rowData.sort((a, b) => {
        let cmp = 0;
        if (tabOverviewSortCol === 'name') cmp = a.name.localeCompare(b.name);
        else if (tabOverviewSortCol === 'path') cmp = a.path.localeCompare(b.path);
        else if (tabOverviewSortCol === 'words') cmp = a.words - b.words;
        else if (tabOverviewSortCol === 'status') cmp = (a.modified ? 1 : 0) - (b.modified ? 1 : 0);
        return tabOverviewSortDir === 'desc' ? -cmp : cmp;
    });

    // Update sort indicators in headers
    const ths = document.querySelectorAll('#tabOverviewTable th.sortable');
    ths.forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === tabOverviewSortCol) {
            th.classList.add(tabOverviewSortDir === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    });

    for (const row of rowData) {
        const tr = document.createElement('tr');
        if (row.active) tr.className = 'active-tab';

        const tdName = document.createElement('td');
        tdName.textContent = row.name;
        tdName.title = row.name;

        const tdPath = document.createElement('td');
        tdPath.textContent = row.path;
        tdPath.title = row.path;

        const tdWords = document.createElement('td');
        tdWords.textContent = row.words.toLocaleString();
        tdWords.style.fontVariantNumeric = 'tabular-nums';

        const tdStatus = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = `tab-overview-status ${row.modified ? 'modified' : 'saved'}`;
        badge.textContent = row.modified ? 'Geändert' : 'Gespeichert';
        tdStatus.appendChild(badge);

        tr.appendChild(tdName);
        tr.appendChild(tdPath);
        tr.appendChild(tdWords);
        tr.appendChild(tdStatus);

        // Double-click to switch to tab
        tr.addEventListener('dblclick', () => {
            switchTab(row.id);
            closeTabOverview();
        });

        tbody.appendChild(tr);
    }
}

// Setup sort click handlers for tab overview
document.addEventListener('DOMContentLoaded', () => {
    const ths = document.querySelectorAll('#tabOverviewTable th.sortable');
    ths.forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (tabOverviewSortCol === col) {
                tabOverviewSortDir = tabOverviewSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                tabOverviewSortCol = col;
                tabOverviewSortDir = 'asc';
            }
            renderTabOverview();
        });
    });
});

// Add to window globals
window.toggleInfoPanel = toggleInfoPanel;
window.showTabOverview = showTabOverview;
window.closeTabOverview = closeTabOverview;
window.showCommandPalette = showCommandPalette;
window.closeCommandPalette = closeCommandPalette;
window.showPdfOptionsDialog = showPdfOptionsDialog;
window.closePdfOptionsDialog = closePdfOptionsDialog;
window.exportPDFWithOptions = exportPDFWithOptions;
window.refreshFileTree = refreshFileTree;

// Initialize session stats on load
document.addEventListener('DOMContentLoaded', () => {
    initSessionStats();
});
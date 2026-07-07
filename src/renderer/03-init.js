// MrxDown Renderer — Modul 03-init.js
// DOMContentLoaded-Bootstrap, marked-Konfiguration, Event-/IPC-Setup, Drag&Drop
// Classic Script (kein ESM): Top-Level-Deklarationen sind global über alle
// Renderer-Module hinweg; die Ladereihenfolge in index.html ist verbindlich.

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
    // E4: Callouts (> [!NOTE] …) — geteilte Extension mit dem CLI-PDF-Pfad (callouts.js)
    if (typeof createCalloutExtension === 'function') {
        marked.use(createCalloutExtension());
    }
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

    // Accessibility pass — aria labels on toolbar, role/aria-modal on dialogs, Escape-to-close, focus trap
    setupAccessibility();

    // Setup tooltip delay
    setupTooltipDelay();
    
    // Setup external links
    handleExternalLinks();
    
    // Setup resizable divider
    setupResizableDivider();
    
    // E2: Setup sidebar resize
    setupSidebarResize();

    // C2: Setup image paste handler (also handles paste-URL-over-selection)
    setupImagePaste();

    // Enter/⇧Enter in den Suchfeldern springt zum nächsten/vorherigen Treffer
    setupSearchFieldKeys();

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

        // Updater-Fortschritt in der Statusleiste (Events kamen bisher nirgends an)
        if (window.electronAPI.onUpdaterStatus) {
            window.electronAPI.onUpdaterStatus((event, data) => {
                updateUpdaterStatus(data || {});
            });
        }

        // Theme "System": follow live OS theme changes
        if (window.electronAPI.onSystemThemeChanged) {
            window.electronAPI.onSystemThemeChanged((event, sysTheme) => {
                if (settings.theme === 'system') {
                    applyThemeClass(sysTheme === 'light');
                }
            });
        }
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
        // L6: only show the file-drop overlay for actual OS file drags — tab
        // reordering and in-editor text drags used to flash it too
        const types = e.dataTransfer && e.dataTransfer.types;
        if (!types || !Array.from(types).includes('Files')) return;
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

            // K6: .docx/.html per Drag&Drop → zu Markdown konvertieren (neuer Tab)
            const lowerName = file.name.toLowerCase();
            if (lowerName.endsWith('.docx') || lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
                importDroppedFile(file);
                return;
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

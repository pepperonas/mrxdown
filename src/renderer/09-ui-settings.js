// MrxDown Renderer — Modul 09-ui-settings.js
// UI-Toggles, Theme (inkl. System), Einstellungen, globale Shortcuts, Session-Saver, Updater-Status
// Classic Script (kein ESM): Top-Level-Deklarationen sind global über alle
// Renderer-Module hinweg; die Ladereihenfolge in index.html ist verbindlich.

// UI Functions
function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    sidebar.classList.toggle('hidden', !sidebarVisible);
}

function toggleLineNumbers() {
    lineNumbers = !lineNumbers;
    editor.setLineNumbers(lineNumbers);
    // L1: keep the settings dialog + next launch in sync with the toolbar toggle
    settings.showLineNumbers = lineNumbers;
    saveSettings();
}

function updateLineNumbers() {
    // No-op: CM6 handles line numbers natively
}

// Apply a resolved light/dark state to every themed surface (body, editor, hljs, mermaid)
function applyThemeClass(isLight) {
    document.body.classList.toggle('light-theme', isLight);
    if (editor && editor.setTheme) editor.setTheme(!isLight);
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
}

// Resolve the theme SETTING ('dark' | 'light' | 'system') to light yes/no and apply it
async function applyThemeSetting() {
    let isLight = settings.theme === 'light';
    if (settings.theme === 'system' && window.electronAPI && window.electronAPI.getSystemTheme) {
        try {
            isLight = (await window.electronAPI.getSystemTheme()) === 'light';
        } catch (e) { /* keep dark */ }
    }
    applyThemeClass(isLight);
}

function toggleTheme() {
    // Toolbar toggle always switches to an EXPLICIT theme (from 'system' it jumps
    // to the opposite of what's currently shown)
    const isLight = !document.body.classList.contains('light-theme');
    settings.theme = isLight ? 'light' : 'dark';
    applyThemeClass(isLight);
    saveSettings();
}

function toggleWordWrap() {
    wordWrap = !wordWrap;
    editor.style.whiteSpace = wordWrap ? 'pre-wrap' : 'pre';
    // L1: keep the settings dialog + next launch in sync with the toolbar toggle
    settings.wordWrap = wordWrap;
    saveSettings();
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
    document.getElementById('settingsTheme').value = settings.theme || 'dark';
    document.getElementById('settingsFontSize').value = settings.fontSize || 14;
    document.getElementById('settingsTabSize').value = settings.tabSize || 4;
    document.getElementById('settingsAutoSave').checked = settings.autoSave || false;
    document.getElementById('settingsPasteHtmlMd').checked = settings.pasteHtmlAsMarkdown !== false;
    // I1: KI-Einstellungen (Key ist write-only — nur Status anzeigen)
    const ai = settings.ai || {};
    document.getElementById('settingsAiEnabled').checked = !!ai.enabled;
    document.getElementById('settingsAiProvider').value = ai.provider || 'ollama';
    document.getElementById('settingsAiEndpoint').value = ai.endpoint || '';
    document.getElementById('settingsAiModel').value = ai.model || '';
    document.getElementById('settingsAiKey').value = '';
    if (window.electronAPI && window.electronAPI.hasAiApiKey) {
        window.electronAPI.hasAiApiKey().then(has => {
            const state = document.getElementById('settingsAiKeyState');
            if (state) state.textContent = has ? '(gespeichert ✓)' : '(keiner)';
        });
    }
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
    if (editor) editor.focus(); // L12
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
    settings.pasteHtmlAsMarkdown = document.getElementById('settingsPasteHtmlMd').checked;
    // I1: KI-Einstellungen übernehmen; Key nur bei Eingabe (write-only, safeStorage)
    settings.ai = {
        enabled: document.getElementById('settingsAiEnabled').checked,
        provider: document.getElementById('settingsAiProvider').value,
        endpoint: document.getElementById('settingsAiEndpoint').value.trim(),
        model: document.getElementById('settingsAiModel').value.trim()
    };
    const aiKeyInput = document.getElementById('settingsAiKey');
    if (aiKeyInput && aiKeyInput.value && window.electronAPI && window.electronAPI.setAiApiKey) {
        window.electronAPI.setAiApiKey(aiKeyInput.value);
        aiKeyInput.value = '';
    }
    settings.autoSaveInterval = Math.max(1, Math.min(60, newAutoSaveInterval || 5));

    const newWritingGoal = parseInt(document.getElementById('settingsWritingGoal').value);
    settings.writingGoal = Math.max(0, Math.min(50000, newWritingGoal || 0));

    const newTheme = document.getElementById('settingsTheme').value;
    if (['dark', 'light', 'system'].includes(newTheme) && newTheme !== settings.theme) {
        settings.theme = newTheme;
        applyThemeSetting();
    }

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
    // H4: another layer (CM6 keymap, menu accelerator on Win/Linux) already
    // consumed this event — don't run the action a second time.
    if (e.defaultPrevented) return;

    // M8: while typing in a dialog/search field, document-level editing shortcuts
    // (⌘B, ⌘D, Alt+↑ …) must not mutate the editor behind the dialog. Escape still
    // falls through to the dialog-closing logic below.
    const t = e.target;
    const inFormField = t && (
        t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' ||
        (t.isContentEditable && !t.closest('.cm-editor'))
    ) && !t.closest('.cm-editor');
    if (inFormField && e.key !== 'Escape') {
        return;
    }

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
        const exportModal = document.getElementById('exportModal');
        if (exportModal && exportModal.classList.contains('visible')) {
            e.preventDefault();
            closeExportDialog();
            return;
        }
        const snippetsModal = document.getElementById('snippetsModal');
        if (snippetsModal && snippetsModal.classList.contains('visible')) {
            e.preventDefault();
            closeSnippetsDialog();
            return;
        }
        const aiModal = document.getElementById('aiModal');
        if (aiModal && aiModal.classList.contains('visible')) {
            e.preventDefault();
            closeAiDialog();
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
            case 'c':
                if (e.shiftKey) {
                    e.preventDefault();
                    copyAsHtml();
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
                    reopenClosedTab(); // browser convention: ⌘⇧T restores the last closed tab
                } else if (e.altKey) {
                    showTabOverview(); // moved from ⌘⇧T
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
                if (e.altKey) {
                    showReplaceDialog(); // ⌥⌘F — matches the menu accelerator (⌘R now reloads only)
                } else if (e.shiftKey) {
                    toggleFocusMode();
                } else {
                    showSearchDialog();
                }
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
                cycleTab(e.shiftKey ? -1 : 1);
                break;
        }

        // M9: ⌘⌥←/→ as macOS-reachable tab cycling (⌘Tab belongs to the OS app
        // switcher; Ctrl+Tab works everywhere). Standard in Safari/VS Code and
        // QWERTZ-safe (no AltGr characters involved).
        if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            e.preventDefault();
            cycleTab(e.key === 'ArrowLeft' ? -1 : 1);
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

            // Apply theme (supports 'system' = follow OS)
            await applyThemeSetting();
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

        // Only restore if there is real unsaved work to protect:
        //   - a modified tab backed by a file (data-loss risk), OR
        //   - an untitled tab with actual content the user hasn't saved anywhere.
        // A modified BUT empty untitled tab is visually identical to a fresh app state,
        // so it's not worth prompting for — this was the "clicked OK and nothing happened"
        // path users hit right after install.
        const hasUnsaved = session.tabs.some(t =>
            (t.isModified && t.filePath) ||
            (!t.filePath && t.content && t.content.trim())
        );
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
                // Restore the previously active tab. L5: the INDEX is authoritative —
                // restored tabs get fresh sequential IDs, so an id match is at best a
                // coincidence (and picked the wrong tab on collision).
                if (session.activeTabIndex != null && session.activeTabIndex < tabs.length) {
                    activeTabId = tabs[session.activeTabIndex].id;
                } else {
                    const matchingTab = tabs.find(t => t.id === session.activeTabId);
                    activeTabId = matchingTab ? matchingTab.id : tabs[0].id;
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

// Updater-Statusanzeige: lebt neben autoSaveStatus in der Statusleiste.
// States (aus main.js): available → downloading (percent) → downloaded.
function updateUpdaterStatus(data) {
    const bar = document.getElementById('autoSaveStatus');
    if (!bar) return;
    let el = document.getElementById('updaterStatus');
    if (!el) {
        el = document.createElement('span');
        el.id = 'updaterStatus';
        el.style.marginLeft = '12px';
        el.style.color = 'var(--accent-blue)';
        bar.parentNode.insertBefore(el, bar.nextSibling);
    }
    switch (data.state) {
        case 'available':
            el.textContent = `⬇ Update ${data.version || ''} verfügbar…`;
            break;
        case 'downloading':
            el.textContent = `⬇ Update wird geladen… ${data.percent != null ? data.percent + ' %' : ''}`;
            break;
        case 'downloaded':
            el.textContent = `✓ Update ${data.version || ''} bereit — Installation beim Neustart`;
            el.style.color = 'var(--accent-green)';
            break;
        case 'error':
            el.textContent = '⚠ Update-Fehler';
            el.title = data.message || '';
            el.style.color = 'var(--accent-red)';
            break;
        default:
            el.textContent = '';
    }
}

function showStatusToast(text) {
    const indicator = document.getElementById('autoSaveStatus');
    if (indicator) {
        indicator.textContent = text;
        indicator.style.color = 'var(--accent-green)';
        setTimeout(() => {
            indicator.textContent = '';
        }, 2000);
    }
}

function showAutoSaveIndicator() {
    showStatusToast('Automatisch gespeichert');
}

// Copy as HTML (⌘⇧C) — renders the selection (or the whole document) through the
// same marked+DOMPurify pipeline as the preview and puts the HTML on the clipboard.
async function copyAsHtml() {
    if (!editor || !editor.cmView) return;
    const { from, to } = editor.cmView.state.selection.main;
    const source = from !== to ? editor.cmView.state.sliceDoc(from, to) : editor.value;
    if (!source.trim()) return;
    let html = marked.parse(source);
    if (typeof DOMPurify !== 'undefined') {
        html = DOMPurify.sanitize(html, { ADD_ATTR: ['id'], ADD_TAGS: ['br'], FORBID_TAGS: ['style', 'form', 'textarea', 'select', 'button', 'link', 'meta', 'base'] }); // Q2: wie Preview-Sanitize
    }
    try {
        await navigator.clipboard.writeText(html);
        showStatusToast(from !== to ? 'Auswahl als HTML kopiert' : 'Dokument als HTML kopiert');
    } catch (err) {
        console.error('Copy as HTML failed:', err);
    }
}

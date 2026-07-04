// MrxDown Renderer — Modul 04-tabs.js
// Tab-Verwaltung: erstellen/schließen/wechseln, Snapshot-Disziplin, Reopen-Stack, Modified-Tracking
// Classic Script (kein ESM): Top-Level-Deklarationen sind global über alle
// Renderer-Module hinweg; die Ladereihenfolge in index.html ist verbindlich.

// Tab Management
function createNewTab(content = '', filePath = null) {
    // C1: snapshot the current tab BEFORE switching away. Tab state is otherwise
    // only captured in switchTab() — ⌘N/open/drop used to silently roll the previous
    // tab back to its last-switch snapshot (data loss on save).
    saveCurrentTabState();

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

    // Remember for "Tab wiederherstellen" (⌘⇧T) — content snapshot for unsaved tabs
    rememberClosedTab(tab);

    const closedActiveTab = (activeTabId === tabId);
    tabs.splice(tabIndex, 1);

    if (tabs.length === 0) {
        createNewTab();
    } else {
        if (closedActiveTab) {
            activeTabId = tabs[Math.max(0, tabIndex - 1)].id;
            loadTabContent(activeTabId);
        }
        // C2: only reload the editor when the ACTIVE tab was closed. Reloading it
        // after closing a background tab rolled the active tab back to its
        // last-switch snapshot, silently discarding unsaved edits.
        renderTabs();
    }
    syncDocumentEdited();
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
        rememberClosedTab(t);
        if (t.filePath && window.electronAPI) {
            window.electronAPI.unwatchFile(t.filePath);
        }
    });
    // C2: snapshot the kept tab before any reload — if it is the active tab,
    // loadTabContent would otherwise revert its unsaved edits.
    saveCurrentTabState();
    const keptWasActive = (activeTabId === keepTabId);
    tabs = tabs.filter(t => t.id === keepTabId);
    activeTabId = keepTabId;
    renderTabs();
    if (!keptWasActive) loadTabContent(keepTabId);
    syncDocumentEdited();
}

async function closeAllTabs() {
    if (!(await handleUnsavedTabs(tabs))) return;
    tabs.forEach(t => {
        rememberClosedTab(t);
        if (t.filePath && window.electronAPI) {
            window.electronAPI.unwatchFile(t.filePath);
        }
    });
    tabs = [];
    createNewTab();
}

// --- Reopen closed tab (⌘⇧T) ---
const closedTabsStack = [];
function rememberClosedTab(tab) {
    closedTabsStack.push({
        title: tab.title,
        content: (tab.id === activeTabId && editor) ? editor.value : (tab.content || ''),
        filePath: tab.filePath,
        cursorPosition: tab.cursorPosition || 0
    });
    if (closedTabsStack.length > 10) closedTabsStack.shift();
}

function reopenClosedTab() {
    const last = closedTabsStack.pop();
    if (!last) return;
    // If the file is already open again, just focus it
    if (last.filePath) {
        const existing = tabs.find(t => t.filePath === last.filePath);
        if (existing) { switchTab(existing.id); return; }
    }
    const tab = createNewTab(last.content, last.filePath);
    if (last.filePath && window.electronAPI) {
        window.electronAPI.watchFile(last.filePath);
    }
    return tab;
}

function cycleTab(direction) {
    if (tabs.length < 2) return;
    const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
    const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
    switchTab(tabs[nextIndex].id);
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
    updateStatsHeavy(true); // true = tab load, don't count the delta as words written

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

// C2: main's close handler used to see only the LAST-touched tab's modified flag,
// so a dirty background tab was discarded without a prompt. Always report
// "any tab modified" instead of the per-tab flag.
function syncDocumentEdited() {
    if (window.electronAPI) {
        window.electronAPI.setDocumentEdited(tabs.some(t => t.isModified));
    }
}

function markTabAsModified(tabId, isModified) {
    const tab = tabs.find(tab => tab.id === tabId);
    if (tab) {
        // L8: skip the full tab-bar rebuild + IPC when the flag didn't change
        // (this fires on every keystroke)
        if (tab.isModified === isModified) return;
        tab.isModified = isModified;
        renderTabs();
        syncDocumentEdited();
        // L7: keep the window title's unsaved-dot in sync immediately (it used to
        // lag until the next tab switch)
        if (tab.id === activeTabId && window.electronAPI) {
            window.electronAPI.updateWindowTitle(tab.title + (isModified ? ' •' : ''));
        }
    }
}

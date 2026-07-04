// MrxDown Renderer — Modul 11-search-watch.js
// Externe Dateiänderungen, Batch-Prepare, komplette Suche/Ersetzen
// Classic Script (kein ESM): Top-Level-Deklarationen sind global über alle
// Renderer-Module hinweg; die Ladereihenfolge in index.html ist verbindlich.

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
                filePath: filePath,
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
                    filePath: filePath,
                    htmlContent: htmlContent
                });
            } catch (error) {
                console.error('Error getting preview content:', error);
                window.electronAPI.sendBatchExportTabReady({
                    filePath: filePath,
                    error: `Error getting preview content: ${error.message}`
                });
            }
        }, 1500); // TODO: Replace with a promise-based approach (e.g., MutationObserver or render callback) instead of a fixed timeout
        
    } catch (error) {
        console.error('Error in handleBatchExportPrepareTab:', error);
        window.electronAPI.sendBatchExportTabReady({
            filePath: filePath,
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

function setupSearchFieldKeys() {
    const bind = (inputId, next, prev) => {
        const el = document.getElementById(inputId);
        if (!el) return;
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                (e.shiftKey ? prev : next)();
            }
        });
    };
    bind('searchInput', findNext, findPrevious);
    bind('replaceSearchInput', findNextReplace, findNextReplace);
}

function closeSearchDialog() {
    if (searchModal) {
        searchModal.classList.remove('visible');
        clearSearchHighlights();
        if (editor) editor.focus(); // L12: keyboard flow continues in the editor
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
        if (editor) editor.focus(); // L12
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

    // M1: always re-search — stored offsets go stale the moment the document is
    // edited or the tab switches, and then selected arbitrary wrong ranges.
    const prevIndex = currentMatchIndex;
    updateSearchResults();
    currentMatchIndex = prevIndex;

    if (searchMatches.length === 0) return;

    currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
    const match = searchMatches[currentMatchIndex];

    editor.focus();
    editor.setSelectionRange(match.start, match.end);
    if (editor.scrollToPos) editor.scrollToPos(match.start); // M2: CM6-correct scrolling

    // Update the counter
    updateSearchResults();
}

function findPrevious() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput?.value || '';

    if (!searchTerm) return;

    // M1: always re-search (see findNext)
    const prevIndex = currentMatchIndex;
    updateSearchResults();
    currentMatchIndex = prevIndex;

    if (searchMatches.length === 0) return;

    currentMatchIndex = currentMatchIndex <= 0 ? searchMatches.length - 1 : currentMatchIndex - 1;
    const match = searchMatches[currentMatchIndex];

    editor.focus();
    editor.setSelectionRange(match.start, match.end);
    if (editor.scrollToPos) editor.scrollToPos(match.start); // M2

    // Update the counter
    updateSearchResults();
}

function findNextReplace() {
    const replaceSearchInput = document.getElementById('replaceSearchInput');
    const searchTerm = replaceSearchInput?.value || '';

    if (!searchTerm) return;

    // M1: always re-search (see findNext)
    const prevIndex = currentMatchIndex;
    updateReplaceResults();
    currentMatchIndex = prevIndex;

    if (searchMatches.length === 0) return;

    currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
    const match = searchMatches[currentMatchIndex];

    editor.focus();
    editor.setSelectionRange(match.start, match.end);
    if (editor.scrollToPos) editor.scrollToPos(match.start); // M2

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


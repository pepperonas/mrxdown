// MrxDown Renderer — Modul 12-features.js
// Sidebar-Resize, PDF-Dialog, Focus/Typewriter, Checkboxen, Bild-Paste/-Drop, Command Palette, Session-Stats, Info-Panel, Lint, Schreibziel, Tab-Übersicht, window-Exporte
// Classic Script (kein ESM): Top-Level-Deklarationen sind global über alle
// Renderer-Module hinweg; die Ladereihenfolge in index.html ist verbindlich.

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

// Cached template catalog — fetched lazily on first dialog open
let _pdfTemplatesCatalog = null;

async function populatePdfTemplateDropdown() {
    const select = document.getElementById('pdfTemplate');
    const desc = document.getElementById('pdfTemplateDescription');
    if (!select) return;
    if (!_pdfTemplatesCatalog && window.electronAPI && window.electronAPI.getPdfTemplates) {
        try { _pdfTemplatesCatalog = await window.electronAPI.getPdfTemplates(); }
        catch (_) { _pdfTemplatesCatalog = []; }
    }
    if (!_pdfTemplatesCatalog || _pdfTemplatesCatalog.length === 0) return;

    // Only rebuild if empty (avoid resetting selection on each open)
    if (select.options.length === 0) {
        const preferred = (settings && settings.pdfTemplate) || 'default';
        for (const tpl of _pdfTemplatesCatalog) {
            const opt = document.createElement('option');
            opt.value = tpl.key;
            opt.textContent = tpl.name;
            if (tpl.key === preferred) opt.selected = true;
            select.appendChild(opt);
        }
        const updateDescription = () => {
            const tpl = _pdfTemplatesCatalog.find(t => t.key === select.value);
            if (desc) desc.textContent = tpl ? tpl.description : '';
        };
        select.addEventListener('change', updateDescription);
        updateDescription();
    }
}

function showPdfOptionsDialog() {
    const modal = document.getElementById('pdfOptionsModal');
    if (modal) modal.classList.add('visible');
    populatePdfTemplateDropdown();
}

function closePdfOptionsDialog() {
    const modal = document.getElementById('pdfOptionsModal');
    if (modal) modal.classList.remove('visible');
}

function exportPDFWithOptions() {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    const templateSelect = document.getElementById('pdfTemplate');
    const pdfOptions = {
        template: templateSelect ? templateSelect.value : 'default',
        pageSize: document.getElementById('pdfPageSize').value,
        orientation: document.getElementById('pdfOrientation').value,
        margin: parseInt(document.getElementById('pdfMargin').value) || 20,
        fontSize: parseInt(document.getElementById('pdfFontSize').value) || 11,
        toc: document.getElementById('pdfToc').checked,
        pageNumbers: document.getElementById('pdfPageNumbers').checked
    };

    // Persist template choice for next invocation
    if (pdfOptions.template && settings) {
        settings.pdfTemplate = pdfOptions.template;
        saveSettings();
    }

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
// M3 fix: one DELEGATED change listener on #preview, registered once. The old
// per-checkbox listeners were re-added after every render while morphdom kept the
// DOM nodes alive — after N renders each toggle fired N times (unbounded leak).
let checkboxToggleDelegated = false;
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
        }
    });

    if (checkboxToggleDelegated) return;
    checkboxToggleDelegated = true;
    preview.addEventListener('change', (e) => {
        const target = e.target;
        if (!target || target.type !== 'checkbox' || target.dataset.line === undefined) return;
        const lineIdx = parseInt(target.dataset.line);
        const lines = editor.value.split('\n');
        if (lineIdx < lines.length) {
            // Calculate char position of this line
            let lineStart = 0;
            for (let i = 0; i < lineIdx; i++) lineStart += lines[i].length + 1;

            // Find the exact position of [ ] or [x] within the line
            const line = lines[lineIdx];
            const bracketMatch = target.checked
                ? line.match(/\[\s\]/)
                : line.match(/\[[xX]\]/);
            if (bracketMatch) {
                const bracketStart = lineStart + bracketMatch.index;
                const bracketEnd = bracketStart + 3; // [ ] or [x] is always 3 chars
                const replacement = target.checked ? '[x]' : '[ ]';
                replaceRange(bracketStart, bracketEnd, replacement);
            }
            handleEditorInput();
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

        // Paste-URL-über-Auswahl → [Auswahl](URL). Universal editor convention
        // (VS Code, Obsidian, Typora, iA Writer). Only when: focus is in the
        // editor, there IS a selection, the clipboard is exactly one URL, and
        // the selection is not inside a fenced code block.
        const target = e.target;
        if (!(target && target.closest && target.closest('.cm-editor'))) return;
        if (!editor || !editor.cmView) return;
        const clip = e.clipboardData.getData('text/plain').trim();
        if (!/^https?:\/\/\S+$/.test(clip)) return;
        const { from, to } = editor.cmView.state.selection.main;
        if (from === to) return; // no selection → normal paste
        const before = editor.cmView.state.sliceDoc(0, from);
        const fenceCount = (before.match(/^(```|~~~)/gm) || []).length;
        if (fenceCount % 2 === 1) return; // inside a code fence → normal paste
        const selText = editor.cmView.state.sliceDoc(from, to);
        if (/\]\(/.test(selText)) return; // selection already contains link syntax
        e.preventDefault();
        const md = `[${selText}](${clip})`;
        editor.cmView.dispatch({
            changes: { from, to, insert: md },
            selection: { anchor: from + md.length }
        });
        handleEditorInput();
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

        // M4: this capture listener stops propagation, so the document-level
        // unhighlight never runs — hide the drop overlay ourselves
        if (dropZone) dropZone.classList.remove('active');

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
        { id: 'replace', label: 'Suchen und Ersetzen', shortcut: '\u2325\u2318F', action: () => showReplaceDialog() },
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
        { id: 'tab-overview', label: 'Tab-\u00dcbersicht', shortcut: '\u2325\u2318T', action: () => showTabOverview() },
        { id: 'reopen-tab', label: 'Geschlossenen Tab wiederherstellen', shortcut: '\u2318\u21e7T', action: () => reopenClosedTab() },
        { id: 'copy-html', label: 'Als HTML kopieren', shortcut: '\u2318\u21e7C', action: () => copyAsHtml() },
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

function updateSessionStats(currentWords, skipDelta = false) {
    if (sessionStartWords === -1) {
        sessionStartWords = currentWords;
        sessionLastWordCount = currentWords;
    }

    // M5: a tab switch/load changes the word count without any writing —
    // rebase the counter instead of crediting the difference as "geschrieben"
    if (skipDelta) {
        sessionLastWordCount = currentWords;
    } else {
        // Track words written (only additions)
        const delta = currentWords - sessionLastWordCount;
        if (delta > 0) {
            sessionTotalWordsWritten += delta;
        }
        sessionLastWordCount = currentWords;
        sessionLastKeyTime = Date.now();
    }

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
        line.textContent = `Z ${w.line}`;

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
            if (editor.scrollToPos) editor.scrollToPos(charPos); // M2: actually scroll to it
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

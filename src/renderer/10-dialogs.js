// MrxDown Renderer — Modul 10-dialogs.js
// Kontextmenü, Über-Dialog, Tabellen-Editor/-Navigation, Accessibility, externe Links, View-Modus, Divider
// Classic Script (kein ESM): Top-Level-Deklarationen sind global über alle
// Renderer-Module hinweg; die Ladereihenfolge in index.html ist verbindlich.

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
        // Move to next cell: find the next pipe at/after cursor (>= so a cursor
        // sitting exactly on a '|' doesn't skip a cell)
        const nextPipe = pipes.find(p => p >= pos);
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
        // Move to previous cell. The cursor sits at "cell start" = (pipe left of it)+2,
        // so the LAST pipe before the cursor delimits the current cell — the previous
        // cell starts after the SECOND-TO-LAST pipe. (H2 fix: +2 on the last pipe just
        // re-selected the current cell start, so Shift+Tab never moved.)
        const prevPipes = pipes.filter(p => p < pos - 1);
        if (prevPipes.length >= 2) {
            const target = prevPipes[prevPipes.length - 2] + 2;
            editor.selectionStart = editor.selectionEnd = target;
        } else if (lineStart > 0) {
            // First cell — wrap to the last cell of the previous table row (skip separator)
            let prevLineEnd = lineStart - 1;
            let prevLineStart = text.lastIndexOf('\n', prevLineEnd - 1) + 1;
            let prevLine = text.substring(prevLineStart, prevLineEnd);
            if (/^\|[\s-:|]+\|$/.test(prevLine.trim()) && prevLineStart > 0) {
                prevLineEnd = prevLineStart - 1;
                prevLineStart = text.lastIndexOf('\n', prevLineEnd - 1) + 1;
                prevLine = text.substring(prevLineStart, prevLineEnd);
            }
            const trimmed = prevLine.trim();
            if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
                const cellPipes = [];
                for (let i = 0; i < prevLine.length; i++) {
                    if (prevLine[i] === '|') cellPipes.push(i);
                }
                if (cellPipes.length >= 2) {
                    const target = prevLineStart + cellPipes[cellPipes.length - 2] + 2;
                    editor.selectionStart = editor.selectionEnd = Math.min(target, prevLineEnd);
                }
            }
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
// --- Accessibility pass ---
// Everything in one place so we can reason about the a11y story without hunting
// through the codebase. Touches three areas: toolbar buttons (aria-label from
// existing data-tooltip), modal dialogs (role, aria-modal, Escape-to-close,
// focus trap), and fallback focus handling on open.
function setupAccessibility() {
    // 1. Toolbar buttons — derive aria-label from the existing data-tooltip attribute.
    //    Existing SVG icons mean nothing to screen readers without a label.
    document.querySelectorAll('[data-tooltip]').forEach(el => {
        if (!el.hasAttribute('aria-label')) {
            el.setAttribute('aria-label', el.getAttribute('data-tooltip'));
        }
    });

    // 2. Modal dialogs — role + aria-modal + trap focus + Escape closes.
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        const modal = overlay.querySelector('.modal');
        if (modal) {
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            const title = modal.querySelector('.modal-title');
            if (title && !modal.hasAttribute('aria-labelledby')) {
                if (!title.id) title.id = 'modal-title-' + Math.random().toString(36).slice(2, 8);
                modal.setAttribute('aria-labelledby', title.id);
            }
        }
    });

    // 3. Global Escape handler — close any visible modal. Wins over the editor's
    //    internal key handling because we use capture phase and don't call
    //    preventDefault unless a modal is actually open.
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const open = Array.from(document.querySelectorAll('.modal-overlay.visible, .modal-overlay[style*="display: block"], .modal-overlay[style*="display:block"]'));
        if (open.length === 0) return;
        // Close the topmost (last-opened) dialog only
        const top = open[open.length - 1];
        // H3: #inputDialog is Promise-based — it MUST close through its own cancel
        // path. Hiding it by class removal leaked the pending Promise and stacked
        // listeners, so a later ⌘K inserted the link markdown twice.
        if (top.id === 'inputDialog') {
            const cancelBtn = document.getElementById('inputDialogCancel');
            if (cancelBtn) {
                cancelBtn.click(); // resolves the Promise + removes listeners
                e.preventDefault();
                e.stopPropagation();
            }
            return;
        }
        top.classList.remove('visible');
        if (top.style.display === 'block') top.style.display = 'none';
        e.preventDefault();
        e.stopPropagation();
    }, true);

    // 4. Focus trap — when a modal becomes visible, focus the first focusable
    //    element inside and keep tab navigation within the dialog.
    const focusableSel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const observers = new Map();
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        const obs = new MutationObserver(() => {
            const visible = overlay.classList.contains('visible') ||
                (overlay.style.display && overlay.style.display !== 'none');
            if (!visible) return;
            const modal = overlay.querySelector('.modal');
            if (!modal) return;
            const focusables = modal.querySelectorAll(focusableSel);
            if (focusables.length > 0) {
                // Defer so CSS transitions don't steal focus mid-animation
                setTimeout(() => focusables[0].focus(), 50);
            }
        });
        obs.observe(overlay, { attributes: true, attributeFilter: ['class', 'style'] });
        observers.set(overlay, obs);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const openOverlay = document.querySelector('.modal-overlay.visible');
        if (!openOverlay) return;
        const modal = openOverlay.querySelector('.modal');
        if (!modal) return;
        const focusables = Array.from(modal.querySelectorAll(focusableSel)).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    });
}

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

        // E1: Wiki-Links — öffnen (data-wiki-path) oder anlegen (missing)
        if (link.classList.contains('wiki-link')) {
            e.preventDefault();
            handleWikiLinkClick(link);
            return;
        }

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

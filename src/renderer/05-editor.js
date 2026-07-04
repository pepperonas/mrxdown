// MrxDown Renderer — Modul 05-editor.js
// Editor-Input, Render-Pipeline (marked→DOMPurify→morphdom), KaTeX/hljs/Mermaid, Outline, Stats, Scroll-Sync, Autocomplete
// Classic Script (kein ESM): Top-Level-Deklarationen sind global über alle
// Renderer-Module hinweg; die Ladereihenfolge in index.html ist verbindlich.

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

// Perf: skip identical re-renders. renderMarkdown fires on every debounce tick,
// tab switch and various UI paths — when neither source, tab nor theme changed
// (e.g. pure cursor movement), the full marked+DOMPurify+morphdom pass is wasted.
let _lastRenderKey = null;

function renderMarkdown(force = false) {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    const isTextFile = activeTab && activeTab.filePath && activeTab.filePath.toLowerCase().endsWith('.txt');

    if (!isTextFile) {
        const key = (activeTab ? activeTab.id : 0) + '|' +
            (document.body.classList.contains('light-theme') ? 'l' : 'd') + '|' +
            editor.value.length + '|' + editor.value;
        if (!force && key === _lastRenderKey) return;
        _lastRenderKey = key;
    } else {
        _lastRenderKey = null;
    }

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
                // M2: CM6-correct scrolling (line-height math breaks with wrapping)
                if (editor.scrollToPos) editor.scrollToPos(charPos);
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

function updateStatsHeavy(isTabLoad = false) {
    if (!editor || !charCount || !wordCount || !lineCount) return;
    const text = editor.value;

    if (typeof analyzeDocument === 'function') {
        const stats = analyzeDocument(text);
        charCount.textContent = `${stats.chars} Zeichen`;
        wordCount.textContent = `${stats.words} ${stats.words === 1 ? 'Wort' : 'Wörter'}`;
        lineCount.textContent = `${stats.lineCount} ${stats.lineCount === 1 ? 'Zeile' : 'Zeilen'}`;

        const paragraphEl = document.getElementById('paragraphCount');
        if (paragraphEl) paragraphEl.textContent = `${stats.paragraphs} ${stats.paragraphs === 1 ? 'Absatz' : 'Absätze'}`;

        const readingEl = document.getElementById('readingTime');
        if (readingEl) readingEl.textContent = `~${stats.readingTimeMin} Min.`;

        updateSessionStats(stats.words, isTabLoad);
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
        cursorEl.textContent = `Z ${line}, Sp ${col}`;
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

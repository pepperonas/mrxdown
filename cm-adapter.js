/**
 * CodeMirror 6 Adapter for MrxDown.
 * Provides a textarea-compatible interface so existing renderer.js code
 * can work with minimal changes.
 *
 * Usage:
 *   const adapter = new EditorAdapter(containerEl, options);
 *   // Now use adapter.value, adapter.selectionStart, etc. like a textarea
 */
class EditorAdapter {
    /**
     * @param {HTMLElement} container - The DOM element to mount CM6 into
     * @param {Object} options
     * @param {string} options.initialDoc
     * @param {boolean} options.isDark
     * @param {boolean} options.showLineNumbers
     * @param {boolean} options.wordWrap
     * @param {number} options.tabSize
     * @param {number} options.fontSize
     * @param {function} options.onDocChanged - Called when document changes
     * @param {function} options.onSelectionChanged - Called when selection changes
     * @param {function} options.onScroll - Called on scroll
     */
    constructor(container, options = {}) {
        this._container = container;
        this._listeners = {};
        this._suppressNextChange = false;

        const cmResult = CMSetup.createEditor(container, {
            initialDoc: options.initialDoc || '',
            isDark: options.isDark !== false,
            showLineNumbers: options.showLineNumbers || false,
            wordWrap: options.wordWrap !== false,
            tabSize: options.tabSize || 4,
            fontSize: options.fontSize || 14,
            onUpdate: (update) => {
                if (update.docChanged && !this._suppressNextChange) {
                    this._emit('input');
                }
                if (update.selectionSet || update.docChanged) {
                    this._emit('keyup');
                    this._emit('click');
                }
            },
        });

        this._view = cmResult.view;
        this._cm = cmResult;

        // Attach scroll listener to CM's scroll DOM
        this._view.scrollDOM.addEventListener('scroll', () => {
            this._emit('scroll', { target: this });
        });

        // Forward keydown events from CM
        this._view.contentDOM.addEventListener('keydown', (e) => {
            this._emit('keydown', e);
        });
    }

    // --- Value property (textarea-compatible) ---

    get value() {
        return this._view.state.doc.toString();
    }

    set value(newValue) {
        this._suppressNextChange = true;
        this._view.dispatch({
            changes: {
                from: 0,
                to: this._view.state.doc.length,
                insert: newValue,
            },
        });
        this._suppressNextChange = false;
    }

    // --- Selection properties ---

    get selectionStart() {
        return this._view.state.selection.main.from;
    }

    set selectionStart(pos) {
        const end = this._view.state.selection.main.to;
        this._view.dispatch({
            selection: { anchor: pos, head: Math.max(pos, end) },
        });
    }

    get selectionEnd() {
        return this._view.state.selection.main.to;
    }

    set selectionEnd(pos) {
        const start = this._view.state.selection.main.from;
        this._view.dispatch({
            selection: { anchor: start, head: pos },
        });
    }

    setSelectionRange(start, end) {
        this._view.dispatch({
            selection: { anchor: start, head: end },
        });
    }

    // --- Scroll properties ---

    get scrollTop() {
        return this._view.scrollDOM.scrollTop;
    }

    set scrollTop(val) {
        this._view.scrollDOM.scrollTop = val;
    }

    get scrollLeft() {
        return this._view.scrollDOM.scrollLeft;
    }

    set scrollLeft(val) {
        this._view.scrollDOM.scrollLeft = val;
    }

    get scrollHeight() {
        return this._view.scrollDOM.scrollHeight;
    }

    get clientHeight() {
        return this._view.scrollDOM.clientHeight;
    }

    // E4: Get first visible line number (1-based) for scroll sync
    getFirstVisibleLine() {
        try {
            const top = this._view.scrollDOM.scrollTop;
            const block = this._view.lineBlockAtHeight(top);
            const line = this._view.state.doc.lineAt(block.from);
            return line.number;
        } catch (e) {
            return 1;
        }
    }

    // E4: Scroll to a specific line number (1-based)
    scrollToLine(lineNum) {
        try {
            const line = this._view.state.doc.line(Math.max(1, Math.min(lineNum, this._view.state.doc.lines)));
            const block = this._view.lineBlockAt(line.from);
            this._view.scrollDOM.scrollTop = block.top;
        } catch (e) {
            // fallback: ignore
        }
    }

    // --- DOM compat ---

    focus() {
        this._view.focus();
    }

    getBoundingClientRect() {
        return this._view.dom.getBoundingClientRect();
    }

    get parentElement() {
        return this._view.dom.parentElement;
    }

    /**
     * Returns the content DOM element for getComputedStyle() compatibility.
     * Use: getComputedStyle(editor.contentDOM)
     */
    get contentDOM() {
        return this._view.contentDOM;
    }

    // --- Style property (limited subset) ---

    get style() {
        if (!this._styleProxy) {
            const self = this;
            this._styleProxy = {
                _whiteSpace: 'pre-wrap',
                _fontSize: '14px',
                _tabSize: '4',
                _paddingLeft: '',
                _height: '',

                get whiteSpace() { return this._whiteSpace; },
                set whiteSpace(val) {
                    this._whiteSpace = val;
                    self._cm.setWordWrap(val === 'pre-wrap');
                },

                get fontSize() { return this._fontSize; },
                set fontSize(val) {
                    this._fontSize = val;
                    self._cm.setFontSize(parseInt(val, 10) || 14);
                },

                get tabSize() { return this._tabSize; },
                set tabSize(val) {
                    this._tabSize = val;
                    self._cm.setTabSize(parseInt(val, 10) || 4);
                },

                get paddingLeft() { return this._paddingLeft; },
                set paddingLeft(val) {
                    // Line numbers are handled via CM6 gutter, ignore padding changes
                    this._paddingLeft = val;
                },

                get height() { return this._height; },
                set height(val) {
                    // Auto-expand not needed with CM6
                    this._height = val;
                },

                get width() { return self._view.dom.style.width; },
                set width(val) { self._view.dom.style.width = val; },
            };
        }
        return this._styleProxy;
    }

    // --- Undo/Redo (replaces document.execCommand) ---

    execCommand(cmd, _showUI, text) {
        if (cmd === 'insertText') {
            const { from, to } = this._view.state.selection.main;
            this._view.dispatch({
                changes: { from, to, insert: text || '' },
                selection: { anchor: from + (text || '').length },
            });
            return true;
        }
        return false;
    }

    undo() {
        this._cm.undo();
    }

    redo() {
        this._cm.redo();
    }

    // --- Theme switching ---

    setTheme(isDark) {
        this._cm.setTheme(isDark);
    }

    // --- Line numbers ---

    setLineNumbers(show) {
        this._cm.setLineNumbers(show);
    }

    // --- C4: Focus Mode ---
    setFocusMode(enabled) {
        if (this._cm.setFocusMode) this._cm.setFocusMode(enabled);
    }

    // --- C5: Typewriter Mode ---
    setTypewriterMode(enabled) {
        if (this._cm.setTypewriterMode) this._cm.setTypewriterMode(enabled);
    }

    // --- Event system (textarea-compatible) ---

    addEventListener(event, handler) {
        if (!this._listeners[event]) {
            this._listeners[event] = [];
        }
        this._listeners[event].push(handler);
    }

    removeEventListener(event, handler) {
        if (this._listeners[event]) {
            this._listeners[event] = this._listeners[event].filter(h => h !== handler);
        }
    }

    _emit(event, data) {
        if (this._listeners[event]) {
            for (const handler of this._listeners[event]) {
                handler(data || { target: this });
            }
        }
    }

    // --- A6: EditorState save/restore per tab ---

    /**
     * Returns the full CM6 EditorState for saving (includes undo history, cursor, etc.)
     */
    getState() {
        return this._view.state;
    }

    /**
     * Replaces the entire CM6 EditorState (restores undo history, cursor, etc.)
     * @param {EditorState} state
     */
    setState(state) {
        this._suppressNextChange = true;
        this._view.setState(state);
        this._suppressNextChange = false;
    }

    // --- CM6 direct access (for advanced operations) ---

    get cmView() {
        return this._view;
    }

    get cmState() {
        return this._view.state;
    }

    /**
     * Scroll to ensure a character offset is visible.
     * @param {number} pos - Character offset
     */
    scrollToPos(pos) {
        this._view.dispatch({
            effects: CMSetup.EditorView.scrollIntoView(pos, { y: 'center' }),
        });
    }

    /**
     * Destroy the editor instance.
     */
    destroy() {
        this._view.destroy();
    }
}

// Export for browser global scope
if (typeof window !== 'undefined') {
    window.EditorAdapter = EditorAdapter;
}

// Export for Node.js tests if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EditorAdapter };
}

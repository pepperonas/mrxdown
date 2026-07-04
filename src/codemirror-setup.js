/**
 * CodeMirror 6 setup for MrxDown.
 * Bundled via esbuild into vendor/codemirror-bundle.js as IIFE (global: CMSetup).
 */
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection, highlightSpecialChars, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, undo, redo } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, HighlightStyle, LanguageDescription, StreamLanguage, indentOnInput, bracketMatching, foldGutter, indentUnit } from '@codemirror/language';

// Curated list of code-block languages for fenced code highlighting.
// Replaces @codemirror/language-data (~150 langs, 1.3MB) with only what the
// autocomplete popup actually offers. Dynamic imports let esbuild split the
// bundle; each language is lazy-loaded by markdownLanguage on first use.
const codeLanguages = [
    LanguageDescription.of({
        name: 'javascript',
        alias: ['js', 'jsx'],
        extensions: ['js', 'jsx'],
        async load() { const m = await import('@codemirror/lang-javascript'); return m.javascript(); }
    }),
    LanguageDescription.of({
        name: 'typescript',
        alias: ['ts', 'tsx'],
        extensions: ['ts', 'tsx'],
        async load() { const m = await import('@codemirror/lang-javascript'); return m.javascript({ typescript: true, jsx: true }); }
    }),
    LanguageDescription.of({
        name: 'python',
        alias: ['py'],
        extensions: ['py'],
        async load() { const m = await import('@codemirror/lang-python'); return m.python(); }
    }),
    LanguageDescription.of({
        name: 'html',
        alias: ['htm'],
        extensions: ['html', 'htm'],
        async load() { const m = await import('@codemirror/lang-html'); return m.html(); }
    }),
    LanguageDescription.of({
        name: 'css',
        extensions: ['css'],
        async load() { const m = await import('@codemirror/lang-css'); return m.css(); }
    }),
    LanguageDescription.of({
        name: 'json',
        extensions: ['json'],
        async load() { const m = await import('@codemirror/lang-json'); return m.json(); }
    }),
    LanguageDescription.of({
        name: 'java',
        extensions: ['java'],
        async load() { const m = await import('@codemirror/lang-java'); return m.java(); }
    }),
    LanguageDescription.of({
        name: 'sql',
        extensions: ['sql'],
        async load() { const m = await import('@codemirror/lang-sql'); return m.sql(); }
    }),
    LanguageDescription.of({
        name: 'bash',
        alias: ['sh', 'shell', 'zsh'],
        extensions: ['sh', 'bash', 'zsh'],
        async load() {
            const m = await import('@codemirror/legacy-modes/mode/shell');
            return StreamLanguage.define(m.shell);
        }
    }),
    // --- Erweiterung 2026-07-04: billige Stream-Parser (legacy-modes) für die
    // restlichen hljs-common-Sprachen — wenige KB pro Sprache statt voller
    // Lezer-Grammatiken. Fences matchen über name/alias. ---
    LanguageDescription.of({
        name: 'c',
        extensions: ['c', 'h'],
        async load() { const m = await import('@codemirror/legacy-modes/mode/clike'); return StreamLanguage.define(m.c); }
    }),
    LanguageDescription.of({
        name: 'cpp',
        alias: ['c++', 'cc', 'cxx'],
        extensions: ['cpp', 'hpp', 'cc'],
        async load() { const m = await import('@codemirror/legacy-modes/mode/clike'); return StreamLanguage.define(m.cpp); }
    }),
    LanguageDescription.of({
        name: 'csharp',
        alias: ['cs', 'c#'],
        extensions: ['cs'],
        async load() { const m = await import('@codemirror/legacy-modes/mode/clike'); return StreamLanguage.define(m.csharp); }
    }),
    LanguageDescription.of({
        name: 'objectivec',
        alias: ['objc', 'objective-c'],
        extensions: ['m'],
        async load() { const m = await import('@codemirror/legacy-modes/mode/clike'); return StreamLanguage.define(m.objectiveC); }
    }),
    LanguageDescription.of({
        name: 'kotlin',
        alias: ['kt'],
        extensions: ['kt', 'kts'],
        async load() { const m = await import('@codemirror/legacy-modes/mode/clike'); return StreamLanguage.define(m.kotlin); }
    }),
    LanguageDescription.of({
        name: 'go',
        alias: ['golang'],
        extensions: ['go'],
        async load() { const m = await import('@codemirror/legacy-modes/mode/go'); return StreamLanguage.define(m.go); }
    }),
    LanguageDescription.of({
        name: 'rust',
        alias: ['rs'],
        extensions: ['rs'],
        async load() { const m = await import('@codemirror/legacy-modes/mode/rust'); return StreamLanguage.define(m.rust); }
    }),
    LanguageDescription.of({
        name: 'ruby',
        alias: ['rb'],
        extensions: ['rb'],
        async load() { const m = await import('@codemirror/legacy-modes/mode/ruby'); return StreamLanguage.define(m.ruby); }
    }),
    LanguageDescription.of({
        name: 'swift',
        extensions: ['swift'],
        async load() { const m = await import('@codemirror/legacy-modes/mode/swift'); return StreamLanguage.define(m.swift); }
    }),
    LanguageDescription.of({
        name: 'php',
        extensions: ['php'],
        async load() { const m = await import('@codemirror/lang-php'); return m.php(); }
    }),
    LanguageDescription.of({
        name: 'yaml',
        alias: ['yml'],
        extensions: ['yaml', 'yml'],
        async load() { const m = await import('@codemirror/legacy-modes/mode/yaml'); return StreamLanguage.define(m.yaml); }
    }),
    LanguageDescription.of({
        name: 'xml',
        alias: ['svg', 'xsl'],
        extensions: ['xml', 'svg'],
        async load() { const m = await import('@codemirror/legacy-modes/mode/xml'); return StreamLanguage.define(m.xml); }
    }),
    LanguageDescription.of({
        name: 'scss',
        extensions: ['scss'],
        async load() { const m = await import('@codemirror/legacy-modes/mode/css'); return StreamLanguage.define(m.sCSS); }
    }),
    LanguageDescription.of({
        name: 'less',
        extensions: ['less'],
        async load() { const m = await import('@codemirror/legacy-modes/mode/css'); return StreamLanguage.define(m.less); }
    }),
    LanguageDescription.of({
        name: 'lua',
        extensions: ['lua'],
        async load() { const m = await import('@codemirror/legacy-modes/mode/lua'); return StreamLanguage.define(m.lua); }
    }),
    LanguageDescription.of({
        name: 'perl',
        alias: ['pl'],
        extensions: ['pl', 'pm'],
        async load() { const m = await import('@codemirror/legacy-modes/mode/perl'); return StreamLanguage.define(m.perl); }
    }),
    LanguageDescription.of({
        name: 'r',
        extensions: ['r'],
        async load() { const m = await import('@codemirror/legacy-modes/mode/r'); return StreamLanguage.define(m.r); }
    }),
    LanguageDescription.of({
        name: 'diff',
        alias: ['patch'],
        extensions: ['diff', 'patch'],
        async load() { const m = await import('@codemirror/legacy-modes/mode/diff'); return StreamLanguage.define(m.diff); }
    }),
    LanguageDescription.of({
        name: 'ini',
        alias: ['toml', 'properties'],
        extensions: ['ini', 'toml', 'properties'],
        async load() { const m = await import('@codemirror/legacy-modes/mode/properties'); return StreamLanguage.define(m.properties); }
    }),
    LanguageDescription.of({
        name: 'powershell',
        alias: ['ps1'],
        extensions: ['ps1'],
        async load() { const m = await import('@codemirror/legacy-modes/mode/powershell'); return StreamLanguage.define(m.powerShell); }
    }),
    LanguageDescription.of({
        name: 'dockerfile',
        alias: ['docker'],
        extensions: [],
        async load() { const m = await import('@codemirror/legacy-modes/mode/dockerfile'); return StreamLanguage.define(m.dockerFile); }
    }),
];
import { tags } from '@lezer/highlight';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { highlightSelectionMatches } from '@codemirror/search';
import { ViewPlugin, Decoration } from '@codemirror/view';

// Theme compartment for dynamic switching
const themeCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();
const wordWrapCompartment = new Compartment();
const tabSizeCompartment = new Compartment();
const fontSizeCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
const focusModeCompartment = new Compartment();
const typewriterCompartment = new Compartment();

// Dark theme highlight style (One Dark inspired, matching original editor-highlight colors)
const darkHighlightStyle = HighlightStyle.define([
    { tag: tags.heading, color: '#e5c07b', fontWeight: '600' },
    { tag: tags.heading1, color: '#e5c07b', fontWeight: '600', fontSize: '1.4em' },
    { tag: tags.heading2, color: '#e5c07b', fontWeight: '600', fontSize: '1.2em' },
    { tag: tags.heading3, color: '#e5c07b', fontWeight: '600', fontSize: '1.1em' },
    { tag: tags.strong, color: '#e06c75' },
    { tag: tags.emphasis, color: '#c678dd', fontStyle: 'italic' },
    { tag: tags.strikethrough, color: '#5c6370', textDecoration: 'line-through' },
    { tag: tags.monospace, color: '#98c379' },
    { tag: tags.url, color: '#61afef' },
    { tag: tags.link, color: '#61afef' },
    { tag: tags.quote, color: '#5c6370', fontStyle: 'italic' },
    { tag: tags.meta, color: '#abb2bf' },
    { tag: tags.comment, color: '#5c6370' },
    { tag: tags.processingInstruction, color: '#e5c07b' },
    { tag: tags.contentSeparator, color: '#5c6370' },
]);

// Light theme highlight style
const lightHighlightStyle = HighlightStyle.define([
    { tag: tags.heading, color: '#986801', fontWeight: '600' },
    { tag: tags.heading1, color: '#986801', fontWeight: '600', fontSize: '1.4em' },
    { tag: tags.heading2, color: '#986801', fontWeight: '600', fontSize: '1.2em' },
    { tag: tags.heading3, color: '#986801', fontWeight: '600', fontSize: '1.1em' },
    { tag: tags.strong, color: '#e45649' },
    { tag: tags.emphasis, color: '#a626a4', fontStyle: 'italic' },
    { tag: tags.strikethrough, color: '#999', textDecoration: 'line-through' },
    { tag: tags.monospace, color: '#50a14f' },
    { tag: tags.url, color: '#4078f2' },
    { tag: tags.link, color: '#4078f2' },
    { tag: tags.quote, color: '#999', fontStyle: 'italic' },
    { tag: tags.meta, color: '#383a42' },
    { tag: tags.comment, color: '#999' },
    { tag: tags.processingInstruction, color: '#986801' },
    { tag: tags.contentSeparator, color: '#999' },
]);

// Dark editor theme
const darkEditorTheme = EditorView.theme({
    '&': {
        backgroundColor: 'transparent',
        color: '#d1d5db',
        height: '100%',
    },
    '.cm-content': {
        fontFamily: "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', 'Courier New', monospace",
        padding: '1.5rem',
        caretColor: '#d1d5db',
    },
    '.cm-cursor': {
        borderLeftColor: '#d1d5db',
    },
    '&.cm-focused .cm-cursor': {
        borderLeftColor: '#d1d5db',
    },
    '.cm-selectionBackground': {
        backgroundColor: 'rgba(104, 141, 177, 0.3) !important',
    },
    '&.cm-focused .cm-selectionBackground': {
        backgroundColor: 'rgba(104, 141, 177, 0.3) !important',
    },
    '.cm-gutters': {
        backgroundColor: '#252830',
        color: '#9ca3af',
        border: 'none',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
    },
    '.cm-activeLineGutter': {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    '.cm-activeLine': {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    '.cm-foldGutter': {
        width: '12px',
    },
    '.cm-selectionMatch': {
        backgroundColor: 'rgba(104, 141, 177, 0.2)',
    },
    '&.cm-focused': {
        outline: 'none',
    },
    '.cm-scroller': {
        overflow: 'auto',
    },
    '.cm-line': {
        padding: '0 4px',
    },
}, { dark: true });

// Light editor theme
const lightEditorTheme = EditorView.theme({
    '&': {
        backgroundColor: 'transparent',
        color: '#1a1a1a',
        height: '100%',
    },
    '.cm-content': {
        fontFamily: "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', 'Courier New', monospace",
        padding: '1.5rem',
        caretColor: '#1a1a1a',
    },
    '.cm-cursor': {
        borderLeftColor: '#1a1a1a',
    },
    '&.cm-focused .cm-cursor': {
        borderLeftColor: '#1a1a1a',
    },
    '.cm-selectionBackground': {
        backgroundColor: 'rgba(74, 122, 181, 0.3) !important',
    },
    '&.cm-focused .cm-selectionBackground': {
        backgroundColor: 'rgba(74, 122, 181, 0.3) !important',
    },
    '.cm-gutters': {
        backgroundColor: '#e8e8e8',
        color: '#555555',
        border: 'none',
        borderRight: '1px solid rgba(0, 0, 0, 0.1)',
    },
    '.cm-activeLineGutter': {
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    '.cm-activeLine': {
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
    },
    '.cm-selectionMatch': {
        backgroundColor: 'rgba(74, 122, 181, 0.15)',
    },
    '&.cm-focused': {
        outline: 'none',
    },
    '.cm-scroller': {
        overflow: 'auto',
    },
    '.cm-line': {
        padding: '0 4px',
    },
}, { dark: false });

// C4: Focus Mode — dims all lines except the current paragraph
function createFocusModeExtension() {
    return ViewPlugin.fromClass(class {
        constructor(view) {
            this.decorations = this.buildDecorations(view);
        }
        update(update) {
            if (update.docChanged || update.selectionSet) {
                this.decorations = this.buildDecorations(update.view);
            }
        }
        buildDecorations(view) {
            const { state } = view;
            const cursor = state.selection.main.head;
            const cursorLine = state.doc.lineAt(cursor).number;

            // Find paragraph boundaries (blank line delimited)
            let paraStart = cursorLine;
            while (paraStart > 1 && state.doc.line(paraStart - 1).text.trim() !== '') {
                paraStart--;
            }
            let paraEnd = cursorLine;
            while (paraEnd < state.doc.lines && state.doc.line(paraEnd + 1).text.trim() !== '') {
                paraEnd++;
            }

            const builder = [];
            const dimMark = Decoration.line({ class: 'cm-focus-dim' });
            for (let i = 1; i <= state.doc.lines; i++) {
                if (i < paraStart || i > paraEnd) {
                    builder.push(dimMark.range(state.doc.line(i).from));
                }
            }
            return Decoration.set(builder);
        }
    }, {
        decorations: v => v.decorations,
    });
}

// Focus mode theme (adds dim styling)
const focusModeTheme = EditorView.theme({
    '.cm-focus-dim': { opacity: '0.3', transition: 'opacity 0.2s ease' },
});

// C5: Typewriter Mode — keeps cursor line at ~40% vertical
function createTypewriterExtension() {
    return ViewPlugin.fromClass(class {
        constructor(view) {
            this.lastLine = -1;
        }
        update(update) {
            if (update.selectionSet || update.docChanged) {
                const { state } = update.view;
                const line = state.doc.lineAt(state.selection.main.head).number;
                if (line !== this.lastLine) {
                    this.lastLine = line;
                    // Scroll cursor to 40% of viewport
                    const coords = update.view.coordsAtPos(state.selection.main.head);
                    if (coords) {
                        const target = update.view.scrollDOM.clientHeight * 0.4;
                        const delta = coords.top - update.view.scrollDOM.getBoundingClientRect().top - target;
                        if (Math.abs(delta) > 10) {
                            update.view.scrollDOM.scrollBy({ top: delta, behavior: 'smooth' });
                        }
                    }
                }
            }
        }
    });
}

/**
 * Create a new CodeMirror editor instance.
 * @param {HTMLElement} parentElement - DOM element to mount the editor in
 * @param {Object} options - Configuration
 * @param {string} options.initialDoc - Initial document content
 * @param {boolean} options.isDark - Whether dark theme is active
 * @param {boolean} options.showLineNumbers - Show line number gutter
 * @param {boolean} options.wordWrap - Enable word wrapping
 * @param {number} options.tabSize - Tab size in spaces
 * @param {number} options.fontSize - Font size in pixels
 * @param {function} options.onUpdate - Callback for document changes: (update) => void
 * @returns {Object} { view, compartments }
 */
function createEditor(parentElement, options = {}) {
    const {
        initialDoc = '',
        isDark = true,
        showLineNumbers = false,
        wordWrap = true,
        tabSize = 4,
        fontSize = 14,
        onUpdate = null,
    } = options;

    const updateListener = onUpdate ? EditorView.updateListener.of(update => {
        onUpdate(update);
    }) : [];

    const state = EditorState.create({
        doc: initialDoc,
        extensions: [
            // Line numbers (togglable)
            lineNumbersCompartment.of(showLineNumbers ? lineNumbers() : []),

            // Core editing
            history(),
            drawSelection(),
            rectangularSelection(),
            highlightActiveLine(),
            highlightActiveLineGutter(),
            highlightSpecialChars(),
            highlightSelectionMatches(),
            indentOnInput(),
            bracketMatching(),
            closeBrackets(),
            foldGutter(),
            placeholder('Beginnen Sie mit dem Schreiben Ihres Markdown-Textes...'),

            // Tab/indent size
            tabSizeCompartment.of(EditorState.tabSize.of(tabSize)),
            indentUnit.of(' '.repeat(tabSize)),

            // Word wrap
            wordWrapCompartment.of(wordWrap ? EditorView.lineWrapping : []),

            // Font size
            fontSizeCompartment.of(EditorView.theme({
                '.cm-content': { fontSize: fontSize + 'px' },
                '.cm-gutters': { fontSize: fontSize + 'px' },
            })),

            // Theme (dark/light)
            themeCompartment.of([
                isDark ? darkEditorTheme : lightEditorTheme,
                syntaxHighlighting(isDark ? darkHighlightStyle : lightHighlightStyle),
            ]),

            // Read-only compartment (for future use)
            readOnlyCompartment.of(EditorState.readOnly.of(false)),

            // C4: Focus mode (off by default)
            focusModeCompartment.of([]),

            // C5: Typewriter mode (off by default)
            typewriterCompartment.of([]),

            // Markdown language support with code block language detection
            markdown({
                base: markdownLanguage,
                codeLanguages: codeLanguages,
            }),

            // Keybindings - filter out Tab/Enter so the app can handle them
            // (smart list continuation, table navigation, indent).
            // H4: also drop bindings the app implements itself (Mod-Shift-k delete
            // line, Alt-Arrow move line, Mod-d) — on Win/Linux the menu accelerator,
            // the document handler AND the CM binding all fired, deleting/moving up
            // to three lines per press. searchKeymap is dropped entirely: it opened
            // CM's built-in English search UI (Mod-g/F3) next to the app's German one.
            keymap.of([
                ...closeBracketsKeymap,
                ...defaultKeymap.filter(b => {
                    const APP_HANDLED = [
                        'Tab', 'Shift-Tab', 'Enter',
                        'Mod-Shift-k',            // app: Zeile löschen
                        'Alt-ArrowUp', 'Alt-ArrowDown', // app: Zeile verschieben
                    ];
                    const key = b.key || '';
                    return !APP_HANDLED.includes(key);
                }),
                ...historyKeymap,
            ]),

            // Update listener
            updateListener,
        ],
    });

    const view = new EditorView({
        state,
        parent: parentElement,
    });

    return {
        view,
        compartments: {
            theme: themeCompartment,
            lineNumbers: lineNumbersCompartment,
            wordWrap: wordWrapCompartment,
            tabSize: tabSizeCompartment,
            fontSize: fontSizeCompartment,
            readOnly: readOnlyCompartment,
        },
        // Helper functions exposed for the adapter
        setTheme(isDark) {
            view.dispatch({
                effects: themeCompartment.reconfigure([
                    isDark ? darkEditorTheme : lightEditorTheme,
                    syntaxHighlighting(isDark ? darkHighlightStyle : lightHighlightStyle),
                ]),
            });
        },
        setLineNumbers(show) {
            view.dispatch({
                effects: lineNumbersCompartment.reconfigure(show ? lineNumbers() : []),
            });
        },
        setWordWrap(enabled) {
            view.dispatch({
                effects: wordWrapCompartment.reconfigure(enabled ? EditorView.lineWrapping : []),
            });
        },
        setTabSize(size) {
            view.dispatch({
                effects: tabSizeCompartment.reconfigure(EditorState.tabSize.of(size)),
            });
        },
        setFontSize(size) {
            view.dispatch({
                effects: fontSizeCompartment.reconfigure(EditorView.theme({
                    '.cm-content': { fontSize: size + 'px' },
                    '.cm-gutters': { fontSize: size + 'px' },
                })),
            });
        },
        undo() { undo(view); },
        redo() { redo(view); },
        setFocusMode(enabled) {
            view.dispatch({
                effects: focusModeCompartment.reconfigure(
                    enabled ? [createFocusModeExtension(), focusModeTheme] : []
                ),
            });
        },
        setTypewriterMode(enabled) {
            view.dispatch({
                effects: typewriterCompartment.reconfigure(
                    enabled ? createTypewriterExtension() : []
                ),
            });
        },
    };
}

// Export for IIFE bundle
export { createEditor, EditorView, EditorState };

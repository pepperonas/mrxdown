/**
 * CodeMirror 6 setup for MrxDown.
 * Bundled via esbuild into vendor/codemirror-bundle.js as IIFE (global: CMSetup).
 */
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection, highlightSpecialChars, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, undo, redo } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching, foldGutter, indentUnit } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';

// Theme compartment for dynamic switching
const themeCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();
const wordWrapCompartment = new Compartment();
const tabSizeCompartment = new Compartment();
const fontSizeCompartment = new Compartment();
const readOnlyCompartment = new Compartment();

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

            // Markdown language support with code block language detection
            markdown({
                base: markdownLanguage,
                codeLanguages: languages,
            }),

            // Keybindings - filter out Tab/Enter so the app can handle them
            // (smart list continuation, table navigation, indent)
            keymap.of([
                ...closeBracketsKeymap,
                ...defaultKeymap.filter(b => {
                    const key = b.key || '';
                    return key !== 'Tab' && key !== 'Shift-Tab' && key !== 'Enter';
                }),
                ...historyKeymap,
                ...searchKeymap,
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
    };
}

// Export for IIFE bundle
export { createEditor, EditorView, EditorState };

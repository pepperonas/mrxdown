// MrxDown Renderer — Modul 02-state.js
// Gesamter geteilter App-State (tabs, settings, DOM-Refs, Suche) — MUSS vor allen anderen Modulen laden
// Classic Script (kein ESM): Top-Level-Deklarationen sind global über alle
// Renderer-Module hinweg; die Ladereihenfolge in index.html ist verbindlich.

// Application State
let tabs = [];
let activeTabId = 0;
let nextTabId = 1;
let sidebarVisible = true;
let lineNumbers = false;
let wordWrap = true;
let currentViewMode = 'split';
let isResizing = false;
let startX = 0;
let startWidth = 0;
let isScrollSyncing = false;
let renderDebounceTimer = null;
let autoSaveTimer = null;
let settings = {
    theme: 'dark',
    fontSize: 14,
    autoSave: false,
    autoSaveInterval: 5,
    showLineNumbers: false,
    wordWrap: true,
    tabSize: 4,
    syncScroll: true,
    writingGoal: 0
};

// DOM Elements - will be initialized in initializeApp
let editor, preview, charCount, wordCount, lineCount, fileName, tabBar, sidebar, dropZone, fileExplorer, contextMenu, aboutModal, tableEditor, searchModal, replaceModal;

// Search state
let currentSearchTerm = '';
let searchMatches = [];
let currentMatchIndex = -1;
let searchDebounceTimer = null;
let replaceDebounceTimer = null;

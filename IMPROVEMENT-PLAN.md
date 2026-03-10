# MrxDown Improvement Plan

Umfassender Verbesserungsplan: alle Kategorien, Dashboard maximal, kein Zen-Modus.

## Umsetzungsreihenfolge

### Phase 1: Stabilitaet und Robustheit (A1-A7)

Muss zuerst kommen, da spaetere Features auf stabilem Fundament aufbauen.

**A1: Race Condition beim Schliessen fixen**
- `main.js`: Close-Handler auf async/await umstellen
- Save-IPC als `ipcMain.handle` (invoke/return) statt fire-and-forget
- Window erst schliessen wenn Save-Promise resolved
- Betrifft: `main.js` (close-Handler ~Zeile 596-626)

**A2: Browser-Dialoge durch Electron-Dialoge ersetzen**
- `confirm()` durch `dialog.showMessageBoxSync` oder async `showMessageBox` ersetzen
- `prompt()` durch eigenen modalen Dialog in `index.html` ersetzen (Link-URL, Bild-URL, Tabellen-Groesse)
- Neues UI-Element: `<div id="input-dialog">` mit Textfeld, Abbrechen, OK
- Betrifft: `renderer.js` (~10 Stellen), `index.html` (neue Modal-Struktur), `css/components.css`

**A3: Crash-Handler**
- `main.js`: `process.on('uncaughtException')` mit Fehler loggen + Dialog
- `app.on('render-process-gone')` mit Window neu erstellen + Session wiederherstellen
- Betrifft: `main.js` (App-Lifecycle)

**A4: Bild-URL-Limits fuer PDF**
- HTTP-Fetch: 10s Timeout, 10MB Limit, max 5 Redirects
- Fallback: Platzhalter-Bild wenn Fetch fehlschlaegt
- Betrifft: `main.js` (`resolveImageToBase64` ~Zeile 171-262)

**A5: PDF-Wait intelligent machen**
- `setTimeout(2000)` ersetzen durch `MutationObserver` + `requestIdleCallback`
- Hidden-Window wartet bis DOM stabil ist (keine Mutations fuer 500ms)
- Betrifft: `main.js` (PDF-Export-Funktionen)

**A6: Undo-History pro Tab erhalten**
- Separaten `EditorState` pro Tab speichern statt nur Content-String
- Tab-Wechsel tauscht den gesamten CM6-State (inkl. Undo, Cursor, Scroll)
- `cm-adapter.js`: neue Methode `getState()`/`setState(state)`
- Betrifft: `cm-adapter.js`, `renderer.js` (Tab-Verwaltung), `src/codemirror-setup.js`

**A7: macOS File Association**
- `app.on('open-file')` Handler in `main.js`
- Datei in neuem Tab oeffnen wenn App schon laeuft
- Datei merken wenn App noch startet (before `ready`)
- Betrifft: `main.js` (App-Lifecycle)

---

### Phase 2: Info-Dashboard (B1-B7)

Neues ausklappbares Panel + erweiterte Statusleiste.

**B1: Erweiterter Dokumentstatus**
- Neue Funktion `analyzeDocument(text)` in `editor-utils.js` (testbar!)
- Rueckgabe: `{ chars, charsNoSpaces, words, sentences, paragraphs, headings, images, links, codeBlocks, readingTimeMin }`
- Lesezeit: 200 WPM Durchschnitt
- Betrifft: `editor-utils.js` (neue Funktion), `renderer.js` (Anzeige), Tests

**B2: Schreibziel-Tracker**
- Setting: Wortziel (z.B. 1000 Woerter/Tag)
- Fortschrittsbalken in Statusleiste oder Dashboard-Panel
- Session-Start Wortanzahl merken, Delta berechnen
- Persisted in `settings.json`
- Betrifft: `main.js` (Settings), `renderer.js` (UI), `index.html`, `css/components.css`

**B3: Dokument-Info-Panel**
- Neues ausklappbares Panel (Button in Statusleiste)
- Zeigt: Dateipfad, Groesse, Erstellt, Geaendert, Encoding, Markdown-Struktur
- Struktur: Heading-Baum mit Verschachtelung, Anzahl pro Ebene
- IPC: `getFileStats(filePath)` liefert `{ size, created, modified }`
- Betrifft: `index.html` (Panel), `main.js` (IPC), `renderer.js` (Logik), `preload.js`, CSS

**B4: Live-Statistiken in Statusleiste**
- Statusleiste erweitern: Zeichen | Woerter | Zeilen | Absaetze | Lesezeit
- Live-Update bei jedem `renderMarkdown()` Call (bereits debounced)
- Betrifft: `index.html` (Status-Elemente), `renderer.js` (Update-Logik)

**B5: Session-Statistik**
- Track: Woerter geschrieben seit App-Start, Netto-Wortaenderung, aktive Schreibzeit
- Aktive Schreibzeit: Timer laeuft wenn Tastatureingabe, pausiert nach 30s Inaktivitaet
- Anzeige im Dashboard-Panel
- Betrifft: `renderer.js` (Tracking-Logik), Dashboard-Panel

**B6: Tab-Uebersicht**
- Panel/Dialog mit Tabelle aller offenen Tabs
- Spalten: Dateiname, Pfad, Woerter, Status (geaendert/gespeichert), Groesse
- Sortierbar per Klick auf Spaltenheader
- Doppelklick aktiviert Tab
- Keyboard-Shortcut: `Cmd+Shift+T`
- Betrifft: `index.html`, `renderer.js`, `css/components.css`

**B7: Markdown-Lint-Anzeige**
- Pruefungen: Kaputte relative Links, fehlende Bilder, Heading-Spruenge (H1 direkt zu H3), doppelte Headings, leere Links
- Ergebnis als Badge in Statusleiste ("3 Warnungen")
- Klick oeffnet Panel mit Warnungsliste, Klick auf Warnung springt zu Zeile
- `lintMarkdown(text, filePath)` in `editor-utils.js` (testbar!)
- Betrifft: `editor-utils.js`, `renderer.js`, `index.html`, CSS, Tests

---

### Phase 3: Editor-Verbesserungen (C1-C8)

**C1: Command Palette**
- `Cmd+Shift+P`: Overlay mit Textfeld + Ergebnisliste
- Fuzzy-Suche ueber alle registrierten Commands
- Command-Registry: Array von `{ id, label, shortcut, action }` Objekten
- Jeder existierende Menueeintrag + Toolbar-Button wird als Command registriert
- Betrifft: `index.html` (Overlay), `renderer.js` (Command-Registry + UI), CSS

**C2: Bild einfuegen per Paste**
- `paste` Event abfangen, `clipboardData.items` nach Bild scannen
- Bild als Datei speichern (gleiches Verzeichnis wie .md, Unterordner `images/`)
- `![](images/paste-{timestamp}.png)` in Editor einfuegen
- IPC: `saveClipboardImage(dirPath, imageBuffer)` liefert `relativePath`
- Betrifft: `renderer.js` (Paste-Handler), `main.js` (IPC), `preload.js`

**C3: Rechtschreibpruefung**
- Electron hat eingebautes Spellcheck: `webPreferences.spellcheck: true`
- Sprache konfigurierbar in Settings (Default: `de-DE`)
- Rechtsklick-Kontextmenue zeigt Vorschlaege
- Toggle in Settings
- Betrifft: `main.js` (webPreferences), Settings

**C4: Focus Mode**
- Aktueller Absatz normal, Rest mit `opacity: 0.3`
- Toggle via Toolbar-Button oder `Cmd+Shift+F`
- CM6 Extension: Custom `ViewPlugin` das aktuellen Absatz tracked
- Betrifft: `src/codemirror-setup.js` (Extension), `renderer.js` (Toggle), Toolbar

**C5: Typewriter Mode**
- Cursor-Zeile bleibt vertikal bei ~40% des Editors
- CM6 `scrollIntoView` mit custom `marginTop`
- Toggle via Toolbar oder Setting
- Betrifft: `src/codemirror-setup.js`, `cm-adapter.js`, Settings

**C6: Checkbox-Toggle im Preview**
- `renderMarkdown()`: Checkboxen bekommen `data-line` Attribut mit Quellzeile
- Click-Handler auf `.task-list-item input[type=checkbox]`
- Bei Klick: Zeile im Editor finden, `[ ]` zu `[x]` togglen (und umgekehrt)
- Betrifft: `renderer.js` (Renderer-Customization + Click-Handler)

**C7: Drag and Drop fuer Bilder**
- Editor-Drop-Zone erweitern: Bilddateien (.png, .jpg, .gif, .svg) akzeptieren
- Bild kopieren in `images/` Unterordner (relativ zur .md-Datei)
- `![filename](images/filename.png)` an Cursor-Position einfuegen
- Betrifft: `renderer.js` (Drop-Handler), `main.js` (Datei-Kopie IPC)

**C8: Minimap**
- CM6 hat kein eingebautes Minimap: Custom-Implementation noetig
- Canvas-basiert: Text als 1px-Linien rendern
- Klick + Drag zum Navigieren
- Toggle in Settings
- Betrifft: Neues Modul `minimap.js`, `index.html`, CSS, `renderer.js`

---

### Phase 4: Rendering und Export (D1-D7)

**D1: Mermaid-Diagramme**
- `marked` Extension: Codeblock mit Sprache `mermaid` erkennen
- Mermaid.js als Vendor-Library (oder CDN-Fallback)
- Rendern als SVG in Preview, inline SVG in PDF
- Betrifft: `renderer.js` (marked-Extension), `vendor/` oder `package.json`, PDF-Builder

**D2: KaTeX Mathe-Formeln**
- `marked` Extension: `$...$` (inline) und `$$...$$` (Block)
- KaTeX als Vendor-Library
- CSS fuer Mathe-Darstellung
- Betrifft: `renderer.js`, `vendor/` oder `package.json`, `css/preview.css`, PDF-Stylesheet

**D3: Syntax-Highlighting in PDF**
- highlight.js oder Prism.js fuer Code-Bloecke
- Theme: dezentes Farbschema passend zum PDF-Style
- `getPdfStylesheet()` um Highlight-CSS erweitern
- Betrifft: `main.js` (PDF-Builder), neue Vendor-Library

**D4: PDF-Optionen-Dialog**
- Modal vor PDF-Export: Seitengroesse, Raender, Orientierung, Schriftgroesse
- Letzte Einstellungen merken in `settings.json`
- Quick-Export (Cmd+P) mit gespeicherten Defaults, Shift+Cmd+P fuer Dialog
- Betrifft: `index.html` (Dialog), `renderer.js`, `main.js` (PDF-Params), Settings

**D5: Inhaltsverzeichnis im PDF**
- Optional: Checkbox im PDF-Dialog
- TOC aus Headings generieren, am Anfang des PDFs einfuegen
- Mit Seitenzahl-Referenzen (CSS `target-counter` oder Post-Processing)
- Betrifft: `main.js` (`buildPdfHtml`)

**D6: Seitenzahlen im PDF**
- CSS `@page` mit `@bottom-center` und `counter(page)`
- Optional: Dokumenttitel im Header
- Betrifft: `main.js` (`getPdfStylesheet`)

**D7: YAML Frontmatter**
- Frontmatter-Block (`---...---`) am Dateianfang parsen
- Optionen: ausblenden, als formatierte Box rendern, oder als Metadaten nutzen (Titel fuer PDF)
- Setting: Frontmatter-Anzeige (aus/Box/Metadaten)
- Betrifft: `renderer.js` (Parsing + Rendering), Settings

---

### Phase 5: UI/UX Polish (E1-E7)

**E1: Fensterposition merken**
- `window-state-keeper` Pattern: Bounds + isMaximized speichern
- In `settings.json` oder separate `window-state.json`
- Betrifft: `main.js` (Window-Erstellung + `resize`/`move` Events)

**E2: Sidebar resizable**
- Drag-Handle (5px Streifen) zwischen Sidebar und Editor
- `mousedown` dann `mousemove` tracken, CSS Variable `--sidebar-width` updaten
- Min 150px, Max 500px
- Breite persistieren in Settings
- Betrifft: `index.html`, `renderer.js`, `css/layout.css`, Settings

**E3: Vollstaendiger Dateibaum**
- Rekursive Ordner-Navigation: Ordner klicken zum Expandieren/Kollabieren
- Lazy Loading: Ordnerinhalt erst bei Expand laden
- Aktive Datei hervorheben
- Refresh-Button
- Neuen Ordner als Root setzen (Drag and Drop oder Menue)
- Betrifft: `renderer.js` (FileTree-Logik), `main.js` (IPC fuer readdir), `index.html`, CSS

**E4: Paragraph-Level Scroll-Sync**
- Source-Map: Jedes Preview-Element bekommt `data-source-line` Attribut
- Editor-Scroll findet naechstes sichtbares `data-source-line` Element in Preview
- Preview-Scroll scrollt Editor zu entsprechender Zeile
- Betrifft: `renderer.js` (marked-Renderer + Scroll-Logik)

**E5: Natives Kontextmenue im Editor**
- Rechtsklick baut Electron `Menu` (nicht custom HTML)
- Eintraege: Ausschneiden, Kopieren, Einfuegen, Trenner, Fett, Kursiv, Code, Link, Trenner, Alle markieren
- Kontextsensitiv: "Link oeffnen" wenn Cursor auf Link steht
- Betrifft: `main.js` (Kontextmenue IPC), `renderer.js`

**E6: Tab-Previews**
- Hover ueber Tab zeigt Tooltip mit den ersten ~5 Zeilen des Dokuments
- Oder: kleine Vorschau-Box (200x150px) mit gerendertem Markdown
- CSS-Tooltip reicht erstmal (einfacher)
- Betrifft: `renderer.js` (Tab-Rendering), CSS

**E7: Toolbar erweitern**
- Neue Buttons: PDF-Export (einzeln), Undo, Redo, Bild einfuegen
- Platzierung: Undo/Redo nach File-Gruppe, Bild nach Link-Button, PDF neben HTML-Export
- Betrifft: `index.html`, `renderer.js` (Click-Handler), `icons.js` (neue Icons)

---

### Phase 6: Performance (F1-F3)

**F1: Inkrementelles Rendering**
- Statt vollem DOM-Replacement: morphdom oder eigenes DOM-Diffing
- Nur geaenderte Elemente updaten, keine Scroll-Position-Verluste, weniger Layout-Thrashing
- Library: `morphdom` (~4KB) oder `nanomorph`
- Betrifft: `renderer.js` (`renderMarkdown`), neue Vendor-Library

**F2: File Watcher auf chokidar**
- `fs.watchFile` (Polling 2s) ersetzen durch `chokidar.watch` (Event-basiert, effizient)
- Weniger CPU, sofortige Erkennung
- chokidar als Dependency
- Betrifft: `main.js` (Watcher-Logik), `package.json`

**F3: Separater EditorState pro Tab**
- Ueberschneidet sich mit A6 (Undo-History)
- Jeder Tab haelt eigenen CM6 `EditorState`
- Tab-Wechsel: `view.setState(tab.editorState)` statt `editor.value = content`
- Sofortiges Umschalten, kein Parsen, kein Re-Highlighting
- Betrifft: `cm-adapter.js`, `renderer.js`, `src/codemirror-setup.js`

---

## Zusammenfassung: 41 Features

| Phase | Features | Aufwand | Prio |
|-------|----------|---------|------|
| 1: Stabilitaet | A1-A7 | Mittel | Hoechste |
| 2: Dashboard | B1-B7 | Gross | Hoch |
| 3: Editor | C1-C8 | Gross | Hoch |
| 4: Rendering | D1-D7 | Mittel-Gross | Mittel |
| 5: UI/UX | E1-E7 | Mittel | Mittel |
| 6: Performance | F1-F3 | Mittel | Normal |

## Empfohlene Reihenfolge innerhalb der Phasen

**Quickwins zuerst** (jeweils 1-2 Dateien, schnell umsetzbar):
A3, A7, C3, E1, E7, D6, B4

**Dann Kern-Features**:
A1, A2, A6/F3, B1, C1, C2, E3, E4

**Dann die grossen Bloecke**:
B2-B7, C4-C8, D1-D5, E2-E6, F1-F2

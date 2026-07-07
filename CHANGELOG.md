# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Wiki-Links + Backlinks (`[[Foo]]`)
- i18n (DE/EN)
- Code-Signing + Notarization für macOS
- PDF-Metadaten (Titel, Autor, Keywords)
- Word-Export via Pandoc, Quick-Open (⌘P)

## [0.10.0] - 2026-07-08

### ⌨️ CLI zum echten Konverter (K7)
- **`mrxdown --to pdf|html|docx <datei|verzeichnis …>`** headless: HTML (portables Standalone-Dokument mit eingebetteten Bildern, Callout-Styles, Heading-IDs), DOCX (mammoth-verifiziert, Frontmatter → docProps) und PDF (wie bisher, inkl. Mermaid/KaTeX/Tagged-PDF). `--pdf` bleibt als Alias erhalten (Kontextmenüs, bestehende Skripte).
- **Mehrere Datei-/Verzeichnis-Argumente** in einem Aufruf (Shell-Globs: `mrxdown --to html docs/*.md`); Verzeichnisse expandieren zu allen `.md`-Dateien. Exit-Code 0 nur wenn alles gelang; unbekannte Formate/fehlende Dateien → 1.
- **CLI-Heading-IDs**: der GitHub-kompatible Heading-ID-Renderer der Preview (editor-utils.js) läuft jetzt auch headless — interne Anker-Links funktionieren in CLI-HTML und CLI-PDF.
- **Q1, Teil 2**: die gesamte CLI ist aus `main.js` nach `src/main/cli.js` gezogen (Einzel- und Batch-Pfad konsolidiert, ~210 Zeilen Duplikat entfernt); `main.js` ist bei ~1690 Zeilen (Start: 2582).
- Wrapper aktualisiert: `mrxdown-cli.sh` (`--to`-Flag, Mehrfach-Argumente, `--help`) und `build/mrxdown.cmd` (reicht `--to` durch, Default bleibt PDF).
- Neues Release-Gate `tests/e2e/cli-convert.js` (15 Checks: HTML-Gerüst/Titel/Callouts/IDs, DOCX-mammoth-Roundtrip + docProps, Mehrfach-Argumente, Fehlerfälle) — läuft in `npm run test:e2e` mit.

## [0.9.0] - 2026-07-08

### 📄 DOCX-Export (K2) — Word ohne Pandoc
- **Word-Export im Export-Dialog** (`Cmd+Shift+E` → Format „Word (DOCX)"): JS-nativ über `@turbodocx/html-to-docx`, keine externen Binaries. Input ist das Preview-HTML (dieselbe Quelle wie der PDF-Export) → echte Word-Heading-Styles (per mammoth-Roundtrip verifiziert), Tabellen, Listen, Links, eingebettete Bilder (inkl. Downscaling-Pipeline), Code-Blöcke als Courier-Absätze.
- **Frontmatter → Dokumenteigenschaften**: title/author/subtitle/keywords landen in `docProps/core.xml`.
- **Optionales echtes TOC-Feld** (Checkbox im Dialog): OOXML-`TOC \o "1-3"`-Feld + `updateFields` — Word füllt das Inhaltsverzeichnis beim Öffnen selbst.
- KaTeX-Formeln werden dedupliziert (MathML-Zweig gestrippt), Mermaid-Diagramme durch einen Platzhalter ersetzt (Word kann kein SVG).
- Registry-Anbindung: DOCX erschien im Export-Dialog ohne eine Zeile Dialog-Sonderlogik — Format-Katalog und `needs`-Felder kommen aus der K1-Registry.
- Tests: 8 Jest (mammoth-Roundtrip, docProps, Courier-Code, TOC-Injektion) + erweitertes E2E `export-dialog` (17 Checks).

## [0.8.0] - 2026-07-08

### 💬 Callouts / Admonitions (E4)
- **`> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`** (GitHub-/Obsidian-Stil) rendern in der Vorschau als gestylte Boxen mit Icon + deutschem Label (Hinweis/Tipp/Wichtig/Warnung/Achtung); eigener Titel via `> [!TIP] Mein Titel`. Markdown im Body (Listen, fett, Code …) funktioniert; unbekannte Typen und normale Zitate bleiben Blockquotes.
- **Auch im PDF** (GUI und CLI): eine geteilte marked-Extension (`callouts.js`, dual-use wie editor-utils.js) erzeugt in Preview und Headless-CLI identisches Markup; druckfreundliche Styles in allen drei PDF-Templates, `page-break-inside: avoid`.
- **M3-Token-Styling** in der Vorschau (color-mix-Flächen, Akzent pro Typ, Light-Theme folgt automatisch); neue Token-Rolle `--md-warning` (dark + light) ergänzt.
- Tests: 11 Jest (Header-Parsing + marked-Integration) + E2E-Szenario `callouts` (9 Checks, inkl. DOMPurify-Überleben der Icon-SVGs und Theme-Wechsel).

## [0.7.0] - 2026-07-08

### 📋 Paste-as-Markdown + Datei-Import (K6)
- **Rich-Text/HTML einfügen → automatisch Markdown**: Kopiertes aus Word, Google Docs, Browsern etc. landet als sauberes Markdown im Editor (Turndown + GFM-Plugin, vendored, 12,6 KB — ATX-Headings, `-`-Listen, GFM-Tabellen, Fenced-Code). Konservative Heuristik: konvertiert nur, wenn die HTML-Variante echte Struktur trägt (`shouldConvertHtmlPaste`); reine Text-Wrapper, Copys aus dem eigenen Editor und Einfügen im Code-Fence bleiben normaler Paste. Google-Docs-Bold-Wrapper wird entpackt. Abschaltbar in den Einstellungen.
- **⌘⇧V — Einfügen ohne Formatierung** (Menü „Bearbeiten", Kontextmenü, Command Palette): fügt immer text/plain ein, an der Konvertierung vorbei.
- **`.docx`-/`.html`-Import per Drag&Drop**: konvertiert nach Markdown und öffnet das Ergebnis als neuen (ungespeicherten) Tab. DOCX via mammoth im Main-Prozess (lazy-required; Datei-Inhalt läuft als Uint8Array über validierte IPC — `File.path` existiert unter Electron 43 nicht mehr), HTML direkt im Renderer.
- **Fix: Paste-Pipeline lief zu spät** — CodeMirrors eigener paste-Handler fügte text/plain ein und konsumierte das Event, BEVOR der document-Listener drankam. Der Paste-Handler läuft jetzt in der Capture-Phase (+ stopPropagation bei Übernahme). Das repariert auch das bestehende **Paste-URL-über-Auswahl** (`[Auswahl](URL)`), das dadurch still wirkungslos war.
- Neue Tests: 11 Jest (Paste-Heuristik + Markdown-Cleanup) + E2E-Szenario `paste-import` (19 Checks, inkl. echtem DOCX→Markdown-Roundtrip über die mammoth-IPC mit `.docx`-Fixture).

## [0.6.0] - 2026-07-07

### 🧩 Export-Registry + gemeinsamer Export-Dialog (Konverter-Grundstein, K1)
- **Zentrale Format-Registry** (`src/main/export/registry.js`): jedes Zielformat ist ein Modul mit `{ id, label, ext, mime, filters, needs, optionsPanel, toBuffer(doc) }`. HTML und PDF sind überführt; neue Formate (DOCX, EPUB, Slides) registrieren sich künftig hier.
- **Gemeinsamer Export-Dialog** (`Cmd+Shift+E`, Menü „Datei → Exportieren…", Command Palette): Format-Auswahl aus der Registry + format-spezifische Optionen (PDF: Vorlage, Seitengröße, Ränder, TOC, Seitenzahlen — die HTML-Variante braucht keine). Direkt-Exporte `Cmd+E` (HTML) und `Cmd+P` (PDF) bleiben unverändert.
- **Neue IPC** `get-export-formats` + `export-document` (invoke, mit Input-Validierung: Format-Whitelist, Typ-Checks, Größen-Limit; PDF-Optionen werden main-seitig saniert — Seitengrößen-Whitelist, geklemmte Ränder/Schriftgrößen).

### 🔧 main.js entflochten (Q1, Teil 1)
- Export-/PDF-Kern (Frontmatter-Parsing, Template-System, hljs/KaTeX/Mermaid-Aufbereitung, printToPDF-Rendering samt Metadaten/Outline, Bild-Einbettung) aus `main.js` in fünf Module unter `src/main/export/` extrahiert — verhaltensidentisch, `main.js` von 2582 auf ~1850 Zeilen. Veränderlicher Zustand (settings, currentFilePath) fließt über einen DI-Kontext.
- Neue Jest-Suite für das jetzt eigenständige Frontmatter-Modul (14 Tests) + E2E-Szenario für Registry & Export-Dialog (12 Checks).

## [0.5.0] - 2026-07-05

### 📦 Ein-Befehl-Installation für macOS
- **`mrxdown-install-macos.sh`** (Release-Asset + curl-Einzeiler im README, Muster: inspector-rust): erkennt die CPU-Architektur, lädt das neueste Release, entfernt das Quarantäne-Attribut (`xattr -cr`) und installiert nach `/Applications` — **keine Gatekeeper-Dialoge, kein Rechtsklick→Öffnen**. Auch als Update-Weg: gleicher Befehl, laufende Instanz wird sanft beendet. (Die vollständige Lösung — Developer-ID + Notarization — bleibt als „Planned".)

### 📄 PDF-Export-Offensive (alle 4 Phasen des PDF-Audits)
- **Electron 28 → 43 (Chromium 120 → 150)** — komplette Test-Suite lief auf Anhieb grün. Schaltet nativ frei:
  - **Seitenzahlen funktionieren jetzt wirklich**: die `@page @bottom-center { counter(page) }`-Regeln der Templates wurden von Chromium 120 still ignoriert (Margin-Boxes kamen erst in Chrome 131). Empirisch verifiziert (Seitenzahl im gerasterten PDF sichtbar).
  - **PDF-Bookmarks/Outline** aus H1–H6: `generateDocumentOutline` existierte erst ab Electron 29 — wir übergaben es bisher wirkungslos.
- **PDF-Metadaten** (pdf-lib-Nachpass in allen 5 Exportpfaden): Title/Author/Subject/Keywords aus dem Frontmatter (Fallback Dateiname), `Lang de-DE`, Creator `MrxDown <version>`. printToPDF selbst schreibt keinerlei Metadaten.
- **Mermaid im CLI-PDF**: ```mermaid-Fences werden im versteckten Druckfenster mit dem vendor-Mermaid gerendert (vorher: roher Codeblock). KaTeX + Mermaid damit in GUI- UND CLI-PDFs.
- **CLI-Pfade**: `generateTaggedPDF` + Outline jetzt auch dort (Barrierefreiheit, `/Lang`).
- **Inhaltsverzeichnis mit echten Seitenzahlen** (Zwei-Pass): Chromium kann `target-counter()` bis heute nicht — Pass 1 liefert via Dokument-Outline die Heading→Seite-Zuordnung (pdfjs-dist), Pass 2 druckt das TOC mit Seitenzahlen + punktierten Führungslinien; Einträge sind klickbare interne Links. Fehlschlag ist nie fatal (dann TOC ohne Zahlen). Das bietet nicht mal Typora.
- **Korrekte Warte-Bedingung** vor dem Druck: `document.fonts.ready` + `img.decode()` + Mermaid-Fertigmeldung statt `requestIdleCallback`-Blindflug (auch CLI: statt fixer 1000 ms).
- **Bild-Downscaling beim Einbetten**: Skia bettet Nicht-JPEGs in voller Auflösung ein — Bilder >1600 px werden jetzt herunterskaliert (JPEG bleibt JPEG q82, Rest PNG; SVG/GIF unangetastet). Größter Dateigrößen-Hebel.
- **Print-Hygiene in allen Templates**: `break-after: avoid` (Überschriften), `break-inside: avoid` (Code/Tabellen/Figuren), `widows/orphans: 3`, `hyphens: auto`, `text-wrap: pretty`, `thead` wiederholt sich je Seite.
- CI-Checks erweitert: CLI-PDF-Test prüft jetzt Title/Creator-Metadaten, Bookmarks und Tagged-PDF per pdf-lib.

## [0.4.1] - 2026-07-04

### 🎨 App-Icon (endlich kein Electron-Default mehr)
- **Eigenes Icon in der MrxDown-M3E-Identität**: „M↓"-Glyphe (Markdown-Mark, CC0) mit Pillen-Strichen — M im Primary-Blau, Pfeil im Tertiär-Grün (unterscheidet vom generischen M↓ und spiegelt die App-Akzente). Dunkle tonale Kachel mit Primary-Glow.
- **Zwei Artworks nach Plattform-Spec** (Apple-HIG-recherchiert): macOS `icon.icns` mit Big-Sur-Grid (824 px-Kachel, 185 px-Radius, 100 px-Rand, gebackener Schatten 0/12/28/50 %, volles Iconset 16–1024); Windows/Linux **full-bleed** `icon.png` (1024, electron-builder erzeugt daraus die .ico) — die macOS-Kachel wirkt dort sonst ~20 % zu klein.
- SVG-Quellen + Electron-Render-Pipeline unter `assets/icon-src/` (reproduzierbar, iterierbar).
- Lesbarkeit bei 16/32 px verifiziert (A/B-Vergleich auf hellem + dunklem Grund).

### ✨ Added
- **Code-Fence-Autocomplete ausgebaut** (2026-07-04): Liste **scrollt jetzt mit der Pfeiltasten-Auswahl** (`scrollIntoView`, blieb vorher stehen). **36 Sprachen statt 10** — deckungsgleich mit dem hljs-„common"-Preview-Bundle plus `mermaid`; eine zentrale Liste statt zweier Duplikate. **Tippen filtert** (```py → python, IDE-Konvention), getipptes Präfix wird hervorgehoben und bei Auswahl ersetzt; unbekanntes Präfix schließt das Popup. **Editor-Highlighting für 21 neue Sprachen** (c/cpp/csharp/objectivec/kotlin/go/rust/ruby/swift/php/yaml/xml/scss/less/lua/perl/r/diff/ini/powershell/dockerfile) über schlanke legacy-Stream-Modes — Bundle 659→877 KB (weiterhin −45 % ggü. dem alten language-data-Bundle). E2E-Szenario `autocomplete-lang` (7 Checks).

## [0.4.0] - 2026-07-04

### 📦 Installation
- **`npm run install-mac`** (`scripts/install-macos.sh`, Muster: inspector-rust): baut, signiert mit einem **stabilen selbstsignierten Zertifikat** (eigene Keychain, einmalig erzeugt) und installiert nach `/Applications`. macOS behandelt jede neue Version als dieselbe vertrauenswürdige App — kein Gatekeeper-Tanz bei Updates; laufende Instanzen werden sanft beendet (nie gekillt).

### 🎨 Material 3 Expressive Redesign (2026-07-04)
- **Design-Token-System** (`css/variables.css`): eigene MrxDown-M3E-Tonpalette aus dem klassischen Seed (#2B2E3B/#688DB1) — vollständige Farbrollen (primary/secondary/tertiary/error + Container + On-Colors, 8 tonale Surface-Stufen), Dark & Light, M3E-Shape-Scale (4–28 px + Pille), State-Layer nach Spez (hover 8 %, focus/pressed 10 %). Legacy-Variablen als theme-bewusste Aliasse auf `body` (nicht `:root` — var()-Referenzen in Custom Properties werden am Deklarations-Element aufgelöst; auf :root wären die Dark-Werte eingebacken).
- **Physikbasiertes Motion-System** (`css/motion.css` + `src/renderer/13-motion.js`): Feder-Easings als CSS `linear()`-Kurven, numerisch aus den offiziellen M3E-Spring-Tokens gesampelt (spatial fast/default/slow = stiffness 800/380/200 bei damping 0.6/0.8/0.8 mit echtem Overshoot; effects monoton) — Parameter gegen die androidx-`ExpressiveMotionTokens.kt` verifiziert. Gestaffelte Start-Entrances, Shape-Morphing beim Drücken (Pille → eckiger, per ButtonTokens-Spez), event-delegierter Material-Ripple, federnde Dialoge/Palette/Toasts, **Circular-Reveal-Theme-Wechsel** aus dem Toggle-Button (View Transitions API). Vollständiger `prefers-reduced-motion`-Guard: nur Fades, kein Morphing.
- **Chrome-Reskin** (Preview bleibt bewusst dokumentgetreu): Docked-Toolbar auf surface-container mit Pillen-Icon-Buttons und tonalen Aktiv-/Export-Zuständen, Tabs mit M3-Indikator-Pille + Emphasized-Label bei Auswahl, Dialoge auf 28-px-XL-Shape mit Filled-/Outlined-Buttons (On-Colors statt Weiß), tonale Command-Palette-Auswahl, M3-Plain-Tooltips (inverse-surface), tonale Scrollbars. Alle hartkodierten rgba-Weiß-Overlays durch Tokens/State-Layer ersetzt; redundante Light-Theme-Overrides entfernt (Tokens sind theme-bewusst).
- Verifiziert: 65 Unit-Tests, 57 E2E-Checks (inkl. Layout-Invarianten bei 4 Breiten), CLI-PDF-Roundtrip, Screenshot-Review Dark/Light/Dialog.


### ✨ Added (Usability-Pass 2026-07-03)
- **Paste-URL-über-Auswahl** — Text markieren, URL einfügen → `[Auswahl](URL)` (Konvention aus VS Code/Obsidian/Typora). Greift nicht in Code-Fences oder ohne Auswahl.
- **Geschlossenen Tab wiederherstellen** — ⌘⇧T (Browser-Konvention, bis zu 10 Tabs, inkl. ungespeichertem Inhalt). Tab-Übersicht liegt jetzt auf ⌥⌘T.
- **Theme „System"** — Einstellungen → Theme folgt dem OS-Erscheinungsbild (nativeTheme, live bei OS-Wechsel).
- **Als HTML kopieren** — ⌘⇧C kopiert Auswahl bzw. Dokument als gerendertes HTML (marked+DOMPurify-Pipeline).
- **Enter/⇧Enter in Suchfeldern** springt zum nächsten/vorherigen Treffer.
- **Tab-Wechsel per Tastatur auf macOS** — ⌥⌘←/→ zusätzlich zu Ctrl+Tab (⌘Tab gehört dem OS-App-Switcher).

### 🏗️ Zuverlässigkeit (Reliability-Pass 2026-07-04, Teil 2)
- **E2E-Test-Suite** (`tests/e2e/`, `npm run test:e2e`): startet die echte App headless mit isoliertem Profil und prüft 9 Szenarien (54 Checks) — Layout-Invarianten bei 4 Fensterbreiten, alle drei Tab-Datenverlust-Regressionen, Save-Roundtrip (atomar, UTF-8), Stale-Search, Tab-Reopen, Theme/System-Theme, Undo-pro-Tab, Fehler-Toast, Render-Skip — plus CLI-PDF-Roundtrip (Einzeldatei + Batch inkl. `.MD`). **Beide CI-Workflows gaten jetzt auf Unit- + E2E-Tests** (release.yml baute bisher komplett ungetestet).
- **Renderer modularisiert**: `renderer.js` (4700 Zeilen) → 12 geordnete Module unter `src/renderer/` (01-core … 12-features). Classic Scripts, geteilter globaler State in `02-state.js`, Ladereihenfolge in index.html verbindlich. Inhaltlich verifiziert identisch (Zeilenvergleich) + komplette E2E-Suite grün.
- **Fehler sichtbar statt stumm**: `window.onerror`/`unhandledrejection` → dismissbarer Fehler-Toast (Dedupe, Auto-Hide); manuell via `window.showErrorToast()`.
- **Updater-Fortschritt in der Statusleiste**: verfügbar → Download-% → bereit/Fehler (Events kamen bisher nirgends an).
- **Undo pro Tab vervollständigt (A6)**: gespeicherte CM6-EditorStates trugen die Compartment-Konfiguration ihres Speicherzeitpunkts — Theme-/Font-/Wrap-Wechsel sprangen beim Tab-Rückwechsel zurück. Der Adapter re-appliziert jetzt die aktuellen Einstellungen nach `setState`.
- **Preview-Perf**: `renderMarkdown` überspringt identische Re-Renders (gleicher Text/Tab/Theme) — Cursor-Bewegungen kosten keine marked+DOMPurify+morphdom-Läufe mehr.
- **CSS-Invarianten flächendeckend**: Sidebar/Dateibaum, Statusleiste (Ellipsis statt Overflow), Tab-Titel, alle Dialoge (Viewport-Caps), Info-Panel, Lint-Liste, Command Palette — nichts kann das Fenster mehr sprengen.

### 🐛 Fixed (Layout 2026-07-04)
- **Preview lief bei langen Wörtern ohne Leerzeichen rechts aus dem Fenster** — zwei Ursachen: `#preview` ohne `overflow-wrap` **und** Flex-Panes ohne `min-width: 0` (Flex-Items schrumpfen nicht unter ihre Min-Content-Breite, das Pane schob sich aus dem Frame). Breite Tabellen scrollen jetzt GitHub-artig in der eigenen Box; `overflow-x: auto` als letztes Netz.
- **Toolbar-Buttons wurden rechts abgeschnitten** (Toolbar brauchte ~1460px). Jetzt responsiv: engere Abstände < 1500px, kleinere Buttons < 1280px, Undo-/Heading-Gruppen weichen < 1180/1060px (bleiben über Menü/Shortcuts/Palette erreichbar), horizontales Scrollen als Fallback. Verifiziert per Layout-Messung bei 1400/1200/1000/900px: keine abgeschnittenen Buttons, kein Body-/Preview-Overflow.

### 🐛 Fixed (Bug-Audit 2026-07-03 — 2 unabhängige Code-Audits, alle Funde verifiziert)
- **Datenverlust-Cluster Tabs (kritisch):**
  - ⌘N / Datei öffnen / Datei-Drop **verwarfen ungespeicherte Änderungen** des aktuellen Tabs (Snapshot nur bei Tab-Wechsel; Speichern überschrieb dann mit veraltetem Stand).
  - **Hintergrund-Tab schließen setzte den aktiven Tab zurück** auf den letzten Tab-Wechsel-Stand.
  - **Hintergrund-Tab speichern band den Pfad an den aktiven Tab** — nächstes ⌘S überschrieb die falsche Datei (`file-saved`-Broadcast der Sync-Save-Pfade entfernt).
  - **Fenster-Schließen prüfte nur den zuletzt berührten Tab** (`documentEdited`-Flag) — dirty Hintergrund-Tabs wurden ohne Nachfrage verworfen und die Crash-Recovery-Session gelöscht. Close-Handler fragt jetzt alle Tabs ab, speichert alle, und **bricht bei Schreibfehlern ab** statt trotzdem zu schließen.
  - **Crash-Recovery war nach dem ersten Fenster-Schließen dauerhaft tot** (macOS Dock-Reopen; `isCleanShutdown` wurde nie zurückgesetzt).
  - **Atomare Saves** (temp + rename) — Absturz mitten im Schreiben kann Dateien nicht mehr trunkieren.
- **Sicherheit:** `setWindowOpenHandler` ergänzt — Mittelklick auf externen Preview-Link öffnete ein Kind-Fenster **mit preload/electronAPI** (beliebiger Dateischreibzugriff für Remote-Seiten). PDF-Fenster laden ohne preload.
- **Falsche-Modified-Flags:** `handleMenuAction` markierte bei fast jeder Aktion (Neu, Öffnen, Suchen, Export …) den Tab als geändert — leere neue Tabs fragten beim Schließen „Speichern?".
- **Shift+Tab in Tabellen bewegte sich nie** (Off-by-one; jetzt inkl. Zeilen-Wrap rückwärts), Tab auf `|`-Zeichen übersprang eine Zelle.
- **Escape im Link-/Bild-Dialog leakte das Promise** — nächstes ⌘K fügte den Link doppelt ein.
- **Doppelte/dreifache Shortcut-Ausführung** (Win/Linux): CM6-`searchKeymap` (englische Such-UI) entfernt, `Mod-Shift-K`/`Alt-Pfeil` aus CM6-Keymap gefiltert, globaler Handler respektiert `defaultPrevented` und ignoriert Eingabefelder (⌘B im Suchfeld schrieb in den Editor).
- **⌘R doppelt belegt** (Ersetzen vs. Neu laden) — Ersetzen jetzt ⌥⌘F (macOS) / Ctrl+H (Win/Linux).
- **PDF-Export:**
  - Relative Bilder lösten gegen die **falsche Basis** auf (letzte geöffnete Datei statt Datei des Tabs) und wurden vom Traversal-Guard geblockt — Batch/Multi-Tab-Exporte verloren Bilder.
  - Optionen (Ränder/Seitengröße/Schriftgröße) griffen **nur beim Standard-Template** (Literal-Regex-Patch) — jetzt Override-CSS-Block.
  - Dialog-Templatewahl wurde von Frontmatter **überstimmt** — Priorität jetzt Dialog > Frontmatter > Settings.
  - **Fenster-Leak** bei fehlgeschlagenen Exporten (unsichtbare BrowserWindows) — try/finally.
  - **data:-URL-Trunkierung** bei großen Dokumenten (GUI-Pfade) — Temp-Datei wie im CLI-Pfad.
  - Batch: verspätete Renderer-Antwort konnte als **HTML des nächsten Tabs** verbucht werden (Korrelation per filePath).
- **Eigener Save triggerte „Datei wurde extern geändert"** (Watcher ohne Unterdrückungsfenster) — inkl. Cursor-Reset beim Tippen.
- **HTML-Export:** `file://`-Bilder auf Windows (Laufwerksbuchstaben via `fileURLToPath`), Export mit leerem Inhalt brach mit drei Dialogen ab.
- **Suche:** gespeicherte Treffer-Offsets veralteten bei Edits/Tab-Wechsel (falsche Markierungen); Treffer/Outline/Lint scrollen jetzt korrekt (`scrollToPos` statt Verhältnis-Mathematik).
- **Checkbox-Listener akkumulierten** über morphdom-Renders (N-fach-Feuern), Drop-Overlay blieb nach Bild-Drop hängen, Overlay erschien bei Tab-Drag.
- **Kleinigkeiten:** „Neues Fenster" entfernt (brach das erste Fenster über den `mainWindow`-Global), UTF-8-BOM brach Frontmatter, CLI-Batch ignorierte `.MD`, Sitzungsstatistik zählte Tab-Wechsel als „geschriebene Wörter", Statusleiste deutsch + Singular („1 Wort", „Z 1, Sp 1", „Automatisch gespeichert"), Zeilenumbruch/Zeilennummern persistieren, Editor-Fokus nach Dialog-Schließen, Fensterposition-Writes debounced, tote IPC-Kanäle entfernt.

## [0.3.1] - 2026-05-03

### 🐛 Fixed
- **CLI-Batch-Modus brach nach erster Datei ab** — der globale `window-all-closed`-Handler löste `app.quit()` aus, sobald die hidden pdfWindow der ersten Iteration schloss. Im Headless/CLI-Modus wird der Auto-Quit jetzt unterdrückt, da die CLI-Pfade ohnehin explizit `app.exit()` aufrufen.

### 📝 Docs
- README: Neuer Abschnitt **„Headless-Installation (Linux-Server)"** mit xvfb-Wrapper-Rezept für `.deb` + `mrxdown <file>` auf headless Servern (getestet auf Ubuntu 24.04 LTS).

## [0.3.0] - 2026-05-02

### ✨ Added
- **PDF-Template-System** — `pdf-templates/{default,academic,minimal}.css` mit Manifest. Frontmatter `template: <name>` wählt Template; Settings-Default als Fallback. Titelseite aus Frontmatter (title, subtitle, author, affiliation, date, abstract). Template-Dropdown im PDF-Optionen-Dialog.
- **KaTeX-Math** — `$inline$`, `$$display$$`, `\(...\)`, `\[...\]` in Live-Preview und PDF. Server-side-Rendering im CLI-Pfad, damit `mrxdown --pdf` Math korrekt embeddet.
- **Mermaid-Diagramme** — ` ```mermaid ` Code-Blocks rendern als SVG. Mermaid-Lib (~3 MB) wird lazy geladen, Theme folgt App-Theme, Output durch DOMPurify mit SVG-Profil, Source-basierter Render-Cache.
- **Code-Highlighting in Live-Preview** — hljs auf alle ` ```lang ` Blöcke (atom-one-dark/light, theme-aware). Vendor-Bundle 158 KB statt 9 MB Node-Package.
- **Auto-Updater** — `electron-updater` aktiviert für packaged Builds. "Nach Updates suchen…" im Menü, automatischer Hintergrund-Check, Restart-Dialog nach Download.
- **Accessibility** — `role="dialog"` + `aria-modal` auf allen Modals, `aria-label` auf Toolbar-Buttons aus `data-tooltip`, Escape-zu-Schließen, Focus-Trap mit Tab-Wrapping.

### 🐛 Fixed
- **Heading-ID-Algorithmus** in 3 Stellen dupliziert + Bug bei Duplikat-Counter (`if(0)` falsy) — auf zentralen `generateHeadingId()` aus `editor-utils.js` konsolidiert.
- **Path-Traversal in PDF-Image-Loader** — `![](../../etc/passwd)` und absolute Pfade außerhalb des MD-Verzeichnisses werden geblockt.
- **`open-external` mit Phishing-Schutz** — Externe Links zeigen Confirmation-Dialog mit Host-basierter Session-Allowlist.
- **Tab-Close-Dialog** — Drei-Wege-Dialog (Speichern / Verwerfen / Abbrechen) mit Promise-basiertem `saveFileSync`/`saveFileAsSync`. Vermeidet Datenverlust bei „Speichern dann schließen".
- **Listener-Leak** in `batch-print-to-pdf` — dangling `ipcMain.once` bei Timeout entfernt.
- **`second-instance`-argv** — Off-by-One-Fix für packaged Builds, filtert nach `.md/.markdown/.txt`.
- **File-Watcher nach Save-As** — folgt jetzt auf den neuen Pfad.
- **IPC-Listener-Akkumulation** bei Renderer-Reload — preload nutzt idempotenten `onOnce()`-Helper.
- **`--no-sandbox` im CLI-Wrapper** entfernt — Renderer-Sandbox bleibt für untrustetes Markdown an.
- **Recent-Files-Pruning async** mit per-File-Timeout — kein Startup-Freeze mehr auf offline Network-Drives.
- **Spurious Restore-Dialog** — leere modifizierte Untitled-Tabs lösen den Wiederherstellen-Dialog nicht mehr aus.

### ⚡ Performance
- **CodeMirror-Bundle 1.6 MB → 677 KB (−58 %)** — `@codemirror/language-data` durch 9 kuratierte Sprachen ersetzt.
- **Keystroke-CPU −30-60 % auf großen Dokumenten** — `editor.value` mit `docChanged`-Invalidation gecacht (statt 100+ O(n)-`doc.toString()` pro Tastendruck).
- **`updateStats()` debounced** (250 ms) — Cursor/Gutter bleiben sync, `analyzeDocument` + `lintMarkdown` warten.
- **`marked.use()`** einmalig beim App-Start statt alle 150 ms → entfernt Global-State-Race bei Batch-Export.
- **`highlight.js` lazy** — 9 MB Language-Defs werden nur geladen, wenn ein PDF tatsächlich exportiert wird.

### 📦 Build
- `pdf-templates/` in electron-builder `files`-Liste.
- Neue Scripts: `npm run build:hljs`, `npm run build:vendor`.
- KaTeX und Mermaid als runtime dependencies.

## [0.3.1] - 2025-01-10

### 🐛 Fixed
- **PDF-Export `<br>` Tag Rendering**: `<br>` Tags werden jetzt korrekt im PDF gerendert
  - `<br>` Tags werden automatisch in `<div class="line-break">` mit height: 0 umgewandelt
  - Chromium's PDF-Engine rendert diese garantiert
  - Fix gilt für marked.js HTML-Ausgabe (DOMPurify: `ADD_TAGS: ['br']`)
  - Betrifft single PDF-Export und Batch-PDF-Export

### 🎨 Changed
- **PDF-Export Zeilenabstände**: Optimierung der Abstände zwischen Absätzen
  - Paragraph margins standardmäßig auf 0 gesetzt
  - Abstand nur zwischen aufeinanderfolgenden Absätzen (`p + p`)
  - Kein Abstand direkt nach Überschriften
  - Kompakte Darstellung von Adressblöcken mit Zeilenumbrüchen
  - Line-height an Live-Preview angepasst (body: 1.7, headings: 2rem/1rem margins)

### 🔧 Technical
- marked.js Konfiguration: `sanitize: false`, `pedantic: false` für Inline-HTML
- DOMPurify: `ADD_TAGS: ['br']`, `KEEP_CONTENT: true`
- PDF CSS-Optimierung für heading margins (2rem top, 1rem bottom)
- Post-Processing: `<br>` → `<div class="line-break">`  replacement

## [0.3.0] - 2025-01-07

### 🐛 Fixed
- **PDF-Export Bilddarstellung**: Entfernung des grauen Rands/Schattens um Bilder
  - Entfernung von `box-shadow: 0 2px 8px rgba(0,0,0,0.1)` aus PDF-Styling
  - Entfernung von `border-radius: 4px` für saubere Bildkanten
  - Fix gilt für einzelnen PDF-Export (`print-to-pdf`) und Batch-PDF-Export (`batch-print-to-pdf`)
  - Bilder werden jetzt ohne visuelle Artefakte exportiert
  - Betrifft beide Export-Modi in main.js (Zeilen 817-823 und 1171-1177)

### 🎨 Changed
- **HTML-Export**: Optimierung der Bilddarstellung in HTML-Exporten
  - Entfernung von `border-radius: 4px` in generateHTMLExport() (renderer.js:835-839)
  - Konsistente Bilddarstellung über alle Export-Formate
  - Saubere, professionelle PDF-Ausgabe ohne störende Schatten

### 🔧 Technical
- Beide PDF-Export-Funktionen synchronisiert
- HTML-Export-Styling vereinfacht
- Verbesserte Bildqualität in allen Exportformaten

## [0.2.4] - 2025-01-15

### 🐛 Fixed
- **Emoji-Rendering bei führenden Emojis**: Emojis am Anfang von Überschriften werden jetzt korrekt im PDF exportiert
- Chromium PDF-Renderer optimiert mit `text-rendering: optimizeLegibility`
- Subpixel-Antialiasing für bessere Emoji-Darstellung hinzugefügt
- Font-Feature-Settings für korrektes Kerning aktiviert
- `white-space: pre-wrap` für Unicode-Zeichenerhaltung

### 🔧 Technical
- `text-rendering: optimizeLegibility` zu body und h1-h6 hinzugefügt
- `-webkit-font-smoothing: subpixel-antialiased` für Headings
- `font-feature-settings: "kern" 1` für optimales Kerning
- `white-space: pre-wrap` verhindert Unicode-Verlust
- Beide Export-Modi (Single + Batch) synchronisiert

## [0.2.3] - 2025-01-15

### 🐛 Fixed
- **Emoji am Anfang von Überschriften**: Emojis am Zeilenanfang (z.B. "📘 Titel") werden jetzt korrekt exportiert
- Rendering-Delay für PDF-Export von 1500ms auf 2000ms erhöht
- `printSelectionOnly: false` explizit gesetzt für vollständigen Export
- Problem betraf Emojis in führender Position bei H1-H6

### 🔧 Technical
- Längere Rendering-Zeit für komplexe Unicode-Zeichen
- Beide Export-Modi (Single + Batch) synchronisiert
- Verbesserte Emoji-Font-Rendering-Pipeline

## [0.2.2] - 2025-01-15

### 🐛 Fixed
- **Emoji-Rendering in PDF-Überschriften**: Emojis werden jetzt korrekt in allen Überschriften (H1-H6) im PDF-Export dargestellt
- Expliziter Emoji-Font-Stack für Headings hinzugefügt
- Problem betraf sowohl Single- als auch Batch-PDF-Export
- Emojis wie 🎉📝✨❤️ funktionieren jetzt überall perfekt

### 🔧 Technical
- Font-Family mit vollständigem Emoji-Stack für `h1-h6` ergänzt
- Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji Support
- Beide PDF-Export-Funktionen synchronisiert

## [0.2.1] - 2025-01-15

### ✨ Added - PDF-Export Optimierungen

#### 📝 Paragraph & Spacing
- Optimiertes Leerzeilen-Handling mit nativen CSS-Margins
- Intelligente Behandlung von `<br>` Tags
- Konsistente Paragraph-Abstände (0.8em)
- Text-Justification mit automatischer Silbentrennung

#### 😊 Emoji-Unterstützung
- Vollständiger Emoji-Font-Stack (Apple, Segoe UI, Noto Color Emoji)
- UTF-8 Encoding für korrekte Darstellung
- Emojis werden in PDFs korrekt dargestellt 🎉

#### 🔗 Hyperlinks
- URLs werden automatisch nach Links angezeigt
- Format: `Link-Text (https://url)`
- Anchor-Links (#section) werden nicht expandiert
- Farbcodierung: Links blau (#0066cc), URLs grau (#666)

#### 📋 Listen
- Optimierte Abstände zwischen Items (0.4em)
- Verbesserte verschachtelte Listen (0.3em)
- Task-Listen-Support mit Checkboxen
- Page-Break-Control für zusammenhängende Items

#### 📄 Seitenumbruch-Kontrolle
- Überschriften bleiben mit folgendem Content zusammen
- Code-Blöcke werden nicht über Seiten getrennt
- Table-Rows bleiben zusammen
- Blockquotes & Bilder ohne Umbrüche

#### 🖼️ Bilder
- Automatische Größenanpassung (max-width: 100%)
- Zentrierung mit margin: auto
- Professionelle Box-Shadow
- Border-Radius für moderne Optik

#### 💻 Code-Blocks
- Optimierte Monospace-Fonts (SF Mono, Monaco, Cascadia Code)
- Syntax-freundliche Farbcodierung
- Inline-Code: Rot (#d14) auf hellgrauem Hintergrund
- Block-Code: Schwarzer Text auf #f8f8f8
- No-Break für zusammenhängende Blöcke

#### 📊 Tabellen
- Header-Repeat auf jeder neuen Seite
- Zebra-Striping (#fafafa)
- Optimierte Font-Size (0.9em)
- Page-Break-Control für Rows

#### 🎨 Typografie
- Professioneller System-Font-Stack
- Optimierte Zeilenhöhe (1.7)
- Widows/Orphans-Kontrolle (3 Zeilen)
- Font-Size: 11pt (PDF-Standard)

### 🐛 Fixed
- Inkonsistente Abstände zwischen Elementen behoben
- Seitenumbrüche in Code-Blöcken verhindert
- Emoji-Darstellung in PDFs korrigiert
- URL-Anzeige für alle Link-Typen verbessert

### ⚡ Performance
- Rendering-Zeit: 1000ms → 1500ms (für bessere Qualität)
- CSS-Größe: 1.2 KB → 3.8 KB (+2.6 KB)
- Optimierte printToPDF-Parameter

### 📚 Documentation
- Ausführliche Dokumentation: `PDF_EXPORT_IMPROVEMENTS.md`
- Test-Datei: `PDF_EXPORT_TEST.md`
- Changelog aktualisiert

## [0.2.0] - 2025-01-14

### Added
- 🚀 Batch-PDF-Export für alle offenen Tabs
- 🔍 Erweiterte Suchen & Ersetzen mit Regex-Support
- 👁️ File Watching: Automatisches Neuladen bei externen Änderungen
- 📄 .txt Datei-Unterstützung

### Fixed
- 🖼️ **PDF-Export** - Entfernt grauen Rahmen (box-shadow) um Bilder im PDF
- 📸 **HTML-Export** - Bilder werden jetzt als base64 eingebettet für Portabilität
- 📝 **Export-Dateinamen** - Übernimmt automatisch den Namen der aktiven Datei
- 🔕 **Export-Dialoge** - Entfernt überflüssige Erfolgsmeldungen nach Export

## [0.0.6] - 2025-01-16

### Fixed
- 🚨 **CRITICAL HOTFIX**: Fixed app startup crash due to DOM initialization
- 🔧 DOM elements now properly initialized after DOMContentLoaded event
- 🛡️ Added null checks for all critical DOM operations
- 💥 Prevented app crashes when DOM elements are not found
- 📊 Improved error handling and stability
- 🔍 Better error reporting for debugging

### Technical Changes
- Moved DOM element initialization from module level to initializeApp()
- Added defensive programming with null checks
- Enhanced error handling throughout the application
- Improved app startup reliability

## [0.0.5] - 2025-01-16

### Added
- 🎛️ **Resizable Divider** - Drag & Drop zwischen Editor und Preview
- 🎯 **View Modes** - Editor Only, Split View, Preview Only Modi
- 🔄 **Scroll Sync Control** - Toggle-Button für Scroll-Synchronisation
- 📸 **App Screenshot** - Mockup in README für bessere Darstellung
- ⚌ **Professional UI** - Drei View-Mode Buttons in Toolbar
- 🎨 **Hover Effects** - Visuelle Rückmeldung beim Divider-Resize

### Fixed
- 🐛 **Scroll-Synchronisation** - Verhindert ungewolltes automatisches Scrollen
- 🔄 **Infinite Loops** - Scroll-Sync Protection mit Debounce-Mechanismus
- 📏 **Minimum Width** - 200px Mindestbreite für Editor/Preview Panes
- 🎯 **Resize Conflicts** - Deaktiviert Sync während Divider-Operationen
- ⚡ **Performance** - 50ms Debounce und intelligente Sync-Erkennung

### Changed
- 🎨 **Enhanced UX** - Smooth Divider-Resize mit col-resize Cursor
- 🔧 **Settings Persistence** - Scroll-Sync Einstellungen werden gespeichert
- 💫 **Visual Feedback** - Opacity-Änderungen für Toggle-States
- 🎪 **Improved Tooltips** - Dynamische Tooltip-Updates für Toggle-Buttons

### Technical Improvements
- Split-View only scroll synchronization
- Minimum difference threshold (5px) before syncing
- Scrollable content validation before sync attempts
- Enhanced error handling for edge cases

## [0.0.4] - 2025-01-16

### Fixed
- 🐛 **CRITICAL FIX**: Resolved GUI interaction issues - all buttons now work properly
- 🔧 Fixed duplicate `autoSaveTimeout` declaration causing JavaScript syntax error
- ✅ All toolbar buttons, sidebar elements, and UI components now respond to clicks
- 🎯 File operations (New, Open, Save) now function correctly
- 🎨 Formatting buttons (Bold, Italic, Code, etc.) now work as expected
- 📊 Table editor, settings, and context menu now functional
- 🚀 Improved overall app stability and responsiveness

### Technical Changes
- Removed duplicate auto-save functionality declarations
- Fixed function scope issues preventing onclick handlers from working
- Enhanced error handling and debugging capabilities

## [0.0.3] - 2025-01-16

### Added
- 📋 Comprehensive macOS installation guide with step-by-step instructions
- 🚀 Automated install-macos.sh script for one-click installation
- 💡 Detailed explanation of macOS Gatekeeper warnings for unsigned apps
- 🔧 curl-based installation command for easy deployment

### Fixed
- ❌ Resolved DMG build failures on GitHub Actions by switching to ZIP format
- 🛡️ Fixed macOS "app is damaged" warnings with proper Gatekeeper bypass instructions
- 🔄 Updated all GitHub Actions to use non-deprecated artifact actions (v4)
- 🏗️ Improved build configuration for better cross-platform compatibility

### Changed
- 📦 macOS distribution format changed from DMG to ZIP for better CI/CD compatibility
- 📚 Enhanced documentation with troubleshooting section
- 🔒 Improved security instructions for macOS users

## [0.0.2] - 2025-01-15

### Fixed
- Fixed DMG background image reference in build configuration
- Resolved build errors for macOS releases
- Improved release artifact generation
- Fixed GitHub Actions workflow failures
- Added proper Linux dependencies for Ubuntu builds
- Resolved code signing issues in CI/CD

### Changed
- Optimized build process for faster releases
- Updated build configuration for better compatibility
- Enhanced CI/CD pipeline with fail-fast: false
- Improved cross-platform build stability

## [0.0.1] - 2025-01-15

### Added
- 🌙 Modern Dark Theme with Material Design
- 📑 Multi-Tab Support for multiple files
- 🖱️ Drag & Drop file functionality
- ⚡ Live-Vorschau with real-time markdown rendering
- 📊 Interactive table editor
- 🔧 Formatting toolbar with icons
- 📂 Integrated file explorer sidebar
- 🧘 Zen mode for distraction-free writing
- 💾 Auto-save functionality (configurable)
- 📤 HTML export with embedded styles
- ⌨️ Comprehensive keyboard shortcuts
- 🎯 Search and replace functionality
- 🔗 Easy link and image insertion
- 🖼️ Context menu with common actions
- ℹ️ About dialog with developer information
- 🔄 Scroll synchronization between editor and preview
- 🎨 Tooltip system with delayed appearance
- 🔐 Secure IPC communication with preload script
- 📱 Responsive design for different screen sizes
- 🎭 Print support for preview content
- 🌐 External link handling
- 📋 Tab management with close functionality
- 🎪 Animated UI elements and transitions

### Technical Features
- Built with Electron 28.0.0
- Secure architecture with context isolation
- Cross-platform support (macOS, Windows, Linux)
- Modern CSS with custom properties
- Markdown parsing with marked.js
- HTML sanitization with DOMPurify
- File operations via native dialogs
- Recent files management
- Settings persistence

### Keyboard Shortcuts
- **File Operations**: Cmd/Ctrl + N (New), O (Open), S (Save), Shift+S (Save As)
- **Formatting**: Cmd/Ctrl + B (Bold), I (Italic), K (Link), T (Table), ` (Code)
- **Headings**: Cmd/Ctrl + 1-6 (H1-H6)
- **Navigation**: Cmd/Ctrl + F (Find), H (Replace), \ (Sidebar), Shift+Z (Zen Mode)
- **Export**: Cmd/Ctrl + E (HTML), Cmd/Ctrl + P (PDF)
- **Tabs**: Cmd/Ctrl + Tab (Switch tabs)

### Build Targets
- **macOS**: DMG and ZIP for Intel & Apple Silicon
- **Windows**: NSIS Installer and Portable version
- **Linux**: AppImage, DEB, and Snap packages

### Security
- Hardened runtime on macOS
- Code signing ready
- Secure file access permissions
- No unnecessary network access

## [0.1.0] - 2025-01-XX

### Added
- Initial project setup
- Basic Electron application structure
- Simple markdown editor
- Basic live preview functionality

---

**Initial Release** - Diese Version stellt die erste vollständige Implementierung von MrxDown dar mit allen grundlegenden Features für produktive Markdown-Bearbeitung.

---

## Legend

- 🎉 **Major Features**
- ✨ **New Features**
- 🔧 **Improvements**
- 🐛 **Bug Fixes**
- 🔒 **Security**
- 📚 **Documentation**
- 🚀 **Performance**
- 💥 **Breaking Changes**
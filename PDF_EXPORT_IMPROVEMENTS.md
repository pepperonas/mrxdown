# PDF Export Verbesserungen - MrxDown v0.2.1

## Übersicht der Optimierungen

Diese Version bringt umfassende Verbesserungen für den PDF-Export, um professionelle, druckfreundliche PDFs aus Markdown-Dokumenten zu generieren.

---

## ✅ Implementierte Verbesserungen

### 1. **Optimiertes Paragraph-Handling & Leerzeilen**
- **Problem behoben**: Markdown `<br>` Tags werden jetzt intelligent behandelt
- **Verbesserung**: Native CSS margins statt visuelle `<br>` Tags
- **Ergebnis**: Konsistente, professionelle Abstände zwischen Absätzen

**CSS Details:**
```css
p {
    margin: 0.8em 0;
    text-align: justify;
    hyphens: auto;
}

br {
    display: block;
    margin: 0.5em 0;
}

p:empty {
    margin: 1em 0;
}
```

---

### 2. **Emoji-Unterstützung**
- **Font-Stack erweitert**: Vollständige Emoji-Fonts integriert
  - `Apple Color Emoji` (macOS)
  - `Segoe UI Emoji` (Windows)
  - `Segoe UI Symbol` (Windows)
  - `Noto Color Emoji` (Universal)
- **UTF-8 Encoding**: Korrekte Zeichendarstellung garantiert
- **Ergebnis**: Emojis werden in PDFs korrekt dargestellt 🎉

---

### 3. **Hyperlinks mit vollständigen URLs**
- **Feature**: URLs werden automatisch hinter Links angezeigt
- **Format**: `Link-Text (https://example.com)`
- **Intelligent**: Anchor-Links (#section) werden NICHT expandiert
- **Farbe**: Links in blau (#0066cc), URLs in grau (#666)

**Beispiel:**
- Markdown: `[Beispiel](https://example.com)`
- PDF Output: **Beispiel** (https://example.com)

---

### 4. **Optimierte Listen-Formatierung**
- **Verbesserte Abstände**:
  - Zwischen List-Items: `0.4em`
  - Verschachtelte Listen: `0.3em`
- **Page Break Control**: Listen-Items bleiben zusammen
- **Task-Listen Support**: Checkboxen mit Abstand
- **Nested Lists**: Optimierte Darstellung verschachtelter Listen

**CSS Features:**
```css
ul, ol {
    margin: 1em 0;
    padding-left: 2em;
}

li {
    margin-bottom: 0.4em;
    line-height: 1.6;
    page-break-inside: avoid;
}
```

---

### 5. **Seitenumbruch-Kontrolle (Page Break Control)**
Intelligente Seitenumbruch-Behandlung für optimale Lesbarkeit:

#### **Überschriften (H1-H6)**
- `page-break-after: avoid` - Kein Umbruch direkt nach Überschrift
- `page-break-inside: avoid` - Überschriften bleiben zusammen
- H1 startet automatisch neue Sektion

#### **Code-Blöcke**
- `page-break-inside: avoid` - Code-Blöcke bleiben auf einer Seite

#### **Tabellen**
- Header wiederholt sich auf jeder Seite (`thead { display: table-header-group }`)
- Zeilen bleiben zusammen (`tr { page-break-inside: avoid }`)

#### **Blockquotes & Bilder**
- Bleiben zusammen, keine Umbrüche innerhalb

---

### 6. **Bild-Optimierung**
- **Responsive Sizing**: `max-width: 100%`, automatische Höhe
- **Zentrierung**: `display: block` mit `margin: 1.5em auto`
- **Styling**: Border-radius (4px) + Box-Shadow
- **Page Break**: Bilder bleiben auf einer Seite

**Visuelles Ergebnis:**
- Bilder passen sich automatisch an Seitenbreite an
- Professionelle Schatten-Effekte
- Optimale Abstände vor/nach Bildern

---

### 7. **Code-Block-Enhancement**
- **Syntax-freundliche Fonts**: SF Mono, Monaco, Cascadia Code, Courier New
- **Farbcodierung**:
  - Inline-Code: Hintergrund #f5f5f5, Text #d14 (rot)
  - Code-Blöcke: Hintergrund #f8f8f8, Border #ddd
- **Optimierte Lesbarkeit**:
  - Font-size: 0.9em (inline), 0.85em (block)
  - Line-height: 1.5
- **No-Break**: Code-Blöcke bleiben zusammen

---

### 8. **Tabellen-Verbesserungen**
- **Header-Repeat**: Table-Header auf jeder Seite
- **Page-Break-Control**: Zeilen bleiben zusammen
- **Zebra-Striping**: Alternierende Hintergrundfarben (#fafafa)
- **Professional Styling**:
  - Border: 1px solid #ddd
  - Padding: 10px 12px
  - Font-size: 0.9em (kompakter)

---

### 9. **Professionelle Typografie**
- **Font Stack**: System-Fonts für beste Performance
  ```
  -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
  'Helvetica Neue', Arial, 'Noto Sans'
  ```
- **Line-height**: 1.7 (optimal für Fließtext)
- **Font-size**: 11pt (PDF-Standard)
- **Widows/Orphans Control**:
  - `orphans: 3` - Mindestens 3 Zeilen am Seitenanfang
  - `widows: 3` - Mindestens 3 Zeilen am Seitenende
- **Text-Justification**: Blocksatz mit automatischer Silbentrennung

---

## 📐 PDF-Einstellungen

### **Page Setup**
```css
@page {
    margin: 20mm 15mm;
    size: A4 portrait;
}
```

### **Export-Parameter**
```javascript
{
    marginsType: 0,              // Custom margins from @page
    pageSize: 'A4',
    printBackground: true,       // Farben/Hintergründe drucken
    landscape: false,            // Portrait-Format
    preferCSSPageSize: true      // @page-Regeln verwenden
}
```

---

## 🎨 Farb-Schema

| Element | Farbe | Verwendung |
|---------|-------|------------|
| Text | `#1a1a1a` | Haupttext, Überschriften |
| Links | `#0066cc` | Hyperlinks |
| URLs | `#666` | URL-Annotationen |
| Code (Inline) | `#d14` | Inline-Code-Snippets |
| Borders | `#ddd` | Tabellen, Code-Blöcke |
| Background (Code) | `#f8f8f8` | Code-Block-Hintergrund |
| Background (Tables) | `#fafafa` | Zebra-Striping |

---

## 📊 Performance-Optimierungen

1. **Rendering-Zeit erhöht**: 1000ms → 1500ms
   - Grund: Komplexere Styles brauchen mehr Zeit
   - Vorteil: Alle Styles werden korrekt angewendet

2. **Base64-Image-Embedding**: Bilder werden eingebettet
   - Vorteil: PDFs sind standalone, keine externen Dependencies

3. **CSS-Page-Size**: Native Browser-Margins werden verwendet
   - Vorteil: Konsistentere Ausgabe

---

## 🔄 Beide Export-Modi aktualisiert

Die Verbesserungen gelten für:
1. ✅ **Single PDF Export** (`Cmd+P`)
2. ✅ **Batch PDF Export** (🚀 Rocket-Button)

Identisches Styling für konsistente Ergebnisse!

---

## 🚀 Zukünftige Erweiterungen (v0.3.0+)

### **Geplante Features:**

1. **PDF-Metadaten**
   - Titel aus H1 oder Dateiname
   - Autor aus Einstellungen
   - Erstellungsdatum, Keywords

2. **Header/Footer**
   - Seitennummerierung ("Seite 1 von 5")
   - Dokumenttitel im Header
   - Timestamp im Footer

3. **Inhaltsverzeichnis**
   - Automatische TOC-Generierung
   - Anklickbare Section-Links
   - Hierarchische Darstellung

4. **Export-Einstellungs-Dialog**
   - Seitengröße wählbar (A4, Letter, A5)
   - Orientierung (Portrait/Landscape)
   - Margin-Größe anpassbar
   - TOC aktivieren/deaktivieren

5. **Erweiterte Code-Features**
   - Syntax-Highlighting (Prism.js/Highlight.js)
   - Optionale Zeilennummern
   - Sprach-Badge

6. **Themes**
   - Light/Dark Mode für PDF
   - Professionelle Farbschemata
   - Custom CSS-Support

---

## 🧪 Testing

**Getestete Markdown-Features:**
- ✅ Headings (H1-H6)
- ✅ Paragraphs mit Leerzeilen
- ✅ Bold, Italic, Code (inline)
- ✅ Code-Blöcke (multi-line)
- ✅ Lists (ordered, unordered, nested)
- ✅ Task lists
- ✅ Links (internal, external)
- ✅ Tables
- ✅ Blockquotes
- ✅ Horizontal Rules
- ✅ Emojis 🎉📝✨
- ✅ Images (local, remote)

---

## 📝 Changelog

**Version 0.2.1** (2025-01-XX)
- ✨ Optimiertes Paragraph-Handling
- ✨ Emoji-Support mit vollständigem Font-Stack
- ✨ Hyperlinks zeigen URLs an
- ✨ Verbesserte Listen-Formatierung
- ✨ Intelligente Seitenumbruch-Kontrolle
- ✨ Bild-Optimierung mit Schatten
- ✨ Code-Block-Enhancement
- ✨ Tabellen mit Header-Repeat
- ✨ Professionelle Typografie (Widows/Orphans)
- 🐛 Fixed: Inkonsistente Abstände
- 🐛 Fixed: Seitenumbrüche in Code-Blöcken
- ⚡ Performance: Rendering-Zeit optimiert

---

## 💡 Best Practices für PDF-Export

### **Für beste Ergebnisse:**

1. **Verwenden Sie semantisches Markdown**
   ```markdown
   # Hauptüberschrift (nur eine H1)

   ## Unterkapitel

   Normaler Text mit **Betonung** und *Kursiv*.
   ```

2. **Achten Sie auf Leerzeilen**
   - Zwischen Paragraphen: 1 Leerzeile
   - Vor/nach Überschriften: 1 Leerzeile
   - Vor/nach Code-Blöcken: 1 Leerzeile

3. **Tabellen kompakt halten**
   - Max. 6-8 Spalten für optimale Lesbarkeit
   - Kurze Header-Bezeichnungen verwenden

4. **Bilder optimieren**
   - Empfohlene Breite: 800-1200px
   - Unterstützte Formate: JPG, PNG, GIF, SVG, WebP

5. **Links sinnvoll setzen**
   - Beschreibende Link-Texte verwenden
   - Interne Anchor-Links für Navigation

---

## 🛠️ Technische Details

**Geänderte Dateien:**
- `main.js` (Zeilen 572-826, 905-1159)

**CSS-Größe:**
- Vorher: ~1.2 KB
- Nachher: ~3.8 KB
- Zuwachs: +2.6 KB (bessere Qualität)

**Browser-Engine:**
- Chromium (via Electron)
- Print-to-PDF API

---

**Entwickelt mit ❤️ von Martin Pfeffer © 2025**

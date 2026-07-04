// MrxDown Renderer — Modul 08-export.js
// HTML-/PDF-/Batch-Export + handleFileSaved
// Classic Script (kein ESM): Top-Level-Deklarationen sind global über alle
// Renderer-Module hinweg; die Ladereihenfolge in index.html ist verbindlich.

function handleFileSaved(filePath) {
    // M6: prefer matching the tab that actually owns this path — binding the event
    // to "whatever tab is active now" mis-targeted saves completing after a quick
    // tab switch. Fall back to the active tab (Save-As of an untitled tab).
    const activeTab = tabs.find(tab => tab.filePath === filePath)
        || tabs.find(tab => tab.id === activeTabId);
    if (activeTab) {
        const previousPath = activeTab.filePath;
        activeTab.filePath = filePath;
        activeTab.title = getFileName(filePath);
        activeTab.isModified = false;

        // Keep the filesystem watcher in sync with the tab's new path.
        // Otherwise Save-As silently leaves the old path watched (and new unwatched),
        // so external changes to the freshly saved file wouldn't trigger the reload prompt.
        if (window.electronAPI && previousPath !== filePath) {
            if (previousPath) window.electronAPI.unwatchFile(previousPath);
            window.electronAPI.watchFile(filePath);
        }

        renderTabs();
        syncDocumentEdited();
        if (activeTab.id === activeTabId) {
            fileName.textContent = activeTab.title;
            if (window.electronAPI) {
                window.electronAPI.updateWindowTitle(activeTab.title);
            }
        }
    }
}

function exportHTML() {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    const htmlContent = generateHTMLExport();
    if (!htmlContent) return; // M7: alert already shown; don't hand null to main
    if (window.electronAPI) {
        window.electronAPI.exportHTML(htmlContent, activeTab ? activeTab.filePath : null);
    }
}

function generateHTMLExport() {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    const title = activeTab ? activeTab.title : 'Export';

    // Get the preview element
    const previewElement = document.getElementById('preview');

    if (!previewElement || !previewElement.innerHTML || previewElement.innerHTML.trim().length === 0) {
        showAlert('Der Preview-Bereich ist leer.', 'Bitte stellen Sie sicher, dass Markdown-Inhalt vorhanden ist.');
        return null;
    }

    // Get just the HTML content, not a clone
    const htmlContent = previewElement.innerHTML;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const images = tempDiv.querySelectorAll('img');

    images.forEach(img => {
        const src = img.src;
        // Keep base64 images as is, convert file:// URLs to base64
        if (src.startsWith('file://')) {
            // For file:// URLs, we need to keep them as is since we can't convert them client-side
            // The browser will handle them when the HTML is opened locally
        }
    });
    
    return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            color: #333;
            line-height: 1.6;
        }
        h1, h2, h3 { margin-top: 24px; margin-bottom: 16px; }
        h1 { border-bottom: 2px solid #eee; padding-bottom: 8px; }
        code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
        }
        pre {
            background: #f4f4f4;
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
        }
        blockquote {
            border-left: 4px solid #ddd;
            padding-left: 16px;
            color: #666;
            margin: 16px 0;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 16px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px 12px;
            text-align: left;
        }
        th {
            background: #f4f4f4;
        }
        img {
            max-width: 100%;
            height: auto;
            margin: 16px 0;
        }
        /* Style anchor links */
        a[href^="#"] {
            color: #688db1;
            text-decoration: none;
            border-bottom: 1px solid transparent;
            transition: border-color 0.3s ease;
        }
        a[href^="#"]:hover {
            border-bottom-color: #688db1;
        }
        /* Smooth scroll for anchor navigation */
        html {
            scroll-behavior: smooth;
        }
        /* Ensure headings with IDs are accessible */
        h1[id], h2[id], h3[id], h4[id], h5[id], h6[id] {
            scroll-margin-top: 2em;
        }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>`;
}

function exportPDF() {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    // PDF export using browser's print functionality
    if (window.electronAPI && window.electronAPI.printToPDF) {
        window.electronAPI.printToPDF(activeTab ? activeTab.filePath : null);
    } else {
        // Fallback: Open print dialog
        window.print();
    }
}

async function batchExportPDF() {
    // Ensure current tab content is saved to the tabs array before exporting
    saveCurrentTabState();

    // Get all tabs that have file paths (saved files)
    const tabsWithFiles = tabs.filter(tab => tab.filePath && tab.filePath !== null);

    if (tabsWithFiles.length === 0) {
        await showAlert('Keine gespeicherten Dateien gefunden.', 'Speichern Sie zuerst Ihre Markdown-Dateien.');
        return;
    }

    const confirmExport = await showConfirm(`${tabsWithFiles.length} Markdown-Dateien als PDF exportieren?`);
    if (!confirmExport) return;

    console.log('Batch exporting PDFs for tabs:', tabsWithFiles.map(tab => tab.filePath));

    if (window.electronAPI && window.electronAPI.batchPrintToPDF) {
        const tabData = tabsWithFiles.map(tab => ({
            filePath: tab.filePath,
            content: tab.content,
            title: tab.title
        }));
        window.electronAPI.batchPrintToPDF(tabData);
    } else {
        await showAlert('PDF-Batch-Export nicht verfügbar.');
    }
}

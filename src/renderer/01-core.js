// MrxDown Renderer — Modul 01-core.js
// Fehler-Toasts + Electron-Dialog-Helfer (showConfirm/showAlert/showInputDialog)
// Classic Script (kein ESM): Top-Level-Deklarationen sind global über alle
// Renderer-Module hinweg; die Ladereihenfolge in index.html ist verbindlich.

// --- Fehler-Sichtbarkeit: Renderer-Fehler landen als dezenter Toast im UI ---
// Ohne das versagen Features stumm (Fehler nur in der unsichtbaren DevTools-
// Konsole). Registrierung sofort beim Script-Load, damit auch Init-Fehler
// gefangen werden; DOM-Zugriff wird bis dahin gepuffert.
(function setupErrorToasts() {
    const pending = [];
    const recent = new Map(); // message -> timestamp, dedupe window
    const DEDUPE_MS = 30000;
    const MAX_VISIBLE = 3;

    function ensureContainer() {
        if (!document.body) return null;
        let c = document.getElementById('errorToasts');
        if (!c) {
            c = document.createElement('div');
            c.id = 'errorToasts';
            c.setAttribute('role', 'alert');
            c.setAttribute('aria-live', 'assertive');
            document.body.appendChild(c);
        }
        return c;
    }

    function show(message, location) {
        const c = ensureContainer();
        if (!c) { pending.push(message); return; }

        // Dedupe auf die reine Message — derselbe Fehler von verschiedenen
        // Zeilen/Callbacks soll trotzdem nur einen Toast erzeugen
        const now = Date.now();
        const last = recent.get(message);
        if (last && now - last < DEDUPE_MS) return; // gleicher Fehler in Serie
        recent.set(message, now);
        if (location) message += ' ' + location;
        if (recent.size > 50) recent.clear();

        while (c.children.length >= MAX_VISIBLE) c.removeChild(c.firstChild);

        const toast = document.createElement('div');
        toast.className = 'error-toast';
        const label = document.createElement('div');
        label.className = 'error-toast-label';
        label.textContent = 'Interner Fehler';
        const text = document.createElement('div');
        text.className = 'error-toast-text';
        text.textContent = message;
        const close = document.createElement('button');
        close.className = 'error-toast-close';
        close.setAttribute('aria-label', 'Fehlermeldung schließen');
        close.textContent = '×';
        close.addEventListener('click', () => toast.remove());
        toast.appendChild(label);
        toast.appendChild(text);
        toast.appendChild(close);
        c.appendChild(toast);
        setTimeout(() => toast.remove(), 12000);
    }

    window.addEventListener('error', (e) => {
        // Ressourcen-Ladefehler (img etc.) haben keine message — ignorieren
        if (!e.message) return;
        show(e.message, e.filename ? `(${e.filename.split('/').pop()}:${e.lineno})` : '');
    });
    window.addEventListener('unhandledrejection', (e) => {
        const r = e.reason;
        show('Unbehandelte Promise-Ablehnung: ' + (r && r.message ? r.message : String(r)));
    });
    document.addEventListener('DOMContentLoaded', () => {
        while (pending.length) show(pending.shift());
    });
    // Für manuelle Nutzung (z. B. IPC-Fehlerpfade)
    window.showErrorToast = show;
})();

// A2: Electron dialog helpers (replace browser confirm/prompt/alert)
async function showConfirm(message, detail) {
    if (window.electronAPI && window.electronAPI.showConfirmDialog) {
        const result = await window.electronAPI.showConfirmDialog({
            message,
            detail,
            buttons: ['OK', 'Abbrechen'],
            defaultId: 0,
            cancelId: 1
        });
        return result === 0;
    }
    return confirm(message); // fallback
}

async function showAlert(message, detail) {
    if (window.electronAPI && window.electronAPI.showAlertDialog) {
        await window.electronAPI.showAlertDialog({ message, detail });
        return;
    }
    alert(message); // fallback
}

function showInputDialog(title, placeholder, defaultValue) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('inputDialog');
        const titleEl = document.getElementById('inputDialogTitle');
        const field = document.getElementById('inputDialogField');
        const okBtn = document.getElementById('inputDialogOk');
        const cancelBtn = document.getElementById('inputDialogCancel');
        if (!overlay || !field) { resolve(null); return; }

        titleEl.textContent = title;
        field.placeholder = placeholder || '';
        field.value = defaultValue || '';
        overlay.style.display = '';
        overlay.classList.add('visible');
        field.focus();
        field.select();

        function cleanup() {
            overlay.style.display = 'none';
            overlay.classList.remove('visible');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            field.removeEventListener('keydown', onKey);
        }
        function onOk() { cleanup(); resolve(field.value); }
        function onCancel() { cleanup(); resolve(null); }
        function onKey(e) {
            if (e.key === 'Enter') { e.preventDefault(); onOk(); }
            if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        }

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        field.addEventListener('keydown', onKey);
    });
}

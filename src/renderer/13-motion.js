// MrxDown Renderer — Modul 13-motion.js
// Material-3-Expressive-Motion: delegierter Ripple, Circular-Reveal beim
// Theme-Wechsel (View Transitions API). Lädt NACH 09-ui-settings.js und
// wrappt dessen globales toggleTheme (Classic-Script-Bindings sind schreibbar).
// Physik/Timing kommen aus css/variables.css + css/motion.css.

(function setupExpressiveMotion() {
    const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- Material Ripple (event-delegiert, ein Listener für die ganze App) ---
    const RIPPLE_TARGETS = '.toolbar-button, .modal-button, .editor-tool, .tab, ' +
        '.command-palette-item, .context-menu-item, .file-item, .outline-item';

    document.addEventListener('pointerdown', (e) => {
        if (reducedMotion() || e.button !== 0) return;
        const host = e.target.closest(RIPPLE_TARGETS);
        if (!host) return;
        host.classList.add('md-ripple-host');
        const rect = host.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 2.2;
        const rip = document.createElement('span');
        rip.className = 'md-ripple';
        rip.style.width = rip.style.height = size + 'px';
        rip.style.left = (e.clientX - rect.left - size / 2) + 'px';
        rip.style.top = (e.clientY - rect.top - size / 2) + 'px';
        host.appendChild(rip);
        const cleanup = () => rip.remove();
        rip.addEventListener('animationend', cleanup, { once: true });
        setTimeout(cleanup, 800); // Fallback, falls animationend verschluckt wird
    }, { passive: true });

    // --- Circular-Reveal-Theme-Wechsel ---------------------------------------
    // Das neue Theme wächst als Kreis aus dem Toggle-Button (M3E-Signatur-Move).
    // Fallback ohne View Transitions API oder bei reduced motion: sofortiger
    // Wechsel — Bewegung ist Verstärkung, nie Voraussetzung.
    function startThemeReveal(originEl, applyFn) {
        if (!document.startViewTransition || reducedMotion()) {
            applyFn();
            return;
        }
        const r = originEl ? originEl.getBoundingClientRect() : null;
        const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
        const y = r ? r.top + r.height / 2 : window.innerHeight / 2;
        const radius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        );
        const root = document.documentElement;
        root.style.setProperty('--reveal-x', x + 'px');
        root.style.setProperty('--reveal-y', y + 'px');
        root.style.setProperty('--reveal-r', radius + 'px');
        document.startViewTransition(() => applyFn());
    }

    // Globales toggleTheme (09-ui-settings.js) mit dem Reveal ummanteln.
    // Wichtig: _origToggleTheme erhält die komplette Logik (Klasse, Settings,
    // Mermaid-Cache, saveSettings) — hier kommt nur die Inszenierung dazu.
    const _origToggleTheme = toggleTheme;
    toggleTheme = function () {
        const btn = document.getElementById('themeToggleBtn');
        startThemeReveal(btn, () => _origToggleTheme());
    };

    // Für Tests/andere Module erreichbar
    window.startThemeReveal = startThemeReveal;
})();

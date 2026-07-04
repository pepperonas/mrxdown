// Theme: Toggle schaltet explizit hell/dunkel; "System" folgt dem OS.
// Feature 2026-07-03 (nativeTheme-Integration).

const { nativeTheme } = require('electron');

module.exports = {
    name: 'theme',
    async run(d) {
        const initial = await d.exec(`return document.body.classList.contains('light-theme');`);

        const toggled = await d.exec(`
            toggleTheme();
            // Circular-Reveal: der Klassenwechsel passiert im View-Transition-
            // Callback (asynchron) — kurz warten, wie es auch der Nutzer sieht
            await new Promise(r => setTimeout(r, 350));
            return { light: document.body.classList.contains('light-theme'), setting: settings.theme };
        `);
        d.assertEq('Toggle wechselt die Klasse', toggled.light, !initial);
        d.assertEq('Toggle setzt explizites Theme', toggled.setting, toggled.light ? 'light' : 'dark');

        // System-Theme: Klasse muss dem OS-Zustand entsprechen
        const osIsDark = nativeTheme.shouldUseDarkColors;
        const system = await d.exec(`
            settings.theme = 'system';
            await applyThemeSetting();
            return document.body.classList.contains('light-theme');
        `);
        d.assertEq('System-Theme folgt dem OS', system, !osIsDark);

        // zurück auf dunkel (Default) für nachfolgende Szenarien-Unabhängigkeit
        await d.exec(`settings.theme = 'dark'; await applyThemeSetting();`);
        const final = await d.exec(`return document.body.classList.contains('light-theme');`);
        d.assertEq('Reset auf dunkel', final, false);
    }
};

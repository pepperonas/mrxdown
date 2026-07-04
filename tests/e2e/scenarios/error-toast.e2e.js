// Fehler-Sichtbarkeit: window.onerror/unhandledrejection erzeugen einen Toast;
// Serien-Duplikate werden dedupliziert.

module.exports = {
    name: 'error-toast',
    async run(d) {
        const r = await d.exec(`
            // Echten uncaught error auslösen (async, damit exec selbst nicht wirft)
            setTimeout(() => { throw new Error('E2E-Testfehler-42'); }, 0);
            await new Promise(res => setTimeout(res, 300));
            const toasts = Array.from(document.querySelectorAll('.error-toast .error-toast-text'))
                .map(t => t.textContent);
            return toasts;
        `);
        d.assert('Toast erscheint bei uncaught error',
            r.some(t => t.includes('E2E-Testfehler-42')), r);

        const deduped = await d.exec(`
            setTimeout(() => { throw new Error('E2E-Testfehler-42'); }, 0);
            setTimeout(() => { throw new Error('E2E-Testfehler-42'); }, 10);
            await new Promise(res => setTimeout(res, 300));
            return document.querySelectorAll('.error-toast').length;
        `);
        d.assertEq('gleicher Fehler wird dedupliziert', deduped, 1);

        const rejection = await d.exec(`
            Promise.reject(new Error('E2E-Rejection-7'));
            await new Promise(res => setTimeout(res, 300));
            return Array.from(document.querySelectorAll('.error-toast .error-toast-text')).map(t => t.textContent);
        `);
        d.assert('Toast bei unhandled rejection',
            rejection.some(t => t.includes('E2E-Rejection-7')), rejection);

        // Aufräumen
        await d.exec(`document.querySelectorAll('.error-toast').forEach(t => t.remove());`);
    }
};

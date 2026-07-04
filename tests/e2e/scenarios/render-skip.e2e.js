// Perf-Regression: renderMarkdown überspringt identische Re-Renders
// (gleicher Text, gleicher Tab, gleiches Theme), rendert aber bei Änderungen.

module.exports = {
    name: 'render-skip',
    async run(d) {
        await d.setContent('# Render-Skip-Test\n\nAbsatz.');

        const r = await d.exec(`
            // Marker in den Preview-DOM hängen: ein echter Re-Render (morphdom)
            // entfernt fremde Knoten, ein geskippter Render lässt ihn stehen
            const marker = document.createElement('span');
            marker.id = 'e2e-render-marker';
            document.getElementById('preview').appendChild(marker);

            renderMarkdown(); // gleicher Inhalt → muss geskippt werden
            const skipped = !!document.getElementById('e2e-render-marker');

            editor.cmView.dispatch({ changes: { from: 0, insert: 'X' } });
            renderMarkdown(); // geänderter Inhalt → muss rendern
            const rendered = !document.getElementById('e2e-render-marker');

            renderMarkdown(true); // force-Flag rendert immer
            return { skipped, rendered };
        `);
        d.assertEq('identischer Render wird übersprungen', r.skipped, true);
        d.assertEq('geänderter Inhalt rendert', r.rendered, true);

        // Preview-Inhalt stimmt am Ende
        const text = await d.exec(`return document.getElementById('preview').textContent.includes('Render-Skip-Test');`);
        d.assertEq('Preview zeigt Inhalt', text, true);
    }
};

// I1: KI-Assistent — end-to-end gegen einen Mock-Ollama-Server (NDJSON-
// Streaming): Opt-in-Gate, Dialog mit Privacy-Hinweis, Streaming ins UI,
// Ersetzen der Auswahl, Key-Roundtrip (write-only + safeStorage).

const http = require('http');

module.exports = {
    name: 'ai-assist',
    async run(d) {
        // Mock-Ollama: streamt zwei NDJSON-Chunks
        let receivedBody = null;
        const server = http.createServer((req, res) => {
            let body = '';
            req.on('data', c => { body += c; });
            req.on('end', () => {
                receivedBody = body;
                res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
                res.write('{"message":{"content":"UMGESCHRIEBENER-"}}\n');
                setTimeout(() => {
                    res.write('{"message":{"content":"TEXT"}}\n');
                    res.end('{"done":true}\n');
                }, 60);
            });
        });
        await new Promise(r => server.listen(0, '127.0.0.1', r));
        const port = server.address().port;

        try {
            // Opt-in-Gate: deaktiviert → ai-run liefert Fehler-Event, kein Request
            const gate = await d.exec(`
                window._aiLastError = null;
                settings.ai = { enabled: false, provider: 'ollama', endpoint: 'http://127.0.0.1:${port}', model: 'test' };
                window.electronAPI.saveSettings(settings); // Main-Prozess-Settings syncen
                await new Promise(r => setTimeout(r, 100));
                window.electronAPI.aiRun({ requestId: 'gate-1', action: 'umschreiben', text: 'x' });
                await new Promise(r => setTimeout(r, 250));
                return window._aiLastError;
            `);
            d.assert('Opt-in-Gate: deaktiviert → Fehler', /deaktiviert/.test(gate || ''), gate);
            d.assertEq('Kein Request beim Gate', receivedBody, null);

            // Unbekannte Aktion wird abgelehnt (Prompt-Katalog ist geschlossen)
            const badAction = await d.exec(`
                window._aiLastError = null;
                settings.ai.enabled = true;
                window.electronAPI.saveSettings(settings);
                await new Promise(r => setTimeout(r, 100));
                window.electronAPI.aiRun({ requestId: 'gate-2', action: 'boesartig', text: 'x' });
                await new Promise(r => setTimeout(r, 250));
                return window._aiLastError;
            `);
            d.assert('Unbekannte Aktion abgelehnt', /Unbekannte Aktion/.test(badAction || ''), badAction);

            // Dialog: Auswahl einfangen, Privacy-Hinweis lokal
            const dialog = await d.exec(`
                editor.value = 'Hallo Welt und mehr';
                editor.cmView.dispatch({ selection: { anchor: 0, head: 10 } }); // "Hallo Welt"
                await showAiDialog();
                return {
                    visible: document.getElementById('aiModal').classList.contains('visible'),
                    original: document.getElementById('aiOriginal').value,
                    privacy: document.getElementById('aiPrivacyInfo').textContent,
                    actionCount: document.getElementById('aiAction').options.length
                };
            `);
            d.assert('Dialog sichtbar', dialog.visible);
            d.assertEq('Auswahl im Original-Feld', dialog.original, 'Hallo Welt');
            d.assert('Privacy-Hinweis: lokal erkannt', dialog.privacy.includes('🔒'), dialog.privacy);
            d.assert('Aktions-Katalog geladen', dialog.actionCount >= 8);

            // Streaming: Ausführen → Chunks landen im Vorschlag, Ersetzen übernimmt
            const run = await d.exec(`
                document.getElementById('aiAction').value = 'umschreiben';
                runAiAction();
                await new Promise(r => setTimeout(r, 700));
                const result = document.getElementById('aiResult').value;
                const applyEnabled = !document.getElementById('aiApplyBtn').disabled;
                applyAiResult();
                return { result, applyEnabled, editorValue: editor.value, modalClosed: !document.getElementById('aiModal').classList.contains('visible') };
            `);
            d.assertEq('Gestreamter Vorschlag komplett', run.result, 'UMGESCHRIEBENER-TEXT');
            d.assert('Ersetzen-Button aktiv nach Done', run.applyEnabled);
            d.assertEq('Auswahl ersetzt, Rest bleibt', run.editorValue, 'UMGESCHRIEBENER-TEXT und mehr');
            d.assert('Dialog nach Ersetzen zu', run.modalClosed);

            // Der Request enthielt System-Prompt + Auswahltext, stream:true
            const sent = JSON.parse(receivedBody);
            d.assert('Request: Systemprompt + Text', sent.stream === true
                && sent.messages[0].role === 'system'
                && sent.messages[1].content.includes('Hallo Welt'), receivedBody && receivedBody.slice(0, 120));

            // Key-Roundtrip: write-only speichern + Status abfragbar, dann löschen
            const key = await d.exec(`
                const set = await window.electronAPI.setAiApiKey('test-geheim-123');
                const has = await window.electronAPI.hasAiApiKey();
                const cleared = await window.electronAPI.setAiApiKey('');
                const hasAfter = await window.electronAPI.hasAiApiKey();
                return { ok: set.ok, has, clearedOk: cleared.ok, hasAfter };
            `);
            d.assert('Key speichern (safeStorage)', key.ok && key.has, JSON.stringify(key));
            d.assert('Key löschen', key.clearedOk && !key.hasAfter, JSON.stringify(key));

            // Aufräumen für Folge-Szenarien
            await d.exec(`
                settings.ai = { enabled: false, provider: 'ollama', endpoint: '', model: '' };
                window.electronAPI.saveSettings(settings);
            `);
        } finally {
            server.close();
        }
    }
};

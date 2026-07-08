// MrxDown Main — I1: AI-Assist (opt-in, self-hosted zuerst).
// Provider-agnostisch: Ollama (lokal, Default-Empfehlung), OpenAI-kompatible
// APIs, Anthropic. ALLE Requests laufen im Main-Prozess (die Renderer-CSP hat
// connect-src 'none'); der API-Key liegt safeStorage-verschlüsselt auf der
// Platte und erreicht den Renderer nie. Kein Request ohne explizite
// Nutzer-Aktion; enabled ist NIE Default-an.

// --- Aktions-Katalog (Prompts leben hier, nicht im Renderer) ---
const AI_SYSTEM_PROMPT = 'Du bist ein Schreibassistent in einem Markdown-Editor. '
    + 'Antworte ausschließlich mit dem Ergebnis — ohne Einleitung, ohne Erklärung, '
    + 'ohne umschließenden Codeblock. Erhalte vorhandene Markdown-Formatierung.';

const AI_ACTIONS = {
    umschreiben: {
        label: 'Umschreiben',
        hint: 'klarer und flüssiger',
        needsSelection: true,
        build: (text) => `Formuliere den folgenden Text klarer und flüssiger um. Bedeutung und Sprache beibehalten.\n\n${text}`
    },
    kuerzen: {
        label: 'Kürzen / Straffen',
        hint: 'ohne Informationsverlust',
        needsSelection: true,
        build: (text) => `Straffe den folgenden Text deutlich, ohne Informationen zu verlieren.\n\n${text}`
    },
    uebersetzen: {
        label: 'Übersetzen (DE ↔ EN)',
        hint: 'erkennt die Richtung',
        needsSelection: true,
        build: (text) => `Übersetze den folgenden Text: Deutsch nach Englisch; ist er englisch, dann nach Deutsch.\n\n${text}`
    },
    ton_formell: {
        label: 'Ton: formeller',
        hint: 'sachlich, professionell',
        needsSelection: true,
        build: (text) => `Schreibe den folgenden Text in einem formelleren, sachlich-professionellen Ton. Sprache beibehalten.\n\n${text}`
    },
    ton_locker: {
        label: 'Ton: lockerer',
        hint: 'nahbar, direkt',
        needsSelection: true,
        build: (text) => `Schreibe den folgenden Text in einem lockereren, nahbaren Ton. Sprache beibehalten.\n\n${text}`
    },
    zusammenfassen: {
        label: 'Zusammenfassen',
        hint: 'kurze Aufzählung',
        needsSelection: true,
        build: (text) => `Fasse den folgenden Text als kurze Markdown-Aufzählung zusammen (Sprache beibehalten).\n\n${text}`
    },
    grammatik: {
        label: 'Grammatik & Rechtschreibung',
        hint: 'nur Fehler fixen',
        needsSelection: true,
        build: (text) => `Korrigiere Rechtschreibung, Grammatik und Zeichensetzung im folgenden Text. Ändere sonst NICHTS — weder Wortwahl noch Stil.\n\n${text}`
    },
    titel: {
        label: 'Titel vorschlagen',
        hint: '5 Vorschläge fürs Dokument',
        needsSelection: true,
        build: (text) => `Schlage 5 prägnante Titel für das folgende Dokument vor, als Markdown-Liste (Sprache des Dokuments).\n\n${text}`
    }
};

const AI_PROVIDERS = ['ollama', 'openai', 'anthropic'];
const AI_DEFAULT_ENDPOINTS = {
    ollama: 'http://localhost:11434',
    openai: 'https://api.openai.com',
    anthropic: 'https://api.anthropic.com'
};

// --- Pure: Request-Bau pro Provider (jest-getestet) ---
function buildAiRequest({ provider, endpoint, model, apiKey, prompt, system }) {
    if (!AI_PROVIDERS.includes(provider)) throw new Error(`Unbekannter Provider: ${provider}`);
    let base = (endpoint || AI_DEFAULT_ENDPOINTS[provider]).trim().replace(/\/+$/, '');
    if (!/^https?:\/\//.test(base)) throw new Error('Endpoint muss http(s):// sein');

    if (provider === 'ollama') {
        return {
            url: base + '/api/chat',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                stream: true,
                messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }]
            })
        };
    }
    if (provider === 'openai') {
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
        return {
            url: base + '/v1/chat/completions',
            headers,
            body: JSON.stringify({
                model,
                stream: true,
                messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }]
            })
        };
    }
    // anthropic
    const headers = { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' };
    if (apiKey) headers['x-api-key'] = apiKey;
    return {
        url: base + '/v1/messages',
        headers,
        body: JSON.stringify({
            model,
            stream: true,
            max_tokens: 4096,
            system,
            messages: [{ role: 'user', content: prompt }]
        })
    };
}

// --- Pure-ish: Stream-Parser pro Provider (zeilengepuffert, jest-getestet) ---
// push(chunk) → Array von Text-Deltas. Ollama streamt NDJSON, OpenAI/Anthropic SSE.
function createStreamParser(provider) {
    let buffer = '';
    return {
        push(chunk) {
            buffer += chunk;
            const deltas = [];
            const lines = buffer.split('\n');
            buffer = lines.pop(); // letzte (evtl. unvollständige) Zeile behalten
            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line) continue;
                try {
                    if (provider === 'ollama') {
                        const obj = JSON.parse(line);
                        if (obj.message && typeof obj.message.content === 'string') deltas.push(obj.message.content);
                    } else {
                        if (!line.startsWith('data:')) continue;
                        const payload = line.slice(5).trim();
                        if (payload === '[DONE]') continue;
                        const obj = JSON.parse(payload);
                        if (provider === 'openai') {
                            const d = obj.choices && obj.choices[0] && obj.choices[0].delta;
                            if (d && typeof d.content === 'string') deltas.push(d.content);
                        } else { // anthropic
                            if (obj.type === 'content_block_delta' && obj.delta && typeof obj.delta.text === 'string') {
                                deltas.push(obj.delta.text);
                            }
                        }
                    }
                } catch { /* halbe/fremde Zeile — überspringen */ }
            }
            return deltas;
        }
    };
}

// --- Streaming-Ausführung (fetch im Main-Prozess, abbrechbar) ---
async function streamAiCompletion(config, onDelta, signal) {
    const req = buildAiRequest(config);
    const response = await fetch(req.url, {
        method: 'POST',
        headers: req.headers,
        body: req.body,
        signal
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`${response.status} ${response.statusText}${detail ? ' — ' + detail.slice(0, 300) : ''}`);
    }
    const parser = createStreamParser(config.provider);
    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const delta of parser.push(decoder.decode(value, { stream: true }))) {
            onDelta(delta);
        }
    }
}

module.exports = {
    AI_ACTIONS,
    AI_PROVIDERS,
    AI_DEFAULT_ENDPOINTS,
    AI_SYSTEM_PROMPT,
    buildAiRequest,
    createStreamParser,
    streamAiCompletion
};

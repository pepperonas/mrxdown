// Tests für I1: pure Request-Builder + Stream-Parser (kein Netzwerk).
const { AI_ACTIONS, buildAiRequest, createStreamParser, AI_DEFAULT_ENDPOINTS } = require('../src/main/ai');

describe('AI_ACTIONS', () => {
    test('every action has label + prompt builder that embeds the text', () => {
        expect(Object.keys(AI_ACTIONS).length).toBeGreaterThanOrEqual(8);
        for (const [id, a] of Object.entries(AI_ACTIONS)) {
            expect(a.label.length).toBeGreaterThan(0);
            const prompt = a.build('MEIN-TEXT-42');
            expect(prompt).toContain('MEIN-TEXT-42');
            expect(id).toMatch(/^[a-z_]+$/);
        }
    });
});

describe('buildAiRequest', () => {
    const base = { model: 'test-model', prompt: 'P', system: 'S' };

    test('ollama: /api/chat, kein Auth-Header, NDJSON-Streaming-Body', () => {
        const r = buildAiRequest({ ...base, provider: 'ollama', endpoint: 'http://localhost:11434/', apiKey: 'geheim' });
        expect(r.url).toBe('http://localhost:11434/api/chat');
        expect(r.headers.Authorization).toBeUndefined(); // Key geht NIE an Ollama
        const body = JSON.parse(r.body);
        expect(body.stream).toBe(true);
        expect(body.messages[0]).toEqual({ role: 'system', content: 'S' });
    });

    test('openai: Bearer-Key, /v1/chat/completions', () => {
        const r = buildAiRequest({ ...base, provider: 'openai', endpoint: '', apiKey: 'sk-x' });
        expect(r.url).toBe('https://api.openai.com/v1/chat/completions');
        expect(r.headers.Authorization).toBe('Bearer sk-x');
    });

    test('anthropic: x-api-key + version header + max_tokens', () => {
        const r = buildAiRequest({ ...base, provider: 'anthropic', endpoint: '', apiKey: 'sk-ant' });
        expect(r.url).toBe('https://api.anthropic.com/v1/messages');
        expect(r.headers['x-api-key']).toBe('sk-ant');
        expect(r.headers['anthropic-version']).toBeTruthy();
        const body = JSON.parse(r.body);
        expect(body.max_tokens).toBeGreaterThan(0);
        expect(body.system).toBe('S');
    });

    test('defaults + validation', () => {
        expect(AI_DEFAULT_ENDPOINTS.ollama).toContain('localhost');
        expect(() => buildAiRequest({ ...base, provider: 'ollama', endpoint: 'ftp://x' })).toThrow(/http/);
        expect(() => buildAiRequest({ ...base, provider: 'evil' })).toThrow(/Provider/);
    });
});

describe('createStreamParser', () => {
    test('ollama NDJSON incl. split chunks', () => {
        const p = createStreamParser('ollama');
        expect(p.push('{"message":{"content":"Hal"}}\n{"message":{"con')).toEqual(['Hal']);
        // Rest der halben Zeile kommt im nächsten Chunk
        expect(p.push('tent":"lo"}}\n{"done":true}\n')).toEqual(['lo']);
    });

    test('openai SSE with [DONE]', () => {
        const p = createStreamParser('openai');
        const deltas = p.push('data: {"choices":[{"delta":{"content":"A"}}]}\n\ndata: {"choices":[{"delta":{"content":"B"}}]}\n\ndata: [DONE]\n\n');
        expect(deltas).toEqual(['A', 'B']);
    });

    test('anthropic SSE content_block_delta only', () => {
        const p = createStreamParser('anthropic');
        const deltas = p.push(
            'event: message_start\ndata: {"type":"message_start"}\n\n' +
            'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n' +
            'data: {"type":"message_stop"}\n\n'
        );
        expect(deltas).toEqual(['Hi']);
    });

    test('garbage lines never throw', () => {
        const p = createStreamParser('openai');
        expect(p.push('data: {kaputt\nquark\n')).toEqual([]);
    });
});

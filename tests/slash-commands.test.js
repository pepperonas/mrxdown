// Tests für E2: expandSnippet (Platzhalter + Cursor-Stop) und die
// eingebauten SLASH_COMMANDS (jeder Body muss sauber expandieren).
const { expandSnippet, SLASH_COMMANDS } = require('../editor-utils');

const FIXED = { now: new Date(2026, 6, 8, 14, 5), title: 'Mein Dokument' };

describe('expandSnippet', () => {
    test('{{date}} expands to ISO date', () => {
        expect(expandSnippet('Heute: {{date}}', FIXED).text).toBe('Heute: 2026-07-08');
    });

    test('{{time}} expands to HH:MM', () => {
        expect(expandSnippet('{{time}}', FIXED).text).toBe('14:05');
    });

    test('{{title}} expands to document title (empty without ctx)', () => {
        expect(expandSnippet('# {{title}}', FIXED).text).toBe('# Mein Dokument');
        expect(expandSnippet('# {{title}}', {}).text).toBe('# ');
    });

    test('{{cursor}} marks the cursor stop and is removed', () => {
        const r = expandSnippet('vor{{cursor}}nach', FIXED);
        expect(r.text).toBe('vornach');
        expect(r.cursorOffset).toBe(3);
    });

    test('only the FIRST cursor stop counts, all markers are removed', () => {
        const r = expandSnippet('a{{cursor}}b{{cursor}}c', FIXED);
        expect(r.text).toBe('abc');
        expect(r.cursorOffset).toBe(1);
    });

    test('no cursor marker → cursorOffset -1 (ans Ende)', () => {
        expect(expandSnippet('nur text', FIXED).cursorOffset).toBe(-1);
    });

    test('placeholders are case-insensitive', () => {
        expect(expandSnippet('{{DATE}}', FIXED).text).toBe('2026-07-08');
    });

    test('empty/undefined body → empty text', () => {
        expect(expandSnippet('', FIXED)).toEqual({ text: '', cursorOffset: -1 });
        expect(expandSnippet(null, FIXED)).toEqual({ text: '', cursorOffset: -1 });
    });
});

describe('SLASH_COMMANDS', () => {
    test('every command has id, label and a body that expands cleanly', () => {
        expect(SLASH_COMMANDS.length).toBeGreaterThanOrEqual(15);
        const ids = new Set();
        for (const cmd of SLASH_COMMANDS) {
            expect(cmd.id).toBeTruthy();
            expect(ids.has(cmd.id)).toBe(false); // eindeutige IDs
            ids.add(cmd.id);
            expect(cmd.label.length).toBeGreaterThan(0);
            const r = expandSnippet(cmd.body, FIXED);
            expect(r.text).not.toContain('{{'); // keine unaufgelösten Platzhalter
        }
    });

    test('datum command produces the ISO date', () => {
        const datum = SLASH_COMMANDS.find(c => c.id === 'datum');
        expect(expandSnippet(datum.body, FIXED).text).toBe('2026-07-08');
    });

    test('callout commands produce valid callout markers', () => {
        const hinweis = SLASH_COMMANDS.find(c => c.id === 'hinweis');
        expect(expandSnippet(hinweis.body, FIXED).text).toContain('> [!NOTE]');
    });
});

const { generateHeadingId } = require('../editor-utils');

describe('generateHeadingId', () => {
    test('simple heading', () => {
        expect(generateHeadingId('Hello World')).toBe('hello-world');
    });

    test('heading with numbers', () => {
        expect(generateHeadingId('1. Grundlagen')).toBe('1-grundlagen');
    });

    test('special characters removed (not replaced)', () => {
        expect(generateHeadingId('Routing & Switching')).toBe('routing--switching');
    });

    test('slash with spaces creates double dash', () => {
        expect(generateHeadingId('ISO 27001 / 27002')).toBe('iso-27001--27002');
    });

    test('slash without spaces is just removed', () => {
        expect(generateHeadingId('ISO 27001/27002')).toBe('iso-2700127002');
    });

    test('DNS & DHCP double dash', () => {
        expect(generateHeadingId('DNS & DHCP')).toBe('dns--dhcp');
    });

    test('German umlauts preserved', () => {
        expect(generateHeadingId('Überschrift mit Ärger')).toBe('überschrift-mit-ärger');
    });

    test('German ß preserved', () => {
        expect(generateHeadingId('Straße und Maß')).toBe('straße-und-maß');
    });

    test('emoji heading gets leading dash', () => {
        const id = generateHeadingId('\u{1F4CB} Inhaltsverzeichnis');
        expect(id).toBe('-inhaltsverzeichnis');
    });

    test('trailing dashes trimmed', () => {
        expect(generateHeadingId('Test - ')).toBe('test');
    });

    test('duplicate handling with counter', () => {
        const counts = {};
        expect(generateHeadingId('Section', counts)).toBe('section');
        expect(generateHeadingId('Section', counts)).toBe('section-1');
        expect(generateHeadingId('Section', counts)).toBe('section-2');
    });

    test('duplicate handling different headings', () => {
        const counts = {};
        expect(generateHeadingId('Alpha', counts)).toBe('alpha');
        expect(generateHeadingId('Beta', counts)).toBe('beta');
        expect(generateHeadingId('Alpha', counts)).toBe('alpha-1');
    });

    test('empty heading', () => {
        expect(generateHeadingId('')).toBe('');
    });

    test('code-like heading', () => {
        expect(generateHeadingId('package.json')).toBe('packagejson');
    });

    test('multiple spaces collapsed to single dash', () => {
        expect(generateHeadingId('Hello   World')).toBe('hello-world');
    });

    test('colon removed', () => {
        expect(generateHeadingId('Step 1: Setup')).toBe('step-1-setup');
    });
});

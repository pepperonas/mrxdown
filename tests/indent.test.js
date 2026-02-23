const { indentLines, unindentLines } = require('../editor-utils');

describe('indentLines', () => {
    test('indents single line', () => {
        expect(indentLines('hello')).toBe('    hello');
    });

    test('indents multiple lines', () => {
        expect(indentLines('line1\nline2\nline3')).toBe('    line1\n    line2\n    line3');
    });

    test('indents already indented lines', () => {
        expect(indentLines('    already')).toBe('        already');
    });

    test('indents empty line (adds spaces)', () => {
        expect(indentLines('')).toBe('    ');
    });

    test('indents mixed content', () => {
        const input = 'first\n  second\n    third';
        const expected = '    first\n      second\n        third';
        expect(indentLines(input)).toBe(expected);
    });
});

describe('unindentLines', () => {
    test('removes 4 spaces from single line', () => {
        expect(unindentLines('    hello')).toBe('hello');
    });

    test('removes up to 4 spaces only', () => {
        expect(unindentLines('      hello')).toBe('  hello');
    });

    test('removes fewer than 4 spaces', () => {
        expect(unindentLines('  hello')).toBe('hello');
    });

    test('removes 1 space', () => {
        expect(unindentLines(' hello')).toBe('hello');
    });

    test('does nothing to unindented line', () => {
        expect(unindentLines('hello')).toBe('hello');
    });

    test('unindents multiple lines', () => {
        const input = '    line1\n    line2\n    line3';
        const expected = 'line1\nline2\nline3';
        expect(unindentLines(input)).toBe(expected);
    });

    test('handles mixed indentation', () => {
        const input = '    four\n  two\n      six';
        const expected = 'four\ntwo\n  six';
        expect(unindentLines(input)).toBe(expected);
    });

    test('handles empty lines', () => {
        expect(unindentLines('')).toBe('');
    });

    test('handles tabs (not removed)', () => {
        expect(unindentLines('\thello')).toBe('\thello');
    });
});

const { toggleLineComment } = require('../editor-utils');

describe('toggleLineComment', () => {
    test('adds comment to plain line', () => {
        expect(toggleLineComment('Hello world')).toBe('<!-- Hello world -->');
    });

    test('removes comment from commented line', () => {
        expect(toggleLineComment('<!-- Hello world -->')).toBe('Hello world');
    });

    test('preserves indentation when adding comment', () => {
        expect(toggleLineComment('    indented text')).toBe('    <!-- indented text -->');
    });

    test('preserves indentation when removing comment', () => {
        expect(toggleLineComment('    <!-- indented text -->')).toBe('    indented text');
    });

    test('handles markdown heading', () => {
        expect(toggleLineComment('## Heading')).toBe('<!-- ## Heading -->');
    });

    test('round-trips correctly', () => {
        const original = 'Some text here';
        const commented = toggleLineComment(original);
        const uncommented = toggleLineComment(commented);
        expect(uncommented).toBe(original);
    });

    test('round-trips with indentation', () => {
        const original = '  indented';
        const commented = toggleLineComment(original);
        const uncommented = toggleLineComment(commented);
        expect(uncommented).toBe(original);
    });

    test('handles empty content', () => {
        expect(toggleLineComment('')).toBe('<!--  -->');
    });

    test('handles list items', () => {
        expect(toggleLineComment('- list item')).toBe('<!-- - list item -->');
    });

    test('handles code', () => {
        expect(toggleLineComment('`code block`')).toBe('<!-- `code block` -->');
    });
});

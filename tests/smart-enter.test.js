const { getSmartEnterText } = require('../editor-utils');

describe('getSmartEnterText', () => {
    describe('unordered lists', () => {
        test('continues dash list', () => {
            expect(getSmartEnterText('- Item one')).toBe('- ');
        });

        test('continues asterisk list', () => {
            expect(getSmartEnterText('* Item one')).toBe('* ');
        });

        test('continues plus list', () => {
            expect(getSmartEnterText('+ Item one')).toBe('+ ');
        });

        test('preserves indentation', () => {
            expect(getSmartEnterText('    - Nested item')).toBe('    - ');
        });

        test('empty dash item ends list', () => {
            expect(getSmartEnterText('- ')).toBe('');
        });

        test('empty asterisk item ends list', () => {
            expect(getSmartEnterText('* ')).toBe('');
        });

        test('empty indented item ends list', () => {
            expect(getSmartEnterText('    - ')).toBe('');
        });
    });

    describe('ordered lists', () => {
        test('continues numbered list', () => {
            expect(getSmartEnterText('1. First item')).toBe('2. ');
        });

        test('increments number correctly', () => {
            expect(getSmartEnterText('3. Third item')).toBe('4. ');
        });

        test('handles large numbers', () => {
            expect(getSmartEnterText('99. Item ninety-nine')).toBe('100. ');
        });

        test('preserves indentation in ordered list', () => {
            expect(getSmartEnterText('  1. Indented first')).toBe('  2. ');
        });

        test('empty ordered item ends list', () => {
            expect(getSmartEnterText('1. ')).toBe('');
        });

        test('empty indented ordered item ends list', () => {
            expect(getSmartEnterText('    5. ')).toBe('');
        });
    });

    describe('non-list context', () => {
        test('normal text returns null', () => {
            expect(getSmartEnterText('Hello world')).toBeNull();
        });

        test('empty line returns null', () => {
            expect(getSmartEnterText('')).toBeNull();
        });

        test('heading returns null', () => {
            expect(getSmartEnterText('## Heading')).toBeNull();
        });

        test('code block returns null', () => {
            expect(getSmartEnterText('```javascript')).toBeNull();
        });

        test('only spaces returns null', () => {
            expect(getSmartEnterText('    ')).toBeNull();
        });
    });
});

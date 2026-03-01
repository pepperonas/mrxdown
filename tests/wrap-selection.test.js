// Tests for toggle-wrap (unwrap) logic
// These test the pure logic that wrapSelection uses internally

describe('wrapSelection toggle logic', () => {
    // Helper simulating the wrap/unwrap check
    function shouldUnwrap(text, selStart, selEnd, prefix, suffix) {
        const selectedText = text.substring(selStart, selEnd);
        const beforeStart = selStart - prefix.length;
        const afterEnd = selEnd + suffix.length;

        // Check surrounding text for wrapper
        if (beforeStart >= 0 && afterEnd <= text.length &&
            text.substring(beforeStart, selStart) === prefix &&
            text.substring(selEnd, afterEnd) === suffix) {
            return 'surrounding';
        }

        // Check if selection includes wrapper
        if (selectedText.startsWith(prefix) && selectedText.endsWith(suffix) &&
            selectedText.length >= prefix.length + suffix.length) {
            return 'included';
        }

        return false;
    }

    test('detects bold wrapping around selection', () => {
        const text = 'Hello **world** end';
        //                    ^     ^  selection: "world" at indices 8-13
        expect(shouldUnwrap(text, 8, 13, '**', '**')).toBe('surrounding');
    });

    test('detects bold wrapping included in selection', () => {
        const text = 'Hello **world** end';
        //            selection: "**world**" at indices 6-15
        expect(shouldUnwrap(text, 6, 15, '**', '**')).toBe('included');
    });

    test('no unwrap for non-wrapped text', () => {
        const text = 'Hello world end';
        expect(shouldUnwrap(text, 6, 11, '**', '**')).toBe(false);
    });

    test('detects italic wrapping', () => {
        const text = 'Hello *world* end';
        expect(shouldUnwrap(text, 7, 12, '*', '*')).toBe('surrounding');
    });

    test('detects code wrapping', () => {
        const text = 'Hello `code` end';
        expect(shouldUnwrap(text, 7, 11, '`', '`')).toBe('surrounding');
    });

    test('detects strikethrough wrapping', () => {
        const text = 'Hello ~~deleted~~ end';
        expect(shouldUnwrap(text, 8, 15, '~~', '~~')).toBe('surrounding');
    });

    test('no false positive at start of string', () => {
        const text = 'world** end';
        expect(shouldUnwrap(text, 0, 5, '**', '**')).toBe(false);
    });
});

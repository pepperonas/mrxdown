// Tests für E3: pure Tabellen-Logik in editor-utils.js
const {
    parseMarkdownTable, formatMarkdownTable, tableAddColumn, tableDeleteColumn,
    tableAddRow, tableDeleteRow, tableCycleAlignment, findTableBounds,
    tableColumnAtPos, csvToMarkdownTable
} = require('../editor-utils');

const LINES = ['| A | Bezeichnung |', '|---|:-----------:|', '| 1 | eins |', '| 2 | zwei |'];

describe('parseMarkdownTable / formatMarkdownTable', () => {
    test('parses header, alignment, rows', () => {
        const t = parseMarkdownTable(LINES);
        expect(t.header).toEqual(['A', 'Bezeichnung']);
        expect(t.align).toEqual([null, 'center']);
        expect(t.rows).toEqual([['1', 'eins'], ['2', 'zwei']]);
    });

    test('format aligns pipes to the longest cell', () => {
        const out = formatMarkdownTable(parseMarkdownTable(LINES));
        const lines = out.split('\n');
        // alle Zeilen gleich lang (ausgerichtete Pipes)
        expect(new Set(lines.map(l => l.length)).size).toBe(1);
        expect(lines[1]).toContain(':');
        // Roundtrip ist stabil
        expect(formatMarkdownTable(parseMarkdownTable(lines))).toBe(out);
    });

    test('non-table or missing separator → null', () => {
        expect(parseMarkdownTable(['| a |', '| b |'])).toBeNull();
        expect(parseMarkdownTable(['text'])).toBeNull();
    });

    test('ragged rows are normalized to header width', () => {
        const t = parseMarkdownTable(['| a | b |', '|---|---|', '| nur-eine |']);
        expect(t.rows[0]).toEqual(['nur-eine', '']);
    });

    test('escaped pipes stay in cells', () => {
        const t = parseMarkdownTable(['| a\\|b | c |', '|---|---|', '| 1 | 2 |']);
        expect(t.header[0]).toBe('a\\|b');
        expect(t.header.length).toBe(2);
    });
});

describe('table operations', () => {
    const t = () => parseMarkdownTable(LINES);

    test('add column inserts everywhere', () => {
        const r = tableAddColumn(t(), 1);
        expect(r.header).toEqual(['A', 'Spalte', 'Bezeichnung']);
        expect(r.rows[0]).toEqual(['1', '', 'eins']);
        expect(r.align).toEqual([null, null, 'center']);
    });

    test('delete column, last column survives', () => {
        const r = tableDeleteColumn(t(), 0);
        expect(r.header).toEqual(['Bezeichnung']);
        const single = tableDeleteColumn(r, 0);
        expect(single.header).toEqual(['Bezeichnung']); // bleibt
    });

    test('add/delete row', () => {
        expect(tableAddRow(t(), 1).rows).toHaveLength(3);
        expect(tableAddRow(t(), 1).rows[1]).toEqual(['', '']);
        expect(tableDeleteRow(t(), 0).rows).toEqual([['2', 'zwei']]);
        const one = tableDeleteRow(tableDeleteRow(t(), 0), 0);
        expect(one.rows).toHaveLength(1); // letzte Datenzeile bleibt
    });

    test('alignment cycles null → left → center → right → null', () => {
        let table = t();
        const seq = [];
        for (let i = 0; i < 4; i++) {
            table = tableCycleAlignment(table, 0);
            seq.push(table.align[0]);
        }
        expect(seq).toEqual(['left', 'center', 'right', null]);
    });
});

describe('findTableBounds / tableColumnAtPos', () => {
    const doc = 'Text davor\n\n' + LINES.join('\n') + '\n\nText danach';

    test('finds the table block around a cursor inside it', () => {
        const pos = doc.indexOf('eins');
        const b = findTableBounds(doc, pos);
        expect(b).not.toBeNull();
        expect(doc.substring(b.start, b.end)).toBe(LINES.join('\n'));
        expect(b.rowIndex).toBe(2);
    });

    test('cursor outside a table → null', () => {
        expect(findTableBounds(doc, 2)).toBeNull();
        expect(findTableBounds(doc, doc.length - 1)).toBeNull();
    });

    test('column index respects escaped pipes', () => {
        const line = '| a\\|b | c | d |';
        expect(tableColumnAtPos(line, line.indexOf('c'))).toBe(1);
        expect(tableColumnAtPos(line, line.indexOf('d'))).toBe(2);
        expect(tableColumnAtPos(line, 3)).toBe(0);
    });
});

describe('csvToMarkdownTable', () => {
    test('TSV converts', () => {
        const md = csvToMarkdownTable('Name\tOrt\nMartin\tBerlin');
        expect(md).toContain('| Name');
        expect(md.split('\n')).toHaveLength(3);
    });

    test('semicolon CSV converts (deutsches Excel)', () => {
        expect(csvToMarkdownTable('a;b\n1;2')).toContain('| a');
    });

    test('comma CSV with quoted delimiter inside cell (3+ Zeilen)', () => {
        const md = csvToMarkdownTable('Name,Kommentar\nX,"gut, sehr gut"\nY,ok');
        expect(md).toContain('gut, sehr gut');
    });

    test('comma needs 3+ rows OR 3+ cols (Prosa-Schutz)', () => {
        expect(csvToMarkdownTable('Hallo, Welt.\nZweiter Satz, mit Komma.')).toBeNull();
        expect(csvToMarkdownTable('a,b,c\n1,2,3')).toContain('| a'); // 3 Spalten ok
        expect(csvToMarkdownTable('a;b\n1;2')).toContain('| a'); // Semikolon bleibt 2×2
    });

    test('pipe in cell is escaped', () => {
        expect(csvToMarkdownTable('a;b\nx|y;2')).toContain('x\\|y');
    });

    test('prose and inconsistent columns → null', () => {
        expect(csvToMarkdownTable('Hallo, Welt')).toBeNull(); // nur 1 Zeile
        expect(csvToMarkdownTable('a,b\nnur-eine-zelle')).toBeNull(); // inkonsistent
        expect(csvToMarkdownTable('Erster Satz.\nZweiter Satz.')).toBeNull(); // kein Delimiter
    });
});

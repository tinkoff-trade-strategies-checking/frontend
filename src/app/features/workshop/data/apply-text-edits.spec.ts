import { applyTextEdits } from './apply-text-edits';

describe('applyTextEdits', () => {
  it('возвращает исходный текст без изменений при пустом списке правок', () => {
    expect(applyTextEdits('let x = 1;', [])).toBe('let x = 1;');
  });

  it('применяет несколько правок с конца к началу без сдвига позиций', () => {
    const src = 'param a = 10;\nlet y = close > 70;\nlet z = rsi(14) > 30;';
    const out = applyTextEdits(src, [
      { startLine: 2, startColumn: 17, endLine: 2, endColumn: 19, replacement: 'lvl_high' },
      { startLine: 3, startColumn: 19, endLine: 3, endColumn: 21, replacement: 'lvl_low' },
      {
        startLine: 1,
        startColumn: 14,
        endLine: 1,
        endColumn: 14,
        replacement: '\nparam lvl_high = 70;',
      },
    ]);
    expect(out).toBe(
      'param a = 10;\nparam lvl_high = 70;\nlet y = close > lvl_high;\nlet z = rsi(14) > lvl_low;',
    );
  });

  it('корректно обрабатывает CRLF (\\r\\n) и вставки в конец строки', () => {
    const src = 'line1\r\nline2\r\nline3';
    const out = applyTextEdits(src, [
      { startLine: 1, startColumn: 6, endLine: 1, endColumn: 6, replacement: '!' },
      { startLine: 2, startColumn: 1, endLine: 2, endColumn: 6, replacement: 'SECOND' },
    ]);
    expect(out).toBe('line1!\r\nSECOND\r\nline3');
  });

  it('считает столбцы по Unicode code points (кириллица и суррогатные пары)', () => {
    const src = '// 🚀 тест\nlet x = 42;';
    // 🚀 — 1 code point (2 UTF-16 code units), далее пробел и 'тест'
    // col 1='/', 2='/', 3=' ', 4='🚀', 5=' ', 6..10='тест'
    const out = applyTextEdits(src, [
      { startLine: 1, startColumn: 6, endLine: 1, endColumn: 10, replacement: 'проверка' },
      { startLine: 2, startColumn: 9, endLine: 2, endColumn: 11, replacement: 'limit' },
    ]);
    expect(out).toBe('// 🚀 проверка\nlet x = limit;');
  });

  it('сохраняет порядок двух вставок в одну точку (start === end)', () => {
    const out = applyTextEdits('helloworld', [
      { startLine: 1, startColumn: 6, endLine: 1, endColumn: 6, replacement: ' ' },
      { startLine: 1, startColumn: 6, endLine: 1, endColumn: 6, replacement: 'beautiful ' },
    ]);
    expect(out).toBe('hello beautiful world');
  });

  it('разрешает вставку в конец строки без захвата CRLF и бросает RangeError при столбце больше длины + 1', () => {
    const src = 'abc\r\ndef';
    const out = applyTextEdits(src, [
      { startLine: 1, startColumn: 2, endLine: 1, endColumn: 4, replacement: 'XYZ' },
    ]);
    expect(out).toBe('aXYZ\r\ndef');

    expect(() =>
      applyTextEdits(src, [
        { startLine: 1, startColumn: 2, endLine: 1, endColumn: 99, replacement: 'XYZ' },
      ]),
    ).toThrow(RangeError);
  });

  it('бросает ошибку при пересекающихся правках или некорректном диапазоне', () => {
    expect(() =>
      applyTextEdits('abcdef', [
        { startLine: 1, startColumn: 2, endLine: 1, endColumn: 5, replacement: 'X' },
        { startLine: 1, startColumn: 4, endLine: 1, endColumn: 6, replacement: 'Y' },
      ]),
    ).toThrow(/пересекаются/);

    expect(() =>
      applyTextEdits('abc', [
        { startLine: 1, startColumn: 3, endLine: 1, endColumn: 2, replacement: 'X' },
      ]),
    ).toThrow(/диапазон/);

    expect(() =>
      applyTextEdits('abc', [
        { startLine: 2, startColumn: 1, endLine: 2, endColumn: 1, replacement: 'X' },
      ]),
    ).toThrow(/строки/);
  });
});

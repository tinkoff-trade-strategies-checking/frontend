export interface TextEdit {
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
  readonly replacement: string;
}

interface LineSpan {
  readonly start: number;
  readonly contentEnd: number;
}

interface ResolvedEdit {
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly replacement: string;
}

function buildLineSpans(source: string): readonly LineSpan[] {
  const spans: LineSpan[] = [];
  let lineStart = 0;

  for (let i = 0; i < source.length; i++) {
    const ch = source.charCodeAt(i);
    if (ch === 13 /* \r */ && source.charCodeAt(i + 1) === 10 /* \n */) {
      spans.push({ start: lineStart, contentEnd: i });
      i++;
      lineStart = i + 1;
    } else if (ch === 10 /* \n */) {
      spans.push({ start: lineStart, contentEnd: i });
      lineStart = i + 1;
    }
  }
  spans.push({ start: lineStart, contentEnd: source.length });
  return spans;
}

function positionToOffset(
  source: string,
  spans: readonly LineSpan[],
  line: number,
  column: number,
): number {
  if (!Number.isInteger(line) || line < 1 || line > spans.length) {
    throw new RangeError(`Некорректный номер строки: ${line} (всего ${spans.length}).`);
  }
  if (!Number.isInteger(column) || column < 1) {
    throw new RangeError(`Некорректный номер столбца: ${column}.`);
  }

  const span = spans[line - 1];
  let offset = span.start;
  let col = 1;
  while (col < column && offset < span.contentEnd) {
    const cp = source.codePointAt(offset);
    if (cp === undefined) {
      break;
    }
    offset += cp > 0xffff ? 2 : 1;
    col++;
  }
  if (col < column) {
    throw new RangeError(`Некорректный номер столбца: ${column} в строке ${line}.`);
  }
  return offset;
}

/**
 * Применяет набор правок DSL-диагностики к исходному тексту.
 * Позиции 1-based `(line, column)` считаются по Unicode code points внутри строки (с поддержкой `\r\n` и `\n`).
 * Правки сортируются с конца к началу и не должны пересекаться.
 */
export function applyTextEdits(source: string, edits: readonly TextEdit[]): string {
  if (edits.length === 0) {
    return source;
  }

  const spans = buildLineSpans(source);
  const resolved: ResolvedEdit[] = edits.map((edit, index) => {
    const start = positionToOffset(source, spans, edit.startLine, edit.startColumn);
    const end = positionToOffset(source, spans, edit.endLine, edit.endColumn);
    if (start > end) {
      throw new RangeError(
        `Некорректный диапазон правки: (${edit.startLine}:${edit.startColumn}) > (${edit.endLine}:${edit.endColumn}).`,
      );
    }
    return { index, start, end, replacement: edit.replacement };
  });

  resolved.sort((a, b) => b.start - a.start || b.end - a.end || b.index - a.index);

  for (let i = 1; i < resolved.length; i++) {
    const later = resolved[i - 1];
    const earlier = resolved[i];
    if (earlier.end > later.start) {
      throw new Error('Правки автоисправления пересекаются.');
    }
  }

  let result = source;
  for (const edit of resolved) {
    result = result.slice(0, edit.start) + edit.replacement + result.slice(edit.end);
  }
  return result;
}

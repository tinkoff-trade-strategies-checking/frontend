import {
  buildDslDownloadFilename,
  DSL_MAX_FILE_BYTES,
  extractStrategyNameFromFilename,
  normalizeDslText,
  readAndValidateDslFile,
} from './dsl-file';

describe('dsl-file', () => {
  it('извлекает название стратегии из имени файла без расширения .dsl/.txt', () => {
    expect(extractStrategyNameFromFilename('sma_crossover.dsl')).toBe('sma_crossover');
    expect(extractStrategyNameFromFilename('  My Strategy.TXT  ')).toBe('My Strategy');
    expect(extractStrategyNameFromFilename('C:\\strategies\\Donchian Breakout.DSL')).toBe(
      'Donchian Breakout',
    );
    expect(extractStrategyNameFromFilename('.dsl')).toBe('');
  });

  it('формирует безопасное имя файла с расширением .dsl для скачивания', () => {
    expect(buildDslDownloadFilename('SMA Crossover')).toBe('SMA-Crossover.dsl');
    expect(buildDslDownloadFilename('  ')).toBe('strategy.dsl');
    expect(buildDslDownloadFilename('my/bad:name?.dsl')).toBe('my-bad-name.dsl');
    expect(buildDslDownloadFilename('Пробой канала.txt')).toBe('Пробой-канала.dsl');
  });

  it('удаляет UTF-8 BOM и нормализует CRLF/CR в LF', () => {
    expect(normalizeDslText('\uFEFFparam a = 1\r\nparam b = 2\rparam c = 3')).toBe(
      'param a = 1\nparam b = 2\nparam c = 3',
    );
  });

  it('принимает валидный .dsl файл размером ровно 64 КиБ', async () => {
    const content = 'a'.repeat(DSL_MAX_FILE_BYTES);
    const file = new File([content], 'exact_limit.dsl', { type: 'text/plain' });

    const res = await readAndValidateDslFile(file);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.source.length).toBe(DSL_MAX_FILE_BYTES);
      expect(res.suggestedName).toBe('exact_limit');
    }
  });

  it('отклоняет файл больше 64 КиБ', async () => {
    const content = 'a'.repeat(DSL_MAX_FILE_BYTES + 1);
    const file = new File([content], 'too_large.dsl', { type: 'text/plain' });

    const res = await readAndValidateDslFile(file);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('64 КиБ');
    }
  });

  it('отклоняет пустой файл и файл только из пробелов/BOM', async () => {
    const empty = new File([], 'empty.dsl', { type: 'text/plain' });
    const emptyRes = await readAndValidateDslFile(empty);
    expect(emptyRes.ok).toBe(false);
    if (!emptyRes.ok) {
      expect(emptyRes.error).toContain('пустой');
    }

    const bomSpaces = new File(['\uFEFF   \r\n\t  '], 'spaces.txt', { type: 'text/plain' });
    const spacesRes = await readAndValidateDslFile(bomSpaces);
    expect(spacesRes.ok).toBe(false);
    if (!spacesRes.ok) {
      expect(spacesRes.error).toContain('пустой');
    }
  });

  it('отклоняет бинарный файл с NUL-байтом и невалидный UTF-8', async () => {
    const nulFile = new File([new Uint8Array([0x70, 0x61, 0x00, 0x72])], 'binary.dsl');
    const nulRes = await readAndValidateDslFile(nulFile);
    expect(nulRes.ok).toBe(false);
    if (!nulRes.ok) {
      expect(nulRes.error).toContain('бинарные');
    }

    const invalidUtf8 = new File([new Uint8Array([0xff, 0xfe, 0x80])], 'bad_encoding.txt');
    const utf8Res = await readAndValidateDslFile(invalidUtf8);
    expect(utf8Res.ok).toBe(false);
    if (!utf8Res.ok) {
      expect(utf8Res.error).toContain('UTF-8');
    }
  });
});

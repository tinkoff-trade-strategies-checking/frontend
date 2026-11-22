import {
  CHECK_LEVEL_LABELS,
  formatCheckLevelAppearance,
  formatDiagnosticLocation,
  formatLinterSummary,
  formatRunRejection,
  formatStrategyInvalidMessage,
  formatWorkshopDateTime,
  validateStrategyParam,
} from './workshop.format';

describe('workshop.format', () => {
  it('форматирует дату публикации в часовом поясе Москвы (Europe/Moscow)', () => {
    expect(formatWorkshopDateTime('2026-11-18T14:00:00+03:00')).toBe('18.11.2026 14:00');
    expect(formatWorkshopDateTime('2026-11-18T11:30:00Z')).toBe('18.11.2026 14:30');
    expect(formatWorkshopDateTime(null)).toBe('—');
  });

  it('форматирует сводку предупреждений линтера с дедупликацией кодов', () => {
    expect(formatLinterSummary([])).toBe('Чисто');

    expect(formatLinterSummary([{ code: 'L001', line: 10, message: 'Константа 70' }])).toBe(
      '1 пред. (L001)',
    );

    expect(
      formatLinterSummary([
        { code: 'L001', line: 5, message: 'Первая' },
        { code: 'L001', line: 9, message: 'Вторая' },
        { code: 'W-LA01', line: 2, message: 'Сравнение с уровнем' },
      ]),
    ).toBe('3 пред. (L001, W-LA01)');
  });

  it('возвращает метки, appearance и позицию диагностик DSL', () => {
    expect(CHECK_LEVEL_LABELS.OK).toBe('Без ошибок');
    expect(formatCheckLevelAppearance('OK')).toBe('positive');
    expect(formatCheckLevelAppearance('WARNING')).toBe('warning');
    expect(formatCheckLevelAppearance('ERROR')).toBe('negative');

    expect(formatDiagnosticLocation({ startLine: 0, startColumn: 0 })).toBe('весь файл');
    expect(formatDiagnosticLocation({ startLine: 12, startColumn: 5 })).toBe('12:5');
  });

  it('валидирует параметры StrategyParamDecl: диапазон и целочисленность (без блокировки по step)', () => {
    const intParam = {
      name: 'slow',
      defaultValue: 50,
      rangeMin: 20,
      rangeMax: 200,
      step: '5',
      integer: true,
    };
    expect(validateStrategyParam(intParam, 55)).toBeNull();
    expect(validateStrategyParam(intParam, 23)).toBeNull();
    expect(validateStrategyParam(intParam, null)).toContain('числовое');
    expect(validateStrategyParam(intParam, 25.5)).toContain('целым');
    expect(validateStrategyParam(intParam, 10)).toContain('20');
    expect(validateStrategyParam(intParam, 250)).toContain('200');

    const unalignedDefaultParam = {
      name: 'fast',
      defaultValue: 12,
      rangeMin: 5,
      rangeMax: 50,
      step: '5',
      integer: true,
    };
    expect(validateStrategyParam(unalignedDefaultParam, 12)).toBeNull();

    const floatParam = {
      name: 'stop_pct',
      defaultValue: 5,
      rangeMin: 1,
      rangeMax: 15,
      step: '0.5',
      integer: false,
    };
    expect(validateStrategyParam(floatParam, 5.5)).toBeNull();
    expect(validateStrategyParam(floatParam, 5.3)).toBeNull();
  });

  it('форматирует ошибки STRATEGY_INVALID и отказ запуска прогона без вывода сырого английского detail', () => {
    expect(
      formatStrategyInvalidMessage([
        {
          code: 'E-LA01',
          level: 'ERROR',
          startLine: 3,
          startColumn: 1,
          endLine: 3,
          endColumn: 10,
          message: 'Обращение к будущему бару',
          fixes: [],
        },
      ]),
    ).toBe('Публикация невозможна — ошибки DSL: E-LA01: Обращение к будущему бару');

    expect(formatStrategyInvalidMessage([])).toBe(
      'Стратегия содержит ошибки DSL и не может быть опубликована.',
    );

    expect(
      formatRunRejection({
        accepted: false,
        reason: 'STRATEGY_INVALID',
        field: 'strategyVersionId',
        barsCount: null,
        maxBars: null,
        detail: 'Strategy contains static errors and cannot be executed',
      }),
    ).toEqual({
      title: 'Стратегия не прошла проверку (STRATEGY_INVALID)',
      suggestion: 'Исправьте ошибки DSL в черновике и опубликуйте новую версию.',
    });

    const invalidParams = formatRunRejection({
      accepted: false,
      reason: 'INVALID_PARAMS',
      field: 'initialCapital',
      barsCount: null,
      maxBars: null,
      detail: 'initialCapital must be positive',
    });
    expect(invalidParams.title).toContain('начальный капитал');
    expect(invalidParams.suggestion).not.toContain('must be positive');

    expect(
      formatRunRejection({
        accepted: false,
        reason: 'TOO_MANY_BARS',
        field: null,
        barsCount: 6000,
        maxBars: 5000,
        detail: null,
      }).title,
    ).toContain('6');
  });
});

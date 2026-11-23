import {
  formatComparisonBadge,
  formatDrawdown,
  formatPct,
  formatRatio,
  formatRub,
} from './report.format';

describe('report.format', () => {
  const norm = (text: string): string => text.replace(/[\u00a0\u202f]/g, ' ');

  it('рубли — всегда два знака, разряды через пробел', () => {
    expect(norm(formatRub(111.2))).toBe('111,20 ₽');
    expect(norm(formatRub(1745.4))).toBe('1 745,40 ₽');
    expect(norm(formatRub(33560))).toBe('33 560,00 ₽');
    expect(norm(formatRub(1500, true))).toBe('+1 500,00 ₽');
    expect(norm(formatRub(-0.5))).toBe('−0,50 ₽');
  });

  it('минус во всех метриках — «−», а не дефис', () => {
    expect(formatRatio(-19.95)).toBe('−19,95');
    expect(formatRatio(1.5)).toBe('1,50');
    expect(formatPct(-3.2)).toBe('−3,20 %');
    expect(formatRatio(null)).toBe('—');
    for (const text of [formatRatio(-1), formatPct(-1), formatRub(-1)]) {
      expect(text).not.toContain('-');
    }
  });

  it('нормализует околонулевые значения (|x| < 0.005) к 0 без знака минуса', () => {
    expect(formatPct(-0.001)).toBe('0,00 %');
    expect(formatPct(-0.001, true)).toBe('0,00 %');
    expect(formatPct(-0)).toBe('0,00 %');
    expect(norm(formatRub(-0.004, true))).toBe('0,00 ₽');
    expect(formatRatio(-0.004)).toBe('0,00');
    expect(formatDrawdown(0)).toBe('0,00 %');
    expect(formatDrawdown(-0.002)).toBe('0,00 %');
    expect(formatDrawdown(4.5)).toBe('−4,50 %');
  });

  it('formatComparisonBadge форматирует сравнение и не перебивает порог округления 0.005', () => {
    expect(formatComparisonBadge('tie', 'Доходность равна', 0)).toBe('На уровне алгоритма');
    expect(formatComparisonBadge('human', 'Вы лучше на 0,00 п.п.', 0.004)).toBe(
      'На уровне алгоритма',
    );
    expect(formatComparisonBadge('human', 'Вы лучше на 0,01 п.п.', 0.006)).toBe(
      'Вы впереди на +0,01 п.п.',
    );
    expect(formatComparisonBadge('algo', 'Алгоритм лучше на 2,75 п.п.', -2.75)).toBe(
      'Алгоритм впереди на +2,75 п.п.',
    );
    expect(formatComparisonBadge('human', 'Сентинел: вы лучше на 999 888 ₽', 134_567)).toBe(
      'Сентинел: вы лучше на 999 888 ₽',
    );
  });
});

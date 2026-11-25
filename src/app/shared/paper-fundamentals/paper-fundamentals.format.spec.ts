import {
  FUNDAMENTAL_CATEGORIES,
  formatBeta,
  formatFundamentalValue,
  formatMarketCapRub,
  formatMultiple,
  formatPercent,
  formatReportDate,
  formatRubPerShare,
  fundamentalValueTone,
} from './paper-fundamentals.format';

describe('paper-fundamentals.format', () => {
  it('содержит ровно 4 категории Investing.com и 20 показателей с подсказками', () => {
    expect(FUNDAMENTAL_CATEGORIES.map((c) => c.title)).toEqual([
      'Оценка',
      'Рентабельность и рост',
      'Устойчивость',
      'На акцию и дивиденды',
    ]);
    const totalMetrics = FUNDAMENTAL_CATEGORIES.reduce((sum, c) => sum + c.metrics.length, 0);
    expect(totalMetrics).toBe(20);
    for (const cat of FUNDAMENTAL_CATEGORIES) {
      for (const m of cat.metrics) {
        expect(m.hint.trim().length).toBeGreaterThan(10);
      }
    }
  });

  it('форматирует капитализацию в трлн ₽, млрд ₽, млн ₽ и — для null/NaN', () => {
    expect(formatMarketCapRub(6_840_000_000_000)).toBe('6,84 трлн ₽');
    expect(formatMarketCapRub(860_000_000_000)).toBe('860,0 млрд ₽');
    expect(formatMarketCapRub(45_500_000)).toBe('45,5 млн ₽');
    expect(formatMarketCapRub(12_500)).toMatch(/12\s500 ₽/);
    expect(formatMarketCapRub(null)).toBe('—');
    expect(formatMarketCapRub(Number.NaN)).toBe('—');
  });

  it('форматирует мультипликаторы (x), проценты (%), бету и показатели на акцию (₽)', () => {
    expect(formatMultiple(4.35)).toBe('4,35x');
    expect(formatMultiple(null)).toBe('—');

    expect(formatPercent(24.1)).toBe('24,1%');
    expect(formatPercent(14.2, true)).toBe('+14,2%');
    expect(formatPercent(-4.2, true)).toBe('-4,2%');
    expect(formatPercent(0, true)).toBe('0,0%');
    expect(formatPercent(null)).toBe('—');

    expect(formatRubPerShare(69.8)).toBe('69,80 ₽');
    expect(formatRubPerShare(1654)).toMatch(/1\s654 ₽/);
    expect(formatRubPerShare(undefined)).toBe('—');

    expect(formatBeta(1.05)).toBe('1,05');
    expect(formatBeta(null)).toBe('—');
  });

  it('форматирует дату отчётности в DD.MM.YYYY и возвращает — для null', () => {
    expect(formatReportDate('2025-12-31')).toBe('31.12.2025');
    expect(formatReportDate('2026-02-26T00:00:00Z')).toBe('26.02.2026');
    expect(formatReportDate(null)).toBe('—');
    expect(formatReportDate('')).toBe('—');
  });

  it('определяет тон только для знаковых процентов (YoY)', () => {
    expect(fundamentalValueTone(12.5, 'signedPercent')).toBe('positive');
    expect(fundamentalValueTone(-3.1, 'signedPercent')).toBe('negative');
    expect(fundamentalValueTone(0, 'signedPercent')).toBe('neutral');
    expect(fundamentalValueTone(24.1, 'percent')).toBe('neutral');
    expect(fundamentalValueTone(null, 'signedPercent')).toBe('neutral');
    expect(formatFundamentalValue(4.28, 'multiple')).toBe('4,28x');
  });
});

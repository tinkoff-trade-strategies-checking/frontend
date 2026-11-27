import { ReportMetrics } from './data/report.models';
import {
  buildExecutiveSummary,
  formatLaunchRejectReason,
  formatPct,
  formatRatio,
  formatRub,
} from './report.format';

function makeMetrics(overrides: Partial<ReportMetrics> = {}): ReportMetrics {
  return {
    initialCapitalRub: 1_000_000,
    finalCapitalRub: 1_084_000,
    totalReturnPct: 8.4,
    cagrPct: 35.2,
    grossReturnPct: 9.1,
    netReturnPct: 8.4,
    maxDrawdownPct: 4.2,
    maxDrawdownDurationDays: 8,
    maxDrawdownDurationSteps: 8,
    volatilityPct: 14.5,
    sharpe: 1.45,
    sortino: 2.1,
    turnover: 1.8,
    tradesCount: 5,
    winRatePct: 60,
    rejectedOrdersCount: 0,
    partialFillsCount: 0,
    hhi: 0.38,
    largestPositionPct: 42,
    bankrupt: false,
    costsRub: {
      totalRub: 7_000,
      commissionRub: 4_500,
      exchangeFeeRub: 200,
      spreadRub: 1_500,
      slippageRub: 800,
    },
    benchmarkImoexPct: 5.2,
    ...overrides,
  };
}

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

  it('buildExecutiveSummary: формирует позитивный вердикт с IMOEX, просадкой и издержками', () => {
    const summary = buildExecutiveSummary(makeMetrics());
    expect(summary.tone).toBe('positive');
    expect(norm(summary.headline)).toContain('+8,40 %');
    const joined = norm(summary.sentences.join(' '));
    expect(joined).toContain('1 000 000,00 ₽');
    expect(joined).toContain('1 084 000,00 ₽');
    expect(joined).toContain('обогнали рынок');
    expect(joined).toContain('IMOEX');
    expect(joined).toContain('почти не трясло');
    expect(joined).toContain('7 000,00 ₽');
    expect(summary.grossBarWidthPct).toBe(100);
    expect(summary.netBarWidthPct).toBeGreaterThan(0);
    expect(summary.netBarWidthPct).toBeLessThan(100);
  });

  it('buildExecutiveSummary: при минусе, сильной просадке и отсутствии IMOEX не упоминает IMOEX', () => {
    const summary = buildExecutiveSummary(
      makeMetrics({
        finalCapitalRub: 820_000,
        grossReturnPct: -16.5,
        netReturnPct: -18,
        maxDrawdownPct: 22.5,
        benchmarkImoexPct: null,
        costsRub: {
          totalRub: null,
          commissionRub: 0,
          exchangeFeeRub: 0,
          spreadRub: 0,
          slippageRub: 0,
        },
      }),
    );
    expect(summary.tone).toBe('negative');
    expect(norm(summary.headline)).toContain('−18,00 %');
    const joined = norm(summary.sentences.join(' '));
    expect(joined).not.toContain('IMOEX');
    expect(joined).toContain('заметно трясло');
    expect(joined).toContain('−22,50 %');
  });

  it('formatLaunchRejectReason: возвращает понятное сообщение для каждого кода отказа', () => {
    expect(formatLaunchRejectReason('NO_MATCHING_PERIOD', null, null)).toContain('подобрать');
    expect(formatLaunchRejectReason('TOO_MANY_BARS', 6000, 5000)).toContain('6000');
    expect(formatLaunchRejectReason('CORPORATE_ACTION_ON_PERIOD', null, null)).toContain(
      'корпоративное событие',
    );
    expect(formatLaunchRejectReason('INVALID_PARAMS', null, null)).toContain('Параметры');
  });
});

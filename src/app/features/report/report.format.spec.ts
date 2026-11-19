import { formatPct, formatRatio, formatRub } from './report.format';

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
});

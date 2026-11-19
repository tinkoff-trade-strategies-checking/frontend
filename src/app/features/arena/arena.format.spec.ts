import { formatRub } from './arena.format';

describe('arena.format', () => {
  it('рубли — всегда два знака', () => {
    const norm = (text: string): string => text.replace(/[\u00a0\u202f]/g, ' ');
    expect(norm(formatRub(1000000))).toBe('1 000 000,00 ₽');
    expect(norm(formatRub(111.2))).toBe('111,20 ₽');
    expect(norm(formatRub(-5, true))).toBe('−5,00 ₽');
  });
});

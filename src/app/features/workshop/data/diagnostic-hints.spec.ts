import { diagnosticHint, KNOWN_DIAGNOSTIC_CODES } from './diagnostic-hints';

describe('diagnostic-hints', () => {
  it('возвращает понятные переводы для всех основных кодов диагностик DSL', () => {
    for (const code of ['E-SYN', 'E-TYPE', 'E-BEC', 'E-LA01', 'E-LA02', 'W-LA01', 'L001']) {
      const hint = diagnosticHint(code);
      expect(hint).not.toBeNull();
      expect(hint!.title.length).toBeGreaterThan(3);
      expect(hint!.explanation.length).toBeGreaterThan(10);
      expect(hint!.howToFix.length).toBeGreaterThan(10);
    }
    expect(KNOWN_DIAGNOSTIC_CODES.length).toBeGreaterThanOrEqual(7);
  });

  it('нормализует регистр и пробелы и возвращает null для неизвестного кода', () => {
    expect(diagnosticHint(' e-la01 ')?.title).toContain('будущее');
    expect(diagnosticHint('UNKNOWN-999')).toBeNull();
  });
});

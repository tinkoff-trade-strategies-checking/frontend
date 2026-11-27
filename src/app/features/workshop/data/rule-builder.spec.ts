import { defaultBuilderRule, generateDsl } from './rule-builder';

describe('rule-builder', () => {
  it('генерирует валидный DSL с param и because без зашитых чисел внутри rule', () => {
    const code = generateDsl([defaultBuilderRule('buy'), defaultBuilderRule('sell')]);
    expect(code).toContain('param rsi_n_1 = 14');
    expect(code).toContain('param rsi_level_1 = 30');
    expect(code).toContain('param size_pct_1 = 50');
    expect(code).toContain('when position == 0 and rsi(close, rsi_n_1) < rsi_level_1');
    expect(code).toContain('then buy size_pct_1 % cash');
    expect(code).toContain('when position > 0 and rsi(close, rsi_n_2) > rsi_level_2');
    expect(code).toContain('then sell all');
    expect(code).toContain('because "');
  });

  it('генерирует crossover/crossunder для пересечения двух SMA и не допускает slow <= fast', () => {
    const code = generateDsl([
      {
        indicator: 'sma_cross',
        comparator: 'above',
        action: 'buy',
        sizePct: 40,
        period: 14,
        level: 30,
        fastPeriod: 50,
        slowPeriod: 20,
      },
      {
        indicator: 'sma_price',
        comparator: 'below',
        action: 'sell',
        sizePct: 60,
        period: 25,
        level: 70,
        fastPeriod: 20,
        slowPeriod: 50,
      },
    ]);
    expect(code).toContain('param fast_n_1 = 50');
    expect(code).toContain('param slow_n_1 = 51');
    expect(code).toContain('crossover(sma(close, fast_n_1), sma(close, slow_n_1))');
    expect(code).toContain('close < sma(close, sma_n_2)');
    expect(code).toContain('then sell size_pct_2 % position');
  });

  it('возвращает пустую строку для пустого списка правил', () => {
    expect(generateDsl([])).toBe('');
  });
});

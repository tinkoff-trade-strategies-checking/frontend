import { ReportDivergence } from './data/report.models';
import { buildTopLessons } from './report-lessons';

function makeDiv(partial: Partial<ReportDivergence> & { id: string }): ReportDivergence {
  return {
    step: 10,
    day: 5,
    dateLabel: '05.03.2025',
    paperTicker: 'SBER',
    sector: 'Финансы',
    type: 'extra',
    deltaBars: null,
    horizonStep: 15,
    horizonDay: 8,
    humanAction: 'Купил 10 лотов',
    algoAction: 'Без сделки',
    errorCostRub: 1000,
    errorCostPct: 1,
    because: null,
    ...partial,
  };
}

describe('buildTopLessons', () => {
  it('возвращает пустой список при null или пустом массиве расхождений', () => {
    expect(buildTopLessons(null)).toEqual([]);
    expect(buildTopLessons([])).toEqual([]);
  });

  it('игнорирует расхождения в пользу пользователя (errorCostRub <= 0)', () => {
    const result = buildTopLessons([
      makeDiv({ id: '1', errorCostRub: -500 }),
      makeDiv({ id: '2', errorCostRub: 0 }),
    ]);
    expect(result).toEqual([]);
  });

  it('выбирает до 3 самых дорогих расхождений, предпочитая разные типы', () => {
    const result = buildTopLessons([
      makeDiv({ id: 'e1', type: 'extra', errorCostRub: 5000 }),
      makeDiv({ id: 'e2', type: 'extra', errorCostRub: 4500 }),
      makeDiv({ id: 'm1', type: 'missed', errorCostRub: 3000, because: 'RSI < 30' }),
      makeDiv({ id: 't1', type: 'timing', errorCostRub: 1500 }),
      makeDiv({ id: 's1', type: 'size', errorCostRub: 800 }),
    ]);
    expect(result).toHaveLength(3);
    expect(result.map((l) => l.id)).toEqual(['e1', 'm1', 't1']);
    expect(result[1].what).toContain('Причина: RSI < 30');
  });
});

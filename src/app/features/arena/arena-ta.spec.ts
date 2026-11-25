import {
  computeAdxSeries,
  computeAtrSeries,
  computeBollingerSeries,
  computeCciSeries,
  computeEmaSeries,
  computeMacdSeries,
  computeMfiSeries,
  computeObvSeries,
  computePivotPoints,
  computeRsiSeries,
  computeSmaSeries,
  computeStochSeries,
  computeTaSummary,
  computeVwapSeries,
  computeWilliamsRSeries,
} from './arena-ta';
import { ArenaCandle } from './data/arena.models';

function makeTrendCandles(count: number, direction: 1 | -1): ArenaCandle[] {
  const candles: ArenaCandle[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const open = price;
    const wave = Math.sin(i * 0.6) * 0.4;
    const close = Math.max(5, open + direction * 1.15 + wave);
    const high = Math.max(open, close) + 1.2;
    const low = Math.max(1, Math.min(open, close) - 0.9);
    candles.push({
      step: i,
      day: i + 1,
      candleInDay: 1,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: 1000 + (i % 7) * 150,
    });
    price = close;
  }
  return candles;
}

describe('arena-ta', () => {
  it('рассчитывает все 12 технических индикаторов и 12 скользящих средних на достаточной истории', () => {
    const candles = makeTrendCandles(220, 1);
    const summary = computeTaSummary(candles);

    expect(summary.candleCount).toBe(220);
    expect(summary.lastClose).toBe(candles[candles.length - 1].close);
    expect(summary.indicators).toHaveLength(12);
    expect(summary.movingAverages).toHaveLength(6);

    const names = summary.indicators.map((i) => i.name);
    expect(names).toEqual([
      'RSI(14)',
      'STOCH(9,6)',
      'STOCHRSI(14)',
      'MACD(12,26)',
      'ADX(14)',
      'Williams %R(14)',
      'CCI(14)',
      'ATR(14)',
      'Highs/Lows(14)',
      'Ultimate Oscillator',
      'ROC(12)',
      'Bull/Bear Power(13)',
    ]);

    for (const row of summary.indicators) {
      expect(row.value).not.toBeNull();
      expect(row.action).not.toBeNull();
      expect(row.vote).not.toBeNull();
    }

    for (const ma of summary.movingAverages) {
      expect(ma.sma).not.toBeNull();
      expect(ma.ema).not.toBeNull();
      expect(ma.smaAction).toBe('buy');
      expect(ma.emaAction).toBe('buy');
    }

    expect(summary.movingAveragesSummary.buy).toBe(12);
    expect(summary.movingAveragesSummary.sell).toBe(0);
    expect(summary.movingAveragesSummary.rating).toBe('strong_buy');
    expect(['buy', 'strong_buy']).toContain(summary.overall.rating);
  });

  it('на устойчивом нисходящем тренде выдаёт «Активно продавать» по скользящим и сводке', () => {
    const candles = makeTrendCandles(220, -1).map((c, i) => ({
      ...c,
      open: 400 - i * 1.1,
      high: 401 - i * 1.1,
      low: 398.5 - i * 1.1,
      close: 399 - i * 1.1,
    }));
    const summary = computeTaSummary(candles);

    expect(summary.movingAveragesSummary.sell).toBe(12);
    expect(summary.movingAveragesSummary.rating).toBe('strong_sell');
    expect(summary.overall.rating).toBe('strong_sell');
    expect(summary.overall.sell).toBeGreaterThan(summary.overall.buy);
  });

  it('корректно обрабатывает короткую историю прогрева без NaN и ошибок', () => {
    const short = makeTrendCandles(8, 1);
    const summary = computeTaSummary(short);

    expect(summary.indicators).toHaveLength(12);
    expect(summary.indicators.every((r) => r.value === null || Number.isFinite(r.value))).toBe(
      true,
    );
    expect(summary.movingAverages[0].sma).not.toBeNull(); // MA5 доступна
    expect(summary.movingAverages[5].sma).toBeNull(); // MA200 недоступна
  });

  it('INV-1: расчёт на префиксе candles[0..k] не зависит от будущих свечей', () => {
    const full = makeTrendCandles(80, 1);
    const prefix = full.slice(0, 45);
    const summaryPrefix = computeTaSummary(prefix);
    const rsiFull = computeRsiSeries(full, 14);
    const rsiPrefix = computeRsiSeries(prefix, 14);

    const lastPrefix = rsiPrefix[rsiPrefix.length - 1];
    const sameStepInFull = rsiFull.find((p) => p.step === lastPrefix.step);
    expect(sameStepInFull).toEqual(lastPrefix);
    expect(summaryPrefix.indicators.find((i) => i.id === 'rsi')?.value).toBe(lastPrefix.value);
  });

  it('рассчитывает все 5 методов точек разворота по предыдущему завершённому дню (включая ДеМарк)', () => {
    const candles: ArenaCandle[] = [
      // Предыдущий день (day = 1): O=100, H=115, L=95, C=110 (внутридневная агрегация из 2 свечей)
      { step: 0, day: 1, candleInDay: 1, open: 100, high: 112, low: 95, close: 108, volume: 100 },
      { step: 1, day: 1, candleInDay: 2, open: 108, high: 115, low: 102, close: 110, volume: 120 },
      // Текущий день (day = 2)
      { step: 2, day: 2, candleInDay: 1, open: 111, high: 113, low: 109, close: 112, volume: 90 },
    ];
    const pivots = computePivotPoints(candles);
    expect(pivots).toHaveLength(5);

    const classic = pivots.find((p) => p.method === 'classic')!;
    // P = (115 + 95 + 110) / 3 = 106.67; R = 20
    expect(classic.pivot).toBeCloseTo(106.67, 2);
    expect(classic.r1).toBeCloseTo(118.33, 2);
    expect(classic.s1).toBeCloseTo(98.33, 2);
    expect(classic.r2).toBeCloseTo(126.67, 2);
    expect(classic.s2).toBeCloseTo(86.67, 2);

    const fib = pivots.find((p) => p.method === 'fibonacci')!;
    expect(fib.r1).toBeCloseTo(106.67 + 0.382 * 20, 1);
    expect(fib.s2).toBeCloseTo(106.67 - 0.618 * 20, 1);

    const camarilla = pivots.find((p) => p.method === 'camarilla')!;
    expect(camarilla.r3).toBeCloseTo(110 + (20 * 1.1) / 4, 2);
    expect(camarilla.s3).toBeCloseTo(110 - (20 * 1.1) / 4, 2);

    const woodie = pivots.find((p) => p.method === 'woodie')!;
    // P = (115 + 95 + 220) / 4 = 107.5
    expect(woodie.pivot).toBe(107.5);

    const demark = pivots.find((p) => p.method === 'demark')!;
    // C (110) > O (100) => X = 2*115 + 95 + 110 = 435 => P = 108.75, R1 = 217.5 - 95 = 122.5, S1 = 217.5 - 115 = 102.5
    expect(demark.pivot).toBe(108.75);
    expect(demark.r1).toBe(122.5);
    expect(demark.s1).toBe(102.5);
    expect(demark.r2).toBeNull();
    expect(demark.s2).toBeNull();
    expect(demark.r3).toBeNull();
    expect(demark.s3).toBeNull();
  });

  it('рассчитывает ряды для оверлеев и осцилляторов графика', () => {
    const candles = makeTrendCandles(60, 1);

    expect(computeSmaSeries(candles, 20)).toHaveLength(41);
    expect(computeEmaSeries(candles, 20)).toHaveLength(41);

    const bb = computeBollingerSeries(candles, 20, 2);
    expect(bb.upper).toHaveLength(41);
    expect(bb.middle).toHaveLength(41);
    expect(bb.lower).toHaveLength(41);
    expect(bb.upper[0].value).toBeGreaterThan(bb.middle[0].value);
    expect(bb.lower[0].value).toBeLessThan(bb.middle[0].value);

    const vwap = computeVwapSeries(candles);
    expect(vwap).toHaveLength(60);

    const macd = computeMacdSeries(candles);
    expect(macd.macd.length).toBeGreaterThan(0);
    expect(macd.signal.length).toBeGreaterThan(0);
    expect(macd.histogram.length).toBe(macd.signal.length);

    const stoch = computeStochSeries(candles);
    expect(stoch.k.length).toBeGreaterThan(0);
    expect(stoch.d.length).toBeGreaterThan(0);

    const adx = computeAdxSeries(candles);
    expect(adx.adx.length).toBeGreaterThan(0);
    expect(adx.plusDi.length).toBeGreaterThan(0);
    expect(adx.minusDi.length).toBeGreaterThan(0);

    expect(computeCciSeries(candles).length).toBeGreaterThan(0);
    expect(computeWilliamsRSeries(candles).length).toBeGreaterThan(0);
    expect(computeAtrSeries(candles).length).toBeGreaterThan(0);
    expect(computeObvSeries(candles)).toHaveLength(60);
    expect(computeMfiSeries(candles).length).toBeGreaterThan(0);
  });
});

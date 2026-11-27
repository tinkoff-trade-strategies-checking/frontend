import { ArenaCandle } from './data/arena.models';

export type TaOverlayId = 'sma20' | 'sma50' | 'ema20' | 'ema50' | 'bb' | 'vwap';

export type TaOscillatorId =
  'none' | 'rsi' | 'macd' | 'stoch' | 'adx' | 'cci' | 'willr' | 'atr' | 'obv' | 'mfi';

export type TaVote = 'buy' | 'sell' | 'neutral';

export type TaIndicatorAction =
  'buy' | 'sell' | 'neutral' | 'overbought' | 'oversold' | 'high_volatility' | 'low_volatility';

export type TaSummaryRating = 'strong_sell' | 'sell' | 'neutral' | 'buy' | 'strong_buy';

export interface TaSeriesPoint {
  readonly step: number;
  readonly value: number;
}

export interface TaBollingerSeries {
  readonly upper: readonly TaSeriesPoint[];
  readonly middle: readonly TaSeriesPoint[];
  readonly lower: readonly TaSeriesPoint[];
}

export interface TaMacdSeries {
  readonly macd: readonly TaSeriesPoint[];
  readonly signal: readonly TaSeriesPoint[];
  readonly histogram: readonly TaSeriesPoint[];
}

export interface TaStochSeries {
  readonly k: readonly TaSeriesPoint[];
  readonly d: readonly TaSeriesPoint[];
}

export interface TaAdxSeries {
  readonly adx: readonly TaSeriesPoint[];
  readonly plusDi: readonly TaSeriesPoint[];
  readonly minusDi: readonly TaSeriesPoint[];
}

export interface TaIndicatorRow {
  readonly id: string;
  readonly name: string;
  readonly value: number | null;
  readonly action: TaIndicatorAction | null;
  readonly vote: TaVote | null;
}

export interface TaMovingAverageRow {
  readonly period: number;
  readonly label: string;
  readonly sma: number | null;
  readonly smaAction: TaVote | null;
  readonly ema: number | null;
  readonly emaAction: TaVote | null;
}

export interface TaSectionSummary {
  readonly rating: TaSummaryRating;
  readonly buy: number;
  readonly sell: number;
  readonly neutral: number;
}

export interface TaPivotRow {
  readonly method: 'classic' | 'fibonacci' | 'camarilla' | 'woodie' | 'demark';
  readonly label: string;
  readonly s3: number | null;
  readonly s2: number | null;
  readonly s1: number | null;
  readonly pivot: number | null;
  readonly r1: number | null;
  readonly r2: number | null;
  readonly r3: number | null;
}

export interface TaSummarySnapshot {
  readonly candleCount: number;
  readonly lastClose: number | null;
  readonly overall: TaSectionSummary;
  readonly indicatorsSummary: TaSectionSummary;
  readonly movingAveragesSummary: TaSectionSummary;
  readonly indicators: readonly TaIndicatorRow[];
  readonly movingAverages: readonly TaMovingAverageRow[];
  readonly pivots: readonly TaPivotRow[];
}

export interface TaOscillatorOption {
  readonly id: TaOscillatorId;
  readonly label: string;
}

export interface TaOverlayOption {
  readonly id: TaOverlayId;
  readonly label: string;
}

export const TA_OVERLAY_OPTIONS: readonly TaOverlayOption[] = [
  { id: 'sma20', label: 'SMA 20' },
  { id: 'sma50', label: 'SMA 50' },
  { id: 'ema20', label: 'EMA 20' },
  { id: 'ema50', label: 'EMA 50' },
  { id: 'bb', label: 'Bollinger' },
  { id: 'vwap', label: 'VWAP' },
];

export const TA_OSCILLATOR_OPTIONS: readonly TaOscillatorOption[] = [
  { id: 'none', label: 'Без осциллятора' },
  { id: 'rsi', label: 'RSI(14)' },
  { id: 'macd', label: 'MACD' },
  { id: 'stoch', label: 'Stochastic' },
  { id: 'adx', label: 'ADX(14)' },
  { id: 'cci', label: 'CCI(14)' },
  { id: 'willr', label: 'Williams %R' },
  { id: 'atr', label: 'ATR(14)' },
  { id: 'obv', label: 'OBV' },
  { id: 'mfi', label: 'MFI(14)' },
];

export const TA_ACTION_LABELS: Readonly<Record<TaIndicatorAction, string>> = {
  buy: 'Покупать',
  sell: 'Продавать',
  neutral: 'Нейтрально',
  overbought: 'Перекупленность',
  oversold: 'Перепроданность',
  high_volatility: 'Высокая волатильность',
  low_volatility: 'Меньшая волатильность',
};

export const TA_RATING_LABELS: Readonly<Record<TaSummaryRating, string>> = {
  strong_buy: 'Активно покупать',
  buy: 'Покупать',
  neutral: 'Нейтрально',
  sell: 'Продавать',
  strong_sell: 'Активно продавать',
};

const MA_PERIODS = [5, 10, 20, 50, 100, 200] as const;

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function smaValues(values: readonly number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) {
    return out;
  }
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) {
      sum -= values[i - period];
    }
    if (i >= period - 1) {
      out[i] = sum / period;
    }
  }
  return out;
}

function emaValues(values: readonly number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) {
    return out;
  }
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let prev = sum / period;
  out[period - 1] = prev;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function emaNullable(values: readonly (number | null)[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0) {
    return out;
  }
  const k = 2 / (period + 1);
  let count = 0;
  let sum = 0;
  let prev: number | null = null;

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null) {
      continue;
    }
    if (prev === null) {
      sum += v;
      count += 1;
      if (count === period) {
        prev = sum / period;
        out[i] = prev;
      }
    } else {
      prev = v * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

function smaNullable(values: readonly (number | null)[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0) {
    return out;
  }
  const window: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null) {
      continue;
    }
    window.push(v);
    sum += v;
    if (window.length > period) {
      sum -= window.shift()!;
    }
    if (window.length === period) {
      out[i] = sum / period;
    }
  }
  return out;
}

function toSeries(
  candles: readonly ArenaCandle[],
  values: readonly (number | null)[],
  digits = 2,
): TaSeriesPoint[] {
  const result: TaSeriesPoint[] = [];
  for (let i = 0; i < candles.length; i++) {
    const v = values[i];
    if (v !== null && Number.isFinite(v)) {
      result.push({ step: candles[i].step, value: round(v, digits) });
    }
  }
  return result;
}

export function computeSmaSeries(
  candles: readonly ArenaCandle[],
  period: number,
): readonly TaSeriesPoint[] {
  const closes = candles.map((c) => c.close);
  return toSeries(candles, smaValues(closes, period));
}

export function computeEmaSeries(
  candles: readonly ArenaCandle[],
  period: number,
): readonly TaSeriesPoint[] {
  const closes = candles.map((c) => c.close);
  return toSeries(candles, emaValues(closes, period));
}

export function computeBollingerSeries(
  candles: readonly ArenaCandle[],
  period = 20,
  multiplier = 2,
): TaBollingerSeries {
  const upper: TaSeriesPoint[] = [];
  const middle: TaSeriesPoint[] = [];
  const lower: TaSeriesPoint[] = [];
  if (candles.length < period || period <= 0) {
    return { upper, middle, lower };
  }
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += candles[j].close;
    }
    const mean = sum / period;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = candles[j].close - mean;
      variance += diff * diff;
    }
    const std = Math.sqrt(variance / period);
    const step = candles[i].step;
    middle.push({ step, value: round(mean) });
    upper.push({ step, value: round(mean + multiplier * std) });
    lower.push({ step, value: round(mean - multiplier * std) });
  }
  return { upper, middle, lower };
}

export function computeVwapSeries(candles: readonly ArenaCandle[]): readonly TaSeriesPoint[] {
  if (candles.length === 0) {
    return [];
  }
  // Если в данных внутридневные свечи (несколько свечей в одном дне), сбрасываем VWAP в начале дня.
  let hasIntraday = false;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].day === candles[i - 1].day && candles[i].day > 0) {
      hasIntraday = true;
      break;
    }
  }

  const result: TaSeriesPoint[] = [];
  let cumPv = 0;
  let cumVol = 0;
  let prevDay: number | null = null;

  for (const c of candles) {
    if (hasIntraday && prevDay !== null && c.day !== prevDay) {
      cumPv = 0;
      cumVol = 0;
    }
    prevDay = c.day;
    const tp = (c.high + c.low + c.close) / 3;
    const vol = Math.max(0, c.volume);
    cumPv += tp * vol;
    cumVol += vol;
    const vwap = cumVol > 0 ? cumPv / cumVol : tp;
    result.push({ step: c.step, value: round(vwap) });
  }
  return result;
}

function rsiArray(candles: readonly ArenaCandle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length <= period || period <= 0) {
    return out;
  }
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) {
      gainSum += diff;
    } else {
      lossSum -= diff;
    }
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function computeRsiSeries(
  candles: readonly ArenaCandle[],
  period = 14,
): readonly TaSeriesPoint[] {
  return toSeries(candles, rsiArray(candles, period));
}

function stochArrays(
  candles: readonly ArenaCandle[],
  kPeriod = 9,
  smoothK = 6,
  dPeriod = 3,
): { rawK: (number | null)[]; k: (number | null)[]; d: (number | null)[] } {
  const rawK: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < kPeriod) {
    return {
      rawK,
      k: new Array(candles.length).fill(null),
      d: new Array(candles.length).fill(null),
    };
  }
  for (let i = kPeriod - 1; i < candles.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (candles[j].high > hh) hh = candles[j].high;
      if (candles[j].low < ll) ll = candles[j].low;
    }
    const range = hh - ll;
    rawK[i] = range === 0 ? 50 : ((candles[i].close - ll) / range) * 100;
  }
  const k = smaNullable(rawK, smoothK);
  const d = smaNullable(k, dPeriod);
  return { rawK, k, d };
}

export function computeStochSeries(
  candles: readonly ArenaCandle[],
  kPeriod = 9,
  smoothK = 6,
  dPeriod = 3,
): TaStochSeries {
  const { k, d } = stochArrays(candles, kPeriod, smoothK, dPeriod);
  return {
    k: toSeries(candles, k),
    d: toSeries(candles, d),
  };
}

function stochRsiArray(
  candles: readonly ArenaCandle[],
  period = 14,
  precomputedRsi?: readonly (number | null)[],
): (number | null)[] {
  const rsi = precomputedRsi ?? rsiArray(candles, period);
  const out: (number | null)[] = new Array(candles.length).fill(null);
  const window: number[] = [];

  for (let i = 0; i < rsi.length; i++) {
    const r = rsi[i];
    if (r === null) {
      continue;
    }
    window.push(r);
    if (window.length > period) {
      window.shift();
    }
    if (window.length === period) {
      let minR = Infinity;
      let maxR = -Infinity;
      for (const v of window) {
        if (v < minR) minR = v;
        if (v > maxR) maxR = v;
      }
      const range = maxR - minR;
      out[i] = range === 0 ? 50 : ((r - minR) / range) * 100;
    }
  }
  return out;
}

function macdArrays(
  candles: readonly ArenaCandle[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
  precomputedCloses?: readonly number[],
): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const closes = precomputedCloses ?? candles.map((c) => c.close);
  const emaFast = emaValues(closes, fast);
  const emaSlow = emaValues(closes, slow);
  const macd: (number | null)[] = new Array(candles.length).fill(null);

  for (let i = 0; i < candles.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      macd[i] = emaFast[i]! - emaSlow[i]!;
    }
  }
  const signal = emaNullable(macd, signalPeriod);
  const histogram: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = 0; i < candles.length; i++) {
    if (macd[i] !== null && signal[i] !== null) {
      histogram[i] = macd[i]! - signal[i]!;
    }
  }
  return { macd, signal, histogram };
}

export function computeMacdSeries(
  candles: readonly ArenaCandle[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): TaMacdSeries {
  const { macd, signal, histogram } = macdArrays(candles, fast, slow, signalPeriod);
  return {
    macd: toSeries(candles, macd, 3),
    signal: toSeries(candles, signal, 3),
    histogram: toSeries(candles, histogram, 3),
  };
}

function adxArrays(
  candles: readonly ArenaCandle[],
  period = 14,
): {
  adx: (number | null)[];
  plusDi: (number | null)[];
  minusDi: (number | null)[];
} {
  const n = candles.length;
  const adx: (number | null)[] = new Array(n).fill(null);
  const plusDi: (number | null)[] = new Array(n).fill(null);
  const minusDi: (number | null)[] = new Array(n).fill(null);
  if (n <= period) {
    return { adx, plusDi, minusDi };
  }

  const tr: number[] = new Array(n).fill(0);
  const plusDm: number[] = new Array(n).fill(0);
  const minusDm: number[] = new Array(n).fill(0);

  for (let i = 1; i < n; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDm[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDm[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    const hl = candles[i].high - candles[i].low;
    const hc = Math.abs(candles[i].high - candles[i - 1].close);
    const lc = Math.abs(candles[i].low - candles[i - 1].close);
    tr[i] = Math.max(hl, hc, lc);
  }

  let smoothTr = 0;
  let smoothPlus = 0;
  let smoothMinus = 0;
  for (let i = 1; i <= period; i++) {
    smoothTr += tr[i];
    smoothPlus += plusDm[i];
    smoothMinus += minusDm[i];
  }

  const dx: (number | null)[] = new Array(n).fill(null);
  for (let i = period; i < n; i++) {
    if (i > period) {
      smoothTr = smoothTr - smoothTr / period + tr[i];
      smoothPlus = smoothPlus - smoothPlus / period + plusDm[i];
      smoothMinus = smoothMinus - smoothMinus / period + minusDm[i];
    }
    const pdi = smoothTr === 0 ? 0 : (100 * smoothPlus) / smoothTr;
    const mdi = smoothTr === 0 ? 0 : (100 * smoothMinus) / smoothTr;
    plusDi[i] = pdi;
    minusDi[i] = mdi;
    const sum = pdi + mdi;
    dx[i] = sum === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / sum;
  }

  const firstAdxIdx = 2 * period - 1;
  if (n > firstAdxIdx) {
    let dxSum = 0;
    for (let i = period; i <= firstAdxIdx; i++) {
      dxSum += dx[i] ?? 0;
    }
    let prevAdx = dxSum / period;
    adx[firstAdxIdx] = prevAdx;
    for (let i = firstAdxIdx + 1; i < n; i++) {
      prevAdx = (prevAdx * (period - 1) + (dx[i] ?? 0)) / period;
      adx[i] = prevAdx;
    }
  }

  return { adx, plusDi, minusDi };
}

export function computeAdxSeries(candles: readonly ArenaCandle[], period = 14): TaAdxSeries {
  const { adx, plusDi, minusDi } = adxArrays(candles, period);
  return {
    adx: toSeries(candles, adx),
    plusDi: toSeries(candles, plusDi),
    minusDi: toSeries(candles, minusDi),
  };
}

function williamsRArray(candles: readonly ArenaCandle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period) {
    return out;
  }
  for (let i = period - 1; i < candles.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (candles[j].high > hh) hh = candles[j].high;
      if (candles[j].low < ll) ll = candles[j].low;
    }
    const range = hh - ll;
    out[i] = range === 0 ? -50 : -100 * ((hh - candles[i].close) / range);
  }
  return out;
}

export function computeWilliamsRSeries(
  candles: readonly ArenaCandle[],
  period = 14,
): readonly TaSeriesPoint[] {
  return toSeries(candles, williamsRArray(candles, period));
}

function cciArray(candles: readonly ArenaCandle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period) {
    return out;
  }
  const tp = candles.map((c) => (c.high + c.low + c.close) / 3);
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += tp[j];
    }
    const mean = sum / period;
    let devSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      devSum += Math.abs(tp[j] - mean);
    }
    const md = devSum / period;
    out[i] = md === 0 ? 0 : (tp[i] - mean) / (0.015 * md);
  }
  return out;
}

export function computeCciSeries(
  candles: readonly ArenaCandle[],
  period = 14,
): readonly TaSeriesPoint[] {
  return toSeries(candles, cciArray(candles, period));
}

function atrArray(candles: readonly ArenaCandle[], period = 14): (number | null)[] {
  const n = candles.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n < period || period <= 0) {
    return out;
  }
  const tr: number[] = new Array(n).fill(0);
  tr[0] = candles[0].high - candles[0].low;
  for (let i = 1; i < n; i++) {
    const hl = candles[i].high - candles[i].low;
    const hc = Math.abs(candles[i].high - candles[i - 1].close);
    const lc = Math.abs(candles[i].low - candles[i - 1].close);
    tr[i] = Math.max(hl, hc, lc);
  }
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += tr[i];
  }
  let prev = sum / period;
  out[period - 1] = prev;
  for (let i = period; i < n; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

export function computeAtrSeries(
  candles: readonly ArenaCandle[],
  period = 14,
): readonly TaSeriesPoint[] {
  return toSeries(candles, atrArray(candles, period), 3);
}

function highsLowsArray(candles: readonly ArenaCandle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period) {
    return out;
  }
  for (let i = period - 1; i < candles.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (candles[j].high > hh) hh = candles[j].high;
      if (candles[j].low < ll) ll = candles[j].low;
    }
    out[i] = candles[i].close - (hh + ll) / 2;
  }
  return out;
}

function ultimateOscillatorArray(
  candles: readonly ArenaCandle[],
  p1 = 7,
  p2 = 14,
  p3 = 28,
): (number | null)[] {
  const n = candles.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n <= p3) {
    return out;
  }
  const bp: number[] = new Array(n).fill(0);
  const tr: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const prevClose = candles[i - 1].close;
    const minLow = Math.min(candles[i].low, prevClose);
    const maxHigh = Math.max(candles[i].high, prevClose);
    bp[i] = candles[i].close - minLow;
    tr[i] = maxHigh - minLow;
  }
  const ratio = (end: number, len: number): number => {
    let bpSum = 0;
    let trSum = 0;
    for (let j = end - len + 1; j <= end; j++) {
      bpSum += bp[j];
      trSum += tr[j];
    }
    return trSum === 0 ? 0.5 : bpSum / trSum;
  };
  for (let i = p3; i < n; i++) {
    const a1 = ratio(i, p1);
    const a2 = ratio(i, p2);
    const a3 = ratio(i, p3);
    out[i] = (100 * (4 * a1 + 2 * a2 + a3)) / 7;
  }
  return out;
}

function rocArray(candles: readonly ArenaCandle[], period = 12): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length <= period) {
    return out;
  }
  for (let i = period; i < candles.length; i++) {
    const prev = candles[i - period].close;
    out[i] = prev === 0 ? 0 : ((candles[i].close - prev) / prev) * 100;
  }
  return out;
}

function bullBearPowerArray(
  candles: readonly ArenaCandle[],
  period = 13,
  precomputedCloses?: readonly number[],
): (number | null)[] {
  const ema = emaValues(precomputedCloses ?? candles.map((c) => c.close), period);
  const out: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = 0; i < candles.length; i++) {
    const e = ema[i];
    if (e !== null) {
      out[i] = candles[i].high - e + (candles[i].low - e);
    }
  }
  return out;
}

export function computeObvSeries(candles: readonly ArenaCandle[]): readonly TaSeriesPoint[] {
  if (candles.length === 0) {
    return [];
  }
  const result: TaSeriesPoint[] = [{ step: candles[0].step, value: 0 }];
  let obv = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) {
      obv += candles[i].volume;
    } else if (candles[i].close < candles[i - 1].close) {
      obv -= candles[i].volume;
    }
    result.push({ step: candles[i].step, value: round(obv, 2) });
  }
  return result;
}

export function computeMfiSeries(
  candles: readonly ArenaCandle[],
  period = 14,
): readonly TaSeriesPoint[] {
  const n = candles.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n <= period) {
    return [];
  }
  const tp = candles.map((c) => (c.high + c.low + c.close) / 3);
  const rawMf = candles.map((c, i) => tp[i] * Math.max(0, c.volume));

  for (let i = period; i < n; i++) {
    let posFlow = 0;
    let negFlow = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (tp[j] > tp[j - 1]) {
        posFlow += rawMf[j];
      } else if (tp[j] < tp[j - 1]) {
        negFlow += rawMf[j];
      }
    }
    if (negFlow === 0) {
      out[i] = posFlow === 0 ? 50 : 100;
    } else {
      const ratio = posFlow / negFlow;
      out[i] = 100 - 100 / (1 + ratio);
    }
  }
  return toSeries(candles, out);
}

function classifyRating(buy: number, sell: number): TaSummaryRating {
  const active = buy + sell;
  if (active === 0 || buy === sell) {
    return 'neutral';
  }
  if (active >= 4 && Math.abs(buy - sell) <= 1) {
    return 'neutral';
  }
  if (buy > sell) {
    return buy >= sell * 2 && buy >= 3 ? 'strong_buy' : 'buy';
  }
  return sell >= buy * 2 && sell >= 3 ? 'strong_sell' : 'sell';
}

function buildSectionSummary(votes: readonly (TaVote | null)[]): TaSectionSummary {
  let buy = 0;
  let sell = 0;
  let neutral = 0;
  for (const v of votes) {
    if (v === 'buy') buy += 1;
    else if (v === 'sell') sell += 1;
    else if (v === 'neutral') neutral += 1;
  }
  return {
    rating: classifyRating(buy, sell),
    buy,
    sell,
    neutral,
  };
}

function extractPriorSessionBar(
  candles: readonly ArenaCandle[],
): { open: number; high: number; low: number; close: number } | null {
  if (candles.length < 2) {
    return null;
  }
  const currentDay = candles[candles.length - 1].day;
  let priorDay: number | null = null;
  for (let i = candles.length - 2; i >= 0; i--) {
    if (candles[i].day !== currentDay) {
      priorDay = candles[i].day;
      break;
    }
  }
  if (priorDay === null) {
    const prev = candles[candles.length - 2];
    return { open: prev.open, high: prev.high, low: prev.low, close: prev.close };
  }
  let open = 0;
  let high = -Infinity;
  let low = Infinity;
  let close = 0;
  let started = false;
  for (let i = 0; i < candles.length - 1; i++) {
    const c = candles[i];
    if (c.day !== priorDay) {
      continue;
    }
    if (!started) {
      open = c.open;
      started = true;
    }
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
    close = c.close;
  }
  return started ? { open, high, low, close } : null;
}

export function computePivotPoints(candles: readonly ArenaCandle[]): readonly TaPivotRow[] {
  const bar = extractPriorSessionBar(candles);
  if (!bar) {
    return [
      {
        method: 'classic',
        label: 'Классические',
        s3: null,
        s2: null,
        s1: null,
        pivot: null,
        r1: null,
        r2: null,
        r3: null,
      },
      {
        method: 'fibonacci',
        label: 'Фибоначчи',
        s3: null,
        s2: null,
        s1: null,
        pivot: null,
        r1: null,
        r2: null,
        r3: null,
      },
      {
        method: 'camarilla',
        label: 'Камарилья',
        s3: null,
        s2: null,
        s1: null,
        pivot: null,
        r1: null,
        r2: null,
        r3: null,
      },
      {
        method: 'woodie',
        label: 'Вуди',
        s3: null,
        s2: null,
        s1: null,
        pivot: null,
        r1: null,
        r2: null,
        r3: null,
      },
      {
        method: 'demark',
        label: 'ДеМарк',
        s3: null,
        s2: null,
        s1: null,
        pivot: null,
        r1: null,
        r2: null,
        r3: null,
      },
    ];
  }

  const { open: o, high: h, low: l, close: c } = bar;
  const range = h - l;

  const pClassic = (h + l + c) / 3;
  const pWoodie = (h + l + 2 * c) / 4;
  const xDemark = c < o ? h + 2 * l + c : c > o ? 2 * h + l + c : h + l + 2 * c;
  const pDemark = xDemark / 4;

  return [
    {
      method: 'classic',
      label: 'Классические',
      s3: round(l - 2 * (h - pClassic)),
      s2: round(pClassic - range),
      s1: round(2 * pClassic - h),
      pivot: round(pClassic),
      r1: round(2 * pClassic - l),
      r2: round(pClassic + range),
      r3: round(h + 2 * (pClassic - l)),
    },
    {
      method: 'fibonacci',
      label: 'Фибоначчи',
      s3: round(pClassic - range),
      s2: round(pClassic - 0.618 * range),
      s1: round(pClassic - 0.382 * range),
      pivot: round(pClassic),
      r1: round(pClassic + 0.382 * range),
      r2: round(pClassic + 0.618 * range),
      r3: round(pClassic + range),
    },
    {
      method: 'camarilla',
      label: 'Камарилья',
      s3: round(c - (range * 1.1) / 4),
      s2: round(c - (range * 1.1) / 6),
      s1: round(c - (range * 1.1) / 12),
      pivot: round(pClassic),
      r1: round(c + (range * 1.1) / 12),
      r2: round(c + (range * 1.1) / 6),
      r3: round(c + (range * 1.1) / 4),
    },
    {
      method: 'woodie',
      label: 'Вуди',
      s3: round(l - 2 * (h - pWoodie)),
      s2: round(pWoodie - range),
      s1: round(2 * pWoodie - h),
      pivot: round(pWoodie),
      r1: round(2 * pWoodie - l),
      r2: round(pWoodie + range),
      r3: round(h + 2 * (pWoodie - l)),
    },
    {
      method: 'demark',
      label: 'ДеМарк',
      s3: null,
      s2: null,
      s1: round(xDemark / 2 - h),
      pivot: round(pDemark),
      r1: round(xDemark / 2 - l),
      r2: null,
      r3: null,
    },
  ];
}

function lastOf(arr: readonly (number | null)[]): number | null {
  return arr.length > 0 ? arr[arr.length - 1] : null;
}

function classifyBoundedOscillator(
  value: number | null,
  overbought: number,
  buyAbove: number,
  sellBelow: number,
  oversold: number,
): { action: TaIndicatorAction | null; vote: TaVote | null } {
  if (value === null) {
    return { action: null, vote: null };
  }
  if (value > overbought) {
    return { action: 'overbought', vote: 'neutral' };
  }
  if (value < oversold) {
    return { action: 'oversold', vote: 'neutral' };
  }
  if (value > buyAbove) {
    return { action: 'buy', vote: 'buy' };
  }
  if (value < sellBelow) {
    return { action: 'sell', vote: 'sell' };
  }
  return { action: 'neutral', vote: 'neutral' };
}

function classifySigned(
  value: number | null,
  threshold = 0,
): { action: TaIndicatorAction | null; vote: TaVote | null } {
  if (value === null) {
    return { action: null, vote: null };
  }
  if (value > threshold) {
    return { action: 'buy', vote: 'buy' };
  }
  if (value < -threshold) {
    return { action: 'sell', vote: 'sell' };
  }
  return { action: 'neutral', vote: 'neutral' };
}

/**
 * Рассчитать полную сводку технического анализа (ru.investing.com) строго по видимым свечам
 * `candles[0..cursor]` без заглядывания вперёд (INV-1) и без привязки к датам/тикерам (INV-7).
 */
export function computeTaSummary(candles: readonly ArenaCandle[]): TaSummarySnapshot {
  const n = candles.length;
  const lastClose = n > 0 ? candles[n - 1].close : null;
  const closes = candles.map((c) => c.close);

  // 12 технических индикаторов Investing.com
  const rsiArr = rsiArray(candles, 14);
  const rsiVal = lastOf(rsiArr);
  const stochVal = lastOf(stochArrays(candles, 9, 6, 3).k);
  const stochRsiVal = lastOf(stochRsiArray(candles, 14, rsiArr));
  const macdRes = macdArrays(candles, 12, 26, 9, closes);
  const macdVal = lastOf(macdRes.macd);
  const adxRes = adxArrays(candles, 14);
  const adxVal = lastOf(adxRes.adx);
  const plusDiVal = lastOf(adxRes.plusDi);
  const minusDiVal = lastOf(adxRes.minusDi);
  const willrVal = lastOf(williamsRArray(candles, 14));
  const cciVal = lastOf(cciArray(candles, 14));
  const atrArr = atrArray(candles, 14);
  const atrVal = lastOf(atrArr);
  const highsLowsVal = lastOf(highsLowsArray(candles, 14));
  const uoVal = lastOf(ultimateOscillatorArray(candles, 7, 14, 28));
  const rocVal = lastOf(rocArray(candles, 12));
  const bullBearVal = lastOf(bullBearPowerArray(candles, 13, closes));

  const adxSignal = (): { action: TaIndicatorAction | null; vote: TaVote | null } => {
    if (adxVal === null || plusDiVal === null || minusDiVal === null) {
      return { action: null, vote: null };
    }
    if (adxVal < 20) {
      return { action: 'neutral', vote: 'neutral' };
    }
    if (plusDiVal > minusDiVal) {
      return { action: 'buy', vote: 'buy' };
    }
    if (minusDiVal > plusDiVal) {
      return { action: 'sell', vote: 'sell' };
    }
    return { action: 'neutral', vote: 'neutral' };
  };

  const atrSignal = (): { action: TaIndicatorAction | null; vote: TaVote | null } => {
    if (atrVal === null || lastClose === null || lastClose <= 0) {
      return { action: null, vote: null };
    }
    const atrPct = atrVal / lastClose;
    if (atrPct >= 0.025) {
      return { action: 'high_volatility', vote: 'neutral' };
    }
    if (atrPct <= 0.01) {
      return { action: 'low_volatility', vote: 'neutral' };
    }
    return { action: 'neutral', vote: 'neutral' };
  };

  const indicators: TaIndicatorRow[] = [
    {
      id: 'rsi',
      name: 'RSI(14)',
      value: rsiVal !== null ? round(rsiVal) : null,
      ...classifyBoundedOscillator(rsiVal, 70, 55, 45, 30),
    },
    {
      id: 'stoch',
      name: 'STOCH(9,6)',
      value: stochVal !== null ? round(stochVal) : null,
      ...classifyBoundedOscillator(stochVal, 80, 55, 45, 20),
    },
    {
      id: 'stochrsi',
      name: 'STOCHRSI(14)',
      value: stochRsiVal !== null ? round(stochRsiVal) : null,
      ...classifyBoundedOscillator(stochRsiVal, 80, 55, 45, 20),
    },
    {
      id: 'macd',
      name: 'MACD(12,26)',
      value: macdVal !== null ? round(macdVal, 3) : null,
      ...classifySigned(macdVal, 0),
    },
    {
      id: 'adx',
      name: 'ADX(14)',
      value: adxVal !== null ? round(adxVal) : null,
      ...adxSignal(),
    },
    {
      id: 'willr',
      name: 'Williams %R(14)',
      value: willrVal !== null ? round(willrVal) : null,
      ...classifyBoundedOscillator(willrVal, -20, -45, -55, -80),
    },
    {
      id: 'cci',
      name: 'CCI(14)',
      value: cciVal !== null ? round(cciVal) : null,
      ...classifySigned(cciVal, 100),
    },
    {
      id: 'atr',
      name: 'ATR(14)',
      value: atrVal !== null ? round(atrVal, 3) : null,
      ...atrSignal(),
    },
    {
      id: 'highs_lows',
      name: 'Highs/Lows(14)',
      value: highsLowsVal !== null ? round(highsLowsVal, 3) : null,
      ...classifySigned(highsLowsVal, 0),
    },
    {
      id: 'uo',
      name: 'Ultimate Oscillator',
      value: uoVal !== null ? round(uoVal) : null,
      ...classifyBoundedOscillator(uoVal, 70, 50, 50, 30),
    },
    {
      id: 'roc',
      name: 'ROC(12)',
      value: rocVal !== null ? round(rocVal) : null,
      ...classifySigned(rocVal, 0),
    },
    {
      id: 'bull_bear',
      name: 'Bull/Bear Power(13)',
      value: bullBearVal !== null ? round(bullBearVal, 3) : null,
      ...classifySigned(bullBearVal, 0),
    },
  ];

  // 12 скользящих средних (SMA + EMA для 5, 10, 20, 50, 100, 200)
  const maVotes: (TaVote | null)[] = [];
  const movingAverages: TaMovingAverageRow[] = MA_PERIODS.map((period) => {
    const smaVal = lastOf(smaValues(closes, period));
    const emaVal = lastOf(emaValues(closes, period));

    const smaAction: TaVote | null =
      smaVal === null || lastClose === null
        ? null
        : lastClose > smaVal
          ? 'buy'
          : lastClose < smaVal
            ? 'sell'
            : 'neutral';
    const emaAction: TaVote | null =
      emaVal === null || lastClose === null
        ? null
        : lastClose > emaVal
          ? 'buy'
          : lastClose < emaVal
            ? 'sell'
            : 'neutral';

    maVotes.push(smaAction, emaAction);

    return {
      period,
      label: `MA${period}`,
      sma: smaVal !== null ? round(smaVal) : null,
      smaAction,
      ema: emaVal !== null ? round(emaVal) : null,
      emaAction,
    };
  });

  const indicatorVotes = indicators.map((row) => row.vote);
  const indicatorsSummary = buildSectionSummary(indicatorVotes);
  const movingAveragesSummary = buildSectionSummary(maVotes);
  const overall = buildSectionSummary([...indicatorVotes, ...maVotes]);

  return {
    candleCount: n,
    lastClose,
    overall,
    indicatorsSummary,
    movingAveragesSummary,
    indicators,
    movingAverages,
    pivots: computePivotPoints(candles),
  };
}

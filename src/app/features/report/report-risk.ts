import { EquityCurvePoint, ReportPaperCandleSeries, ReportPaperReveal } from './data/report.models';

export const DEFAULT_VAR_CONFIDENCE = 0.95;
export const MAX_CORRELATION_PAPERS = 12;
export const MIN_RISK_RETURNS = 2;
export const LOW_SAMPLE_RETURNS = 10;

export interface PortfolioRiskMetrics {
  /** Исторический дневной VaR (95%) в % (знак отражает доходность в 5% худших шагов). */
  readonly var95Pct: number | null;
  /** Исторический дневной CVaR / Expected Shortfall (95%) в %. */
  readonly cvar95Pct: number | null;
  /** Коэффициент бета портфеля к бенчмарку IMOEX: Cov(Rp, Rm) / Var(Rm). */
  readonly betaToImoex: number | null;
  /** Корреляция Пирсона доходностей портфеля и IMOEX в диапазоне [-1, 1]. */
  readonly correlationToImoex: number | null;
  /** Число шаговых доходностей портфеля. */
  readonly sampleSize: number;
  /** Число парных шаговых доходностей с бенчмарком. */
  readonly benchmarkSampleSize: number;
  /** Малая выборка (< 10 шагов), оценка носит ориентировочный характер. */
  readonly lowSample: boolean;
}

export interface PaperCorrelationMatrix {
  readonly labels: readonly string[];
  readonly values: readonly (readonly (number | null)[])[];
  readonly totalPapers: number;
  readonly truncatedCount: number;
}

export interface CorrelationMatrixOptions {
  /** INV-7: при true всегда отображает слепые метки вместо тикеров. */
  readonly hideTickers?: boolean;
  readonly maxPapers?: number;
}

/**
 * Вычисляет безразмерные шаговые доходности r_t = (v_t - v_{t-1}) / v_{t-1}.
 * INV-6: исключительно статистическая обработка безразмерных отношений, без денежной арифметики.
 */
export function computeStepReturns(series: readonly (number | null)[]): readonly number[] {
  const returns: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const curr = series[i];
    if (
      prev !== null &&
      curr !== null &&
      Number.isFinite(prev) &&
      Number.isFinite(curr) &&
      prev > 0
    ) {
      returns.push((curr - prev) / prev);
    }
  }
  return returns;
}

/**
 * Парные шаговые доходности двух синхронных рядов (портфель и бенчмарк).
 */
export function computePairedStepReturns(
  seriesA: readonly (number | null)[],
  seriesB: readonly (number | null)[],
): { readonly a: readonly number[]; readonly b: readonly number[] } {
  const len = Math.min(seriesA.length, seriesB.length);
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 1; i < len; i++) {
    const prevA = seriesA[i - 1];
    const currA = seriesA[i];
    const prevB = seriesB[i - 1];
    const currB = seriesB[i];
    if (
      prevA !== null &&
      currA !== null &&
      prevB !== null &&
      currB !== null &&
      Number.isFinite(prevA) &&
      Number.isFinite(currA) &&
      Number.isFinite(prevB) &&
      Number.isFinite(currB) &&
      prevA > 0 &&
      prevB > 0
    ) {
      a.push((currA - prevA) / prevA);
      b.push((currB - prevB) / prevB);
    }
  }
  return { a, b };
}

/**
 * Исторические VaR и CVaR (Expected Shortfall) в процентах для заданного уровня доверия (0.95).
 * Гарантируется cvarPct <= varPct.
 */
export function computeHistoricalVarCvar(
  returns: readonly number[],
  confidence = DEFAULT_VAR_CONFIDENCE,
): { readonly varPct: number | null; readonly cvarPct: number | null } {
  if (returns.length < MIN_RISK_RETURNS || confidence <= 0 || confidence >= 1) {
    return { varPct: null, cvarPct: null };
  }
  const sorted = [...returns].sort((x, y) => x - y);
  const tailCount = Math.max(1, Math.ceil((1 - confidence) * sorted.length - 1e-12));
  const varReturn = sorted[tailCount - 1];
  let tailSum = 0;
  for (let i = 0; i < tailCount; i++) {
    tailSum += sorted[i];
  }
  const cvarReturn = tailSum / tailCount;
  return {
    varPct: varReturn * 100,
    cvarPct: cvarReturn * 100,
  };
}

/**
 * Коэффициент Пирсона r и бета Cov(x, y) / Var(y) по двум рядам одинаковой длины.
 */
export function computeBetaAndCorrelation(
  portfolioReturns: readonly number[],
  benchmarkReturns: readonly number[],
): { readonly beta: number | null; readonly correlation: number | null } {
  const n = Math.min(portfolioReturns.length, benchmarkReturns.length);
  if (n < MIN_RISK_RETURNS) {
    return { beta: null, correlation: null };
  }

  let sumP = 0;
  let sumM = 0;
  for (let i = 0; i < n; i++) {
    sumP += portfolioReturns[i];
    sumM += benchmarkReturns[i];
  }
  const meanP = sumP / n;
  const meanM = sumM / n;

  let covSum = 0;
  let varPSum = 0;
  let varMSum = 0;
  for (let i = 0; i < n; i++) {
    const dp = portfolioReturns[i] - meanP;
    const dm = benchmarkReturns[i] - meanM;
    covSum += dp * dm;
    varPSum += dp * dp;
    varMSum += dm * dm;
  }

  if (varMSum <= 1e-15) {
    return { beta: null, correlation: null };
  }
  const beta = covSum / varMSum;
  if (varPSum <= 1e-15) {
    return { beta, correlation: null };
  }
  const rawCorr = covSum / Math.sqrt(varPSum * varMSum);
  const correlation = Math.max(-1, Math.min(1, rawCorr));
  return { beta, correlation };
}

/**
 * Полный расчёт риск-метрик портфеля по кривой капитала отчёта.
 */
export function computePortfolioRisk(
  equityCurve: readonly EquityCurvePoint[],
  confidence = DEFAULT_VAR_CONFIDENCE,
): PortfolioRiskMetrics {
  const humanSeries = equityCurve.map((p) => p.humanCapitalRub);
  const benchSeries = equityCurve.map((p) => p.benchmarkCapitalRub);

  const returns = computeStepReturns(humanSeries);
  const { varPct, cvarPct } = computeHistoricalVarCvar(returns, confidence);

  const paired = computePairedStepReturns(humanSeries, benchSeries);
  const { beta, correlation } = computeBetaAndCorrelation(paired.a, paired.b);

  return {
    var95Pct: varPct,
    cvar95Pct: cvarPct,
    betaToImoex: beta,
    correlationToImoex: correlation,
    sampleSize: returns.length,
    benchmarkSampleSize: paired.a.length,
    lowSample: returns.length < LOW_SAMPLE_RETURNS,
  };
}

/**
 * INV-7: подпись бумаги в матрице корреляций.
 * Если тикеры скрыты (или тикер отсутствует), используется слепая метка.
 */
export function paperCorrelationLabel(paper: ReportPaperReveal, hideTickers: boolean): string {
  if (hideTickers || !paper.ticker.trim()) {
    return paper.blindLabel.trim() || paper.id;
  }
  return paper.ticker.trim();
}

/**
 * Строит N×N матрицу корреляций Пирсона по доходностям свечей закрытия бумаг.
 * Возвращает null, если в отчёте меньше 2 бумаг с достаточным числом свечей.
 * При числе бумаг > maxPapers (по умолчанию 12) аккуратно ограничивает вывод.
 */
export function computePaperCorrelationMatrix(
  papers: readonly ReportPaperReveal[],
  paperCandles: readonly ReportPaperCandleSeries[] | undefined,
  options: CorrelationMatrixOptions = {},
): PaperCorrelationMatrix | null {
  if (!paperCandles || paperCandles.length < 2 || papers.length < 2) {
    return null;
  }
  const maxPapers = Math.max(2, options.maxPapers ?? MAX_CORRELATION_PAPERS);
  const hideTickers = options.hideTickers ?? false;
  const candleMap = new Map<string, readonly number[]>();
  for (const series of paperCandles) {
    candleMap.set(series.paperId, series.closes);
  }

  const eligible: { readonly label: string; readonly returns: readonly number[] }[] = [];
  for (const paper of papers) {
    const closes = candleMap.get(paper.id) ?? candleMap.get(paper.ticker);
    if (!closes || closes.length < MIN_RISK_RETURNS + 1) {
      continue;
    }
    const returns = computeStepReturns(closes);
    if (returns.length >= MIN_RISK_RETURNS) {
      eligible.push({
        label: paperCorrelationLabel(paper, hideTickers),
        returns,
      });
    }
  }

  if (eligible.length < 2) {
    return null;
  }

  const totalPapers = eligible.length;
  const shown = eligible.slice(0, maxPapers);
  const truncatedCount = Math.max(0, totalPapers - shown.length);
  const n = shown.length;

  const values: (number | null)[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => null),
  );

  for (let i = 0; i < n; i++) {
    values[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const { correlation } = computeBetaAndCorrelation(shown[i].returns, shown[j].returns);
      values[i][j] = correlation;
      values[j][i] = correlation;
    }
  }

  return {
    labels: shown.map((item) => item.label),
    values,
    totalPapers,
    truncatedCount,
  };
}

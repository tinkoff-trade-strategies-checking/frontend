import { inject, Injectable } from '@angular/core';
import { Api } from '../../../api/api';
import { getReport } from '../../../api/fn/analysis/get-report';
import { Comparison } from '../../../api/models/comparison';
import { Divergence } from '../../../api/models/divergence';
import { DivergenceSummary as ApiDivergenceSummary } from '../../../api/models/divergence-summary';
import { EquityPoint } from '../../../api/models/equity-point';
import { PaperReveal } from '../../../api/models/paper-reveal';
import { ReportFill as ApiReportFill } from '../../../api/models/report-fill';
import { ReportMetrics as ApiReportMetrics } from '../../../api/models/report-metrics';
import { ReportResult } from '../../../api/models/report-result';
import { ReverseCheckTrade as ApiReverseCheckTrade } from '../../../api/models/reverse-check-trade';
import { SessionReport as ApiSessionReport } from '../../../api/models/session-report';
import { TradeAction } from '../../../api/models/trade-action';
import { UnderwaterPoint as ApiUnderwaterPoint } from '../../../api/models/underwater-point';
import { formatMoscowDateTime } from '../../../shared/stub-session-registry';
import { formatPeriod } from '../../history/data/http-history.api';
import { formatPct, formatRub } from '../report.format';
import {
  ComparisonCapitalItem,
  ComparisonPctItem,
  DivergenceSummary,
  EquityCurvePoint,
  ReportApi,
  ReportComparison,
  ReportDivergence,
  ReportFill,
  ReportMetrics,
  ReportPaperReveal,
  ReverseCheckTrade,
  SessionReport,
  SessionReportResult,
  UnderwaterPoint,
} from './report.models';

/**
 * Деньги, проценты и коэффициенты приходят строками и считаются сервером (INV-6): число нужно только
 * для отображения и осей графиков, арифметики над ним клиент не делает.
 */
const num = (value: string): number => Number(value);
const numOrNull = (value: string | null): number | null => (value === null ? null : Number(value));

const MOSCOW_DATE = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateLabel = (iso: string): string => MOSCOW_DATE.format(new Date(iso));

export function formatTradeAction(action: TradeAction): string {
  if (action.kind === 'none' || action.side === null || action.lots === null) {
    return 'Нет заявки';
  }
  const verb = action.side === 'buy' ? 'Покупка' : 'Продажа';
  const how = action.orderType === 'limit' ? 'лимитной заявкой' : 'по рынку';
  return `${verb} ${action.lots} лот. ${how}`;
}

export function mapMetrics(m: ApiReportMetrics): ReportMetrics {
  return {
    initialCapitalRub: num(m.initialCapital),
    finalCapitalRub: num(m.finalCapital),
    totalReturnPct: num(m.totalReturnPct),
    cagrPct: numOrNull(m.cagrPct),
    grossReturnPct: num(m.grossReturnPct),
    netReturnPct: num(m.netReturnPct),
    maxDrawdownPct: num(m.maxDrawdownPct),
    maxDrawdownDurationDays: m.maxDrawdownDurationDays,
    maxDrawdownDurationSteps: m.maxDrawdownDurationSteps,
    volatilityPct: numOrNull(m.volatilityPct),
    sharpe: numOrNull(m.sharpe),
    sortino: numOrNull(m.sortino),
    turnover: num(m.turnover),
    tradesCount: m.tradesCount,
    winRatePct: numOrNull(m.winRatePct),
    rejectedOrdersCount: m.rejectedOrdersCount,
    partialFillsCount: m.partialFillsCount,
    hhi: num(m.hhi),
    largestPositionPct: num(m.largestPositionPct),
    bankrupt: m.bankrupt,
    costsRub: {
      totalRub: num(m.costs.total),
      commissionRub: num(m.costs.commission),
      exchangeFeeRub: num(m.costs.exchangeFee),
      spreadRub: num(m.costs.spread),
      slippageRub: num(m.costs.slippage),
    },
    benchmarkImoexPct: numOrNull(m.benchmarkImoexPct),
  };
}

/** Подписи сравнения собирает клиент из `diff` сервера (контракт: подписи на клиенте). */
export function mapComparison(c: Comparison): ReportComparison {
  const capital = c.finalCapital;
  const diffRub = num(capital.diff);
  const finalCapital: ComparisonCapitalItem = {
    humanRub: num(capital.human),
    algoRub: num(capital.algo),
    winner: capital.winner,
    diffRub,
    diffLabel:
      capital.winner === 'tie'
        ? 'Результаты равны'
        : `${capital.winner === 'human' ? 'Вы лучше' : 'Алгоритм лучше'} на ${formatRub(Math.abs(diffRub))}`,
  };
  const pct = (
    item: Comparison['netReturn'],
    humanBetter: string,
    algoBetter: string,
    tie: string,
  ): ComparisonPctItem => {
    const diff = num(item.diffPctPoints);
    return {
      humanPct: num(item.humanPct),
      algoPct: num(item.algoPct),
      winner: item.winner,
      diffPctPoints: diff,
      diffLabel:
        item.winner === 'tie'
          ? tie
          : `${item.winner === 'human' ? humanBetter : algoBetter} ${formatPct(Math.abs(diff))}`.replace(
              ' %',
              ' п.п.',
            ),
    };
  };
  return {
    finalCapital,
    netReturn: pct(c.netReturn, 'Вы лучше на', 'Алгоритм лучше на', 'Доходность равна'),
    maxDrawdown: pct(
      c.maxDrawdown,
      'У вас просадка меньше на',
      'У алгоритма просадка меньше на',
      'Просадки равны',
    ),
  };
}

function mapEquity(point: EquityPoint): EquityCurvePoint {
  return {
    step: point.step,
    dateLabel: dateLabel(point.date),
    humanCapitalRub: num(point.humanCapital),
    algoCapitalRub: numOrNull(point.algoCapital),
    benchmarkCapitalRub: numOrNull(point.benchmarkCapital),
  };
}

function mapUnderwater(point: ApiUnderwaterPoint): UnderwaterPoint {
  return {
    step: point.step,
    dateLabel: dateLabel(point.date),
    humanDrawdownPct: num(point.humanDrawdownPct),
    algoDrawdownPct: numOrNull(point.algoDrawdownPct),
  };
}

function mapDivergence(d: Divergence): ReportDivergence {
  return {
    id: d.id,
    step: d.step,
    day: d.day,
    dateLabel: dateLabel(d.date),
    paperTicker: d.paperTicker,
    sector: d.sector,
    type: d.type,
    deltaBars: d.deltaBars,
    horizonStep: d.horizonStep,
    horizonDay: d.horizonDay,
    humanAction: formatTradeAction(d.humanAction),
    algoAction: formatTradeAction(d.algoAction),
    errorCostRub: num(d.errorCost),
    errorCostPct: num(d.errorCostPct),
    because: d.because,
  };
}

function mapSummary(s: ApiDivergenceSummary): DivergenceSummary {
  return {
    totalErrorCostRub: num(s.totalErrorCost),
    totalErrorCostPct: num(s.totalErrorCostPct),
    worstDivergenceId: s.worstDivergenceId,
    worstType: s.worstType,
    worstDay: s.worstDay,
    worstErrorCostRub: numOrNull(s.worstErrorCost),
  };
}

function mapReverse(t: ApiReverseCheckTrade): ReverseCheckTrade {
  return {
    id: t.id,
    paperTicker: t.paperTicker,
    entryStep: t.entryStep,
    entryDay: t.entryDay,
    entryDateLabel: dateLabel(t.entryDate),
    exitStep: t.exitStep,
    exitDay: t.exitDay,
    exitDateLabel: dateLabel(t.exitDate),
    lots: t.lots,
    entryPriceRub: num(t.entryPrice),
    exitPriceRub: num(t.exitPrice),
    netProfitRub: num(t.netProfit),
    entryDivergenceId: t.entryDivergenceId,
  };
}

function mapFill(f: ApiReportFill): ReportFill {
  return {
    id: f.id,
    day: f.day,
    dateLabel: dateLabel(f.date),
    paperTicker: f.paperTicker,
    side: f.side,
    orderType: f.orderType,
    lots: f.lots,
    priceRub: num(f.price),
    costRub: num(f.cost),
    partial: f.partial,
    note: null,
  };
}

function mapPaper(p: PaperReveal): ReportPaperReveal {
  return {
    id: p.id,
    blindLabel: p.blindLabel,
    ticker: p.ticker,
    name: p.name,
    sector: p.sector,
    startPriceRub: num(p.startPrice),
    lotSize: p.lotSize,
  };
}

export function mapReport(r: ApiSessionReport): SessionReport {
  return {
    sessionId: r.sessionId,
    blind: r.blind,
    finishedEarly: r.finishedEarly,
    replayAvailable: r.replayAvailable,
    playedDays: r.playedDays,
    totalDays: r.totalDays,
    timeframe: r.timeframe,
    regime: r.regime,
    createdAt: r.createdAt,
    backgroundAlgorithmName: r.backgroundAlgorithmName,
    noDividendsNote: 'без дивидендов',
    period: { ...r.period, label: formatPeriod(r.period) },
    papers: r.papers.map(mapPaper),
    humanMetrics: mapMetrics(r.humanMetrics),
    algoMetrics: r.algoMetrics === null ? null : mapMetrics(r.algoMetrics),
    comparison: r.comparison === null ? null : mapComparison(r.comparison),
    equityCurve: r.equityCurve.map(mapEquity),
    underwaterCurve: r.underwaterCurve.map(mapUnderwater),
    divergenceSummary: r.divergenceSummary === null ? null : mapSummary(r.divergenceSummary),
    divergences: r.divergences === null ? null : r.divergences.map(mapDivergence),
    reverseCheckTrades: r.reverseCheckTrades === null ? null : r.reverseCheckTrades.map(mapReverse),
    fills: r.fills.map(mapFill),
  };
}

export function mapReportResult(result: ReportResult): SessionReportResult {
  switch (result.status) {
    case 'READY':
      return { status: 'READY', report: mapReport(result.report) };
    case 'BUILDING':
      return {
        status: 'BUILDING',
        sessionId: result.sessionId,
        message: 'Отчёт собирается — страница обновится сама, когда он будет готов.',
      };
    case 'NOT_FINISHED':
      return {
        status: 'NOT_FINISHED',
        sessionId: result.sessionId,
        blind: result.blind,
        title: result.title,
        createdAt: formatMoscowDateTime(result.createdAt),
        playedDays: result.playedDays,
        totalDays: result.totalDays,
        regime: result.regime,
      };
    case 'NOT_FOUND':
      return { status: 'NOT_FOUND', sessionId: result.sessionId };
  }
}

@Injectable()
export class HttpReportApi implements ReportApi {
  private readonly api = inject(Api);

  async getReport(sessionId: string): Promise<SessionReportResult> {
    return mapReportResult(await this.api.invoke(getReport, { sessionId }));
  }
}

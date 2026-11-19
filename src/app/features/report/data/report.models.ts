import { InjectionToken } from '@angular/core';

export type ReportTimeframe = '1m' | '5m' | '10m' | '15m' | '1h' | '1d';

export type ReportRegime = 'calm' | 'medium' | 'stress';

export type ComparisonWinner = 'human' | 'algo' | 'tie';

export type DivergenceType = 'extra' | 'missed' | 'size' | 'timing';

export interface ReportPaperReveal {
  readonly id: string;
  readonly blindLabel: string;
  readonly ticker: string;
  readonly name: string;
  readonly sector: string;
  readonly startPriceRub: number;
  readonly lotSize: number;
}

export interface ReportPeriod {
  readonly startDate: string;
  readonly endDate: string;
  readonly label: string;
}

export interface ReportCostsBreakdown {
  readonly totalRub: number | null;
  readonly commissionRub: number;
  readonly exchangeFeeRub: number;
  readonly spreadRub: number;
  readonly slippageRub: number;
}

export interface ReportMetrics {
  readonly initialCapitalRub: number;
  readonly finalCapitalRub: number;
  readonly totalReturnPct: number;
  readonly cagrPct: number | null;
  readonly grossReturnPct: number;
  readonly netReturnPct: number;
  readonly maxDrawdownPct: number;
  readonly maxDrawdownDurationDays: number | null;
  readonly maxDrawdownDurationSteps: number;
  readonly volatilityPct: number | null;
  readonly sharpe: number | null;
  readonly sortino: number | null;
  readonly turnover: number;
  readonly tradesCount: number;
  readonly winRatePct: number | null;
  readonly rejectedOrdersCount: number;
  readonly partialFillsCount: number;
  readonly hhi: number;
  readonly largestPositionPct: number;
  readonly bankrupt: boolean;
  readonly costsRub: ReportCostsBreakdown;
  readonly benchmarkImoexPct: number | null;
}

export interface ComparisonCapitalItem {
  readonly humanRub: number;
  readonly algoRub: number;
  readonly winner: ComparisonWinner;
  readonly diffRub: number;
  readonly diffLabel: string;
}

export interface ComparisonPctItem {
  readonly humanPct: number;
  readonly algoPct: number;
  readonly winner: ComparisonWinner;
  readonly diffPctPoints: number;
  readonly diffLabel: string;
}

export interface ReportComparison {
  readonly finalCapital: ComparisonCapitalItem;
  readonly netReturn: ComparisonPctItem;
  readonly maxDrawdown: ComparisonPctItem;
}

export interface EquityCurvePoint {
  readonly step: number;
  readonly dateLabel: string;
  readonly humanCapitalRub: number;
  readonly algoCapitalRub: number | null;
  readonly benchmarkCapitalRub: number | null;
}

export interface UnderwaterPoint {
  readonly step: number;
  readonly dateLabel: string;
  readonly humanDrawdownPct: number;
  readonly algoDrawdownPct: number | null;
}

export interface ReportDivergence {
  readonly id: string;
  readonly step: number;
  readonly day: number;
  readonly dateLabel: string;
  readonly paperTicker: string;
  readonly sector: string;
  readonly type: DivergenceType;
  readonly deltaBars: number | null;
  readonly horizonStep: number;
  readonly horizonDay: number;
  readonly humanAction: string;
  readonly algoAction: string;
  readonly errorCostRub: number;
  readonly errorCostPct: number;
  readonly because: string | null;
}

export interface DivergenceSummary {
  readonly totalErrorCostRub: number;
  readonly totalErrorCostPct: number;
  readonly worstDivergenceId: string | null;
  readonly worstType: DivergenceType | null;
  readonly worstDay: number | null;
  readonly worstErrorCostRub: number | null;
}

export interface ReverseCheckTrade {
  readonly id: string;
  readonly paperTicker: string;
  readonly entryStep: number;
  readonly entryDay: number;
  readonly entryDateLabel: string;
  readonly exitStep: number;
  readonly exitDay: number;
  readonly exitDateLabel: string;
  readonly lots: number;
  readonly entryPriceRub: number;
  readonly exitPriceRub: number;
  readonly netProfitRub: number;
  readonly entryDivergenceId: string;
}

export interface ReportFill {
  readonly id: string;
  readonly day: number;
  readonly dateLabel: string;
  readonly paperTicker: string;
  readonly side: 'buy' | 'sell';
  readonly orderType:
    'market' | 'limit' | 'stop' | 'stop_limit' | 'take_profit' | 'trailing' | 'oco';
  readonly lots: number;
  readonly priceRub: number;
  readonly costRub: number | null;
  readonly partial: boolean;
  readonly note: string | null;
}

export interface SessionReport {
  readonly sessionId: string;
  readonly blind: boolean;
  readonly finishedEarly: boolean;
  readonly replayAvailable: boolean;
  readonly playedDays: number;
  readonly totalDays: number;
  readonly timeframe: ReportTimeframe;
  readonly regime: ReportRegime;
  readonly createdAt: string;
  readonly backgroundAlgorithmName: string | null;
  readonly noDividendsNote: string;
  readonly period: ReportPeriod;
  readonly papers: readonly ReportPaperReveal[];
  readonly humanMetrics: ReportMetrics;
  readonly algoMetrics: ReportMetrics | null;
  readonly comparison: ReportComparison | null;
  readonly equityCurve: readonly EquityCurvePoint[];
  readonly underwaterCurve: readonly UnderwaterPoint[] | null;
  readonly divergenceSummary: DivergenceSummary | null;
  readonly divergences: readonly ReportDivergence[] | null;
  readonly reverseCheckTrades: readonly ReverseCheckTrade[] | null;
  readonly fills: readonly ReportFill[];
}

export type SessionReportResult =
  | {
      readonly status: 'READY';
      readonly report: SessionReport;
    }
  | {
      readonly status: 'BUILDING';
      readonly sessionId: string;
      readonly message: string;
    }
  | {
      readonly status: 'NOT_FINISHED';
      readonly sessionId: string;
      readonly blind: boolean;
      readonly title: string;
      readonly createdAt: string;
      readonly playedDays: number;
      readonly totalDays: number;
      readonly regime: ReportRegime;
    }
  | {
      readonly status: 'NOT_FOUND';
      readonly sessionId: string;
    };

export interface ReportApi {
  getReport(sessionId: string): Promise<SessionReportResult>;
}

export const REPORT_API = new InjectionToken<ReportApi>('REPORT_API');

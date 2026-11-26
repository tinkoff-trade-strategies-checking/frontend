import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { RunEvent } from '../../../api/models/run-event';
import { OrderLegType } from '../../../api/models/order-leg-type';
import { OrderStatus } from '../../../api/models/order-status';
import {
  CandleTimeframe,
  LaunchRejectReason,
  MarketRegime,
  SessionDurationDays,
  StartMode,
} from '../../launch/data/launch.models';
import {
  ReportFill,
  ReportMetrics,
  ReportPaperReveal,
  ReportPeriod,
  ReportRegime,
  ReportRoundTrip,
  ReportTimeframe,
} from '../../report/data/report.models';
import { CheckLevel, StrategyDiagnostic } from '../../workshop/data/workshop.models';

export type RunStatus = 'queued' | 'running' | 'completed' | 'bankrupt' | 'invalid' | 'failed';

export type CreateRunRejectReason = LaunchRejectReason | 'STRATEGY_INVALID';

export interface CreateRunCommand {
  readonly strategyVersionId: string;
  readonly paramOverrides?: Readonly<Record<string, number>>;
  readonly blind: boolean;
  readonly durationDays: SessionDurationDays;
  readonly timeframe: CandleTimeframe;
  readonly regime: MarketRegime;
  readonly startMode: StartMode;
  readonly customStartDate: string | null;
  readonly paperCount: number | null;
  readonly paperIds: readonly string[] | null;
  /** Money из контракта (INV-6): десятичная строка рублей, до 2 знаков. */
  readonly initialCapital: string;
}

export type CreateRunResult =
  | {
      readonly accepted: true;
      readonly runId: string;
    }
  | {
      readonly accepted: false;
      readonly reason: CreateRunRejectReason;
      readonly field: string | null;
      readonly barsCount: number | null;
      readonly maxBars: number | null;
      readonly detail: string | null;
    };

export interface CreateCompareRunsCommand {
  readonly algorithmIds: readonly string[];
  readonly blind: boolean;
  readonly durationDays: SessionDurationDays;
  readonly timeframe: CandleTimeframe;
  readonly regime: MarketRegime;
  readonly startMode: StartMode;
  readonly customStartDate: string | null;
  readonly paperCount: number | null;
  readonly paperIds: readonly string[] | null;
  /** Money из контракта (INV-6): десятичная строка рублей, до 2 знаков. */
  readonly initialCapital: string;
}

export interface CompareRunPaper {
  readonly id: string | null;
  readonly ticker: string;
  readonly name: string;
}

export interface CompareRunItem {
  readonly algorithmId: string;
  readonly algorithmName: string;
  readonly versionId: string;
  readonly runId: string;
  readonly status: RunStatus;
}

export interface CompareRunsWindow {
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly periodLabel: string | null;
  readonly timeframe: CandleTimeframe;
  readonly durationDays: number;
  readonly initialCapitalRub: number;
  readonly blind: boolean;
  readonly papers: readonly CompareRunPaper[];
}

export type CreateCompareRunsResult =
  | {
      readonly accepted: true;
      readonly window: CompareRunsWindow;
      readonly runs: readonly CompareRunItem[];
    }
  | {
      readonly accepted: false;
      readonly reason: CreateRunRejectReason;
      readonly field: string | null;
      readonly barsCount: number | null;
      readonly maxBars: number | null;
      readonly detail: string | null;
    };

export interface RunInfo {
  readonly runId: string;
  readonly strategyVersionId: string;
  readonly algoName: string;
  readonly blind: boolean;
  readonly status: RunStatus;
  readonly doneSteps: number;
  readonly totalSteps: number | null;
  readonly repeatOfRunId: string | null;
  readonly repeatMatch: boolean | null;
  readonly lastEventId: string | null;
  readonly createdAt: string;
  readonly finishedAt: string | null;
  readonly errorCode: string | null;
  readonly diagnostics: readonly StrategyDiagnostic[];
  readonly period: ReportPeriod | null;
  readonly papers: readonly ReportPaperReveal[] | null;
}

export type RunStreamEvent = RunEvent | { readonly type: 'stream_failed'; readonly status: number };

export interface StrategyFinding {
  readonly code: string;
  readonly level: CheckLevel;
  readonly message: string;
  readonly step: number;
}

export interface RunOrder {
  readonly id: number;
  readonly paperTicker: string;
  readonly side: 'buy' | 'sell';
  readonly orderType: OrderLegType;
  readonly lots: number;
  readonly status: OrderStatus;
  readonly placedStep: number;
  readonly closedStep: number | null;
  readonly limitPrice: number | null;
  readonly stopPrice: number | null;
  readonly trailingPct: number | null;
  readonly ruleName: string;
  readonly because: string;
}

export interface RunEquityPoint {
  readonly step: number;
  readonly dateLabel: string;
  readonly capitalRub: number;
  readonly benchmarkCapitalRub: number | null;
}

export interface RunUnderwaterPoint {
  readonly step: number;
  readonly dateLabel: string;
  readonly drawdownPct: number;
}

export interface AlgoRunReport {
  readonly runId: string;
  readonly strategyVersionId: string;
  readonly algoName: string;
  readonly blind: boolean;
  readonly status: RunStatus;
  readonly playedDays: number;
  readonly totalDays: number;
  readonly timeframe: ReportTimeframe;
  readonly regime: ReportRegime;
  readonly createdAt: string;
  readonly repeatOfRunId: string | null;
  readonly repeatMatch: boolean | null;
  readonly level: CheckLevel;
  readonly findings: readonly StrategyFinding[];
  readonly diagnostics: readonly StrategyDiagnostic[];
  readonly period: ReportPeriod;
  readonly papers: readonly ReportPaperReveal[];
  readonly metrics: ReportMetrics | null;
  readonly equityCurve: readonly RunEquityPoint[];
  readonly underwaterCurve: readonly RunUnderwaterPoint[];
  readonly roundTrips: readonly ReportRoundTrip[];
  readonly fills: readonly ReportFill[];
  readonly orders: readonly RunOrder[];
}

export type RunReportResult =
  | { readonly status: 'READY'; readonly report: AlgoRunReport }
  | { readonly status: 'BUILDING'; readonly runId: string; readonly message: string }
  | { readonly status: 'NOT_FINISHED'; readonly runId: string }
  | { readonly status: 'NOT_FOUND'; readonly runId: string };

export interface RunsApi {
  createRun(command: CreateRunCommand): Promise<CreateRunResult>;
  createCompareRuns(command: CreateCompareRunsCommand): Promise<CreateCompareRunsResult>;
  getRun(runId: string): Promise<RunInfo>;
  events(runId: string, lastEventId: string | null): Observable<RunStreamEvent>;
  repeatRun(runId: string): Promise<{ readonly runId: string }>;
  getRunReport(runId: string): Promise<RunReportResult>;
}

export const RUNS_API = new InjectionToken<RunsApi>('RUNS_API');

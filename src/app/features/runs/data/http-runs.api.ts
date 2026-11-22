import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Api } from '../../../api/api';
import { ApiConfiguration } from '../../../api/api-configuration';
import { getRunReport } from '../../../api/fn/analysis/get-run-report';
import { createRun } from '../../../api/fn/simulation/create-run';
import { getRun } from '../../../api/fn/simulation/get-run';
import { repeatRun } from '../../../api/fn/simulation/repeat-run';
import { AlgoRunReport as ApiAlgoRunReport } from '../../../api/models/algo-run-report';
import { PaperReveal } from '../../../api/models/paper-reveal';
import { ReportFill as ApiReportFill } from '../../../api/models/report-fill';
import { RunEvent } from '../../../api/models/run-event';
import { RunInfo as ApiRunInfo } from '../../../api/models/run-info';
import { RunReportResult as ApiRunReportResult } from '../../../api/models/run-report-result';
import { toProblem } from '../../../core/api-problem';
import { SESSION_FETCH, sseEventStream } from '../../../core/session-events';
import { formatPeriod } from '../../history/data/http-history.api';
import { mapMetrics } from '../../report/data/http-report.api';
import { ReportFill, ReportPaperReveal } from '../../report/data/report.models';
import {
  AlgoRunReport,
  CreateRunCommand,
  CreateRunRejectReason,
  CreateRunResult,
  RunInfo,
  RunReportResult,
  RunStreamEvent,
  RunsApi,
} from './runs.models';

const REJECT_REASONS: Readonly<Record<CreateRunRejectReason, true>> = {
  NO_MATCHING_PERIOD: true,
  TOO_MANY_BARS: true,
  INVALID_PARAMS: true,
  CORPORATE_ACTION_ON_PERIOD: true,
  STRATEGY_INVALID: true,
};

function isCreateRunRejectReason(code: string | null): code is CreateRunRejectReason {
  return code !== null && Object.hasOwn(REJECT_REASONS, code);
}

const MOSCOW_DATE = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateLabel = (iso: string): string => MOSCOW_DATE.format(new Date(iso));
const num = (value: string): number => Number(value);
const numOrNull = (value: string | null | undefined): number | null =>
  value === null || value === undefined ? null : Number(value);

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

export function mapRunInfo(info: ApiRunInfo): RunInfo {
  const hideReveal = info.blind && (info.status === 'queued' || info.status === 'running');
  return {
    runId: info.runId,
    strategyVersionId: info.strategyVersionId,
    algoName: info.algoName,
    blind: info.blind,
    status: info.status,
    doneSteps: info.doneSteps,
    totalSteps: info.totalSteps,
    repeatOfRunId: info.repeatOfRunId,
    repeatMatch: info.repeatMatch,
    lastEventId: info.lastEventId,
    createdAt: info.createdAt,
    finishedAt: info.finishedAt,
    errorCode: info.errorCode,
    diagnostics: info.diagnostics ?? [],
    period:
      hideReveal || info.period === null
        ? null
        : { ...info.period, label: formatPeriod(info.period) },
    papers: hideReveal || info.papers === null ? null : info.papers.map(mapPaper),
  };
}

export function mapAlgoRunReport(r: ApiAlgoRunReport): AlgoRunReport {
  return {
    runId: r.runId,
    strategyVersionId: r.strategyVersionId,
    algoName: r.algoName,
    blind: r.blind,
    status: r.status,
    playedDays: r.playedDays,
    totalDays: r.totalDays,
    timeframe: r.timeframe,
    regime: r.regime,
    createdAt: r.createdAt,
    repeatOfRunId: r.repeatOfRunId,
    repeatMatch: r.repeatMatch,
    level: r.level,
    findings: r.findings,
    diagnostics: r.diagnostics,
    period: { ...r.period, label: formatPeriod(r.period) },
    papers: r.papers.map(mapPaper),
    metrics: r.metrics === null ? null : mapMetrics(r.metrics),
    equityCurve: r.equityCurve.map((p) => ({
      step: p.step,
      dateLabel: dateLabel(p.date),
      capitalRub: num(p.capital),
      benchmarkCapitalRub: numOrNull(p.benchmarkCapital),
    })),
    underwaterCurve: r.underwaterCurve.map((p) => ({
      step: p.step,
      dateLabel: dateLabel(p.date),
      drawdownPct: num(p.drawdownPct),
    })),
    roundTrips: r.roundTrips.map((t) => ({
      paperTicker: t.paperTicker,
      entryStep: t.entryStep,
      exitStep: t.exitStep,
      entryDateLabel: dateLabel(t.entryDate),
      exitDateLabel: dateLabel(t.exitDate),
      lots: t.lots,
      entryPriceRub: num(t.entryPrice),
      exitPriceRub: num(t.exitPrice),
      grossPnlRub: num(t.grossPnl),
      costsRub: num(t.costs),
      netPnlRub: num(t.netPnl),
    })),
    fills: r.fills.map(mapFill),
    orders: r.orders.map((o) => ({
      id: o.id,
      paperTicker: o.paperTicker,
      side: o.side,
      orderType: o.orderType,
      lots: o.lots,
      status: o.status,
      placedStep: o.placedStep,
      closedStep: o.closedStep,
      limitPrice: numOrNull(o.limitPrice),
      stopPrice: numOrNull(o.stopPrice),
      trailingPct: numOrNull(o.trailingPct),
      ruleName: o.ruleName,
      because: o.because,
    })),
  };
}

export function mapRunReportResult(result: ApiRunReportResult): RunReportResult {
  switch (result.status) {
    case 'READY':
      return { status: 'READY', report: mapAlgoRunReport(result.report) };
    case 'BUILDING':
      return {
        status: 'BUILDING',
        runId: result.runId,
        message: 'Отчёт собирается — страница обновится сама, когда он будет готов.',
      };
    case 'NOT_FINISHED':
      return { status: 'NOT_FINISHED', runId: result.runId };
    case 'NOT_FOUND':
      return { status: 'NOT_FOUND', runId: result.runId };
  }
}

@Injectable()
export class HttpRunsApi implements RunsApi {
  private readonly api = inject(Api);
  private readonly config = inject(ApiConfiguration);
  private readonly sessionFetch = inject(SESSION_FETCH);

  async createRun(command: CreateRunCommand): Promise<CreateRunResult> {
    try {
      const created = await this.api.invoke(createRun, {
        body: {
          ...command,
          paramOverrides: command.paramOverrides ? { ...command.paramOverrides } : undefined,
          paperIds: command.paperIds === null ? null : [...command.paperIds],
        },
      });
      return { accepted: true, runId: created.runId };
    } catch (error) {
      const problem = toProblem(error);
      if (problem.status === 422 && isCreateRunRejectReason(problem.code)) {
        return {
          accepted: false,
          reason: problem.code,
          field: problem.field,
          barsCount: problem.barsCount,
          maxBars: problem.maxBars,
          detail: problem.detail,
        };
      }
      throw error;
    }
  }

  async getRun(runId: string): Promise<RunInfo> {
    return mapRunInfo(await this.api.invoke(getRun, { runId }));
  }

  events(runId: string, lastEventId: string | null): Observable<RunStreamEvent> {
    const url = `${this.config.rootUrl}/runs/${encodeURIComponent(runId)}/events`;
    return sseEventStream<RunEvent>(url, lastEventId, this.sessionFetch);
  }

  async repeatRun(runId: string): Promise<{ readonly runId: string }> {
    const created = await this.api.invoke(repeatRun, { runId });
    return { runId: created.runId };
  }

  async getRunReport(runId: string): Promise<RunReportResult> {
    return mapRunReportResult(await this.api.invoke(getRunReport, { runId }));
  }
}

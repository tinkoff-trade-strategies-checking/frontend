import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ReportMetrics } from '../../report/data/report.models';
import {
  AlgoRunReport,
  CreateRunCommand,
  CreateRunResult,
  RunInfo,
  RunReportResult,
  RunStatus,
  RunStreamEvent,
  RunsApi,
} from './runs.models';

interface StubRunRecord {
  info: RunInfo;
  readonly repeatOfRunId: string | null;
  readonly blind: boolean;
}

function defaultMetrics(initialRub: number, finalRub: number, bankrupt = false): ReportMetrics {
  const netPct = Math.round(((finalRub - initialRub) / initialRub) * 10_000) / 100;
  return {
    initialCapitalRub: initialRub,
    finalCapitalRub: finalRub,
    totalReturnPct: netPct,
    cagrPct: null,
    grossReturnPct: netPct + 0.35,
    netReturnPct: netPct,
    maxDrawdownPct: bankrupt ? 100 : 4.2,
    maxDrawdownDurationDays: 6,
    maxDrawdownDurationSteps: 6,
    volatilityPct: 14.5,
    sharpe: 1.32,
    sortino: 1.85,
    turnover: 1.4,
    tradesCount: 6,
    winRatePct: 66.7,
    rejectedOrdersCount: 0,
    partialFillsCount: 0,
    stopTakeSameBarCount: 0,
    hhi: 0.38,
    largestPositionPct: 35,
    bankrupt,
    costsRub: {
      totalRub: 1250,
      commissionRub: 600,
      exchangeFeeRub: 50,
      spreadRub: 300,
      slippageRub: 300,
    },
    benchmarkImoexPct: 3.1,
  };
}

function buildStubReport(record: StubRunRecord): AlgoRunReport {
  const { info } = record;
  const isInvalidOrFailed = info.status === 'invalid' || info.status === 'failed';
  return {
    runId: info.runId,
    strategyVersionId: info.strategyVersionId,
    algoName: info.algoName,
    blind: info.blind,
    status: info.status,
    playedDays: info.doneSteps,
    totalDays: info.totalSteps ?? 60,
    timeframe: '1d',
    regime: 'calm',
    createdAt: info.createdAt,
    repeatOfRunId: info.repeatOfRunId,
    repeatMatch: info.repeatMatch,
    level: isInvalidOrFailed ? 'ERROR' : 'WARNING',
    findings: isInvalidOrFailed
      ? [
          {
            code: 'E-RT01',
            level: 'ERROR',
            message: 'Деление на ноль при расчёте индикатора.',
            step: 3,
          },
        ]
      : [
          {
            code: 'W-RT01',
            level: 'WARNING',
            message: 'Первые 14 баров пропущены на прогрев индикатора RSI.',
            step: 1,
          },
        ],
    diagnostics: info.diagnostics,
    period: info.period ?? {
      startDate: '2023-04-10',
      endDate: '2023-07-05',
      label: '10.04.2023 — 05.07.2023',
    },
    papers: info.papers ?? [
      {
        id: 'SBER',
        blindLabel: 'A',
        ticker: 'SBER',
        name: 'Сбербанк',
        sector: 'Финансы',
        startPriceRub: 245,
        lotSize: 10,
      },
      {
        id: 'LKOH',
        blindLabel: 'B',
        ticker: 'LKOH',
        name: 'ЛУКОЙЛ',
        sector: 'Нефть и газ',
        startPriceRub: 5120,
        lotSize: 1,
      },
    ],
    metrics: isInvalidOrFailed ? null : defaultMetrics(1_000_000, 1_081_500),
    equityCurve: [
      { step: 0, dateLabel: '10.04.2023', capitalRub: 1_000_000, benchmarkCapitalRub: 1_000_000 },
      { step: 30, dateLabel: '24.05.2023', capitalRub: 1_038_000, benchmarkCapitalRub: 1_015_000 },
      { step: 60, dateLabel: '05.07.2023', capitalRub: 1_081_500, benchmarkCapitalRub: 1_031_000 },
    ],
    underwaterCurve: [
      { step: 0, dateLabel: '10.04.2023', drawdownPct: 0 },
      { step: 30, dateLabel: '24.05.2023', drawdownPct: 1.8 },
      { step: 60, dateLabel: '05.07.2023', drawdownPct: 0 },
    ],
    roundTrips: [
      {
        paperTicker: 'SBER',
        entryStep: 15,
        exitStep: 42,
        entryDateLabel: '28.04.2023',
        exitDateLabel: '09.06.2023',
        lots: 50,
        entryPriceRub: 248,
        exitPriceRub: 266,
        grossPnlRub: 9000,
        costsRub: 280,
        netPnlRub: 8720,
      },
    ],
    fills: [
      {
        id: 'f-1',
        day: 15,
        dateLabel: '28.04.2023',
        paperTicker: 'SBER',
        side: 'buy',
        orderType: 'market',
        lots: 50,
        priceRub: 248,
        costRub: 140,
        partial: false,
        note: 'enter',
      },
    ],
    orders: [
      {
        id: 1,
        paperTicker: 'SBER',
        side: 'buy',
        orderType: 'market',
        lots: 50,
        status: 'filled',
        placedStep: 15,
        closedStep: 15,
        limitPrice: null,
        stopPrice: null,
        trailingPct: null,
        ruleName: 'enter_rsi',
        because: 'RSI(14) опустился ниже порога 30.',
      },
    ],
  };
}

const SEED_PERIOD = {
  startDate: '2023-04-10',
  endDate: '2023-07-05',
  label: '10.04.2023 — 05.07.2023',
};

const SEED_PAPERS = [
  {
    id: 'SBER',
    blindLabel: 'A',
    ticker: 'SBER',
    name: 'Сбербанк',
    sector: 'Финансы',
    startPriceRub: 245,
    lotSize: 10,
  },
];

function makeSeedRecord(
  runId: string,
  algoName: string,
  blind: boolean,
  status: RunStatus,
  doneSteps: number,
): StubRunRecord {
  const running = status === 'queued' || status === 'running';
  return {
    repeatOfRunId: null,
    blind,
    info: {
      runId,
      strategyVersionId: `${runId}-v1`,
      algoName,
      blind,
      status,
      doneSteps,
      totalSteps: 60,
      repeatOfRunId: null,
      repeatMatch: null,
      lastEventId: running ? '1' : '4',
      createdAt: '2026-11-18T11:30:00+03:00',
      finishedAt: running ? null : '2026-11-18T11:31:00+03:00',
      errorCode: null,
      diagnostics: [],
      period: running && blind ? null : SEED_PERIOD,
      papers: running && blind ? null : SEED_PAPERS,
    },
  };
}

@Injectable({ providedIn: 'root' })
export class StubRunsStore {
  readonly records = new Map<string, StubRunRecord>([
    ['R-0205', makeSeedRecord('R-0205', 'Momentum RSI v2', true, 'completed', 60)],
    ['R-0204', makeSeedRecord('R-0204', 'Mean Reversion Bands v1', false, 'completed', 60)],
    ['R-0203', makeSeedRecord('R-0203', 'Breakout ATR v3', true, 'running', 22)],
    ['R-0202', makeSeedRecord('R-0202', 'SMA Cross 20/50 v1', false, 'completed', 41)],
  ]);
  seq = 301;
}

function injectRunsStore(): StubRunsStore {
  try {
    return inject(StubRunsStore, { optional: true }) ?? new StubRunsStore();
  } catch {
    return new StubRunsStore();
  }
}

@Injectable()
export class StubRunsApi implements RunsApi {
  private readonly store = injectRunsStore();

  async createRun(command: CreateRunCommand): Promise<CreateRunResult> {
    if (command.strategyVersionId.includes('invalid')) {
      return {
        accepted: false,
        reason: 'STRATEGY_INVALID',
        field: 'strategyVersionId',
        barsCount: null,
        maxBars: null,
        detail: 'Стратегия содержит ошибки DSL.',
      };
    }
    const runId = `R-${String(this.store.seq++).padStart(4, '0')}`;
    const totalSteps = command.durationDays;
    this.store.records.set(runId, {
      repeatOfRunId: null,
      blind: command.blind,
      info: {
        runId,
        strategyVersionId: command.strategyVersionId,
        algoName: `Алгоритм (${command.strategyVersionId})`,
        blind: command.blind,
        status: 'running',
        doneSteps: 0,
        totalSteps,
        repeatOfRunId: null,
        repeatMatch: null,
        lastEventId: null,
        createdAt: new Date().toISOString(),
        finishedAt: null,
        errorCode: null,
        diagnostics: [],
        period: command.blind ? null : SEED_PERIOD,
        papers: command.blind ? null : SEED_PAPERS,
      },
    });
    return { accepted: true, runId };
  }

  async getRun(runId: string): Promise<RunInfo> {
    const rec = this.store.records.get(runId);
    if (!rec) {
      throw new Error(`Прогон ${runId} не найден.`);
    }
    return rec.info;
  }

  events(runId: string, lastEventId: string | null): Observable<RunStreamEvent> {
    return new Observable<RunStreamEvent>((subscriber) => {
      const rec = this.store.records.get(runId);
      if (!rec) {
        subscriber.next({ type: 'stream_failed', status: 404 });
        subscriber.complete();
        return;
      }
      let eventSeq = lastEventId === null ? 0 : Number.parseInt(lastEventId, 10) || 0;
      const nextEventId = () => String(++eventSeq);
      const totalSteps = rec.info.totalSteps ?? 60;
      if (rec.info.status !== 'queued' && rec.info.status !== 'running') {
        subscriber.next({ type: 'report_ready', eventId: nextEventId(), runId });
        subscriber.complete();
        return;
      }

      const timers: ReturnType<typeof setTimeout>[] = [];
      const half = Math.max(1, Math.floor(totalSteps / 2));

      timers.push(
        setTimeout(() => {
          const eventId = nextEventId();
          rec.info = { ...rec.info, status: 'running', doneSteps: half, lastEventId: eventId };
          subscriber.next({ type: 'run_progress', eventId, doneSteps: half, totalSteps });
        }, 10),
      );

      timers.push(
        setTimeout(() => {
          const eventId = nextEventId();
          rec.info = { ...rec.info, doneSteps: totalSteps, lastEventId: eventId };
          subscriber.next({
            type: 'run_progress',
            eventId,
            doneSteps: totalSteps,
            totalSteps,
          });
        }, 20),
      );

      timers.push(
        setTimeout(() => {
          const repeatMatch = rec.repeatOfRunId !== null ? true : null;
          const finishId = nextEventId();
          const readyId = nextEventId();
          rec.info = {
            ...rec.info,
            status: 'completed',
            doneSteps: totalSteps,
            repeatMatch,
            lastEventId: readyId,
            finishedAt: new Date().toISOString(),
            period: SEED_PERIOD,
            papers: SEED_PAPERS,
          };
          subscriber.next({
            type: 'run_finished',
            eventId: finishId,
            status: 'completed',
            repeatMatch,
          });
          subscriber.next({ type: 'report_ready', eventId: readyId, runId });
          subscriber.complete();
        }, 30),
      );

      return () => {
        for (const t of timers) {
          clearTimeout(t);
        }
      };
    });
  }

  async repeatRun(runId: string): Promise<{ readonly runId: string }> {
    const source = this.store.records.get(runId);
    const newId = `R-${String(this.store.seq++).padStart(4, '0')}`;
    const totalSteps = source?.info.totalSteps ?? 60;
    const blind = source?.blind ?? true;
    this.store.records.set(newId, {
      repeatOfRunId: runId,
      blind,
      info: {
        runId: newId,
        strategyVersionId: source?.info.strategyVersionId ?? 'A-0001-v2',
        algoName: source?.info.algoName ?? `Повтор ${runId}`,
        blind,
        status: 'running',
        doneSteps: 0,
        totalSteps,
        repeatOfRunId: runId,
        repeatMatch: null,
        lastEventId: null,
        createdAt: new Date().toISOString(),
        finishedAt: null,
        errorCode: null,
        diagnostics: [],
        period: blind ? null : SEED_PERIOD,
        papers: blind ? null : SEED_PAPERS,
      },
    });
    return { runId: newId };
  }

  async getRunReport(runId: string): Promise<RunReportResult> {
    const rec = this.store.records.get(runId);
    if (!rec) {
      return { status: 'NOT_FOUND', runId };
    }
    if (rec.info.status === 'queued' || rec.info.status === 'running') {
      return { status: 'NOT_FINISHED', runId };
    }
    return { status: 'READY', report: buildStubReport(rec) };
  }
}

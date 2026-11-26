import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ReportMetrics, ReportPaperReveal, ReportPeriod } from '../../report/data/report.models';
import {
  AlgoRunReport,
  CompareRunItem,
  CreateCompareRunsCommand,
  CreateCompareRunsResult,
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
  readonly autoAdvance?: boolean;
  readonly timeframe?: AlgoRunReport['timeframe'];
  readonly regime?: AlgoRunReport['regime'];
  readonly initialCapitalRub?: number;
  readonly finalCapitalRub?: number;
  readonly revealPeriod?: ReportPeriod;
  readonly revealPapers?: readonly ReportPaperReveal[];
}

interface SeedReportOverrides {
  readonly timeframe?: '1d' | '1h';
  readonly regime?: 'calm' | 'medium' | 'stress';
  readonly totalDays?: number;
  readonly period?: {
    readonly startDate: string;
    readonly endDate: string;
    readonly label: string;
  };
  readonly finalRub: number;
  readonly maxDrawdownPct: number;
  readonly sharpe: number | null;
  readonly sortino: number | null;
  readonly tradesCount: number;
  readonly winRatePct: number | null;
  readonly costsTotalRub: number;
  readonly equityCurve: readonly {
    readonly step: number;
    readonly dateLabel: string;
    readonly capitalRub: number;
    readonly benchmarkCapitalRub: number | null;
  }[];
}

const SEED_REPORT_OVERRIDES: Readonly<Record<string, SeedReportOverrides>> = {
  'R-0204': {
    regime: 'medium',
    period: { startDate: '2022-09-12', endDate: '2022-12-05', label: '12.09.2022 — 05.12.2022' },
    finalRub: 978_600,
    maxDrawdownPct: 6.8,
    sharpe: -0.45,
    sortino: -0.62,
    tradesCount: 9,
    winRatePct: 44.4,
    costsTotalRub: 1840,
    equityCurve: [
      { step: 0, dateLabel: '12.09.2022', capitalRub: 1_000_000, benchmarkCapitalRub: 1_000_000 },
      { step: 20, dateLabel: '10.10.2022', capitalRub: 964_000, benchmarkCapitalRub: 982_000 },
      { step: 40, dateLabel: '07.11.2022', capitalRub: 991_000, benchmarkCapitalRub: 995_000 },
      { step: 60, dateLabel: '05.12.2022', capitalRub: 978_600, benchmarkCapitalRub: 1_004_000 },
    ],
  },
  'R-0202': {
    regime: 'stress',
    period: { startDate: '2020-01-20', endDate: '2020-03-18', label: '20.01.2020 — 18.03.2020' },
    finalRub: 1_010_700,
    maxDrawdownPct: 3.1,
    sharpe: 0.58,
    sortino: 0.81,
    tradesCount: 4,
    winRatePct: 50,
    costsTotalRub: 820,
    equityCurve: [
      { step: 0, dateLabel: '20.01.2020', capitalRub: 1_000_000, benchmarkCapitalRub: 1_000_000 },
      { step: 15, dateLabel: '10.02.2020', capitalRub: 1_018_000, benchmarkCapitalRub: 990_000 },
      { step: 30, dateLabel: '03.03.2020', capitalRub: 989_000, benchmarkCapitalRub: 935_000 },
      { step: 41, dateLabel: '18.03.2020', capitalRub: 1_010_700, benchmarkCapitalRub: 912_000 },
    ],
  },
  'R-0200': {
    regime: 'calm',
    period: { startDate: '2023-07-11', endDate: '2023-10-03', label: '11.07.2023 — 03.10.2023' },
    finalRub: 1_037_400,
    maxDrawdownPct: 5.4,
    sharpe: 0.94,
    sortino: 1.29,
    tradesCount: 11,
    winRatePct: 54.5,
    costsTotalRub: 2150,
    equityCurve: [
      { step: 0, dateLabel: '11.07.2023', capitalRub: 1_000_000, benchmarkCapitalRub: 1_000_000 },
      { step: 20, dateLabel: '08.08.2023', capitalRub: 1_012_000, benchmarkCapitalRub: 1_010_000 },
      { step: 40, dateLabel: '05.09.2023', capitalRub: 1_024_500, benchmarkCapitalRub: 1_022_000 },
      { step: 60, dateLabel: '03.10.2023', capitalRub: 1_037_400, benchmarkCapitalRub: 1_028_000 },
    ],
  },
  'R-0199': {
    regime: 'stress',
    period: { startDate: '2020-02-24', endDate: '2020-05-19', label: '24.02.2020 — 19.05.2020' },
    finalRub: 15_000,
    maxDrawdownPct: 98.5,
    sharpe: -2.4,
    sortino: -2.9,
    tradesCount: 14,
    winRatePct: 21.4,
    costsTotalRub: 4600,
    equityCurve: [
      { step: 0, dateLabel: '24.02.2020', capitalRub: 1_000_000, benchmarkCapitalRub: 1_000_000 },
      { step: 6, dateLabel: '03.03.2020', capitalRub: 710_000, benchmarkCapitalRub: 960_000 },
      { step: 12, dateLabel: '12.03.2020', capitalRub: 280_000, benchmarkCapitalRub: 890_000 },
      { step: 18, dateLabel: '20.03.2020', capitalRub: 15_000, benchmarkCapitalRub: 860_000 },
    ],
  },
};

function defaultMetrics(
  initialRub: number,
  finalRub: number,
  bankrupt = false,
  overrides?: SeedReportOverrides,
): ReportMetrics {
  const netPct = Math.round(((finalRub - initialRub) / initialRub) * 10_000) / 100;
  const totalCosts = overrides?.costsTotalRub ?? 1250;
  return {
    initialCapitalRub: initialRub,
    finalCapitalRub: finalRub,
    totalReturnPct: netPct,
    cagrPct: null,
    grossReturnPct: Math.round((netPct + 0.35) * 100) / 100,
    netReturnPct: netPct,
    maxDrawdownPct: bankrupt
      ? (overrides?.maxDrawdownPct ?? 100)
      : (overrides?.maxDrawdownPct ?? 4.2),
    maxDrawdownDurationDays: 6,
    maxDrawdownDurationSteps: 6,
    volatilityPct: 14.5,
    sharpe: overrides !== undefined ? overrides.sharpe : 1.32,
    sortino: overrides !== undefined ? overrides.sortino : 1.85,
    turnover: 1.4,
    tradesCount: overrides?.tradesCount ?? 6,
    winRatePct: overrides !== undefined ? overrides.winRatePct : 66.7,
    rejectedOrdersCount: 0,
    partialFillsCount: 0,
    stopTakeSameBarCount: 0,
    hhi: 0.38,
    largestPositionPct: 35,
    bankrupt,
    costsRub: {
      totalRub: totalCosts,
      commissionRub: Math.round(totalCosts * 0.48),
      exchangeFeeRub: Math.round(totalCosts * 0.04),
      spreadRub: Math.round(totalCosts * 0.24),
      slippageRub:
        totalCosts -
        Math.round(totalCosts * 0.48) -
        Math.round(totalCosts * 0.04) -
        Math.round(totalCosts * 0.24),
    },
    benchmarkImoexPct: 3.1,
  };
}

function buildStubReport(record: StubRunRecord): AlgoRunReport {
  const { info } = record;
  const isInvalidOrFailed = info.status === 'invalid' || info.status === 'failed';
  const overrides = SEED_REPORT_OVERRIDES[info.runId];
  const initialRub = record.initialCapitalRub ?? 1_000_000;
  const finalRub = overrides?.finalRub ?? record.finalCapitalRub ?? 1_081_500;
  const period = overrides?.period ??
    info.period ??
    record.revealPeriod ?? {
      startDate: '2023-04-10',
      endDate: '2023-07-05',
      label: '10.04.2023 — 05.07.2023',
    };
  const midRub = Math.round((initialRub + finalRub) / 2);
  const totalSteps = overrides?.totalDays ?? info.totalSteps ?? 60;
  const [startLabel, endLabel] = period.label.split(' — ');
  return {
    runId: info.runId,
    strategyVersionId: info.strategyVersionId,
    algoName: info.algoName,
    blind: info.blind,
    status: info.status,
    playedDays: info.doneSteps,
    totalDays: totalSteps,
    timeframe: overrides?.timeframe ?? record.timeframe ?? '1d',
    regime: overrides?.regime ?? record.regime ?? 'calm',
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
    period,
    papers: info.papers ??
      record.revealPapers ?? [
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
    metrics: isInvalidOrFailed
      ? null
      : defaultMetrics(initialRub, finalRub, info.status === 'bankrupt', overrides),
    equityCurve: overrides?.equityCurve ?? [
      {
        step: 0,
        dateLabel: startLabel ?? '10.04.2023',
        capitalRub: initialRub,
        benchmarkCapitalRub: initialRub,
      },
      {
        step: Math.max(1, Math.floor(totalSteps / 2)),
        dateLabel: startLabel ?? '24.05.2023',
        capitalRub: midRub,
        benchmarkCapitalRub: Math.round(initialRub * 1.015),
      },
      {
        step: totalSteps,
        dateLabel: endLabel ?? '05.07.2023',
        capitalRub: finalRub,
        benchmarkCapitalRub: Math.round(initialRub * 1.031),
      },
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

function formatIsoDateRu(iso: string): string {
  const parts = iso.split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : iso;
}

function addCalendarDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return SEED_PERIOD.endDate;
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

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
    ['R-0201', makeSeedRecord('R-0201', 'Momentum RSI v2', true, 'completed', 60)],
    ['R-0200', makeSeedRecord('R-0200', 'Breakout ATR v3', true, 'completed', 60)],
    ['R-0199', makeSeedRecord('R-0199', 'Aggressive Martingale v1', false, 'bankrupt', 18)],
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

  async createCompareRuns(command: CreateCompareRunsCommand): Promise<CreateCompareRunsResult> {
    if (command.algorithmIds.length < 2 || command.algorithmIds.length > 5) {
      return {
        accepted: false,
        reason: 'INVALID_PARAMS',
        field: 'algorithmIds',
        barsCount: null,
        maxBars: null,
        detail: 'Для сравнения выберите от 2 до 5 алгоритмов.',
      };
    }

    const startDate =
      command.startMode === 'custom' && command.customStartDate
        ? command.customStartDate
        : SEED_PERIOD.startDate;
    const endDate =
      command.startMode === 'custom' && command.customStartDate
        ? addCalendarDays(command.customStartDate, Math.round(command.durationDays * 1.4))
        : SEED_PERIOD.endDate;
    const period: ReportPeriod = {
      startDate,
      endDate,
      label: `${formatIsoDateRu(startDate)} — ${formatIsoDateRu(endDate)}`,
    };

    const papers: readonly ReportPaperReveal[] =
      command.startMode === 'custom' && command.paperIds && command.paperIds.length > 0
        ? command.paperIds.map((id, idx) => ({
            id,
            blindLabel: String.fromCharCode(65 + (idx % 26)),
            ticker: id,
            name: id,
            sector: 'MOEX',
            startPriceRub: 250 + idx * 50,
            lotSize: 10,
          }))
        : [
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
          ];

    const initialCapitalRub = Number(command.initialCapital) || 1_000_000;
    const totalSteps = command.durationDays;
    const runs: CompareRunItem[] = [];
    const returnOffsets = [0.064, 0.031, -0.018, 0.092, 0.012];

    command.algorithmIds.forEach((algorithmId, index) => {
      const runId = `R-${String(this.store.seq++).padStart(4, '0')}`;
      const versionId = `${algorithmId}-v1`;
      const finalCapitalRub = Math.round(
        initialCapitalRub * (1 + returnOffsets[index % returnOffsets.length]),
      );
      this.store.records.set(runId, {
        repeatOfRunId: null,
        blind: command.blind,
        autoAdvance: true,
        timeframe: command.timeframe,
        regime: command.regime,
        initialCapitalRub,
        finalCapitalRub,
        revealPeriod: period,
        revealPapers: papers,
        info: {
          runId,
          strategyVersionId: versionId,
          algoName: `Алгоритм ${algorithmId}`,
          blind: command.blind,
          status: 'queued',
          doneSteps: 0,
          totalSteps,
          repeatOfRunId: null,
          repeatMatch: null,
          lastEventId: null,
          createdAt: new Date().toISOString(),
          finishedAt: null,
          errorCode: null,
          diagnostics: [],
          period: command.blind ? null : period,
          papers: command.blind ? null : papers,
        },
      });
      runs.push({
        algorithmId,
        algorithmName: `Алгоритм ${algorithmId}`,
        versionId,
        runId,
        status: 'queued',
      });
    });

    return {
      accepted: true,
      window: {
        startDate: command.blind ? null : period.startDate,
        endDate: command.blind ? null : period.endDate,
        periodLabel: command.blind ? null : period.label,
        timeframe: command.timeframe,
        durationDays: command.durationDays,
        initialCapitalRub,
        blind: command.blind,
        papers: command.blind
          ? papers.map((p) => ({ id: null, ticker: '', name: `Бумага ${p.blindLabel}` }))
          : papers.map((p) => ({ id: p.id, ticker: p.ticker, name: p.name })),
      },
      runs,
    };
  }

  async getRun(runId: string): Promise<RunInfo> {
    const rec = this.store.records.get(runId);
    if (!rec) {
      throw new Error(`Прогон ${runId} не найден.`);
    }
    if (rec.autoAdvance) {
      const totalSteps = rec.info.totalSteps ?? 60;
      if (rec.info.status === 'queued') {
        rec.info = {
          ...rec.info,
          status: 'running',
          doneSteps: Math.max(1, Math.floor(totalSteps / 2)),
        };
      } else if (rec.info.status === 'running') {
        rec.info = {
          ...rec.info,
          status: 'completed',
          doneSteps: totalSteps,
          finishedAt: new Date().toISOString(),
          period: rec.revealPeriod ?? SEED_PERIOD,
          papers: rec.revealPapers ?? SEED_PAPERS,
        };
      }
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

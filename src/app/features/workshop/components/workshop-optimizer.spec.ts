import { TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
import { EMPTY } from 'rxjs';
import { vi } from 'vitest';
import { LAUNCH_API } from '../../launch/data/launch.models';
import { StubLaunchApi } from '../../launch/data/stub-launch.api';
import { AlgoRunReport, RUNS_API, RunsApi } from '../../runs/data/runs.models';
import { StrategyParamDecl, WorkshopAlgorithmDetail } from '../data/workshop.models';
import {
  buildParamGrid,
  findBestOptimizerResult,
  generateParamValues,
  MAX_OPTIMIZER_COMBINATIONS,
  OptimizerResultRow,
  sortOptimizerResults,
  WorkshopOptimizer,
} from './workshop-optimizer';

const TEST_PARAMS: readonly StrategyParamDecl[] = [
  { name: 'fast', defaultValue: 20, rangeMin: 10, rangeMax: 50, step: '5', integer: true },
  { name: 'slow', defaultValue: 50, rangeMin: 30, rangeMax: 150, step: '10', integer: true },
  { name: 'stop_pct', defaultValue: 5, rangeMin: 1, rangeMax: 10, step: '0.5', integer: false },
];

const TEST_ALGO: WorkshopAlgorithmDetail = {
  id: 'A-OPT',
  name: 'SMA Cross',
  description: 'Тестовый алгоритм для подбора параметров',
  authorId: 'user',
  author: 'Вы',
  isMine: true,
  isSystem: false,
  visibility: 'public',
  latestVersion: 1,
  publishedAt: '2026-11-18T14:00:00+03:00',
  license: 'MIT',
  linterWarnings: [],
  versions: [
    {
      id: 'A-OPT-v1',
      version: 1,
      publishedAt: '2026-11-18T14:00:00+03:00',
      summary: 'v1',
      immutable: true,
      params: TEST_PARAMS,
    },
  ],
};

function makeReport(runId: string, netReturnPct: number, sharpe: number): AlgoRunReport {
  return {
    runId,
    strategyVersionId: 'A-OPT-v1',
    algoName: 'SMA Cross',
    blind: false,
    status: 'completed',
    playedDays: 60,
    totalDays: 60,
    timeframe: '1d',
    regime: 'medium',
    createdAt: '2026-11-18T14:00:00+03:00',
    repeatOfRunId: null,
    repeatMatch: null,
    level: 'OK',
    findings: [],
    diagnostics: [],
    period: { startDate: '2020-02-26', endDate: '2020-05-21', label: '26.02.2020 — 21.05.2020' },
    papers: [],
    metrics: {
      initialCapitalRub: 1_000_000,
      finalCapitalRub: Math.round(1_000_000 * (1 + netReturnPct / 100)),
      totalReturnPct: netReturnPct,
      cagrPct: null,
      grossReturnPct: netReturnPct + 0.2,
      netReturnPct,
      maxDrawdownPct: 4.5,
      maxDrawdownDurationDays: 5,
      maxDrawdownDurationSteps: 5,
      volatilityPct: 14,
      sharpe,
      sortino: sharpe * 1.2,
      turnover: 1.2,
      tradesCount: 8,
      winRatePct: 62.5,
      rejectedOrdersCount: 0,
      partialFillsCount: 0,
      hhi: 0.5,
      largestPositionPct: 50,
      bankrupt: false,
      costsRub: {
        totalRub: 1200,
        commissionRub: 700,
        exchangeFeeRub: 100,
        spreadRub: 200,
        slippageRub: 200,
      },
      benchmarkImoexPct: 2.0,
    },
    equityCurve: [],
    underwaterCurve: [],
    roundTrips: [],
    fills: [],
    orders: [],
  };
}

describe('workshop-optimizer', () => {
  it('генерирует равномерные значения параметра с учётом диапазона и шага', () => {
    const vals = generateParamValues(TEST_PARAMS[0], 5);
    expect(vals).toEqual([10, 20, 30, 40, 50]);

    const floatVals = generateParamValues(TEST_PARAMS[2], 3);
    expect(floatVals).toEqual([1, 5.5, 10]);
  });

  it('строит сетку комбинаций для 1 и 2 параметров и строго ограничивает её <= 12', () => {
    const grid1 = buildParamGrid(TEST_PARAMS, ['fast'], 5);
    expect(grid1.length).toBe(5);
    expect(grid1[0]).toEqual({ fast: 10, slow: 50, stop_pct: 5 });

    const grid2 = buildParamGrid(TEST_PARAMS, ['fast', 'slow'], 5);
    expect(grid2.length).toBeLessThanOrEqual(MAX_OPTIMIZER_COMBINATIONS);
    expect(grid2.length).toBe(12); // 4 × 3 = 12
    for (const combo of grid2) {
      expect(combo['stop_pct']).toBe(5);
    }

    // Более 2 выбранных параметров игнорируются
    const gridExtra = buildParamGrid(TEST_PARAMS, ['fast', 'slow', 'stop_pct'], 4);
    expect(gridExtra.length).toBeLessThanOrEqual(MAX_OPTIMIZER_COMBINATIONS);
  });

  it('сортирует результаты по доходности, просадке и Шарпу и выбирает лучшую комбинацию', () => {
    const rows: OptimizerResultRow[] = [
      {
        id: '1',
        params: { fast: 10 },
        status: 'completed',
        runId: 'R-1',
        netReturnPct: 3.5,
        maxDrawdownPct: 5.0,
        sharpe: 0.9,
        tradesCount: 6,
        error: null,
      },
      {
        id: '2',
        params: { fast: 20 },
        status: 'completed',
        runId: 'R-2',
        netReturnPct: 8.2,
        maxDrawdownPct: 3.1,
        sharpe: 1.7,
        tradesCount: 10,
        error: null,
      },
      {
        id: '3',
        params: { fast: 30 },
        status: 'failed',
        runId: null,
        netReturnPct: null,
        maxDrawdownPct: null,
        sharpe: null,
        tradesCount: null,
        error: 'Ошибка',
      },
    ];

    const byReturnDesc = sortOptimizerResults(rows, 'netReturnPct', 'desc');
    expect(byReturnDesc.map((r) => r.id)).toEqual(['2', '1', '3']);

    const byDdAsc = sortOptimizerResults(rows, 'maxDrawdownPct', 'asc');
    expect(byDdAsc.map((r) => r.id)).toEqual(['2', '1', '3']);

    const best = findBestOptimizerResult(rows);
    expect(best?.id).toBe('2');
  });

  it('выполняет подбор через RUNS_API, показывает прогресс, выделяет лучший результат и применяет параметры', async () => {
    let seq = 0;
    const returnsByFast: Record<number, number> = { 10: 2.1, 30: 9.4, 50: 4.0 };
    const createRunSpy = vi.fn(async (cmd: Parameters<RunsApi['createRun']>[0]) => {
      const fast = cmd.paramOverrides?.['fast'] ?? 20;
      seq += 1;
      return { accepted: true as const, runId: `R-${seq}-${fast}` };
    });

    const mockRunsApi: RunsApi = {
      createRun: createRunSpy,
      createCompareRuns: () => Promise.reject(new Error('not used')),
      getRun: async (runId) => ({
        runId,
        strategyVersionId: 'A-OPT-v1',
        algoName: 'SMA Cross',
        blind: false,
        status: 'completed',
        doneSteps: 60,
        totalSteps: 60,
        repeatOfRunId: null,
        repeatMatch: null,
        lastEventId: null,
        createdAt: '2026-11-18T14:00:00+03:00',
        finishedAt: '2026-11-18T14:00:02+03:00',
        errorCode: null,
        diagnostics: [],
        period: null,
        papers: null,
      }),
      events: () => EMPTY,
      repeatRun: () => Promise.reject(new Error('not used')),
      getRunReport: async (runId) => {
        const fast = Number(runId.split('-')[2]);
        const ret = returnsByFast[fast] ?? 1.0;
        return { status: 'READY', report: makeReport(runId, ret, ret / 5) };
      },
    };

    await TestBed.configureTestingModule({
      imports: [WorkshopOptimizer],
      providers: [
        provideTaiga(),
        { provide: LAUNCH_API, useClass: StubLaunchApi },
        { provide: RUNS_API, useValue: mockRunsApi },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkshopOptimizer);
    fixture.componentRef.setInput('algorithm', TEST_ALGO);
    let applied: Readonly<Record<string, number>> | null = null;
    fixture.componentInstance.applyParams.subscribe((p) => {
      applied = p;
    });

    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="optimizer-combo-count"]')?.textContent).toContain('3');

    const startBtn = el.querySelector<HTMLButtonElement>('[data-testid="optimizer-start-btn"]');
    expect(startBtn).not.toBeNull();
    startBtn!.click();

    await new Promise((resolve) => setTimeout(resolve, 20));
    fixture.detectChanges();

    expect(createRunSpy).toHaveBeenCalledTimes(3);
    expect(el.querySelector('[data-testid="optimizer-progress"]')?.textContent).toContain(
      'Выполнено 3 из 3',
    );
    const bestRow = el.querySelector('tr[data-best="true"]');
    expect(bestRow).not.toBeNull();
    expect(bestRow?.textContent).toContain('fast = 30');
    expect(bestRow?.textContent).toContain('+9,40 %');

    const applyBestBtn = el.querySelector<HTMLButtonElement>(
      '[data-testid="optimizer-apply-best"]',
    );
    expect(applyBestBtn).not.toBeNull();
    applyBestBtn!.click();
    expect(applied).toEqual({ fast: 30, slow: 50, stop_pct: 5 });
  });
});

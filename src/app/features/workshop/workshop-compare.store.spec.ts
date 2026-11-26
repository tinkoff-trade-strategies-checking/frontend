import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { HISTORY_API, HistoryApi, HistoryPage } from '../history/data/history.models';
import { StubHistoryApi } from '../history/data/stub-history.api';
import { RUNS_API, RunsApi } from '../runs/data/runs.models';
import { StubRunsApi } from '../runs/data/stub-runs.api';
import { StubWorkshopApi } from './data/stub-workshop.api';
import { WORKSHOP_API } from './data/workshop.models';
import { COMPARE_POLL_INTERVAL_MS, WorkshopCompareStore } from './workshop-compare.store';

describe('WorkshopCompareStore', () => {
  function setup(overrides?: { historyApi?: HistoryApi; runsApi?: RunsApi }): WorkshopCompareStore {
    TestBed.configureTestingModule({
      providers: [
        { provide: WORKSHOP_API, useClass: StubWorkshopApi },
        { provide: HISTORY_API, useValue: overrides?.historyApi ?? new StubHistoryApi() },
        { provide: RUNS_API, useValue: overrides?.runsApi ?? new StubRunsApi() },
        { provide: COMPARE_POLL_INTERVAL_MS, useValue: 0 },
        WorkshopCompareStore,
      ],
    });
    return TestBed.inject(WorkshopCompareStore);
  }

  it('загружает метрики последнего завершённого прогона, отмечает отсутствие прогона и разные периоды', async () => {
    const store = setup();
    await store.load(['A-0002', 'A-0003', 'A-0001', 'A-UNKNOWN']);

    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.entries().map((e) => `${e.id}:${e.status}`)).toEqual([
      'A-0002:ready',
      'A-0003:ready',
      'A-0001:no_run',
      'A-UNKNOWN:not_found',
    ]);

    const ready = store.readyEntries();
    expect(ready[0].runId).toBe('R-0205');
    expect(ready[1].runId).toBe('R-0200');
    expect(store.hasDifferentContexts()).toBe(true);
    expect(store.chartSeries().length).toBe(2);

    const best = store.bestByMetric();
    expect(best.netReturnPct).toBe('A-0002');
    expect(best.maxDrawdownPct).toBe('A-0002');
    expect(best.sharpe).toBe('A-0002');
    expect(best.costsTotalRub).toBe('A-0002');
  });

  it('удаляет алгоритм из сравнения и пересчитывает серии и лучшие значения', async () => {
    const store = setup();
    await store.load(['A-0002', 'A-0003', 'A-0006']);

    expect(store.entries().length).toBe(3);
    const remaining = store.removeAlgorithm('A-0002');
    expect(remaining).toEqual(['A-0003', 'A-0006']);
    expect(store.bestByMetric().netReturnPct).toBe('A-0003');
    expect(store.bestByMetric().maxDrawdownPct).toBe('A-0006');
  });

  it('защищён от гонки: более ранний запрос не перезаписывает новый результат', async () => {
    let resolveSlow!: (page: HistoryPage) => void;
    let call = 0;
    const baseHistory = new StubHistoryApi();
    const slowHistory: HistoryApi = {
      list(query) {
        call++;
        if (call === 1) {
          return new Promise<HistoryPage>((resolve) => {
            resolveSlow = resolve;
          });
        }
        return baseHistory.list(query);
      },
    };
    const store = setup({ historyApi: slowHistory });

    const first = store.load(['A-0002', 'A-0003']);
    const second = store.load(['A-0006']);
    await second;

    resolveSlow({ items: [], total: 0, page: 1, pageSize: 100, totalPages: 1 });
    await first;

    expect(store.entries().map((e) => e.id)).toEqual(['A-0006']);
    expect(store.readyEntries()[0].runId).toBe('R-0202');
  });

  it('учитывает различие таймфрейма в hasDifferentContexts даже при совпадающем периоде и бумагах', async () => {
    const baseRuns = new StubRunsApi();
    const samePeriodDiffTfRuns: RunsApi = {
      ...baseRuns,
      createRun: baseRuns.createRun.bind(baseRuns),
      createCompareRuns: baseRuns.createCompareRuns.bind(baseRuns),
      getRun: baseRuns.getRun.bind(baseRuns),
      events: baseRuns.events.bind(baseRuns),
      repeatRun: baseRuns.repeatRun.bind(baseRuns),
      async getRunReport(runId) {
        const res = await baseRuns.getRunReport(runId);
        if (res.status !== 'READY') {
          return res;
        }
        return {
          status: 'READY',
          report: {
            ...res.report,
            timeframe: runId === 'R-0205' ? '1d' : '1h',
            period: {
              startDate: '2023-04-10',
              endDate: '2023-07-05',
              label: '10.04.2023 — 05.07.2023',
            },
            papers: res.report.papers.slice(0, 1),
          },
        };
      },
    };
    const store = setup({ runsApi: samePeriodDiffTfRuns });
    await store.load(['A-0002', 'A-0003']);

    expect(store.hasDifferentContexts()).toBe(true);
  });

  it('при ошибке загрузки очищает прежние entries, выставляет error и сбрасывает loading', async () => {
    let shouldFail = false;
    const baseHistory = new StubHistoryApi();
    const flakyHistory: HistoryApi = {
      list: vi.fn((q) =>
        shouldFail ? Promise.reject(new Error('network down')) : baseHistory.list(q),
      ),
    };
    const store = setup({ historyApi: flakyHistory });

    await store.load(['A-0002', 'A-0003']);
    expect(store.entries().length).toBe(2);

    shouldFail = true;
    await store.load(['A-0002', 'A-0003']);
    expect(store.loading()).toBe(false);
    expect(store.entries()).toEqual([]);
    expect(store.error()).toBe('Не удалось загрузить данные для сравнения.');
  });

  it('launchBatch запускает алгоритмы на едином отрезке, опрашивает до завершения и формирует sharedContext', async () => {
    const store = setup();
    await store.load(['A-0002', 'A-0003']);
    expect(store.hasDifferentContexts()).toBe(true);
    expect(store.sharedContext()).toBeNull();

    const runIds = await store.launchBatch({
      blind: false,
      durationDays: 60,
      timeframe: '1d',
      regime: 'medium',
      startMode: 'random',
      customStartDate: null,
      paperCount: 2,
      paperIds: null,
      initialCapital: '1000000.00',
    });

    expect(runIds).not.toBeNull();
    expect(runIds).toHaveLength(2);
    expect(store.batchRunning()).toBe(false);
    expect(store.activeRunIds()).toEqual(runIds);
    expect(store.hasDifferentContexts()).toBe(false);

    const shared = store.sharedContext();
    expect(shared).not.toBeNull();
    expect(shared?.timeframe).toBe('1d');
    expect(shared?.papers).toEqual(['SBER', 'LKOH']);
    expect(store.readyEntries().map((e) => e.runId)).toEqual(runIds);
  });

  it('load с явными runIds восстанавливает точное сравнение на одном отрезке после перезагрузки', async () => {
    const stubRuns = new StubRunsApi();
    const store = setup({ runsApi: stubRuns });
    await store.load(['A-0002', 'A-0003']);

    const runIds = await store.launchBatch({
      blind: false,
      durationDays: 60,
      timeframe: '1d',
      regime: 'calm',
      startMode: 'custom',
      customStartDate: '2023-06-01',
      paperCount: null,
      paperIds: ['SBER', 'GAZP'],
      initialCapital: '1000000.00',
    });
    expect(runIds).toHaveLength(2);

    // Имитируем повторную загрузку страницы с ?ids=...&runIds=...
    await store.load(['A-0002', 'A-0003'], runIds ?? []);
    expect(store.loading()).toBe(false);
    expect(store.activeRunIds()).toEqual(runIds);
    expect(store.hasDifferentContexts()).toBe(false);
    expect(store.sharedContext()?.papers).toEqual(['SBER', 'GAZP']);
    expect(store.readyEntries().map((e) => e.runId)).toEqual(runIds);
  });

  it('launchBatch при отказе 422 выставляет batchRejection и снимает batchRunning', async () => {
    const baseRuns = new StubRunsApi();
    const rejectingRuns: RunsApi = {
      ...baseRuns,
      createRun: baseRuns.createRun.bind(baseRuns),
      getRun: baseRuns.getRun.bind(baseRuns),
      events: baseRuns.events.bind(baseRuns),
      repeatRun: baseRuns.repeatRun.bind(baseRuns),
      getRunReport: baseRuns.getRunReport.bind(baseRuns),
      createCompareRuns: async () => ({
        accepted: false,
        reason: 'NO_MATCHING_PERIOD',
        field: 'regime',
        barsCount: null,
        maxBars: null,
        detail: 'Нет подходящего окна',
      }),
    };
    const store = setup({ runsApi: rejectingRuns });
    await store.load(['A-0002', 'A-0003']);

    const runIds = await store.launchBatch({
      blind: false,
      durationDays: 60,
      timeframe: '1d',
      regime: 'stress',
      startMode: 'random',
      customStartDate: null,
      paperCount: 3,
      paperIds: null,
      initialCapital: '1000000.00',
    });

    expect(runIds).toBeNull();
    expect(store.batchRunning()).toBe(false);
    expect(store.batchRejection()).not.toBeNull();
  });
});

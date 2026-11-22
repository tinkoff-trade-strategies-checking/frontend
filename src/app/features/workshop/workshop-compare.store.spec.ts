import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { HISTORY_API, HistoryApi, HistoryPage } from '../history/data/history.models';
import { StubHistoryApi } from '../history/data/stub-history.api';
import { RUNS_API, RunsApi } from '../runs/data/runs.models';
import { StubRunsApi } from '../runs/data/stub-runs.api';
import { StubWorkshopApi } from './data/stub-workshop.api';
import { WORKSHOP_API } from './data/workshop.models';
import { WorkshopCompareStore } from './workshop-compare.store';

describe('WorkshopCompareStore', () => {
  function setup(overrides?: { historyApi?: HistoryApi; runsApi?: RunsApi }): WorkshopCompareStore {
    TestBed.configureTestingModule({
      providers: [
        { provide: WORKSHOP_API, useClass: StubWorkshopApi },
        { provide: HISTORY_API, useValue: overrides?.historyApi ?? new StubHistoryApi() },
        { provide: RUNS_API, useValue: overrides?.runsApi ?? new StubRunsApi() },
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

  it('при ошибке загрузки выставляет error и сбрасывает loading', async () => {
    const failingHistory: HistoryApi = {
      list: vi.fn().mockRejectedValue(new Error('network down')),
    };
    const store = setup({ historyApi: failingHistory });

    await store.load(['A-0002', 'A-0003']);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('Не удалось загрузить данные для сравнения.');
  });
});

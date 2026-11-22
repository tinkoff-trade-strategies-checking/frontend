import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { RUNS_API, RunReportResult, RunsApi } from './data/runs.models';
import { StubRunsApi } from './data/stub-runs.api';
import { RunReportStore } from './run-report.store';

describe('RunReportStore', () => {
  afterEach(() => vi.useRealTimers());

  it('опрашивает отчёт при BUILDING каждые pollIntervalMs до READY и маппит графики с algo=null', async () => {
    vi.useFakeTimers();
    const ready = await new StubRunsApi().getRunReport('R-0205');
    const building: RunReportResult = {
      status: 'BUILDING',
      runId: 'R-0205',
      message: 'Отчёт собирается',
    };
    const getRunReport = vi
      .fn<RunsApi['getRunReport']>()
      .mockResolvedValueOnce(building)
      .mockResolvedValueOnce(building)
      .mockResolvedValue(ready);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: RUNS_API,
          useValue: {
            getRunReport,
            getRun: vi.fn(),
            createRun: vi.fn(),
            events: vi.fn(),
            repeatRun: vi.fn(),
          },
        },
        RunReportStore,
      ],
    });

    const store = TestBed.inject(RunReportStore);
    store.pollIntervalMs = 1000;

    await store.load('R-0205');
    expect(store.result()?.status).toBe('BUILDING');

    await vi.advanceTimersByTimeAsync(1000);
    expect(store.result()?.status).toBe('BUILDING');
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.result()?.status).toBe('READY');
    expect(getRunReport).toHaveBeenCalledTimes(3);

    expect(store.equityPoints().length).toBeGreaterThan(0);
    expect(store.equityPoints().every((p) => p.algoCapitalRub === null)).toBe(true);
    expect(store.underwaterPoints().every((p) => p.algoDrawdownPct === null)).toBe(true);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(getRunReport).toHaveBeenCalledTimes(3);
  });

  it('смена прогона останавливает прежний polling, а 3 сетевые ошибки подряд выводят error', async () => {
    vi.useFakeTimers();
    const building: RunReportResult = {
      status: 'BUILDING',
      runId: 'R-1',
      message: 'Собирается',
    };
    const notFound: RunReportResult = { status: 'NOT_FOUND', runId: 'R-2' };
    const getRunReport = vi
      .fn<RunsApi['getRunReport']>()
      .mockResolvedValueOnce(building)
      .mockResolvedValueOnce(notFound)
      .mockResolvedValueOnce(building)
      .mockRejectedValue(new Error('network'));

    TestBed.configureTestingModule({
      providers: [
        {
          provide: RUNS_API,
          useValue: {
            getRunReport,
            getRun: vi.fn(),
            createRun: vi.fn(),
            events: vi.fn(),
            repeatRun: vi.fn(),
          },
        },
        RunReportStore,
      ],
    });

    const store = TestBed.inject(RunReportStore);
    store.pollIntervalMs = 1000;

    await store.load('R-1');
    await store.load('R-2');
    await vi.advanceTimersByTimeAsync(5000);
    expect(store.result()?.status).toBe('NOT_FOUND');

    await store.load('R-3');
    await vi.advanceTimersByTimeAsync(5000);
    expect(store.error()).toBeTruthy();
  });

  it('не запускает polling после уничтожения стора, если getRunReport(BUILDING) завершился позже', async () => {
    vi.useFakeTimers();
    let resolveReport!: (res: RunReportResult) => void;
    const getRunReport = vi.fn<RunsApi['getRunReport']>().mockImplementation(
      () =>
        new Promise<RunReportResult>((resolve) => {
          resolveReport = resolve;
        }),
    );

    TestBed.configureTestingModule({
      providers: [
        {
          provide: RUNS_API,
          useValue: {
            getRunReport,
            getRun: vi.fn(),
            createRun: vi.fn(),
            events: vi.fn(),
            repeatRun: vi.fn(),
          },
        },
        RunReportStore,
      ],
    });

    const store = TestBed.inject(RunReportStore);
    store.pollIntervalMs = 500;
    const loadPromise = store.load('R-BUILD');
    TestBed.resetTestingModule();

    resolveReport({ status: 'BUILDING', runId: 'R-BUILD', message: 'Собирается' });
    await loadPromise;
    await vi.advanceTimersByTimeAsync(2000);

    expect(getRunReport).toHaveBeenCalledTimes(1);
    expect(store.result()).toBeNull();
  });
});

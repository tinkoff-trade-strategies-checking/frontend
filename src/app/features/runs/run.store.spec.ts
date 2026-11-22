import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { RUNS_API, RunInfo, RunsApi, RunStreamEvent } from './data/runs.models';
import { StubRunsApi } from './data/stub-runs.api';
import { RunStore } from './run.store';

describe('RunStore', () => {
  it('обновляет прогресс по SSE run_progress, перечитывает на run_finished и активирует reportReady на report_ready', async () => {
    const events$ = new Subject<RunStreamEvent>();
    const running: RunInfo = {
      runId: 'R-1',
      strategyVersionId: 'v1',
      algoName: 'Test Algo',
      blind: true,
      status: 'running',
      doneSteps: 5,
      totalSteps: 20,
      repeatOfRunId: null,
      repeatMatch: null,
      lastEventId: '1',
      createdAt: '2026-11-18T11:30:00+03:00',
      finishedAt: null,
      errorCode: null,
      diagnostics: [],
      period: null,
      papers: null,
    };
    const finished: RunInfo = {
      ...running,
      status: 'completed',
      doneSteps: 20,
      finishedAt: '2026-11-18T11:31:00+03:00',
      period: {
        startDate: '2023-04-10',
        endDate: '2023-07-05',
        label: '10.04.2023 — 05.07.2023',
      },
      papers: [
        {
          id: 'SBER',
          blindLabel: 'A',
          ticker: 'SBER',
          name: 'Сбербанк',
          sector: 'Финансы',
          startPriceRub: 245,
          lotSize: 10,
        },
      ],
    };

    const getRun = vi
      .fn<RunsApi['getRun']>()
      .mockResolvedValueOnce(running)
      .mockResolvedValueOnce(finished);
    const events = vi.fn<RunsApi['events']>().mockReturnValue(events$.asObservable());

    TestBed.configureTestingModule({
      providers: [
        {
          provide: RUNS_API,
          useValue: {
            getRun,
            events,
            createRun: vi.fn(),
            repeatRun: vi.fn(),
            getRunReport: vi.fn(),
          },
        },
        RunStore,
      ],
    });

    const store = TestBed.inject(RunStore);
    await store.load('R-1');
    expect(store.run()?.doneSteps).toBe(5);
    expect(store.progressPct()).toBe(25);
    expect(store.isTerminal()).toBe(false);
    expect(events).toHaveBeenCalledWith('R-1', '1');

    events$.next({ type: 'run_progress', eventId: '2', doneSteps: 10, totalSteps: 20 });
    expect(store.run()?.doneSteps).toBe(10);
    expect(store.progressPct()).toBe(50);

    events$.next({ type: 'run_finished', eventId: '3', status: 'completed', repeatMatch: null });
    await Promise.resolve();
    await Promise.resolve();
    expect(getRun).toHaveBeenCalledTimes(2);
    expect(store.run()?.period?.label).toBe('10.04.2023 — 05.07.2023');
    expect(store.isTerminal()).toBe(true);

    events$.next({ type: 'report_ready', eventId: '4', runId: 'R-1' });
    expect(store.reportReady()).toBe(true);
  });

  it('перечитывает прогон при run_failed и фиксирует ошибку потока при stream_failed', async () => {
    const events$ = new Subject<RunStreamEvent>();
    const running: RunInfo = {
      runId: 'R-2',
      strategyVersionId: 'v1',
      algoName: 'Fail Algo',
      blind: false,
      status: 'queued',
      doneSteps: 0,
      totalSteps: 10,
      repeatOfRunId: null,
      repeatMatch: null,
      lastEventId: null,
      createdAt: '2026-11-18T11:30:00+03:00',
      finishedAt: null,
      errorCode: null,
      diagnostics: [],
      period: null,
      papers: null,
    };
    const failed: RunInfo = {
      ...running,
      status: 'failed',
      errorCode: 'E-RT01',
    };
    const getRun = vi
      .fn<RunsApi['getRun']>()
      .mockResolvedValueOnce(running)
      .mockResolvedValueOnce(failed);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: RUNS_API,
          useValue: {
            getRun,
            events: () => events$.asObservable(),
            createRun: vi.fn(),
            repeatRun: vi.fn(),
            getRunReport: vi.fn(),
          },
        },
        RunStore,
      ],
    });

    const store = TestBed.inject(RunStore);
    await store.load('R-2');
    events$.next({ type: 'run_failed', eventId: '1', errorCode: 'E-RT01' });
    await Promise.resolve();
    await Promise.resolve();
    expect(store.run()?.status).toBe('failed');
    expect(store.run()?.errorCode).toBe('E-RT01');

    events$.next({ type: 'stream_failed', status: 404 });
    expect(store.streamError()).toBeTruthy();
  });

  it('repeat вызывает repeatRun и возвращает новый runId', async () => {
    const stub = new StubRunsApi();
    TestBed.configureTestingModule({
      providers: [{ provide: RUNS_API, useValue: stub }, RunStore],
    });
    const store = TestBed.inject(RunStore);
    const spy = vi.spyOn(stub, 'repeatRun');
    const newId = await store.repeat('R-0205');
    expect(spy).toHaveBeenCalledWith('R-0205');
    expect(newId).toMatch(/^R-\d{4}$/);
  });

  it('не открывает SSE для уже завершённого прогона', async () => {
    const stub = new StubRunsApi();
    const eventsSpy = vi.spyOn(stub, 'events').mockReturnValue(of());
    TestBed.configureTestingModule({
      providers: [{ provide: RUNS_API, useValue: stub }, RunStore],
    });
    const store = TestBed.inject(RunStore);
    await store.load('R-0205');
    expect(eventsSpy).not.toHaveBeenCalled();
    expect(store.isTerminal()).toBe(true);
  });

  it('не открывает SSE если стор уничтожен пока getRun ещё в полёте', async () => {
    let resolveRun!: (info: RunInfo) => void;
    const getRun = vi.fn<RunsApi['getRun']>().mockImplementation(
      () =>
        new Promise<RunInfo>((resolve) => {
          resolveRun = resolve;
        }),
    );
    const events = vi.fn<RunsApi['events']>().mockReturnValue(of());

    TestBed.configureTestingModule({
      providers: [
        {
          provide: RUNS_API,
          useValue: {
            getRun,
            events,
            createRun: vi.fn(),
            repeatRun: vi.fn(),
            getRunReport: vi.fn(),
          },
        },
        RunStore,
      ],
    });

    const store = TestBed.inject(RunStore);
    const loadPromise = store.load('R-INFLIGHT');
    TestBed.resetTestingModule();

    resolveRun({
      runId: 'R-INFLIGHT',
      strategyVersionId: 'v1',
      algoName: 'Inflight Algo',
      blind: false,
      status: 'running',
      doneSteps: 1,
      totalSteps: 10,
      repeatOfRunId: null,
      repeatMatch: null,
      lastEventId: null,
      createdAt: '2026-11-18T11:30:00+03:00',
      finishedAt: null,
      errorCode: null,
      diagnostics: [],
      period: null,
      papers: null,
    });
    await loadPromise;

    expect(events).not.toHaveBeenCalled();
    expect(store.run()).toBeNull();
  });
});

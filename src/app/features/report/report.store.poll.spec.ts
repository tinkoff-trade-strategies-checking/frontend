import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { REPORT_API, ReportApi, SessionReportResult } from './data/report.models';
import { StubReportApi } from './data/stub-report.api';
import { ReportStore } from './report.store';

describe('ReportStore: отчёт ещё собирается (BUILDING)', () => {
  afterEach(() => vi.useRealTimers());

  it('перечитывает отчёт, пока он не станет READY, и останавливается', async () => {
    vi.useFakeTimers();
    const ready = await new StubReportApi().getReport('S-0103');
    const building: SessionReportResult = {
      status: 'BUILDING',
      sessionId: 'S-0103',
      message: 'Отчёт собирается',
    };
    const getReport = vi
      .fn<ReportApi['getReport']>()
      .mockResolvedValueOnce(building)
      .mockResolvedValueOnce(building)
      .mockResolvedValue(ready);
    TestBed.configureTestingModule({
      providers: [{ provide: REPORT_API, useValue: { getReport } }, ReportStore],
    });
    const store = TestBed.inject(ReportStore);
    store.pollIntervalMs = 1000;

    await store.load('S-0103');
    expect(store.result()?.status).toBe('BUILDING');

    await vi.advanceTimersByTimeAsync(1000);
    expect(store.result()?.status).toBe('BUILDING');
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.result()?.status).toBe('READY');
    expect(getReport).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(getReport).toHaveBeenCalledTimes(3);
  });

  it('смена сессии останавливает опрос прежней', async () => {
    vi.useFakeTimers();
    const building: SessionReportResult = {
      status: 'BUILDING',
      sessionId: 'a',
      message: 'Отчёт собирается',
    };
    const notFound: SessionReportResult = { status: 'NOT_FOUND', sessionId: 'b' };
    const getReport = vi
      .fn<ReportApi['getReport']>()
      .mockResolvedValueOnce(building)
      .mockResolvedValue(notFound);
    TestBed.configureTestingModule({
      providers: [{ provide: REPORT_API, useValue: { getReport } }, ReportStore],
    });
    const store = TestBed.inject(ReportStore);
    await store.load('a');
    await store.load('b');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(store.result()?.status).toBe('NOT_FOUND');
    expect(getReport).toHaveBeenCalledTimes(2);
  });

  it('одиночный сбой сети при опросе не останавливает его; три подряд — останавливают с ошибкой', async () => {
    vi.useFakeTimers();
    const building: SessionReportResult = {
      status: 'BUILDING',
      sessionId: 'a',
      message: 'Отчёт собирается',
    };
    const notFound: SessionReportResult = { status: 'NOT_FOUND', sessionId: 'a' };
    const getReport = vi
      .fn<ReportApi['getReport']>()
      .mockResolvedValueOnce(building)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(notFound);
    TestBed.configureTestingModule({
      providers: [{ provide: REPORT_API, useValue: { getReport } }, ReportStore],
    });
    const store = TestBed.inject(ReportStore);
    store.pollIntervalMs = 1000;
    await store.load('a');
    await vi.advanceTimersByTimeAsync(3000);
    expect(store.result()?.status).toBe('NOT_FOUND');
    expect(store.error()).toBeNull();

    const failing = vi
      .fn<ReportApi['getReport']>()
      .mockResolvedValueOnce(building)
      .mockRejectedValue(new Error('network'));
    const store2 = TestBed.inject(ReportStore);
    (store2 as unknown as { api: ReportApi }).api = { getReport: failing };
    await store2.load('a');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(failing).toHaveBeenCalledTimes(4);
    expect(store2.error()).toBeTruthy();
  });

  it('не запускает polling если стор уничтожен пока getReport в полёте', async () => {
    vi.useFakeTimers();
    let resolveReport!: (res: SessionReportResult) => void;
    const getReport = vi.fn<ReportApi['getReport']>().mockImplementation(
      () =>
        new Promise<SessionReportResult>((resolve) => {
          resolveReport = resolve;
        }),
    );

    TestBed.configureTestingModule({
      providers: [{ provide: REPORT_API, useValue: { getReport } }, ReportStore],
    });
    const store = TestBed.inject(ReportStore);
    store.pollIntervalMs = 1000;

    const loadPromise = store.load('S-INFLIGHT');
    TestBed.resetTestingModule();

    resolveReport({
      status: 'BUILDING',
      sessionId: 'S-INFLIGHT',
      message: 'Отчёт собирается',
    });
    await loadPromise;

    await vi.advanceTimersByTimeAsync(10_000);
    expect(getReport).toHaveBeenCalledTimes(1);
    expect(store.result()).toBeNull();
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SESSION_FETCH, SessionFetch } from '../../../core/session-events';
import { HttpRunsApi } from './http-runs.api';
import { RunStreamEvent } from './runs.models';

describe('HttpRunsApi', () => {
  let api: HttpRunsApi;
  let http: HttpTestingController;
  let fetchSpy: SessionFetch;

  beforeEach(() => {
    fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'id: 4\ndata: {"type":"run_progress","eventId":"4","doneSteps":10,"totalSteps":60}\n\n',
            ),
          );
          controller.close();
        },
      }),
    }));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SESSION_FETCH, useValue: fetchSpy },
        HttpRunsApi,
      ],
    });
    api = TestBed.inject(HttpRunsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('createRun возвращает runId при 201 и отказ STRATEGY_INVALID/TOO_MANY_BARS при 422', async () => {
    const cmd = {
      strategyVersionId: 'ver-1',
      paramOverrides: { fast: 12 },
      blind: true,
      durationDays: 60 as const,
      timeframe: '1d' as const,
      regime: 'stress' as const,
      startMode: 'random' as const,
      customStartDate: null,
      paperCount: 3,
      paperIds: null,
      initialCapital: '1000000.00',
    };

    const pOk = api.createRun(cmd);
    const reqOk = http.expectOne('/api/v1/runs');
    expect(reqOk.request.method).toBe('POST');
    reqOk.flush({ runId: 'run-1' }, { status: 201, statusText: 'Created' });
    expect(await pOk).toEqual({ accepted: true, runId: 'run-1' });

    const pReject = api.createRun(cmd);
    http
      .expectOne('/api/v1/runs')
      .flush(
        { code: 'STRATEGY_INVALID', detail: 'Ошибка DSL' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    expect(await pReject).toMatchObject({
      accepted: false,
      reason: 'STRATEGY_INVALID',
      detail: 'Ошибка DSL',
    });
  });

  it('getRun маскирует period/papers для идущего слепого прогона (INV-7) и repeatRun создаёт повтор', async () => {
    const pRun = api.getRun('run-1');
    http.expectOne('/api/v1/runs/run-1').flush({
      runId: 'run-1',
      strategyVersionId: 'ver-1',
      algoName: 'Momentum',
      blind: true,
      status: 'running',
      doneSteps: 5,
      totalSteps: 60,
      repeatOfRunId: null,
      repeatMatch: null,
      lastEventId: '5',
      createdAt: '2026-11-22T12:00:00Z',
      finishedAt: null,
      errorCode: null,
      diagnostics: [],
      period: { startDate: '2020-02-26', endDate: '2020-05-21' },
      papers: [],
    });
    const info = await pRun;
    expect(info.period).toBeNull();
    expect(info.papers).toBeNull();
    expect(info.lastEventId).toBe('5');

    const pRepeat = api.repeatRun('run-1');
    const reqRepeat = http.expectOne('/api/v1/runs/run-1/repeat');
    expect(reqRepeat.request.method).toBe('POST');
    reqRepeat.flush({ runId: 'run-2' }, { status: 201, statusText: 'Created' });
    expect(await pRepeat).toEqual({ runId: 'run-2' });
  });

  it('events открывает SSE /runs/{id}/events с Last-Event-ID и getRunReport маппит отчёт', async () => {
    const events: RunStreamEvent[] = [];
    const sub = api.events('run-1', '3').subscribe((e) => events.push(e));
    await vi.waitFor(() => expect(events).toHaveLength(1));
    sub.unsubscribe();
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/runs/run-1/events',
      expect.objectContaining({ headers: expect.objectContaining({ 'Last-Event-ID': '3' }) }),
    );
    expect(events[0]).toMatchObject({ type: 'run_progress', doneSteps: 10, totalSteps: 60 });

    const pReport = api.getRunReport('run-1');
    http.expectOne('/api/v1/runs/run-1/report').flush({
      status: 'READY',
      report: {
        runId: 'run-1',
        strategyVersionId: 'ver-1',
        algoName: 'Momentum',
        blind: false,
        status: 'completed',
        playedDays: 60,
        totalDays: 60,
        timeframe: '1d',
        regime: 'calm',
        createdAt: '2026-11-22T12:00:00Z',
        repeatOfRunId: null,
        repeatMatch: null,
        level: 'OK',
        findings: [{ code: 'W-RT01', level: 'WARNING', message: 'Пропущен прогрев', step: 1 }],
        diagnostics: [],
        period: { startDate: '2023-04-10', endDate: '2023-07-05' },
        papers: [],
        metrics: null,
        equityCurve: [
          { step: 0, date: '2023-04-10T07:00:00Z', capital: '1000000.00', benchmarkCapital: null },
        ],
        underwaterCurve: [{ step: 0, date: '2023-04-10T07:00:00Z', drawdownPct: '0.00' }],
        roundTrips: [],
        fills: [],
        orders: [
          {
            id: 1,
            paperTicker: 'SBER',
            side: 'buy',
            orderType: 'market',
            lots: 10,
            status: 'filled',
            placedStep: 1,
            closedStep: 1,
            limitPrice: null,
            stopPrice: null,
            trailingPct: null,
            ruleName: 'enter',
            because: 'RSI ниже порога',
          },
        ],
      },
    });
    const rep = await pReport;
    expect(rep.status).toBe('READY');
    if (rep.status === 'READY') {
      expect(rep.report.period.label).toBe('10.04.2023 — 05.07.2023');
      expect(rep.report.equityCurve[0].capitalRub).toBe(1000000);
      expect(rep.report.orders[0].because).toBe('RSI ниже порога');
    }
  });
});

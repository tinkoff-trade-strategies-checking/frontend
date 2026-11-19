import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpReplayApi } from './http-replay.api';

const SESSION = '0190-s';

const PORTFOLIO = {
  mode: 'OPEN',
  equityPct: '100',
  cashPct: '100',
  investedPct: '0',
  pnlPct: '0',
  costsPct: '0',
  equity: '1000000.00',
  cash: '1000000.00',
  invested: '0.00',
  pnl: '0.00',
  costs: '0.00',
  positions: [],
};

const META = {
  sessionId: SESSION,
  blind: true,
  period: { startDate: '2020-02-26', endDate: '2020-05-21' },
  regime: 'stress',
  totalSteps: 100,
  lastStep: 40,
  totalDays: 60,
};

describe('HttpReplayApi', () => {
  let api: HttpReplayApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpReplayApi],
    });
    api = TestBed.inject(HttpReplayApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  function load(initialStep?: number) {
    const pending = api.loadSession(SESSION, initialStep);
    const req = controller.expectOne((r) => r.url === `/api/v1/sessions/${SESSION}/replay`);
    return { pending, req };
  }

  it('снимок на нужном шаге; воспроизведение идёт только до lastStep; слепая сессия остаётся слепой', async () => {
    const { pending, req } = load(5);
    expect(req.request.params.get('step')).toBe('5');
    expect(req.request.params.has('fromStep')).toBe(false);
    req.flush({
      status: 'READY',
      kind: 'SNAPSHOT',
      session: META,
      snapshot: {
        mode: 'OPEN',
        sessionId: SESSION,
        regime: 'stress',
        step: 5,
        totalSteps: 100,
        warmupSteps: 0,
        day: 2,
        totalDays: 60,
        finished: false,
        playing: null,
        speed: null,
        papers: [],
        portfolio: PORTFOLIO,
        fills: [],
        orders: [],
      },
      increment: null,
    });
    const result = await pending;
    if (result.status !== 'READY') {
      throw new Error('ожидался READY');
    }
    expect(result.session).toMatchObject({
      periodLabel: '26.02.2020 — 21.05.2020',
      totalSteps: 40,
      blind: true,
    });
    expect(result.snapshot).toMatchObject({ step: 5, totalSteps: 40, blind: true });
    expect(result.snapshot.playing).toBeUndefined();
  });

  it('следующий шаг — приращение с fromStep; INV-2: цена сделки берётся с сервера, а не из свечи', async () => {
    const { pending, req } = load(0);
    req.flush({
      status: 'READY',
      kind: 'SNAPSHOT',
      session: META,
      snapshot: {
        mode: 'OPEN',
        sessionId: SESSION,
        regime: 'stress',
        step: 0,
        totalSteps: 100,
        warmupSteps: 0,
        day: 1,
        totalDays: 60,
        finished: false,
        playing: null,
        speed: null,
        papers: [],
        portfolio: PORTFOLIO,
        fills: [],
        orders: [],
      },
      increment: null,
    });
    await pending;

    const stepPending = api.step(SESSION);
    const stepReq = controller.expectOne((r) => r.url === `/api/v1/sessions/${SESSION}/replay`);
    expect(stepReq.request.params.get('step')).toBe('1');
    expect(stepReq.request.params.get('fromStep')).toBe('0');
    stepReq.flush({
      status: 'READY',
      kind: 'INCREMENT',
      session: META,
      snapshot: null,
      increment: {
        mode: 'OPEN',
        step: 1,
        day: 1,
        finished: false,
        bars: {
          p1: [
            {
              step: 1,
              day: 1,
              candleInDay: 2,
              openedAt: '2020-02-26T08:00:00Z',
              open: '10',
              high: '12',
              low: '9',
              close: '11',
              volume: 5,
              afterHalt: false,
            },
          ],
        },
        paperStats: { p1: { changePct: '1', lastPrice: '11' } },
        portfolio: PORTFOLIO,
        fills: [
          {
            id: 'f1',
            orderId: 'o1',
            paperId: 'p1',
            step: 1,
            day: 1,
            candleInDay: 2,
            executedAt: '2020-02-26T08:00:00Z',
            side: 'buy',
            type: 'market',
            lots: 1,
            price: '10.00',
            amountPct: '0.1',
            costPct: '0.01',
            amount: '100.00',
            cost: '1.00',
            stopAndTakeSameBar: false,
          },
        ],
        orders: [],
      },
    });
    const step = await stepPending;
    expect(step.step).toBe(1);
    // Сделка по open свечи шага, а не по её close (11): цену отдаёт ядро, клиент её не пересчитывает.
    expect(step.fills[0].price).toBe(10);
    expect(step.bars['p1'].close).toBe(11);

    const next = api.step(SESSION);
    const nextReq = controller.expectOne((r) => r.url === `/api/v1/sessions/${SESSION}/replay`);
    expect(nextReq.request.params.get('fromStep')).toBe('1');
    nextReq.flush({ status: 'NOT_FOUND', sessionId: SESSION });
    await expect(next).rejects.toThrow();
  });

  it('незавершённая сессия: без снимка, дата создания по Москве', async () => {
    const { pending, req } = load();
    req.flush({
      status: 'NOT_FINISHED',
      sessionId: SESSION,
      blind: true,
      title: 'Слепая сессия от 18.11.2026',
      createdAt: '2026-11-18T12:00:00Z',
      playedDays: 3,
      totalDays: 20,
      regime: 'calm',
    });
    const result = await pending;
    expect(result).toMatchObject({ status: 'NOT_FINISHED', createdAt: '18.11.2026 15:00' });
    expect(result).not.toHaveProperty('snapshot');
  });

  it('шаг до загрузки воспроизведения — ошибка', async () => {
    await expect(api.step(SESSION)).rejects.toThrow();
  });

  it('пачка шагов: step = курсор + count, но не дальше lastStep', async () => {
    const { pending, req } = load(0);
    req.flush({
      status: 'READY',
      kind: 'SNAPSHOT',
      session: META,
      snapshot: {
        mode: 'OPEN',
        sessionId: SESSION,
        regime: 'stress',
        step: 0,
        totalSteps: 100,
        warmupSteps: 0,
        day: 1,
        totalDays: 60,
        finished: false,
        playing: null,
        speed: null,
        papers: [],
        portfolio: PORTFOLIO,
        fills: [],
        orders: [],
      },
      increment: null,
    });
    await pending;
    expect(api.batchStep).toBe(true);

    const first = api.step(SESSION, 30);
    const firstReq = controller.expectOne((r) => r.url === `/api/v1/sessions/${SESSION}/replay`);
    expect(firstReq.request.params.get('step')).toBe('30');
    expect(firstReq.request.params.get('fromStep')).toBe('0');
    firstReq.flush({
      status: 'READY',
      kind: 'INCREMENT',
      session: META,
      snapshot: null,
      increment: {
        mode: 'OPEN',
        step: 30,
        day: 1,
        finished: false,
        bars: {},
        paperStats: {},
        portfolio: PORTFOLIO,
        fills: [],
        orders: [],
      },
    });
    expect((await first).partial).toBe(true);

    void api.step(SESSION, 30).catch(() => undefined);
    const second = controller.expectOne((r) => r.url === `/api/v1/sessions/${SESSION}/replay`);
    expect(second.request.params.get('step')).toBe('40');
    expect(second.request.params.get('fromStep')).toBe('30');
    second.flush({ status: 'NOT_FOUND', sessionId: SESSION });
  });
});

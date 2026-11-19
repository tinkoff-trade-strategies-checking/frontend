import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { EVENT_SOURCE_FACTORY } from '../../../core/session-events';
import { HttpArenaApi } from './http-arena.api';

const SESSION = '0190aaaa-0000-7000-8000-000000000001';
const PAPER = '0190bbbb-0000-7000-8000-000000000002';

const BLIND_PORTFOLIO = {
  mode: 'BLIND',
  equityPct: '100',
  cashPct: '100',
  investedPct: '0',
  pnlPct: '0',
  costsPct: '0',
  positions: [],
};

function blindSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'BLIND',
    sessionId: SESSION,
    regime: 'calm',
    step: 1,
    totalSteps: 100,
    warmupSteps: 0,
    day: 1,
    totalDays: 20,
    finished: false,
    playing: true,
    speed: 5,
    papers: [
      {
        paperIndex: 2,
        label: 'Бумага A',
        sector: 'IT',
        lotValueAtStart: '1.5',
        candles: [
          {
            step: 0,
            day: 1,
            candleInDay: 1,
            open: '100.00',
            high: '101.50',
            low: '99.00',
            close: '100.50',
            volume: '1.25',
            afterHalt: false,
          },
        ],
        stat: { changePct: '0.5', lastPrice: '100.50' },
      },
    ],
    portfolio: BLIND_PORTFOLIO,
    fills: [],
    orders: [],
    ...overrides,
  };
}

describe('HttpArenaApi', () => {
  let api: HttpArenaApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        HttpArenaApi,
        { provide: EVENT_SOURCE_FACTORY, useValue: vi.fn() },
      ],
    });
    api = TestBed.inject(HttpArenaApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  async function load(snapshot: Record<string, unknown> = blindSnapshot()) {
    const pending = api.getSnapshot(SESSION);
    controller.expectOne(`/api/v1/sessions/${SESSION}`).flush(snapshot);
    return pending;
  }

  it('без id сессии из маршрута — понятная ошибка, запроса нет', async () => {
    await expect(api.getSnapshot()).rejects.toThrow('Откройте сессию');
  });

  it('слепой снимок: бумага — индекс, цены из строк, плеер сервера (INV-7, INV-8)', async () => {
    const snap = await load();
    expect(snap.blind).toBe(true);
    expect(snap.playing).toBe(true);
    expect(snap.speed).toBe(5);
    expect(snap.papers[0].id).toBe('2');
    expect(snap.papers[0].candles[0]).toEqual({
      step: 0,
      day: 1,
      candleInDay: 1,
      open: 100,
      high: 101.5,
      low: 99,
      close: 100.5,
      volume: 1.25,
    });
    expect(snap.papers[0].changePct).toBe(0.5);
  });

  it('INV-2 и слепой режим: заявка с seenStep, paperIndex и Idempotency-Key, цены строками', async () => {
    await load();
    const pending = api.placeOrder({
      seenStep: 1,
      paperId: '2',
      side: 'buy',
      type: 'limit',
      lots: 3,
      tif: 'day',
      limitPrice: 99.1,
    });
    const req = controller.expectOne(`/api/v1/sessions/${SESSION}/orders`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(req.request.body).toMatchObject({
      seenStep: 1,
      paperIndex: 2,
      side: 'buy',
      type: 'limit',
      lots: 3,
      tif: 'day',
      limitPrice: '99.1',
      stopPrice: null,
    });
    expect(req.request.body).not.toHaveProperty('paperId');
    req.flush({
      mode: 'BLIND',
      accepted: false,
      reason: 'INSUFFICIENT_CASH',
      field: null,
      orderIds: [],
      order: null,
      orders: [],
      portfolio: BLIND_PORTFOLIO,
    });
    const result = await pending;
    expect(result).toMatchObject({ accepted: false, reason: 'INSUFFICIENT_CASH', partial: true });
  });

  it('раскрытый режим: заявка адресуется paperId из каталога', async () => {
    await load({
      ...blindSnapshot(),
      mode: 'OPEN',
      papers: [],
      portfolio: {
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
      },
    });
    const pending = api.estimateOrder({ paperId: PAPER, lots: 2 });
    const req = controller.expectOne(`/api/v1/sessions/${SESSION}/order-estimate`);
    expect(req.request.body).toMatchObject({ paperId: PAPER, lots: 2 });
    expect(req.request.body).not.toHaveProperty('paperIndex');
    req.flush({
      mode: 'BLIND',
      canPlace: true,
      reason: null,
      field: null,
      amountPct: '1.25',
      commissionPct: '0.01',
      exchangeFeePct: '0',
      requiredCashPct: '1.3',
      legs: [],
    });
    expect(await pending).toEqual({ amountPct: 1.25 });
  });

  it('отмена: DELETE с seenStep и ключом; замена: PUT', async () => {
    await load();
    const order = 'o-1';
    const cancel = api.cancelOrder({ seenStep: 4, orderId: order });
    const del = controller.expectOne(
      (r) => r.url === `/api/v1/sessions/${SESSION}/orders/${order}`,
    );
    expect(del.request.method).toBe('DELETE');
    expect(del.request.params.get('seenStep')).toBe('4');
    expect(del.request.headers.has('Idempotency-Key')).toBe(true);
    del.flush({
      mode: 'BLIND',
      accepted: true,
      reason: null,
      field: null,
      orderIds: [],
      order: null,
      orders: [],
      portfolio: BLIND_PORTFOLIO,
    });
    await cancel;

    const replace = api.replaceOrder({
      seenStep: 4,
      orderId: order,
      lots: 2,
      tif: 'gtc',
      stopPrice: 90,
    });
    const put = controller.expectOne(`/api/v1/sessions/${SESSION}/orders/${order}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toMatchObject({ seenStep: 4, lots: 2, tif: 'gtc', stopPrice: '90' });
    put.flush({
      mode: 'BLIND',
      accepted: true,
      reason: null,
      field: null,
      orderIds: [],
      order: null,
      orders: [],
      portfolio: BLIND_PORTFOLIO,
    });
    await replace;
  });

  it('плеер: step возвращает результат шага, speed — со скоростью', async () => {
    await load();
    const step = api.step();
    const req = controller.expectOne(`/api/v1/sessions/${SESSION}/player`);
    expect(req.request.body).toEqual({ action: 'step' });
    expect(req.request.headers.has('Idempotency-Key')).toBe(true);
    req.flush({
      mode: 'BLIND',
      sessionId: SESSION,
      playing: false,
      speed: 1,
      step: 2,
      day: 1,
      finished: false,
      stepResult: {
        mode: 'BLIND',
        step: 2,
        day: 1,
        finished: false,
        bars: {
          '2': [
            {
              step: 1,
              day: 1,
              candleInDay: 2,
              open: '1',
              high: '1',
              low: '1',
              close: '1',
              volume: '1',
              afterHalt: false,
            },
            {
              step: 2,
              day: 1,
              candleInDay: 3,
              open: '1',
              high: '2',
              low: '1',
              close: '2',
              volume: '1',
              afterHalt: false,
            },
          ],
        },
        paperStats: { '2': { changePct: '1', lastPrice: '2' } },
        portfolio: BLIND_PORTFOLIO,
        fills: [],
        orders: [],
      },
    });
    const result = await step;
    expect(result.step).toBe(2);
    expect(result.batches?.['2'].map((c) => c.step)).toEqual([1, 2]);
    expect(result.bars['2'].step).toBe(2);

    const speed = api.control('speed', 100);
    const speedReq = controller.expectOne(`/api/v1/sessions/${SESSION}/player`);
    expect(speedReq.request.body).toEqual({ action: 'speed', speed: 100 });
    speedReq.flush({
      mode: 'BLIND',
      sessionId: SESSION,
      playing: true,
      speed: 100,
      step: 2,
      day: 1,
      finished: false,
      stepResult: null,
    });
    expect(await speed).toMatchObject({ playing: true, speed: 100, stepResult: null });
  });
});

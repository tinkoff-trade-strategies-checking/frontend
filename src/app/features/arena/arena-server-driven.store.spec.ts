import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { ArenaStore } from './arena.store';
import {
  ARENA_API,
  ArenaApi,
  ArenaCandle,
  ArenaEvent,
  ArenaOrder,
  ArenaPlayerState,
  ArenaPortfolio,
  ArenaSnapshot,
  ArenaStepResult,
} from './data/arena.models';

const PORTFOLIO: ArenaPortfolio = {
  equityPct: 100,
  cashPct: 100,
  investedPct: 0,
  pnlPct: 0,
  costsPct: 0,
  positions: {},
};

function candle(step: number, extra: Partial<ArenaCandle> = {}): ArenaCandle {
  return {
    step,
    day: 1,
    candleInDay: step,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 1,
    ...extra,
  };
}

function order(id: string, extra: Partial<ArenaOrder> = {}): ArenaOrder {
  return {
    id,
    paperId: '0',
    side: 'buy',
    type: 'limit',
    lots: 1,
    filledLots: 0,
    tif: 'day',
    status: 'active',
    step: 0,
    seenStep: 0,
    limitPrice: 99,
    ...extra,
  };
}

function snapshot(extra: Partial<ArenaSnapshot> = {}): ArenaSnapshot {
  return {
    sessionId: 's-1',
    blind: true,
    step: 1,
    totalSteps: 10,
    day: 1,
    totalDays: 5,
    finished: false,
    papers: [
      {
        id: '0',
        label: 'Бумага A',
        sector: 'IT',
        candles: [candle(0), candle(1)],
        changePct: 0,
        lastPrice: 100,
      },
    ],
    portfolio: PORTFOLIO,
    orders: [order('o-1')],
    fills: [],
    playing: false,
    speed: 1,
    ...extra,
  };
}

function stepResult(step: number, extra: Partial<ArenaStepResult> = {}): ArenaStepResult {
  return {
    step,
    day: 1,
    finished: false,
    bars: { '0': candle(step) },
    paperStats: { '0': { changePct: 1, lastPrice: 100 } },
    portfolio: PORTFOLIO,
    orders: [],
    fills: [],
    ...extra,
  };
}

class FakeServerApi implements ArenaApi {
  readonly serverDriven = true;
  readonly events$ = new Subject<ArenaEvent>();
  snapshotValue = snapshot();
  private playingNow = false;
  readonly control = vi.fn(async (action: string): Promise<ArenaPlayerState> => ({
    playing: (this.playingNow =
      action === 'play' ? true : action === 'pause' ? false : this.playingNow),
    speed: 1,
    step: 1,
    day: 1,
    finished: false,
    stepResult: null,
  }));
  readonly getSnapshot = vi.fn(async () => this.snapshotValue);
  events = () => this.events$.asObservable();
  step = vi.fn(async () => stepResult(2));
  estimateOrder = vi.fn();
  placeOrder = vi.fn();
  cancelOrder = vi.fn();
  replaceOrder = vi.fn();
  finishSession = vi.fn();
}

describe('ArenaStore при серверном времени', () => {
  function setup(api: FakeServerApi): ArenaStore {
    TestBed.configureTestingModule({
      providers: [{ provide: ARENA_API, useValue: api }, ArenaStore],
    });
    return TestBed.inject(ArenaStore);
  }

  it('INV-8: init читает снимок, подхватывает плеер сервера и подписывается на поток', async () => {
    const api = new FakeServerApi();
    api.snapshotValue = snapshot({ playing: true, speed: 10 });
    const store = setup(api);
    await store.init(undefined, 's-1');
    expect(store.playing()).toBe(true);
    expect(store.speed()).toBe(10);
    expect(api.control).not.toHaveBeenCalled();
    api.events$.next({ type: 'step', result: stepResult(2) });
    expect(store.step()).toBe(2);
    expect(store.selectedPaper()!.candles.map((c) => c.step)).toEqual([0, 1, 2]);
  });

  it('шаг, который уже виден (ответ на команду и событие SSE), применяется один раз', async () => {
    const api = new FakeServerApi();
    const store = setup(api);
    await store.init();
    api.events$.next({ type: 'step', result: stepResult(2) });
    api.events$.next({ type: 'step', result: stepResult(2) });
    await store.stepOnce();
    expect(store.selectedPaper()!.candles.filter((c) => c.step === 2)).toHaveLength(1);
  });

  it('пачка свечей на высокой скорости добавляется целиком, по возрастанию шагов', async () => {
    const api = new FakeServerApi();
    const store = setup(api);
    await store.init();
    api.events$.next({
      type: 'step',
      result: stepResult(4, { batches: { '0': [candle(2), candle(3), candle(4)] } }),
    });
    expect(store.selectedPaper()!.candles.map((c) => c.step)).toEqual([0, 1, 2, 3, 4]);
    expect(store.step()).toBe(4);
  });

  it('пуск, пауза и скорость уходят командами на сервер, таймера на клиенте нет', async () => {
    const api = new FakeServerApi();
    const store = setup(api);
    await store.init();
    store.togglePlay();
    await vi.waitFor(() => expect(store.playing()).toBe(true));
    expect(api.control).toHaveBeenCalledWith('play', undefined);
    store.setSpeed(100);
    await vi.waitFor(() => expect(api.control).toHaveBeenCalledWith('speed', 100));
    store.pause();
    await vi.waitFor(() => expect(api.control).toHaveBeenCalledWith('pause', undefined));
    expect(api.step).not.toHaveBeenCalled();
  });

  it('события player и paused обновляют плеер; причина паузы показывается', async () => {
    const api = new FakeServerApi();
    const store = setup(api);
    await store.init();
    api.events$.next({ type: 'player', playing: true, speed: 5 });
    expect(store.playing()).toBe(true);
    expect(store.speed()).toBe(5);
    api.events$.next({ type: 'paused', reason: 'disconnect' });
    expect(store.playing()).toBe(false);
    expect(store.notice()).toContain('соединение');
  });

  it('resync после обрыва потока перечитывает снимок (INV-8)', async () => {
    const api = new FakeServerApi();
    const store = setup(api);
    await store.init();
    api.snapshotValue = snapshot({ step: 7 });
    api.events$.next({ type: 'resync' });
    await vi.waitFor(() => expect(store.step()).toBe(7));
    expect(api.getSnapshot).toHaveBeenCalledTimes(2);
  });

  it('order_updated вливает заявку по id, не теряя остальные', async () => {
    const api = new FakeServerApi();
    const store = setup(api);
    await store.init();
    api.events$.next({
      type: 'order_updated',
      order: order('o-2'),
      portfolio: { ...PORTFOLIO, cashPct: 90 },
    });
    api.events$.next({
      type: 'order_updated',
      order: order('o-1', { status: 'cancelled' }),
      portfolio: PORTFOLIO,
    });
    expect(store.orders().map((o) => [o.id, o.status])).toEqual([
      ['o-1', 'cancelled'],
      ['o-2', 'active'],
    ]);
  });

  it('ответ на команду заявки — частичный: остальные заявки сохраняются, при замене старая закрывается', async () => {
    const api = new FakeServerApi();
    api.replaceOrder.mockResolvedValue({
      accepted: true,
      orders: [order('o-9', { lots: 3 })],
      partial: true,
      portfolio: PORTFOLIO,
    });
    const store = setup(api);
    await store.init();
    await store.replaceOrder('o-1', { lots: 3, tif: 'day', limitPrice: 98 });
    expect(store.orders().map((o) => o.id)).toEqual(['o-1', 'o-9']);
    expect(store.orders()[0]).toMatchObject({ status: 'cancelled', rejectReason: 'REPLACED' });
  });

  it('INV-7: в идущей слепой сессии даты не выводятся, даже если пришли в снимке и в шаге', async () => {
    const api = new FakeServerApi();
    api.snapshotValue = snapshot({
      papers: [
        {
          id: '0',
          label: 'A',
          sector: 'IT',
          candles: [candle(0, { dateLabel: '01.01.2020', fullDateLabel: '01.01.2020 10:00' })],
          changePct: 0,
          lastPrice: 100,
        },
      ],
    });
    const store = setup(api);
    await store.init();
    api.events$.next({
      type: 'step',
      result: stepResult(2, {
        bars: { '0': candle(2, { dateLabel: '02.01.2020' }) },
        fills: [
          {
            id: 'f-1',
            orderId: 'o-1',
            paperId: '0',
            step: 2,
            day: 1,
            candleInDay: 2,
            side: 'buy',
            type: 'limit',
            lots: 1,
            price: 99,
            amountPct: 1,
            costPct: 0.1,
            dateLabel: '02.01.2020 10:00',
          },
        ],
      }),
    });
    for (const c of store.selectedPaper()!.candles) {
      expect(c.dateLabel).toBeUndefined();
      expect(c.fullDateLabel).toBeUndefined();
    }
    expect(store.fills()[0].dateLabel).toBeUndefined();
  });

  it('раскрытая сессия показывает даты', async () => {
    const api = new FakeServerApi();
    api.snapshotValue = snapshot({
      blind: false,
      papers: [
        {
          id: 'p-1',
          label: 'SBER',
          sector: 'Финансы',
          candles: [candle(0, { dateLabel: '01.01.2020' })],
          changePct: 0,
          lastPrice: 100,
        },
      ],
    });
    const store = setup(api);
    await store.init();
    expect(store.selectedPaper()!.candles[0].dateLabel).toBe('01.01.2020');
  });

  it('конфликт состояния плеера (409) перечитывает снимок', async () => {
    const api = new FakeServerApi();
    const store = setup(api);
    await store.init();
    api.control.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 409, error: { code: 'PLAYER_STATE_CONFLICT' } }),
    );
    api.snapshotValue = snapshot({ step: 5 });
    store.togglePlay();
    await vi.waitFor(() => expect(store.step()).toBe(5));
    expect(store.error()).toContain('плеера');
  });

  it('finished и report_ready: сессия завершена, отчёт помечен готовым', async () => {
    const api = new FakeServerApi();
    const store = setup(api);
    await store.init();
    api.events$.next({
      type: 'finished',
      result: {
        sessionId: 's-1',
        finishedAtStep: 3,
        finishedAtDay: 2,
        portfolio: PORTFOLIO,
        orders: [order('o-1', { status: 'cancelled' })],
        partial: true,
      },
    });
    expect(store.finished()).toBe(true);
    expect(store.playing()).toBe(false);
    api.events$.next({ type: 'report_ready' });
    expect(store.reportReady()).toBe(true);
  });
});

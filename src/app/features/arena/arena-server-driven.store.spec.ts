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
    lastEventId: 10,
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

const stepEvent = (eventId: number, result: ArenaStepResult): ArenaEvent => ({
  type: 'step',
  eventId,
  result,
});

class FakeServerApi implements ArenaApi {
  readonly serverDriven = true;
  events$ = new Subject<ArenaEvent>();
  readonly opened: (number | null)[] = [];
  snapshots: ArenaSnapshot[] = [snapshot()];
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
  readonly getSnapshot = vi.fn(async () => {
    const next = this.snapshots.length > 1 ? this.snapshots.shift()! : this.snapshots[0];
    return next;
  });
  events = (lastEventId: number | null) => {
    this.opened.push(lastEventId);
    this.events$ = new Subject<ArenaEvent>();
    return this.events$.asObservable();
  };
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

  it('INV-8: init читает снимок, подхватывает плеер сервера и открывает поток с номера из снимка (F5 во время игры)', async () => {
    const api = new FakeServerApi();
    api.snapshots = [snapshot({ playing: true, speed: 10, lastEventId: 10 })];
    const store = setup(api);
    await store.init(undefined, 's-1');
    expect(store.playing()).toBe(true);
    expect(store.speed()).toBe(10);
    expect(api.control).not.toHaveBeenCalled();
    expect(api.opened).toEqual([10]);
    api.events$.next(stepEvent(11, stepResult(2)));
    expect(store.step()).toBe(2);
    expect(store.selectedPaper()!.candles.map((c) => c.step)).toEqual([0, 1, 2]);
  });

  it('повтор события (номер не больше учтённого) пропускается, в том числе после снимка', async () => {
    const api = new FakeServerApi();
    const store = setup(api);
    await store.init();
    api.events$.next(stepEvent(10, stepResult(2)));
    expect(store.step()).toBe(1);
    api.events$.next(stepEvent(11, stepResult(2)));
    api.events$.next(stepEvent(11, stepResult(2)));
    expect(store.selectedPaper()!.candles.filter((c) => c.step === 2)).toHaveLength(1);
  });

  it('шаг из ответа на команду и тот же шаг из потока применяются один раз', async () => {
    const api = new FakeServerApi();
    const store = setup(api);
    await store.init();
    api.events$.next(stepEvent(11, stepResult(2)));
    await store.stepOnce();
    expect(store.selectedPaper()!.candles.filter((c) => c.step === 2)).toHaveLength(1);
  });

  it('пачка свечей на высокой скорости добавляется целиком, по возрастанию шагов', async () => {
    const api = new FakeServerApi();
    const store = setup(api);
    await store.init();
    api.events$.next(
      stepEvent(11, stepResult(4, { batches: { '0': [candle(2), candle(3), candle(4)] } })),
    );
    expect(store.selectedPaper()!.candles.map((c) => c.step)).toEqual([0, 1, 2, 3, 4]);
    expect(store.step()).toBe(4);
  });

  it('INV-8: пропуск номера события — перечитывает снимок и открывает поток с его номера', async () => {
    const api = new FakeServerApi();
    api.snapshots = [
      snapshot({ lastEventId: 10 }),
      snapshot({
        step: 5,
        lastEventId: 14,
        papers: [
          {
            id: '0',
            label: 'A',
            sector: 'IT',
            candles: [0, 1, 2, 3, 4, 5].map((s) => candle(s)),
            changePct: 0,
            lastPrice: 100,
          },
        ],
      }),
    ];
    const store = setup(api);
    await store.init();
    api.events$.next(stepEvent(13, stepResult(5)));
    await vi.waitFor(() => expect(store.step()).toBe(5));
    expect(api.getSnapshot).toHaveBeenCalledTimes(2);
    expect(api.opened).toEqual([10, 14]);
    // событие из дыры не применялось поверх снимка
    expect(store.selectedPaper()!.candles.map((c) => c.step)).toEqual([0, 1, 2, 3, 4, 5]);
    api.events$.next(stepEvent(15, stepResult(6)));
    expect(store.step()).toBe(6);
  });

  it('INV-1/8: пачка свечей не по порядку (первая свеча дальше step + 1) — не применяется, снимок', async () => {
    const api = new FakeServerApi();
    api.snapshots = [snapshot(), snapshot({ step: 6, lastEventId: 11 })];
    const store = setup(api);
    await store.init();
    api.events$.next(stepEvent(11, stepResult(6, { batches: { '0': [candle(5), candle(6)] } })));
    await vi.waitFor(() => expect(api.getSnapshot).toHaveBeenCalledTimes(2));
    expect(store.selectedPaper()!.candles.map((c) => c.step)).not.toContain(5);
  });

  it('снимок старее уже применённых событий отбрасывается и читается заново', async () => {
    const api = new FakeServerApi();
    api.snapshots = [
      snapshot({ lastEventId: 10 }),
      snapshot({ step: 1, lastEventId: 10 }),
      snapshot({ step: 3, lastEventId: 12 }),
    ];
    const store = setup(api);
    await store.init();
    api.events$.next(stepEvent(11, stepResult(2)));
    api.events$.next(stepEvent(12, stepResult(3)));
    expect(store.step()).toBe(3);

    // снимок устарел (номер 10 < 12): экран не откатывается
    api.snapshots = [
      snapshot({ step: 1, lastEventId: 10 }),
      snapshot({ step: 3, lastEventId: 12 }),
    ];
    await store.resync();
    expect(store.step()).toBe(3);
    expect(api.getSnapshot.mock.calls.length).toBeGreaterThanOrEqual(3);
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

  it('пауза откатывается, если команда не прошла: экран показывает состояние сервера', async () => {
    const api = new FakeServerApi();
    api.snapshots = [snapshot({ playing: true, lastEventId: 10 })];
    const store = setup(api);
    await store.init();
    expect(store.playing()).toBe(true);
    api.control.mockRejectedValueOnce(new HttpErrorResponse({ status: 503, error: {} }));
    store.pause();
    expect(store.playing()).toBe(false);
    await vi.waitFor(() => expect(store.playing()).toBe(true));
    expect(store.error()).toBeTruthy();
  });

  it('события player и paused обновляют плеер; причина паузы показывается', async () => {
    const api = new FakeServerApi();
    const store = setup(api);
    await store.init();
    api.events$.next({ type: 'player', eventId: 11, playing: true, speed: 5 });
    expect(store.playing()).toBe(true);
    expect(store.speed()).toBe(5);
    api.events$.next({ type: 'paused', eventId: 12, reason: 'disconnect' });
    expect(store.playing()).toBe(false);
    expect(store.notice()).toContain('соединение');
  });

  it('order_updated вливает заявку по id, не теряя остальные, и повтор не затирает новое', async () => {
    const api = new FakeServerApi();
    const store = setup(api);
    await store.init();
    api.events$.next({
      type: 'order_updated',
      eventId: 11,
      order: order('o-2'),
      portfolio: { ...PORTFOLIO, cashPct: 90 },
    });
    api.events$.next({
      type: 'order_updated',
      eventId: 12,
      order: order('o-1', { status: 'cancelled' }),
      portfolio: PORTFOLIO,
    });
    // повтор старого события (после переподключения) не откатывает заявку
    api.events$.next({
      type: 'order_updated',
      eventId: 11,
      order: order('o-1', { status: 'active' }),
      portfolio: PORTFOLIO,
    });
    expect(store.orders().map((o) => [o.id, o.status])).toEqual([
      ['o-1', 'cancelled'],
      ['o-2', 'active'],
    ]);
  });

  it('OCO: подача вливает обе ноги, отмена — обе отменённые, остальные заявки сохраняются', async () => {
    const api = new FakeServerApi();
    const stop = order('leg-stop', { type: 'stop', side: 'sell', ocoSiblingId: 'leg-take' });
    const take = order('leg-take', {
      type: 'take_profit',
      side: 'sell',
      ocoSiblingId: 'leg-stop',
    });
    api.placeOrder.mockResolvedValue({
      accepted: true,
      order: stop,
      orders: [stop, take],
      partial: true,
      portfolio: PORTFOLIO,
    });
    api.cancelOrder.mockResolvedValue({
      accepted: true,
      orders: [
        { ...stop, status: 'cancelled', rejectReason: 'CANCELLED_BY_USER' },
        { ...take, status: 'cancelled', rejectReason: 'CANCELLED_BY_USER' },
      ],
      partial: true,
      portfolio: PORTFOLIO,
    });
    const store = setup(api);
    await store.init();
    await store.placeOrder({
      paperId: '0',
      side: 'sell',
      type: 'oco',
      lots: 1,
      tif: 'gtc',
      stopPrice: 90,
      takeProfitPrice: 110,
    });
    expect(store.activeOrders().map((o) => o.id)).toEqual(['o-1', 'leg-stop', 'leg-take']);
    await store.cancelOrder('leg-take');
    expect(store.activeOrders().map((o) => o.id)).toEqual(['o-1']);
    expect(store.closedOrders().map((o) => o.id)).toEqual(['leg-stop', 'leg-take']);
  });

  it('замена OCO: старая пара снимается по снимку сервера, а не по догадке клиента', async () => {
    const api = new FakeServerApi();
    const stop = order('old-stop', { type: 'stop', side: 'sell', ocoSiblingId: 'old-take' });
    const take = order('old-take', { type: 'take_profit', side: 'sell', ocoSiblingId: 'old-stop' });
    const newStop = order('new-stop', { type: 'stop', side: 'sell', ocoSiblingId: 'new-take' });
    const newTake = order('new-take', {
      type: 'take_profit',
      side: 'sell',
      ocoSiblingId: 'new-stop',
    });
    api.snapshots = [
      snapshot({ orders: [stop, take], lastEventId: 10 }),
      snapshot({
        orders: [
          { ...stop, status: 'cancelled', rejectReason: 'REPLACED' },
          { ...take, status: 'cancelled', rejectReason: 'REPLACED' },
          newStop,
          newTake,
        ],
        lastEventId: 12,
      }),
    ];
    api.replaceOrder.mockResolvedValue({
      accepted: true,
      order: newStop,
      orders: [newStop, newTake],
      partial: true,
      portfolio: PORTFOLIO,
    });
    const store = setup(api);
    await store.init();
    await store.replaceOrder('old-stop', {
      lots: 1,
      tif: 'gtc',
      stopPrice: 91,
      takeProfitPrice: 111,
    });
    expect(api.getSnapshot).toHaveBeenCalledTimes(2);
    expect(store.activeOrders().map((o) => o.id)).toEqual(['new-stop', 'new-take']);
    expect(store.closedOrders().map((o) => o.id)).toEqual(['old-stop', 'old-take']);
  });

  it('INV-7: в идущей слепой сессии даты не выводятся, даже если пришли в снимке и в шаге', async () => {
    const api = new FakeServerApi();
    api.snapshots = [
      snapshot({
        papers: [
          {
            id: '0',
            label: 'A',
            sector: 'IT',
            candles: [
              candle(0, { dateLabel: '01.01.2020', fullDateLabel: '01.01.2020 10:00' }),
              candle(1, { dateLabel: '01.01.2020' }),
            ],
            changePct: 0,
            lastPrice: 100,
          },
        ],
      }),
    ];
    const store = setup(api);
    await store.init();
    api.events$.next(
      stepEvent(
        11,
        stepResult(2, {
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
      ),
    );
    for (const c of store.selectedPaper()!.candles) {
      expect(c.dateLabel).toBeUndefined();
      expect(c.fullDateLabel).toBeUndefined();
    }
    expect(store.fills()[0].dateLabel).toBeUndefined();
  });

  it('раскрытая сессия показывает даты', async () => {
    const api = new FakeServerApi();
    api.snapshots = [
      snapshot({
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
      }),
    ];
    const store = setup(api);
    await store.init();
    expect(store.selectedPaper()!.candles[0].dateLabel).toBe('01.01.2020');
  });

  it('конфликт состояния плеера (409) перечитывает снимок', async () => {
    const api = new FakeServerApi();
    api.snapshots = [snapshot(), snapshot({ step: 5, lastEventId: 10 })];
    const store = setup(api);
    await store.init();
    api.control.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 409, error: { code: 'PLAYER_STATE_CONFLICT' } }),
    );
    store.togglePlay();
    await vi.waitFor(() => expect(store.step()).toBe(5));
    expect(store.error()).toContain('плеера');
  });

  it('поток закрыт сервером (401/404): без переподключения, снимок покажет причину', async () => {
    const api = new FakeServerApi();
    const store = setup(api);
    await store.init();
    api.getSnapshot.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 404, error: { code: 'NOT_FOUND' } }),
    );
    api.events$.next({ type: 'stream_failed', status: 404 });
    await vi.waitFor(() => expect(api.getSnapshot).toHaveBeenCalledTimes(2));
    expect(api.opened).toEqual([10]);
    expect(store.error()).toBeTruthy();
  });

  it('report_ready закрывает поток; finished без report_ready — через паузу', async () => {
    vi.useFakeTimers();
    try {
      const api = new FakeServerApi();
      const store = setup(api);
      await store.init();
      const subject = api.events$;
      expect(subject.observed).toBe(true);
      api.events$.next({
        type: 'finished',
        eventId: 11,
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
      expect(subject.observed).toBe(true);
      api.events$.next({ type: 'report_ready', eventId: 12 });
      expect(store.reportReady()).toBe(true);
      expect(subject.observed).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('finished без report_ready: поток закрывается по таймеру', async () => {
    vi.useFakeTimers();
    try {
      const api = new FakeServerApi();
      const store = setup(api);
      await store.init();
      const subject = api.events$;
      api.events$.next({
        type: 'finished',
        eventId: 11,
        result: {
          sessionId: 's-1',
          finishedAtStep: 3,
          finishedAtDay: 2,
          portfolio: PORTFOLIO,
          partial: true,
        },
      });
      expect(subject.observed).toBe(true);
      await vi.advanceTimersByTimeAsync(31_000);
      expect(subject.observed).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('завершённая сессия: поток не открывается', async () => {
    const api = new FakeServerApi();
    api.snapshots = [snapshot({ finished: true })];
    const store = setup(api);
    await store.init();
    expect(api.opened).toEqual([]);
  });
});

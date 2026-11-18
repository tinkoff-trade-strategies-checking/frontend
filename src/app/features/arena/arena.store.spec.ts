import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ArenaStore } from './arena.store';
import { ARENA_API, ArenaApi, ArenaSnapshot } from './data/arena.models';
import { StubArenaApi } from './data/stub-arena.api';

describe('ArenaStore', () => {
  function setup(api: ArenaApi = new StubArenaApi()): { store: ArenaStore; api: ArenaApi } {
    TestBed.configureTestingModule({
      providers: [{ provide: ARENA_API, useValue: api }, ArenaStore],
    });
    return { store: TestBed.inject(ArenaStore), api };
  }

  it('INV-8: загружает состояние из ArenaApi при init без обращения к localStorage', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const stub = new StubArenaApi();
    const snapSpy = vi.spyOn(stub, 'getSnapshot');
    const { store } = setup(stub);

    await store.init();

    expect(snapSpy).toHaveBeenCalledTimes(1);
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(store.sessionId()).toBe('S-0104');
    expect(store.step()).toBe(0);
    getItemSpy.mockRestore();
  });

  it('INV-1: stepOnce добавляет только одну новую свечу и очищает notice', async () => {
    const stub = new StubArenaApi();
    const stepSpy = vi.spyOn(stub, 'step');
    const { store } = setup(stub);

    await store.init();
    await store.placeOrder({
      paperId: 'A',
      side: 'buy',
      type: 'limit',
      lots: 5,
      tif: 'day',
      limitPrice: 95,
    });
    expect(store.notice()).toBe('Заявка выставлена.');

    const initialLen = store.selectedPaper()!.candles.length;
    await store.stepOnce();
    expect(stepSpy).toHaveBeenCalledTimes(1);
    expect(store.step()).toBe(1);
    expect(store.selectedPaper()!.candles.length).toBe(initialLen + 1);
    expect(store.selectedPaper()!.candles.at(-1)?.step).toBe(1);
    expect(store.notice()).toBeNull();
  });

  it('INV-2: placeOrder, replaceOrder и cancelOrder отправляются с seenStep последней показанной свечи', async () => {
    const stub = new StubArenaApi();
    const placeSpy = vi.spyOn(stub, 'placeOrder');
    const replaceSpy = vi.spyOn(stub, 'replaceOrder');
    const cancelSpy = vi.spyOn(stub, 'cancelOrder');
    const { store } = setup(stub);

    await store.init();
    await store.stepOnce();
    await store.stepOnce();
    expect(store.step()).toBe(2);

    const placed = await store.placeOrder({
      paperId: 'A',
      side: 'buy',
      type: 'limit',
      lots: 5,
      tif: 'day',
      limitPrice: 95,
    });
    expect(placeSpy).toHaveBeenCalledWith(expect.objectContaining({ seenStep: 2 }));

    const orderId = placed!.order!.id;
    const replaced = await apiReplace(store, orderId);
    expect(replaceSpy).toHaveBeenCalledWith(expect.objectContaining({ seenStep: 2, orderId }));

    await store.cancelOrder(replaced!.order!.id);
    expect(cancelSpy).toHaveBeenCalledWith(
      expect.objectContaining({ seenStep: 2, orderId: replaced!.order!.id }),
    );
  });

  it('INV-6: оценка заявки и метрики портфеля приходят из источника без расчёта в клиенте', async () => {
    const customSnapshot: ArenaSnapshot = {
      sessionId: 'S-MOCK',
      blind: true,
      step: 0,
      totalSteps: 10,
      day: 1,
      totalDays: 10,
      finished: false,
      papers: [
        {
          id: 'A',
          label: 'Бумага A',
          sector: 'IT',
          candles: [
            {
              step: 0,
              day: 1,
              candleInDay: 1,
              open: 100,
              high: 102,
              low: 99,
              close: 101,
              volume: 100,
            },
          ],
          changePct: 1,
          lastPrice: 101,
        },
      ],
      portfolio: {
        equityPct: 123.45,
        cashPct: 50.12,
        investedPct: 73.33,
        pnlPct: 23.45,
        costsPct: 0.42,
        positions: {
          A: { paperId: 'A', lots: 7, avgPrice: 98.5, pnlPct: 23.45, valuePct: 73.33 },
        },
      },
      orders: [],
      fills: [],
    };

    const stub = new StubArenaApi();
    vi.spyOn(stub, 'getSnapshot').mockResolvedValue(customSnapshot);
    vi.spyOn(stub, 'estimateOrder').mockResolvedValue({ amountPct: 42.42 });
    const { store } = setup(stub);

    await store.init();
    expect(store.portfolio()).toEqual(customSnapshot.portfolio);

    await store.estimateOrder('A', 7);
    expect(store.estimatedPct()).toBe(42.42);
  });

  it('сериализует команды и шаги, сбрасывает editingOrder при отказе замены и ловит ошибки API', async () => {
    const stub = new StubArenaApi();
    const { store } = setup(stub);
    await store.init();

    const placed = await store.placeOrder({
      paperId: 'A',
      side: 'buy',
      type: 'limit',
      lots: 5,
      tif: 'day',
      limitPrice: 95,
    });
    const order = placed!.order!;
    store.startEditOrder(order);
    expect(store.editingOrder()?.id).toBe(order.id);

    // Отказ замены (недостаточно средств) сбрасывает режим замены и выставляет error.
    await store.replaceOrder(order.id, { lots: 500, tif: 'day', limitPrice: 95 });
    expect(store.editingOrder()).toBeNull();
    expect(store.error()).toContain('Недостаточно свободных средств');

    // Исключение в API перехватывается в store.error.
    vi.spyOn(stub, 'placeOrder').mockRejectedValueOnce(new Error('Сетевой сбой'));
    await store.placeOrder({
      paperId: 'A',
      side: 'buy',
      type: 'market',
      lots: 1,
      tif: 'day',
    });
    expect(store.error()).toBe('Сетевой сбой');
  });

  it('поддерживает скорости ×1, ×5, ×10, ×100, паузу и не сбрасывает finished', async () => {
    const { store } = setup();
    await store.init();

    store.setSpeed(100);
    expect(store.speed()).toBe(100);

    store.togglePlay();
    expect(store.playing()).toBe(true);

    store.pause();
    expect(store.playing()).toBe(false);

    await store.finishSession();
    expect(store.finished()).toBe(true);
    expect(store.canStep()).toBe(false);
  });

  it('INV-2: фиксирует seenStep синхронно в момент клика, даже если шаг уже в очереди', async () => {
    const stub = new StubArenaApi();
    const { store } = setup(stub);
    await store.init();
    expect(store.step()).toBe(0);

    let resolveStep!: (value: Awaited<ReturnType<StubArenaApi['step']>>) => void;
    const origStep = stub.step.bind(stub);
    vi.spyOn(stub, 'step').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStep = resolve;
        }),
    );
    const placeSpy = vi.spyOn(stub, 'placeOrder');

    const stepPromise = store.stepOnce();
    const placePromise = store.placeOrder({
      paperId: 'A',
      side: 'buy',
      type: 'limit',
      lots: 5,
      tif: 'day',
      limitPrice: 95,
    });

    const realStepResult = await origStep();
    resolveStep(realStepResult);
    await Promise.all([stepPromise, placePromise]);

    expect(store.step()).toBe(1);
    expect(placeSpy).toHaveBeenCalledWith(expect.objectContaining({ seenStep: 0 }));
  });

  it('таймер пропускает тики, пока шаг в работе, и останавливается после pause()', async () => {
    vi.useFakeTimers();
    try {
      const stub = new StubArenaApi();
      let resolveStep!: (value: Awaited<ReturnType<StubArenaApi['step']>>) => void;
      const stepSpy = vi.spyOn(stub, 'step').mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveStep = resolve;
          }),
      );
      const { store } = setup(stub);
      await store.init();

      store.setSpeed(10); // 100 мс
      store.togglePlay();

      // Первый тик запускает шаг.
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      expect(stepSpy).toHaveBeenCalledTimes(1);

      // Следующие 5 тиков при незавершённом шаге не ставят новые шаги в очередь.
      vi.advanceTimersByTime(500);
      await Promise.resolve();
      expect(stepSpy).toHaveBeenCalledTimes(1);

      store.pause();
      resolveStep({
        step: 1,
        day: 2,
        finished: false,
        bars: {},
        paperStats: {},
        portfolio: store.portfolio(),
        orders: [],
        fills: [],
      });
      await Promise.resolve();
      await Promise.resolve();

      vi.advanceTimersByTime(500);
      expect(stepSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('estimateOrder отбрасывает запоздавший ответ после очистки поля лотов', async () => {
    const stub = new StubArenaApi();
    let resolveEstimate!: (value: { amountPct: number }) => void;
    vi.spyOn(stub, 'estimateOrder').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveEstimate = resolve;
        }),
    );
    const { store } = setup(stub);
    await store.init();

    const pending = store.estimateOrder('A', 5);
    await store.estimateOrder('A', null);
    resolveEstimate({ amountPct: 55.55 });
    await pending;

    expect(store.estimatedPct()).toBeNull();
  });
});

function apiReplace(store: ArenaStore, orderId: string) {
  return store.replaceOrder(orderId, {
    lots: 8,
    tif: 'gtc',
    limitPrice: 94,
  });
}

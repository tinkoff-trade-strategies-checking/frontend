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
    expect(store.step()).toBe(1);
    getItemSpy.mockRestore();
  });

  it('INV-1: stepOnce добавляет только одну новую свечу и не предзагружает будущее', async () => {
    const stub = new StubArenaApi();
    const stepSpy = vi.spyOn(stub, 'step');
    const { store } = setup(stub);

    await store.init();
    const initialLen = store.selectedPaper()!.candles.length;

    await store.stepOnce();
    expect(stepSpy).toHaveBeenCalledTimes(1);
    expect(store.step()).toBe(2);
    expect(store.selectedPaper()!.candles.length).toBe(initialLen + 1);
    expect(store.selectedPaper()!.candles.at(-1)?.step).toBe(2);
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
    expect(store.step()).toBe(3);

    const placed = await store.placeOrder({
      paperId: 'A',
      side: 'buy',
      type: 'limit',
      lots: 5,
      tif: 'day',
      limitPrice: 95,
    });
    expect(placeSpy).toHaveBeenCalledWith(expect.objectContaining({ seenStep: 3 }));

    const orderId = placed.order!.id;
    const replaced = await store.replaceOrder(orderId, {
      lots: 8,
      tif: 'gtc',
      limitPrice: 94,
    });
    expect(replaceSpy).toHaveBeenCalledWith(expect.objectContaining({ seenStep: 3, orderId }));

    await store.cancelOrder(replaced.order!.id);
    expect(cancelSpy).toHaveBeenCalledWith(
      expect.objectContaining({ seenStep: 3, orderId: replaced.order!.id }),
    );
  });

  it('INV-6: отображает метрики портфеля из источника без пересчёта на клиенте', async () => {
    const customSnapshot: ArenaSnapshot = {
      sessionId: 'S-MOCK',
      blind: true,
      step: 1,
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
              step: 1,
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
    const { store } = setup(stub);

    await store.init();
    expect(store.portfolio()).toEqual(customSnapshot.portfolio);
  });

  it('поддерживает скорости ×1, ×5, ×10, ×100, паузу и завершение сессии', async () => {
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
});

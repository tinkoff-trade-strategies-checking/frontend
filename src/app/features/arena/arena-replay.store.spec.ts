import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ArenaStore } from './arena.store';
import {
  ARENA_API,
  ArenaApi,
  ArenaCandle,
  ArenaFill,
  ArenaOrder,
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

const candle = (step: number): ArenaCandle => ({
  step,
  day: 1,
  candleInDay: step,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: 1,
});

const order = (id: string, extra: Partial<ArenaOrder> = {}): ArenaOrder => ({
  id,
  paperId: 'p1',
  side: 'buy',
  type: 'limit',
  lots: 1,
  filledLots: 0,
  tif: 'day',
  status: 'active',
  step: 0,
  seenStep: 0,
  ...extra,
});

const fill = (id: string, step: number): ArenaFill => ({
  id,
  orderId: 'o-1',
  paperId: 'p1',
  step,
  day: 1,
  candleInDay: step,
  side: 'buy',
  type: 'limit',
  lots: 1,
  price: 99,
  amountPct: 1,
  costPct: 0.1,
});

const snapshotAt0: ArenaSnapshot = {
  sessionId: 's',
  blind: true,
  step: 0,
  totalSteps: 40,
  day: 1,
  totalDays: 5,
  finished: false,
  papers: [
    {
      id: 'p1',
      label: 'SBER',
      sector: 'Финансы',
      candles: [candle(0)],
      changePct: 0,
      lastPrice: 100,
    },
  ],
  portfolio: PORTFOLIO,
  orders: [order('o-1')],
  fills: [],
};

/** Воспроизведение отдаёт приращение: только заявки и сделки, изменившиеся за `(fromStep; step]`. */
function increment(step: number, orders: ArenaOrder[], fills: ArenaFill[]): ArenaStepResult {
  const batch = Array.from({ length: 1 }, () => candle(step));
  return {
    step,
    day: 1,
    finished: false,
    bars: { p1: batch[0] },
    batches: { p1: batch },
    paperStats: { p1: { changePct: 0, lastPrice: 100 } },
    portfolio: PORTFOLIO,
    orders,
    fills,
    partial: true,
  };
}

describe('ArenaStore: воспроизведение приращениями (INV-4)', () => {
  afterEach(() => vi.useRealTimers());

  function setup(api: ArenaApi): ArenaStore {
    TestBed.configureTestingModule({
      providers: [{ provide: ARENA_API, useValue: api }, ArenaStore],
    });
    return TestBed.inject(ArenaStore);
  }

  it('заявки и сделки накапливаются по шагам и после трёх шагов равны снимку на том же шаге', async () => {
    const deltas = [
      increment(1, [], []),
      increment(2, [order('o-2', { step: 2 })], [fill('f-1', 2)]),
      increment(3, [order('o-1', { status: 'filled', filledLots: 1 })], [fill('f-2', 3)]),
    ];
    const step = vi.fn(async () => deltas.shift()!);
    const store = setup({
      getSnapshot: async () => snapshotAt0,
      step,
      estimateOrder: vi.fn(),
      placeOrder: vi.fn(),
      cancelOrder: vi.fn(),
      replaceOrder: vi.fn(),
      finishSession: vi.fn(),
    });
    await store.init();
    await store.stepOnce();
    await store.stepOnce();
    await store.stepOnce();

    // Снимок `SNAPSHOT` на шаге 3 содержал бы ровно это.
    expect(store.orders().map((o) => [o.id, o.status])).toEqual([
      ['o-1', 'filled'],
      ['o-2', 'active'],
    ]);
    expect(store.fills().map((f) => f.id)).toEqual(['f-1', 'f-2']);
    expect(store.selectedPaper()!.candles.map((c) => c.step)).toEqual([0, 1, 2, 3]);
  });

  it('полный список без признака partial (заглушки) по-прежнему заменяет заявки и сделки', async () => {
    const full: ArenaStepResult = {
      ...increment(1, [order('o-9')], [fill('f-9', 1)]),
      partial: undefined,
    };
    const store = setup({
      getSnapshot: async () => snapshotAt0,
      step: async () => full,
      estimateOrder: vi.fn(),
      placeOrder: vi.fn(),
      cancelOrder: vi.fn(),
      replaceOrder: vi.fn(),
      finishSession: vi.fn(),
    });
    await store.init();
    await store.stepOnce();
    expect(store.orders().map((o) => o.id)).toEqual(['o-9']);
  });

  it('на ×100 воспроизведение берёт пачку шагов за такт, а не запрос на каждый шаг', async () => {
    vi.useFakeTimers();
    const counts: (number | undefined)[] = [];
    let next = 0;
    const store = setup({
      batchStep: true,
      getSnapshot: async () => snapshotAt0,
      step: async (count?: number) => {
        counts.push(count);
        next += count ?? 1;
        return increment(next, [], []);
      },
      estimateOrder: vi.fn(),
      placeOrder: vi.fn(),
      cancelOrder: vi.fn(),
      replaceOrder: vi.fn(),
      finishSession: vi.fn(),
    });
    await store.init();
    store.setSpeed(100);
    store.togglePlay();
    await vi.advanceTimersByTimeAsync(650);
    store.pause();
    // 200 мс такт × ×100 = 20 шагов за запрос; запросов не больше трёх за 650 мс
    expect(counts.length).toBeGreaterThan(0);
    expect(counts.length).toBeLessThanOrEqual(3);
    expect(counts.every((c) => c === 20)).toBe(true);
  });

  it('источник без пачек (заглушки): по одному шагу за запрос', async () => {
    vi.useFakeTimers();
    const counts: (number | undefined)[] = [];
    let next = 0;
    const store = setup({
      getSnapshot: async () => snapshotAt0,
      step: async (count?: number) => {
        counts.push(count);
        next += 1;
        return increment(next, [], []);
      },
      estimateOrder: vi.fn(),
      placeOrder: vi.fn(),
      cancelOrder: vi.fn(),
      replaceOrder: vi.fn(),
      finishSession: vi.fn(),
    });
    await store.init();
    store.setSpeed(10);
    store.togglePlay();
    await vi.advanceTimersByTimeAsync(350);
    store.pause();
    expect(counts.length).toBeGreaterThan(1);
    expect(counts.every((c) => c === 1)).toBe(true);
  });
});

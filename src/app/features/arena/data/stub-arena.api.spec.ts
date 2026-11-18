import { StubArenaApi } from './stub-arena.api';

describe('StubArenaApi', () => {
  it('INV-1: снимок и шаги не отдают свечи дальше текущего курсора', async () => {
    const api = new StubArenaApi();
    const snap = await api.getSnapshot();

    for (const paper of snap.papers) {
      const maxStep = Math.max(...paper.candles.map((c) => c.step));
      expect(maxStep).toBe(snap.step);
      expect(paper.candles.every((c) => c.step <= snap.step)).toBe(true);
    }

    for (let i = 0; i < 5; i++) {
      const prevStep = (await api.getSnapshot()).step;
      const res = await api.step();
      expect(res.step).toBe(prevStep + 1);
      for (const paper of snap.papers) {
        expect(res.bars[paper.id].step).toBe(res.step);
      }
    }
  });

  it('INV-2: команды заявки, отмены и замены требуют актуальный seenStep', async () => {
    const api = new StubArenaApi();
    const snap = await api.getSnapshot();

    const futureOrder = await api.placeOrder({
      seenStep: snap.step + 1,
      paperId: 'A',
      side: 'buy',
      type: 'market',
      lots: 5,
      tif: 'day',
    });
    expect(futureOrder.accepted).toBe(false);

    const validOrder = await api.placeOrder({
      seenStep: snap.step,
      paperId: 'A',
      side: 'buy',
      type: 'limit',
      lots: 5,
      tif: 'day',
      limitPrice: 95,
    });
    expect(validOrder.accepted).toBe(true);
    expect(validOrder.order?.createdStep).toBe(snap.step);

    const orderId = validOrder.order!.id;

    const badReplace = await api.replaceOrder({
      seenStep: snap.step + 2,
      orderId,
      lots: 10,
      tif: 'gtc',
      limitPrice: 94,
    });
    expect(badReplace.accepted).toBe(false);

    const okReplace = await api.replaceOrder({
      seenStep: snap.step,
      orderId,
      lots: 10,
      tif: 'gtc',
      limitPrice: 94,
    });
    expect(okReplace.accepted).toBe(true);
    expect(okReplace.order?.lots).toBe(10);

    const okCancel = await api.cancelOrder({
      seenStep: snap.step,
      orderId: okReplace.order!.id,
    });
    expect(okCancel.accepted).toBe(true);
    expect(okCancel.orders.every((o) => o.status === 'cancelled')).toBe(true);
  });

  it('INV-7: в слепом режиме нет запрещённых полей, реальных дат и рублёвых сумм', async () => {
    const api = new StubArenaApi();
    const snap = await api.getSnapshot();
    const serialized = JSON.stringify(snap);

    expect(snap.blind).toBe(true);
    expect(serialized).not.toContain('₽');
    for (const forbidden of ['ticker', 'realDate', 'timeOfDay', 'lotSize', 'priceStep']) {
      expect(serialized).not.toContain(forbidden);
    }

    for (const paper of snap.papers) {
      expect(paper.label).toMatch(/^Бумага [A-E]$/);
      expect(paper.sector.length).toBeGreaterThan(0);
      const startBar = paper.candles.find((c) => c.step === 1);
      expect(startBar?.open).toBe(100);
    }

    expect(snap.portfolio.equityPct).toBe(100);
    expect(snap.portfolio.cashPct).toBe(100);
  });

  it('рыночная заявка исполняется по open следующей свечи и обновляет портфель', async () => {
    const api = new StubArenaApi();
    const snap = await api.getSnapshot();

    const placed = await api.placeOrder({
      seenStep: snap.step,
      paperId: 'A',
      side: 'buy',
      type: 'market',
      lots: 10,
      tif: 'day',
    });
    expect(placed.accepted).toBe(true);

    const next = await api.step();
    expect(next.fills.length).toBe(1);
    expect(next.fills[0].price).toBe(next.bars['A'].open);
    expect(next.portfolio.positions['A'].lots).toBe(10);
    expect(next.portfolio.cashPct).toBeLessThan(100);
    expect(next.portfolio.costsPct).toBeGreaterThan(0);
  });

  it('валидирует трейлинг-стоп (только продажа, 0 < d <= 50) и OCO (стоп < тейк)', async () => {
    const api = new StubArenaApi();
    const { step } = await api.getSnapshot();

    const badTrailSide = await api.placeOrder({
      seenStep: step,
      paperId: 'A',
      side: 'buy',
      type: 'trailing',
      lots: 5,
      tif: 'gtc',
      trailingPct: 5,
    });
    expect(badTrailSide.accepted).toBe(false);

    const badTrailPct = await api.placeOrder({
      seenStep: step,
      paperId: 'A',
      side: 'sell',
      type: 'trailing',
      lots: 5,
      tif: 'gtc',
      trailingPct: 60,
    });
    expect(badTrailPct.accepted).toBe(false);

    const badOco = await api.placeOrder({
      seenStep: step,
      paperId: 'A',
      side: 'sell',
      type: 'oco',
      lots: 5,
      tif: 'gtc',
      stopPrice: 110,
      takeProfitPrice: 105,
    });
    expect(badOco.accepted).toBe(false);
  });

  it('finishSession запрещает новые заявки после завершения', async () => {
    const api = new StubArenaApi();
    const fin = await api.finishSession();
    expect(fin.finishedAtStep).toBe(1);

    const res = await api.placeOrder({
      seenStep: 1,
      paperId: 'A',
      side: 'buy',
      type: 'market',
      lots: 1,
      tif: 'day',
    });
    expect(res.accepted).toBe(false);
  });
});

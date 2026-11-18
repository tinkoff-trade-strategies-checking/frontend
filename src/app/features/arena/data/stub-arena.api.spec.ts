import { StubArenaApi } from './stub-arena.api';

function assertNoBlindLeaks(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toContain('₽');
  for (const forbidden of ['ticker', 'realDate', 'timeOfDay', 'lotSize', 'priceStep']) {
    expect(serialized).not.toContain(forbidden);
  }
}

describe('StubArenaApi', () => {
  it('INV-1: снимок после нескольких шагов и сами шаги не отдают свечи дальше курсора', async () => {
    const api = new StubArenaApi();
    const initial = await api.getSnapshot();

    for (const paper of initial.papers) {
      expect(Math.max(...paper.candles.map((c) => c.step))).toBe(initial.step);
    }

    for (let i = 0; i < 4; i++) {
      const prevStep = (await api.getSnapshot()).step;
      const res = await api.step();
      expect(res.step).toBe(prevStep + 1);
      for (const paper of initial.papers) {
        expect(res.bars[paper.id].step).toBe(res.step);
      }
    }

    const afterSteps = await api.getSnapshot();
    expect(afterSteps.step).toBe(4);
    for (const paper of afterSteps.papers) {
      expect(Math.max(...paper.candles.map((c) => c.step))).toBe(afterSteps.step);
      expect(paper.candles.every((c) => c.step <= afterSteps.step)).toBe(true);
    }
  });

  it('INV-2: различает step и seenStep (seenStep < step принимается, seenStep > step отклоняется)', async () => {
    const api = new StubArenaApi();
    await api.step();
    await api.step();
    const snap = await api.getSnapshot();
    expect(snap.step).toBe(2);

    const futureOrder = await api.placeOrder({
      seenStep: snap.step + 1,
      paperId: 'A',
      side: 'buy',
      type: 'market',
      lots: 5,
      tif: 'day',
    });
    expect(futureOrder.accepted).toBe(false);
    expect(futureOrder.reason).toBe('INVALID_PARAMS');
    expect(futureOrder.field).toBe('seenStep');

    const laggedOrder = await api.placeOrder({
      seenStep: snap.step - 1,
      paperId: 'A',
      side: 'buy',
      type: 'limit',
      lots: 5,
      tif: 'day',
      limitPrice: 95,
    });
    expect(laggedOrder.accepted).toBe(true);
    expect(laggedOrder.order?.step).toBe(2);
    expect(laggedOrder.order?.seenStep).toBe(1);

    const okReplace = await api.replaceOrder({
      seenStep: snap.step - 1,
      orderId: laggedOrder.order!.id,
      lots: 10,
      tif: 'gtc',
      limitPrice: 94,
    });
    expect(okReplace.accepted).toBe(true);
    expect(okReplace.order?.step).toBe(2);
    expect(okReplace.order?.seenStep).toBe(1);

    const okCancel = await api.cancelOrder({
      seenStep: snap.step,
      orderId: okReplace.order!.id,
    });
    expect(okCancel.accepted).toBe(true);
    expect(okCancel.orders.every((o) => o.status === 'cancelled')).toBe(true);
  });

  it('INV-7: слепой режим (P0 = open шага 0, V_rel, без запрещённых полей в снимке, шагах и командах)', async () => {
    const api = new StubArenaApi();
    const snap = await api.getSnapshot();
    assertNoBlindLeaks(snap);

    for (const paper of snap.papers) {
      expect(paper.label).toMatch(/^Бумага [A-E]$/);
      expect(paper.sector.length).toBeGreaterThan(0);
      const stepZero = paper.candles.find((c) => c.step === 0);
      expect(stepZero?.open).toBe(100);
      const warmup = paper.candles.filter((c) => c.step < 0);
      const avgWarmupVol = warmup.reduce((sum, b) => sum + b.volume, 0) / warmup.length;
      expect(avgWarmupVol).toBeCloseTo(100, 0);
    }

    const stepRes = await api.step();
    assertNoBlindLeaks(stepRes);

    const cmdRes = await api.placeOrder({
      seenStep: stepRes.step,
      paperId: 'A',
      side: 'buy',
      type: 'market',
      lots: 5,
      tif: 'day',
    });
    assertNoBlindLeaks(cmdRes);
  });

  it('заявка не исполняется на шаге подачи, а рыночная исполняется на open следующей свечи', async () => {
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
    expect((await api.getSnapshot()).fills.length).toBe(0);

    const next = await api.step();
    expect(next.fills.length).toBe(1);
    expect(next.fills[0].price).toBe(next.bars['A'].open);
    expect(next.portfolio.positions['A'].lots).toBe(10);
    expect(next.portfolio.cashPct).toBeLessThan(100);
    expect(next.portfolio.costsPct).toBeGreaterThan(0);
  });

  it('проверяет коды отказов INSUFFICIENT_CASH, INSUFFICIENT_POSITION, INVALID_PARAMS и SESSION_NOT_ACTIVE', async () => {
    const api = new StubArenaApi();
    const { step } = await api.getSnapshot();

    const noCash = await api.placeOrder({
      seenStep: step,
      paperId: 'A',
      side: 'buy',
      type: 'market',
      lots: 500,
      tif: 'day',
    });
    expect(noCash.accepted).toBe(false);
    expect(noCash.reason).toBe('INSUFFICIENT_CASH');

    const noPos = await api.placeOrder({
      seenStep: step,
      paperId: 'A',
      side: 'sell',
      type: 'market',
      lots: 1,
      tif: 'day',
    });
    expect(noPos.accepted).toBe(false);
    expect(noPos.reason).toBe('INSUFFICIENT_POSITION');

    // Покупаем 10 лотов, чтобы проверить тейк-профит <= close.
    await api.placeOrder({
      seenStep: step,
      paperId: 'A',
      side: 'buy',
      type: 'market',
      lots: 10,
      tif: 'day',
    });
    const afterBuy = await api.step();
    const currentClose = afterBuy.bars['A'].close;

    const badTp = await api.placeOrder({
      seenStep: afterBuy.step,
      paperId: 'A',
      side: 'sell',
      type: 'take_profit',
      lots: 5,
      tif: 'gtc',
      takeProfitPrice: currentClose,
    });
    expect(badTp.accepted).toBe(false);
    expect(badTp.reason).toBe('INVALID_PARAMS');
    expect(badTp.field).toBe('takeProfitPrice');

    const fin = await api.finishSession();
    expect(fin.finishedAtStep).toBe(afterBuy.step);

    const afterFinish = await api.placeOrder({
      seenStep: afterBuy.step,
      paperId: 'A',
      side: 'buy',
      type: 'market',
      lots: 1,
      tif: 'day',
    });
    expect(afterFinish.accepted).toBe(false);
    expect(afterFinish.reason).toBe('SESSION_NOT_ACTIVE');
  });
});

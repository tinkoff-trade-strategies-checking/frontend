import { mapOpenCandle, mapOrder, toPctString, toPriceString } from './arena.mappers';

describe('arena.mappers', () => {
  it('число → строка контракта без экспоненты и хвостовых нулей', () => {
    expect(toPriceString(99.1)).toBe('99.1');
    expect(toPriceString(100)).toBe('100');
    expect(toPriceString(0.0000001)).toBe('0.0000001');
    expect(toPriceString(1e-9)).toBe('0.000000001');
    expect(toPctString(2.5)).toBe('2.5');
    expect(toPriceString(1234567.89)).toMatch(/^\d+(\.\d{1,9})?$/);
  });

  it('раскрытая свеча: дата и время по Москве, объём в лотах', () => {
    const candle = mapOpenCandle({
      step: 3,
      day: 1,
      candleInDay: 3,
      openedAt: '2020-02-26T07:00:00Z',
      open: '10.5',
      high: '11',
      low: '10',
      close: '10.7',
      volume: 1200,
      afterHalt: false,
    });
    expect(candle.fullDateLabel).toBe('26.02.2020 10:00');
    expect(candle.dateLabel).toBe('26.02.2020');
    expect(candle.volume).toBe(1200);
  });

  it('заявка: null → отсутствует, причина снятия сохраняется', () => {
    const order = mapOrder({
      mode: 'BLIND',
      paperIndex: 1,
      id: 'o',
      side: 'sell',
      type: 'trailing',
      lots: 2,
      filledLots: 0,
      tif: 'gtc',
      status: 'cancelled',
      step: 5,
      seenStep: 5,
      closedStep: 6,
      ocoSiblingId: null,
      limitPrice: null,
      stopPrice: null,
      takeProfitPrice: null,
      trailingPct: '3',
      trailingStopLevel: '97.5',
      reason: 'CANCELLED_BY_USER',
      rejectField: null,
    });
    expect(order).toMatchObject({
      paperId: '1',
      trailingPct: 3,
      peakPrice: 97.5,
      rejectReason: 'CANCELLED_BY_USER',
    });
    expect(order.limitPrice).toBeUndefined();
  });
});

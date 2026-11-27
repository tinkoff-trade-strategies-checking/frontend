import { TestBed } from '@angular/core/testing';
import { StubInstrumentsApi } from './stub-instruments.api';

describe('StubInstrumentsApi', () => {
  let api: StubInstrumentsApi;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    api = TestBed.inject(StubInstrumentsApi);
  });

  it('возвращает ОФЗ, корпоративные и амортизируемые облигации', async () => {
    const bonds = await api.listBonds();
    expect(bonds.length).toBeGreaterThanOrEqual(5);
    expect(bonds.some((b) => b.bondType === 'OFZ')).toBe(true);
    expect(bonds.some((b) => b.bondType === 'CORPORATE')).toBe(true);
    expect(bonds.some((b) => b.amortized)).toBe(true);
  });

  it('пересчитывает полную цену и YTM при изменении цены в процентах от номинала', async () => {
    const lowPrice = await api.calculateBond('SU26238RMFS4', 50);
    const highPrice = await api.calculateBond('SU26238RMFS4', 90);

    expect(lowPrice.cleanPriceRub).toBe(500);
    expect(lowPrice.dirtyPriceRub).toBeGreaterThan(lowPrice.cleanPriceRub);
    expect(lowPrice.ytmPct).toBeGreaterThan(highPrice.ytmPct);
    expect(lowPrice.remainingCouponsCount).toBeGreaterThan(0);
  });

  it('возвращает БПИФ всех категорий, включая фонды ликвидности с RUONIA', async () => {
    const etfs = await api.listEtfs();
    expect(etfs.length).toBeGreaterThanOrEqual(6);
    expect(etfs.some((e) => e.tracksRuonia && e.category === 'LIQUIDITY')).toBe(true);
    expect(etfs.some((e) => e.category === 'EQUITY_INDEX')).toBe(true);
    expect(etfs.some((e) => e.category === 'BOND_INDEX')).toBe(true);
    expect(etfs.some((e) => e.category === 'GOLD')).toBe(true);
    expect(etfs.some((e) => e.category === 'CURRENCY')).toBe(true);
  });

  it('возвращает расчётные и поставочные фьючерсы и считает вариационную маржу для лонга и шорта', async () => {
    const futures = await api.listFutures();
    expect(futures.length).toBeGreaterThanOrEqual(6);
    expect(futures.some((f) => f.settlementType === 'CASH')).toBe(true);
    expect(futures.some((f) => f.settlementType === 'DELIVERY')).toBe(true);

    const longCalc = await api.calculateFutures('SiH7', {
      entryPrice: 95000,
      currentPrice: 96000,
      contracts: 2,
    });
    const shortCalc = await api.calculateFutures('SiH7', {
      entryPrice: 95000,
      currentPrice: 96000,
      contracts: -2,
    });

    expect(longCalc.variationMarginRub).toBe(2000);
    expect(shortCalc.variationMarginRub).toBe(-2000);
    expect(longCalc.initialMarginTotalRub).toBe(29000);
    expect(longCalc.effectiveLeverage).toBeGreaterThan(1);
  });

  it('возвращает Call и Put опционы и рассчитывает 5 греков по Блэку — Шоулзу', async () => {
    const options = await api.listOptions();
    expect(options.length).toBeGreaterThanOrEqual(6);
    expect(options.some((o) => o.optionType === 'CALL')).toBe(true);
    expect(options.some((o) => o.optionType === 'PUT')).toBe(true);

    const callGreeks = await api.calculateOptionGreeks('Si96000BC7', {
      spot: 96000,
      volatilityPct: 25,
      riskFreeRatePct: 16,
    });
    const putGreeks = await api.calculateOptionGreeks('Si95000BO7', {
      spot: 95000,
      volatilityPct: 25,
      riskFreeRatePct: 16,
    });

    expect(callGreeks.delta).toBeGreaterThan(0);
    expect(callGreeks.delta).toBeLessThan(1);
    expect(putGreeks.delta).toBeLessThan(0);
    expect(putGreeks.delta).toBeGreaterThan(-1);
    expect(callGreeks.gamma).toBeGreaterThan(0);
    expect(callGreeks.vega).toBeGreaterThan(0);
    expect(callGreeks.theta).toBeLessThan(0);
    expect(callGreeks.premium).toBeGreaterThan(0);
  });
});

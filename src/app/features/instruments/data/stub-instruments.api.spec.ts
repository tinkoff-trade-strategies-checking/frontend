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

  it('возвращает дивиденды T+1 и считает чистую выплату после НДФЛ 13% и 15%', async () => {
    const dividends = await api.listDividends();
    expect(dividends.length).toBeGreaterThanOrEqual(8);

    const calc13 = await api.calculateDividendPayout('SBER', { shares: 100, taxRatePct: 13 });
    const calc15 = await api.calculateDividendPayout('SBER', { shares: 100, taxRatePct: 15 });

    expect(calc13.grossPayoutRub).toBe(3484);
    expect(calc13.taxWithheldRub).toBeCloseTo(452.92, 2);
    expect(calc13.netPayoutRub).toBeGreaterThan(calc15.netPayoutRub);
    expect(calc13.lastBuyDate).toBeTruthy();
  });

  it('считает налоги НДФЛ, сальдирование, вычеты ИИС и доходность DCA / XIRR', async () => {
    const iisA = await api.calculateTax({
      accountType: 'IIS_A',
      grossProfitRub: 250000,
      priorLossesRub: 50000,
      dividendsRub: 40000,
      annualContributionsRub: 400000,
    });
    const iisB = await api.calculateTax({
      accountType: 'IIS_B',
      grossProfitRub: 250000,
      priorLossesRub: 50000,
      dividendsRub: 40000,
      annualContributionsRub: 400000,
    });

    expect(iisA.lossOffsetUsedRub).toBe(50000);
    expect(iisA.taxableProfitRub).toBe(200000);
    expect(iisA.iisDeductionRefundRub).toBe(52000);
    expect(iisB.tradingTaxRub).toBe(0);
    expect(iisB.iisDeductionRefundRub).toBe(0);

    const dca = await api.calculateDca({
      cashflows: [
        { date: '2025-01-15', amountRub: 50000 },
        { date: '2025-04-15', amountRub: 50000 },
        { date: '2025-07-15', amountRub: 50000 },
        { date: '2025-10-15', amountRub: 50000 },
      ],
      finalValueRub: 236000,
      finalDate: '2026-01-15',
    });

    expect(dca.totalContributedRub).toBe(200000);
    expect(dca.netProfitRub).toBe(36000);
    expect(dca.simpleReturnPct).toBe(18);
    expect(dca.xirrPct).toBeGreaterThan(18);
    expect(dca.cashflowsCount).toBe(4);
  });

  it('возвращает бумаги скринера, события календаря и поддерживает CRUD алертов', async () => {
    const papers = await api.listScreenerPapers();
    expect(papers.length).toBeGreaterThanOrEqual(10);
    expect(papers.some((p) => p.hasFundamentals)).toBe(true);
    expect(papers.some((p) => !p.hasFundamentals)).toBe(true);

    const cbrEvents = await api.listMarketEvents('CBR_RATE');
    expect(cbrEvents.length).toBeGreaterThan(0);
    expect(cbrEvents.every((e) => e.eventType === 'CBR_RATE')).toBe(true);

    const initialAlerts = await api.listAlerts();
    const created = await api.createAlert({
      ticker: 'ydex',
      conditionType: 'PRICE_BELOW',
      thresholdValue: 3800,
      note: 'Тестовый алерт',
    });
    expect(created.ticker).toBe('YDEX');
    expect((await api.listAlerts()).length).toBe(initialAlerts.length + 1);

    await api.deleteAlert(created.id);
    expect((await api.listAlerts()).length).toBe(initialAlerts.length);
  });
});

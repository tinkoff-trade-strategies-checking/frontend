import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { INSTRUMENTS_API, InstrumentsApi } from './data/instruments.models';
import { StubInstrumentsApi } from './data/stub-instruments.api';
import { InstrumentsStore } from './instruments.store';

describe('InstrumentsStore', () => {
  let store: InstrumentsStore;
  let api: InstrumentsApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: INSTRUMENTS_API, useClass: StubInstrumentsApi }, InstrumentsStore],
    });
    api = TestBed.inject(INSTRUMENTS_API);
    store = TestBed.inject(InstrumentsStore);
  });

  it('лениво загружает вкладки: при init запрашивает только облигации, остальные — при переключении', async () => {
    const bondsSpy = vi.spyOn(api, 'listBonds');
    const etfsSpy = vi.spyOn(api, 'listEtfs');
    await store.init();
    expect(bondsSpy).toHaveBeenCalledTimes(1);
    expect(etfsSpy).not.toHaveBeenCalled();
    expect(store.bonds().length).toBeGreaterThan(0);
    expect(store.selectedBondTicker()).toBe(store.bonds()[0].ticker);
    expect(store.calcResult()?.ticker).toBe(store.bonds()[0].ticker);

    await store.setActiveTab('etfs');
    expect(etfsSpy).toHaveBeenCalledTimes(1);
    expect(store.etfs().length).toBeGreaterThan(0);
    // Повторное переключение не делает лишних запросов.
    await store.setActiveTab('bonds');
    await store.setActiveTab('etfs');
    expect(etfsSpy).toHaveBeenCalledTimes(1);
  });

  it('фильтрует облигации по типу, амортизации и поисковому запросу', async () => {
    await store.init();

    store.bondFilter.set('ofz');
    expect(store.filteredBonds().every((b) => b.bondType === 'OFZ')).toBe(true);

    store.bondFilter.set('corporate');
    expect(store.filteredBonds().every((b) => b.bondType === 'CORPORATE')).toBe(true);

    store.bondFilter.set('amortized');
    expect(store.filteredBonds().length).toBeGreaterThan(0);
    expect(store.filteredBonds().every((b) => b.amortized)).toBe(true);

    store.bondFilter.set('all');
    store.bondQuery.set('сбер');
    expect(store.filteredBonds().length).toBe(1);
    expect(store.filteredBonds()[0].issuer).toContain('Сбер');
  });

  it('фильтрует БПИФ по категории и поиску', async () => {
    await store.init();
    await store.setActiveTab('etfs');

    store.etfFilter.set('liquidity');
    expect(store.filteredEtfs().length).toBeGreaterThan(0);
    expect(store.filteredEtfs().every((e) => e.tracksRuonia)).toBe(true);

    store.etfFilter.set('gold_currency');
    expect(store.filteredEtfs().some((e) => e.category === 'GOLD')).toBe(true);
    expect(store.filteredEtfs().some((e) => e.category === 'CURRENCY')).toBe(true);

    store.etfFilter.set('all');
    store.etfQuery.set('золото');
    expect(store.filteredEtfs().some((e) => e.ticker === 'GOLD')).toBe(true);
  });

  it('вызывает серверный расчёт при изменении цены и сбрасывает к текущей', async () => {
    const calcSpy = vi.spyOn(api, 'calculateBond');
    await store.init();
    const firstBond = store.bonds()[0];

    await store.updateCalcPricePct(80);
    expect(calcSpy).toHaveBeenLastCalledWith(firstBond.ticker, 80);
    expect(store.calcResult()?.pricePct).toBe(80);

    await store.resetCalcPrice();
    expect(calcSpy).toHaveBeenLastCalledWith(firstBond.ticker, firstBond.pricePct);
    expect(store.calcPricePct()).toBe(firstBond.pricePct);
  });

  it('фильтрует фьючерсы и передаёт знак контрактов при переключении Лонг / Шорт', async () => {
    const calcSpy = vi.spyOn(api, 'calculateFutures');
    await store.init();
    await store.setActiveTab('futures');

    expect(store.futures().length).toBeGreaterThan(0);
    expect(store.selectedFutureTicker()).toBe(store.futures()[0].ticker);

    store.futuresFilter.set('cash');
    expect(store.filteredFutures().every((f) => f.settlementType === 'CASH')).toBe(true);

    store.futuresFilter.set('delivery');
    expect(store.filteredFutures().length).toBeGreaterThan(0);
    expect(store.filteredFutures().every((f) => f.settlementType === 'DELIVERY')).toBe(true);

    store.futuresFilter.set('all');
    store.futuresQuery.set('brent');
    expect(store.filteredFutures().some((f) => f.ticker === 'BRF7')).toBe(true);

    await store.updateFuturesContracts(3);
    await store.updateFuturesDirection('SHORT');
    expect(calcSpy).toHaveBeenLastCalledWith(
      store.futures()[0].ticker,
      expect.objectContaining({ contracts: -3 }),
    );
    expect(store.futuresCalcResult()?.contracts).toBe(-3);
  });

  it('фильтрует опционы Call / Put и пересчитывает греки при изменении параметров', async () => {
    const calcSpy = vi.spyOn(api, 'calculateOptionGreeks');
    await store.init();
    await store.setActiveTab('options');

    expect(store.options().length).toBeGreaterThan(0);
    expect(store.selectedOptionTicker()).toBe(store.options()[0].ticker);

    store.optionFilter.set('call');
    expect(store.filteredOptions().every((o) => o.optionType === 'CALL')).toBe(true);

    store.optionFilter.set('put');
    expect(store.filteredOptions().length).toBeGreaterThan(0);
    expect(store.filteredOptions().every((o) => o.optionType === 'PUT')).toBe(true);

    await store.updateOptionVolatilityPct(40);
    await store.updateOptionRiskFreeRatePct(18);
    expect(calcSpy).toHaveBeenLastCalledWith(
      store.options()[0].ticker,
      expect.objectContaining({ volatilityPct: 40, riskFreeRatePct: 18 }),
    );
    expect(store.optionCalcResult()?.impliedVolPct).toBe(40);
  });

  it('загружает дивиденды, фильтрует по тикеру/компании и пересчитывает выплату при смене НДФЛ', async () => {
    const calcSpy = vi.spyOn(api, 'calculateDividendPayout');
    await store.init();
    await store.setActiveTab('dividends');

    expect(store.dividends().length).toBeGreaterThan(0);
    expect(store.selectedDividend()?.ticker).toBe(store.dividends()[0].ticker);

    store.dividendQuery.set('лукойл');
    expect(store.filteredDividends().some((d) => d.ticker === 'LKOH')).toBe(true);

    await store.updateDividendShares(250);
    await store.updateDividendTaxRate(15);
    expect(calcSpy).toHaveBeenLastCalledWith(
      store.dividends()[0].ticker,
      expect.objectContaining({ shares: 250, taxRatePct: 15 }),
    );
    expect(store.dividendCalcResult()?.taxRatePct).toBe(15);
  });

  it('пересчитывает налоги ИИС и DCA / XIRR при изменении параметров и добавлении строк', async () => {
    const taxSpy = vi.spyOn(api, 'calculateTax');
    const dcaSpy = vi.spyOn(api, 'calculateDca');
    await store.init();
    await store.setActiveTab('tax_dca');

    expect(store.taxCalcResult()).not.toBeNull();
    expect(store.dcaCalcResult()).not.toBeNull();

    await store.updateTaxAccountType('IIS_3');
    expect(taxSpy).toHaveBeenLastCalledWith(expect.objectContaining({ accountType: 'IIS_3' }));
    expect(store.taxCalcResult()?.tradingTaxRub).toBe(0);
    expect(store.taxCalcResult()?.iisDeductionRefundRub).toBeGreaterThan(0);

    const initialLen = store.dcaCashflows().length;
    await store.addDcaCashflow();
    expect(store.dcaCashflows().length).toBe(initialLen + 1);
    expect(dcaSpy).toHaveBeenCalled();

    await store.removeDcaCashflow(0);
    expect(store.dcaCashflows().length).toBe(initialLen);
  });

  it('фильтрует и сортирует скринер акций по пресетам, сектору и числовым порогам', async () => {
    await store.init();
    await store.setActiveTab('screener');
    expect(store.screenerPapers().length).toBeGreaterThanOrEqual(10);
    expect(store.screenerSectors().length).toBeGreaterThanOrEqual(3);

    store.applyScreenerPreset('dividend_gt_10');
    expect(store.filteredScreenerPapers().length).toBeGreaterThan(0);
    expect(
      store.filteredScreenerPapers().every((p) => p.dividendYield !== null && p.dividendYield > 10),
    ).toBe(true);

    store.applyScreenerPreset('undervalued_pe_lt_6');
    expect(
      store
        .filteredScreenerPapers()
        .every((p) => p.peRatio !== null && p.peRatio > 0 && p.peRatio < 6),
    ).toBe(true);

    store.applyScreenerPreset('high_roe_gt_20');
    expect(store.filteredScreenerPapers().every((p) => p.roe !== null && p.roe > 20)).toBe(true);

    store.applyScreenerPreset('low_debt_lt_0_5');
    expect(
      store.filteredScreenerPapers().every((p) => p.debtToEquity !== null && p.debtToEquity < 0.5),
    ).toBe(true);

    store.resetScreenerFilters();
    store.screenerMaxPe.set(5);
    expect(store.filteredScreenerPapers().every((p) => p.peRatio !== null && p.peRatio <= 5)).toBe(
      true,
    );

    store.resetScreenerFilters();
    store.toggleScreenerSort('peRatio');
    const sorted = store.filteredScreenerPapers();
    const withPe = sorted.filter((p) => p.peRatio !== null);
    for (let i = 1; i < withPe.length; i++) {
      expect(withPe[i].peRatio!).toBeGreaterThanOrEqual(withPe[i - 1].peRatio!);
    }
    expect(sorted[sorted.length - 1].peRatio).toBeNull();
  });

  it('разбивает скринер на страницы по 50 строк и сбрасывает на 1-ю страницу при смене фильтра или сортировки', async () => {
    const manyPapers = Array.from({ length: 120 }, (_, i) => ({
      ticker: `T${String(i + 1).padStart(3, '0')}`,
      name: `Компания ${i + 1}`,
      sector: i % 2 === 0 ? 'Финансы' : 'Энергетика',
      marketCapRub: (120 - i) * 1_000_000_000,
      peRatio: 4 + (i % 10),
      pbRatio: 1.1,
      psRatio: 1.5,
      evEbitda: 5,
      roe: 18 + (i % 10),
      netMargin: 12,
      debtToEquity: 0.3,
      dividendYield: 8 + (i % 6),
      beta: 1.0,
      hasFundamentals: true,
    }));
    vi.spyOn(api, 'listScreenerPapers').mockResolvedValue(manyPapers);

    await store.init();
    await store.setActiveTab('screener');

    expect(store.screenerTotalPages()).toBe(3);
    expect(store.currentScreenerPage()).toBe(1);
    expect(store.visibleScreenerPapers()).toHaveLength(50);
    expect(store.visibleScreenerPapers()[0].ticker).toBe('T001');

    store.nextScreenerPage();
    expect(store.currentScreenerPage()).toBe(2);
    expect(store.visibleScreenerPapers()).toHaveLength(50);
    expect(store.visibleScreenerPapers()[0].ticker).toBe('T051');

    store.nextScreenerPage();
    expect(store.currentScreenerPage()).toBe(3);
    expect(store.visibleScreenerPapers()).toHaveLength(20);
    expect(store.visibleScreenerPapers()[0].ticker).toBe('T101');

    // Не выходит за последнюю страницу.
    store.nextScreenerPage();
    expect(store.currentScreenerPage()).toBe(3);

    store.prevScreenerPage();
    expect(store.currentScreenerPage()).toBe(2);

    // Смена сортировки сбрасывает на 1-ю страницу.
    store.toggleScreenerSort('ticker');
    expect(store.currentScreenerPage()).toBe(1);

    // Смена поиска сбрасывает на 1-ю страницу.
    store.nextScreenerPage();
    expect(store.currentScreenerPage()).toBe(2);
    store.setScreenerQuery('T0');
    expect(store.currentScreenerPage()).toBe(1);

    // Смена сектора сбрасывает на 1-ю страницу.
    store.setScreenerQuery('');
    store.nextScreenerPage();
    expect(store.currentScreenerPage()).toBe(2);
    store.setScreenerSector('Финансы');
    expect(store.currentScreenerPage()).toBe(1);
  });

  it('фильтрует события календаря и создаёт/удаляет алерты', async () => {
    await store.init();
    await store.setActiveTab('events_alerts');
    expect(store.marketEvents().length).toBeGreaterThan(0);

    store.eventFilter.set('CBR_RATE');
    expect(store.filteredMarketEvents().every((e) => e.eventType === 'CBR_RATE')).toBe(true);

    const beforeCount = store.alerts().length;
    const ok = await store.createAlert({
      ticker: 'GAZP',
      conditionType: 'RSI_BELOW',
      thresholdValue: 28,
      note: 'Перепроданность',
    });
    expect(ok).toBe(true);
    expect(store.alerts().length).toBe(beforeCount + 1);
    const createdId = store.alerts()[0].id;

    await store.deleteAlert(createdId);
    expect(store.alerts().length).toBe(beforeCount);
  });
});

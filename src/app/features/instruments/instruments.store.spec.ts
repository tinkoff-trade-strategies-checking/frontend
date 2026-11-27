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

  it('загружает облигации и БПИФ и автоматически выбирает первую облигацию для калькулятора', async () => {
    await store.init();
    expect(store.bonds().length).toBeGreaterThan(0);
    expect(store.etfs().length).toBeGreaterThan(0);
    expect(store.selectedBondTicker()).toBe(store.bonds()[0].ticker);
    expect(store.calcResult()?.ticker).toBe(store.bonds()[0].ticker);
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
});

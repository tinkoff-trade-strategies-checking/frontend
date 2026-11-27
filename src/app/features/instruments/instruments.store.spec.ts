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
});

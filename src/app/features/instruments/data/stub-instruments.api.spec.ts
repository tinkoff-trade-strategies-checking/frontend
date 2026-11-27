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
});

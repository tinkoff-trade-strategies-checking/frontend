import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpInstrumentsApi } from './http-instruments.api';

describe('HttpInstrumentsApi', () => {
  let api: HttpInstrumentsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(HttpInstrumentsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('загружает и мапит список облигаций из GET /api/v1/instruments/bonds', async () => {
    const promise = api.listBonds();
    const req = http.expectOne('/api/v1/instruments/bonds');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        ticker: 'SU26238RMFS4',
        name: 'ОФЗ-ПД 26238',
        issuer: 'Минфин РФ',
        bondType: 'OFZ',
        faceValueRub: '1000.00',
        couponRatePct: '7.10',
        couponValueRub: '35.40',
        couponPeriodDays: 182,
        nextCouponDate: '2026-12-02',
        maturityDate: '2041-05-15',
        offerDate: null,
        accruedInterestRub: '21.85',
        ytmPct: '14.85',
        durationYears: '7.62',
        amortized: false,
        pricePct: '56.40',
        currency: 'RUB',
      },
    ]);

    const bonds = await promise;
    expect(bonds).toHaveLength(1);
    expect(bonds[0]).toMatchObject({
      ticker: 'SU26238RMFS4',
      bondType: 'OFZ',
      faceValueRub: 1000,
      pricePct: 56.4,
      couponValueRub: 35.4,
      couponPeriodDays: 182,
      accruedInterestRub: 21.85,
      ytmPct: 14.85,
      amortized: false,
    });
  });

  it('вызывает серверный YTM-калькулятор GET /api/v1/instruments/bonds/{ticker}/calc', async () => {
    const promise = api.calculateBond('SU26238RMFS4', 62.5);
    const req = http.expectOne('/api/v1/instruments/bonds/SU26238RMFS4/calc?pricePct=62.50');
    expect(req.request.method).toBe('GET');
    req.flush({
      ticker: 'SU26238RMFS4',
      pricePct: '62.50',
      asOfDate: '2026-11-27',
      cleanPriceRub: '625.00',
      accruedInterestRub: '21.85',
      dirtyPriceRub: '646.85',
      currentYieldPct: '11.33',
      ytmPct: '13.42',
      remainingCouponsCount: 29,
      yearsToMaturity: '14.46',
      nextCouponDate: '2026-12-02',
      couponValueRub: '35.40',
      amortized: false,
    });

    const calc = await promise;
    expect(calc).toMatchObject({
      ticker: 'SU26238RMFS4',
      pricePct: 62.5,
      asOfDate: '2026-11-27',
      cleanPriceRub: 625,
      accruedInterestRub: 21.85,
      dirtyPriceRub: 646.85,
      currentYieldPct: 11.33,
      ytmPct: 13.42,
      remainingCouponsCount: 29,
      yearsToMaturity: 14.46,
    });
  });

  it('загружает и нормализует категории БПИФ/ETF из GET /api/v1/instruments/etfs', async () => {
    const promise = api.listEtfs();
    const req = http.expectOne('/api/v1/instruments/etfs');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        ticker: 'LQDT',
        name: 'ВИМ — Ликвидность',
        assetClass: 'ETF',
        category: 'LIQUIDITY',
        tracksRuonia: true,
        expenseRatioPct: '0.29',
        underlyingIndex: 'RUSFAR / RUONIA',
        navPriceRub: '1.72',
        currency: 'RUB',
        description: 'Фонд денежного рынка',
      },
      {
        ticker: 'GOLD',
        name: 'ВИМ — Золото',
        assetClass: 'METAL',
        category: 'GOLD',
        tracksRuonia: false,
        expenseRatioPct: '0.66',
        underlyingIndex: 'GLDRUB_TOM',
        navPriceRub: '2.38',
        currency: 'RUB',
        description: 'Фонд на физическое золото',
      },
    ]);

    const etfs = await promise;
    expect(etfs).toHaveLength(2);
    expect(etfs[0]).toMatchObject({
      ticker: 'LQDT',
      assetClass: 'ETF',
      category: 'LIQUIDITY',
      tracksRuonia: true,
      expenseRatioPct: 0.29,
    });
    expect(etfs[1]).toMatchObject({
      ticker: 'GOLD',
      assetClass: 'METAL',
      category: 'GOLD',
      tracksRuonia: false,
      expenseRatioPct: 0.66,
    });
  });
});

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

  it('загружает фьючерсы ФОРТС из GET /api/v1/instruments/futures', async () => {
    const promise = api.listFutures();
    const req = http.expectOne('/api/v1/instruments/futures');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        ticker: 'SiH7',
        name: 'Фьючерс USD/RUB (март 2027)',
        underlying: 'USD/RUB',
        contractSize: 1000,
        priceStep: '1.00',
        stepPriceRub: '1.00',
        initialMarginRub: '14500.00',
        lastPrice: '95400.00',
        expirationDate: '2027-03-18',
        settlementType: 'CASH',
        currency: 'RUB',
      },
      {
        ticker: 'SRH7',
        name: 'Фьючерс Сбербанк (март 2027)',
        underlying: 'SBER',
        contractSize: 100,
        priceStep: '1.00',
        stepPriceRub: '1.00',
        initialMarginRub: '5400.00',
        lastPrice: '28650.00',
        expirationDate: '2027-03-18',
        settlementType: 'DELIVERY',
        currency: 'RUB',
      },
    ]);

    const futures = await promise;
    expect(futures).toHaveLength(2);
    expect(futures[0]).toMatchObject({
      ticker: 'SiH7',
      settlementType: 'CASH',
      initialMarginRub: 14500,
      lastPrice: 95400,
    });
    expect(futures[1].settlementType).toBe('DELIVERY');
  });

  it('вызывает серверный калькулятор фьючерса GET /api/v1/instruments/futures/{ticker}/calc', async () => {
    const promise = api.calculateFutures('SiH7', {
      entryPrice: 95000,
      currentPrice: 96000,
      contracts: -2,
    });
    const req = http.expectOne(
      '/api/v1/instruments/futures/SiH7/calc?entryPrice=95000&currentPrice=96000&contracts=-2',
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      ticker: 'SiH7',
      entryPrice: '95000.00',
      currentPrice: '96000.00',
      contracts: -2,
      asOfDate: '2026-11-27',
      expirationDate: '2027-03-18',
      daysToExpiration: 111,
      expired: false,
      variationMarginRub: '-2000.00',
      initialMarginTotalRub: '29000.00',
      notionalRub: '192000.00',
      roeOnMarginPct: '-6.90',
      effectiveLeverage: '6.62',
    });

    const calc = await promise;
    expect(calc).toMatchObject({
      ticker: 'SiH7',
      contracts: -2,
      variationMarginRub: -2000,
      initialMarginTotalRub: 29000,
      roeOnMarginPct: -6.9,
      effectiveLeverage: 6.62,
      daysToExpiration: 111,
    });
  });

  it('загружает опционы и рассчитывает греки через GET /api/v1/instruments/options/{ticker}/calc', async () => {
    const listPromise = api.listOptions();
    const listReq = http.expectOne('/api/v1/instruments/options');
    expect(listReq.request.method).toBe('GET');
    listReq.flush([
      {
        ticker: 'Si96000BC7',
        name: 'Si Call 96 000',
        underlying: 'SiH7',
        optionType: 'CALL',
        strike: '96000.00',
        expirationDate: '2027-03-18',
        underlyingPrice: '95400.00',
        impliedVolPct: '22.50',
        riskFreeRatePct: '16.00',
        contractSize: 1,
        initialMarginRub: '7200.00',
      },
    ]);

    const options = await listPromise;
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({
      ticker: 'Si96000BC7',
      optionType: 'CALL',
      strike: 96000,
      impliedVolPct: 22.5,
    });

    const calcPromise = api.calculateOptionGreeks('Si96000BC7', {
      spot: 97000,
      volatilityPct: 25,
      riskFreeRatePct: 16,
    });
    const calcReq = http.expectOne(
      '/api/v1/instruments/options/Si96000BC7/calc?spot=97000&volatilityPct=25&riskFreeRatePct=16',
    );
    expect(calcReq.request.method).toBe('GET');
    calcReq.flush({
      ticker: 'Si96000BC7',
      optionType: 'CALL',
      spot: '97000.00',
      strike: '96000.00',
      impliedVolPct: '25.00',
      riskFreeRatePct: '16.00',
      asOfDate: '2026-11-27',
      expirationDate: '2027-03-18',
      daysToExpiration: 111,
      expired: false,
      premium: '8420.15',
      intrinsicValue: '1000.00',
      timeValue: '7420.15',
      delta: '0.6712',
      gamma: '0.000027',
      theta: '-38.45',
      vega: '193.20',
      rho: '172.10',
    });

    const greeks = await calcPromise;
    expect(greeks).toMatchObject({
      ticker: 'Si96000BC7',
      optionType: 'CALL',
      premium: 8420.15,
      intrinsicValue: 1000,
      timeValue: 7420.15,
      delta: 0.6712,
      theta: -38.45,
      vega: 193.2,
      rho: 172.1,
    });
  });
});

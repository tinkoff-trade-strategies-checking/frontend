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

  it('загружает дивиденды и рассчитывает выплату через GET /api/v1/instruments/dividends', async () => {
    const listPromise = api.listDividends('sber');
    const listReq = http.expectOne('/api/v1/instruments/dividends?ticker=SBER');
    expect(listReq.request.method).toBe('GET');
    listReq.flush([
      {
        id: 1,
        ticker: 'SBER',
        issuerName: 'ПАО Сбербанк',
        recordDate: '2026-07-17',
        exDividendDate: '2026-07-17',
        lastBuyDate: '2026-07-16',
        paymentDate: '2026-08-05',
        dividendPerShareRub: '34.84',
        yieldPct: '11.45',
        estimatedGapPct: '9.96',
        currency: 'RUB',
      },
    ]);

    const dividends = await listPromise;
    expect(dividends).toHaveLength(1);
    expect(dividends[0]).toMatchObject({
      ticker: 'SBER',
      dividendPerShareRub: 34.84,
      yieldPct: 11.45,
      estimatedGapPct: 9.96,
      lastBuyDate: '2026-07-16',
    });

    const calcPromise = api.calculateDividendPayout('SBER', { shares: 200, taxRatePct: 15 });
    const calcReq = http.expectOne(
      '/api/v1/instruments/dividends/SBER/calc?shares=200&taxRatePct=15',
    );
    expect(calcReq.request.method).toBe('GET');
    calcReq.flush({
      ticker: 'SBER',
      issuerName: 'ПАО Сбербанк',
      shares: 200,
      taxRatePct: '15.00',
      dividendPerShareRub: '34.84',
      grossPayoutRub: '6968.00',
      taxWithheldRub: '1045.20',
      netPayoutRub: '5922.80',
      lastBuyDate: '2026-07-16',
      exDividendDate: '2026-07-17',
      recordDate: '2026-07-17',
      paymentDate: '2026-08-05',
      yieldPct: '11.45',
      estimatedGapPct: '9.96',
      currency: 'RUB',
    });

    const payout = await calcPromise;
    expect(payout).toMatchObject({
      ticker: 'SBER',
      shares: 200,
      taxRatePct: 15,
      grossPayoutRub: 6968,
      taxWithheldRub: 1045.2,
      netPayoutRub: 5922.8,
    });
  });

  it('отправляет decimal-строки в POST /api/v1/instruments/tax/calc и /dca/calc', async () => {
    const taxPromise = api.calculateTax({
      accountType: 'IIS_A',
      grossProfitRub: 250000,
      priorLossesRub: 50000,
      dividendsRub: 40000,
      annualContributionsRub: 400000,
    });
    const taxReq = http.expectOne('/api/v1/instruments/tax/calc');
    expect(taxReq.request.method).toBe('POST');
    expect(taxReq.request.body).toEqual({
      accountType: 'IIS_A',
      grossProfitRub: '250000.00',
      priorLossesRub: '50000.00',
      dividendsRub: '40000.00',
      annualContributionsRub: '400000.00',
    });
    taxReq.flush({
      accountType: 'IIS_A',
      taxableProfitRub: '200000.00',
      lossOffsetUsedRub: '50000.00',
      tradingTaxRub: '26000.00',
      dividendTaxRub: '5200.00',
      totalTaxRub: '31200.00',
      iisDeductionRefundRub: '52000.00',
      netAfterTaxRub: '310800.00',
      effectiveTaxRatePct: '-7.17',
    });

    const tax = await taxPromise;
    expect(tax).toMatchObject({
      accountType: 'IIS_A',
      taxableProfitRub: 200000,
      lossOffsetUsedRub: 50000,
      iisDeductionRefundRub: 52000,
      netAfterTaxRub: 310800,
    });

    const dcaPromise = api.calculateDca({
      cashflows: [
        { date: '2025-01-15', amountRub: 50000 },
        { date: '2025-07-15', amountRub: 50000 },
      ],
      finalValueRub: 120000,
      finalDate: '2026-01-15',
    });
    const dcaReq = http.expectOne('/api/v1/instruments/dca/calc');
    expect(dcaReq.request.method).toBe('POST');
    expect(dcaReq.request.body).toEqual({
      cashflows: [
        { date: '2025-01-15', amountRub: '50000.00' },
        { date: '2025-07-15', amountRub: '50000.00' },
      ],
      finalValueRub: '120000.00',
      finalDate: '2026-01-15',
    });
    dcaReq.flush({
      totalContributedRub: '100000.00',
      totalWithdrawnRub: '0.00',
      netInvestedRub: '100000.00',
      finalValueRub: '120000.00',
      netProfitRub: '20000.00',
      simpleReturnPct: '20.00',
      xirrPct: '27.45',
      twrPct: '21.10',
      holdingDays: 365,
      cashflowsCount: 2,
    });

    const dca = await dcaPromise;
    expect(dca).toMatchObject({
      totalContributedRub: 100000,
      netProfitRub: 20000,
      simpleReturnPct: 20,
      xirrPct: 27.45,
      twrPct: 21.1,
      holdingDays: 365,
      cashflowsCount: 2,
    });
  });

  it('загружает скринер акций и календарь событий с фильтрами', async () => {
    const screenerPromise = api.listScreenerPapers();
    const screenerReq = http.expectOne('/api/v1/instruments/screener');
    expect(screenerReq.request.method).toBe('GET');
    screenerReq.flush([
      {
        ticker: 'SBER',
        name: 'Сбербанк',
        sector: 'Финансы',
        marketCapRub: '6650000000000.00',
        peRatio: '4.20',
        pbRatio: '0.95',
        psRatio: '2.10',
        evEbitda: null,
        roe: '24.10',
        netMargin: '36.50',
        debtToEquity: '0.35',
        dividendYield: '11.45',
        beta: '0.96',
        hasFundamentals: true,
      },
      {
        ticker: 'ABRD',
        name: 'Абрау-Дюрсо',
        sector: 'Потребительский',
        marketCapRub: null,
        peRatio: null,
        pbRatio: null,
        psRatio: null,
        evEbitda: null,
        roe: null,
        netMargin: null,
        debtToEquity: null,
        dividendYield: null,
        beta: null,
        hasFundamentals: false,
      },
    ]);

    const papers = await screenerPromise;
    expect(papers).toHaveLength(2);
    expect(papers[0]).toMatchObject({
      ticker: 'SBER',
      peRatio: 4.2,
      roe: 24.1,
      evEbitda: null,
      dividendYield: 11.45,
      hasFundamentals: true,
    });
    expect(papers[1]).toMatchObject({
      ticker: 'ABRD',
      peRatio: null,
      hasFundamentals: false,
    });

    const eventsPromise = api.listMarketEvents('EARNINGS', 'sber');
    const eventsReq = http.expectOne('/api/v1/instruments/events?type=EARNINGS&ticker=SBER');
    expect(eventsReq.request.method).toBe('GET');
    eventsReq.flush([
      {
        id: 10,
        eventDate: '2026-12-11',
        eventType: 'EARNINGS',
        ticker: 'SBER',
        title: 'Отчёт Сбербанка за 11 мес.',
        importance: 'HIGH',
        description: 'Сокращённые результаты по РПБУ.',
      },
    ]);

    const events = await eventsPromise;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 10,
      eventType: 'EARNINGS',
      ticker: 'SBER',
      importance: 'HIGH',
    });
  });

  it('выполняет CRUD алертов через GET/POST/DELETE /api/v1/alerts', async () => {
    const listPromise = api.listAlerts();
    const listReq = http.expectOne('/api/v1/alerts');
    expect(listReq.request.method).toBe('GET');
    listReq.flush([
      {
        id: '019a-alert-1',
        ticker: 'SBER',
        conditionType: 'PRICE_ABOVE',
        thresholdValue: '310.00',
        active: true,
        note: 'Пробой уровня',
        createdAt: '2026-11-27T10:00:00Z',
      },
    ]);

    const alerts = await listPromise;
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      id: '019a-alert-1',
      ticker: 'SBER',
      conditionType: 'PRICE_ABOVE',
      thresholdValue: 310,
    });

    const createPromise = api.createAlert({
      ticker: 'lkoh',
      conditionType: 'RSI_BELOW',
      thresholdValue: 30,
      note: 'Перепроданность',
    });
    const createReq = http.expectOne('/api/v1/alerts');
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual({
      ticker: 'LKOH',
      conditionType: 'RSI_BELOW',
      thresholdValue: '30.00',
      note: 'Перепроданность',
    });
    createReq.flush({
      id: '019a-alert-2',
      ticker: 'LKOH',
      conditionType: 'RSI_BELOW',
      thresholdValue: '30.00',
      active: true,
      note: 'Перепроданность',
      createdAt: '2026-11-27T12:00:00Z',
    });

    const created = await createPromise;
    expect(created).toMatchObject({
      id: '019a-alert-2',
      ticker: 'LKOH',
      conditionType: 'RSI_BELOW',
      thresholdValue: 30,
    });

    const deletePromise = api.deleteAlert('019a-alert-2');
    const deleteReq = http.expectOne('/api/v1/alerts/019a-alert-2');
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null, { status: 204, statusText: 'No Content' });
    await deletePromise;
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpFundamentalsApi } from './http-fundamentals.api';

describe('HttpFundamentalsApi', () => {
  let api: HttpFundamentalsApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpFundamentalsApi],
    });
    api = TestBed.inject(HttpFundamentalsApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GET /api/v1/papers/{ticker}/fundamentals парсит decimal-строки в числа', async () => {
    const promise = api.getPaperFundamentals('sber');

    const req = httpMock.expectOne('/api/v1/papers/SBER/fundamentals');
    expect(req.request.method).toBe('GET');
    req.flush({
      ticker: 'SBER',
      available: true,
      snapshot: {
        ticker: 'SBER',
        reportDate: '2025-12-31',
        availableAt: '2026-02-26',
        periodType: 'FY',
        currency: 'RUB',
        marketCapRub: '6780000000000.00',
        peRatio: '4.28',
        pbRatio: '0.91',
        psRatio: '2.15',
        evEbitda: null,
        roe: '23.40',
        roa: '2.85',
        grossMargin: '58.20',
        operatingMargin: '46.10',
        netMargin: '38.50',
        revenueGrowthYoy: '14.20',
        epsGrowthYoy: '7.80',
        debtToEquity: null,
        currentRatio: null,
        eps: '70.10',
        bookValuePerShare: '329.50',
        dividendYield: '11.60',
        payoutRatio: '50.00',
        freeFloat: '48.00',
        beta: '1.05',
      },
    });

    const result = await promise;
    expect(result).not.toBeNull();
    expect(result!.ticker).toBe('SBER');
    expect(result!.marketCapRub).toBe(6_780_000_000_000);
    expect(result!.peRatio).toBe(4.28);
    expect(result!.evEbitda).toBeNull();
    expect(result!.dividendYield).toBe(11.6);
  });

  it('возвращает null при available: false', async () => {
    const promise = api.getPaperFundamentals('UNKNOWN');
    const req = httpMock.expectOne('/api/v1/papers/UNKNOWN/fundamentals');
    req.flush({ ticker: 'UNKNOWN', available: false, snapshot: null });

    expect(await promise).toBeNull();
  });

  it('GET /api/v1/sessions/{sessionId}/fundamentals сохраняет INV-7 hiddenByBlindMode', async () => {
    const promise = api.getSessionFundamentals('sess-1');
    const req = httpMock.expectOne('/api/v1/sessions/sess-1/fundamentals');
    req.flush({ hiddenByBlindMode: true, asOfDate: null, items: [] });

    const res = await promise;
    expect(res).toEqual({ hiddenByBlindMode: true, asOfDate: null, items: [] });
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ReportResult } from '../../../api/models/report-result';
import { HttpReportApi, mapComparison, mapReportResult } from './http-report.api';

const METRICS = {
  initialCapital: '1000000.00',
  finalCapital: '1051200.50',
  totalReturnPct: '5.12',
  cagrPct: null,
  grossReturnPct: '5.5',
  netReturnPct: '5.12',
  maxDrawdownPct: '3.4',
  maxDrawdownDurationDays: 4,
  maxDrawdownDurationSteps: 40,
  volatilityPct: null,
  sharpe: null,
  sortino: null,
  turnover: '1.2',
  tradesCount: 3,
  winRatePct: null,
  rejectedOrdersCount: 0,
  partialFillsCount: 1,
  stopTakeSameBarCount: 0,
  hhi: '0.4',
  largestPositionPct: '30',
  bankrupt: false,
  costs: {
    total: '900.00',
    commission: '500.00',
    exchangeFee: '10.00',
    spread: '190.00',
    slippage: '200.00',
  },
  benchmarkImoexPct: null,
};

function ready(overrides: Record<string, unknown> = {}): ReportResult {
  return {
    status: 'READY',
    report: {
      sessionId: '0190-s',
      blind: true,
      finishedEarly: false,
      replayAvailable: true,
      playedDays: 60,
      totalDays: 60,
      timeframe: '1d',
      regime: 'stress',
      createdAt: '2026-11-18T12:00:00Z',
      backgroundAlgorithmName: null,
      period: { startDate: '2020-02-26', endDate: '2020-05-21' },
      papers: [
        {
          id: 'p1',
          blindLabel: 'A',
          ticker: 'SBER',
          name: 'Сбербанк',
          sector: 'Финансы',
          startPrice: '234.40',
          lotSize: 10,
        },
      ],
      humanMetrics: METRICS,
      algoMetrics: null,
      comparison: null,
      equityCurve: [
        {
          step: 0,
          date: '2020-02-26T07:00:00Z',
          humanCapital: '1000000.00',
          algoCapital: null,
          benchmarkCapital: null,
        },
      ],
      underwaterCurve: [
        { step: 0, date: '2020-02-26T07:00:00Z', humanDrawdownPct: '0', algoDrawdownPct: null },
      ],
      divergenceSummary: null,
      divergences: null,
      reverseCheckTrades: null,
      roundTrips: [],
      fills: [
        {
          id: 'f1',
          day: 1,
          date: '2020-02-26T07:00:00Z',
          paperTicker: 'SBER',
          side: 'buy',
          orderType: 'market',
          lots: 80,
          price: '234.40',
          cost: '2120.00',
          partial: false,
        },
      ],
      ...overrides,
    },
  } as unknown as ReportResult;
}

describe('mapReportResult', () => {
  it('отчёт: деньги и проценты из строк, отложенные блоки остаются null (ФТ-18…20)', () => {
    const res = mapReportResult(ready());
    if (res.status !== 'READY') {
      throw new Error('ожидался READY');
    }
    const rep = res.report;
    expect(rep.period.label).toBe('26.02.2020 — 21.05.2020');
    expect(rep.humanMetrics.finalCapitalRub).toBe(1051200.5);
    expect(rep.humanMetrics.costsRub.totalRub).toBe(900);
    expect(rep.humanMetrics.cagrPct).toBeNull();
    expect(rep.algoMetrics).toBeNull();
    expect(rep.comparison).toBeNull();
    expect(rep.divergences).toBeNull();
    expect(rep.equityCurve[0]).toMatchObject({ dateLabel: '26.02.2020', algoCapitalRub: null });
    expect(rep.underwaterCurve?.[0].algoDrawdownPct).toBeNull();
    expect(rep.fills[0]).toMatchObject({ priceRub: 234.4, costRub: 2120, paperTicker: 'SBER' });
    expect(rep.humanMetrics.stopTakeSameBarCount).toBe(0);
    expect(rep.roundTrips).toEqual([]);
  });

  it('расхождения: действия собираются в текст, «лишнее» без because', () => {
    const res = mapReportResult(
      ready({
        divergences: [
          {
            id: 'd1',
            step: 3,
            day: 4,
            date: '2020-03-02T07:00:00Z',
            paperTicker: 'SBER',
            sector: 'Финансы',
            type: 'extra',
            deltaBars: null,
            horizonStep: 20,
            horizonDay: 21,
            humanAction: { kind: 'trade', side: 'buy', lots: 90, orderType: 'limit' },
            algoAction: { kind: 'none', side: null, lots: null, orderType: null },
            errorCost: '1200.00',
            errorCostPct: '0.12',
            because: null,
          },
        ],
      }),
    );
    if (res.status !== 'READY') {
      throw new Error('ожидался READY');
    }
    expect(res.report.divergences?.[0]).toMatchObject({
      humanAction: 'Покупка 90 лот. лимитной заявкой',
      algoAction: 'Нет заявки',
      errorCostRub: 1200,
      because: null,
    });
  });

  it('BUILDING, NOT_FINISHED и NOT_FOUND', () => {
    expect(mapReportResult({ status: 'BUILDING', sessionId: 's' })).toMatchObject({
      status: 'BUILDING',
      sessionId: 's',
    });
    expect(
      mapReportResult({
        status: 'NOT_FINISHED',
        sessionId: 's',
        blind: true,
        title: 'Слепая сессия от 18.11.2026',
        createdAt: '2026-11-18T12:00:00Z',
        playedDays: 3,
        totalDays: 20,
        regime: 'calm',
      }),
    ).toMatchObject({ status: 'NOT_FINISHED', createdAt: '18.11.2026 15:00' });
    expect(mapReportResult({ status: 'NOT_FOUND', sessionId: 's' }).status).toBe('NOT_FOUND');
  });
});

describe('mapComparison', () => {
  it('подписи собирает клиент из diff сервера', () => {
    const cmp = mapComparison({
      finalCapital: { human: '1000000.00', algo: '1027550.00', winner: 'algo', diff: '27550.00' },
      netReturn: { humanPct: '1', algoPct: '3.75', winner: 'algo', diffPctPoints: '2.75' },
      maxDrawdown: { humanPct: '5', algoPct: '5', winner: 'tie', diffPctPoints: '0' },
    });
    expect(cmp.finalCapital.diffLabel).toMatch(/^Алгоритм лучше на 27\s550 ₽$/);
    expect(cmp.netReturn.diffLabel).toBe('Алгоритм лучше на 2,75 п.п.');
    expect(cmp.maxDrawdown.diffLabel).toBe('Просадки равны');
  });
});

describe('HttpReportApi', () => {
  it('запрашивает отчёт по id сессии', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpReportApi],
    });
    const api = TestBed.inject(HttpReportApi);
    const controller = TestBed.inject(HttpTestingController);
    const pending = api.getReport('0190-s');
    controller
      .expectOne('/api/v1/sessions/0190-s/report')
      .flush({ status: 'NOT_FOUND', sessionId: '0190-s' });
    expect(await pending).toEqual({ status: 'NOT_FOUND', sessionId: '0190-s' });
    controller.verify();
  });
});

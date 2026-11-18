import { TestBed } from '@angular/core/testing';
import { StubSessionRegistry } from '../../../shared/stub-session-registry';
import { StubReplayApi } from '../../replay/data/stub-replay.api';
import { formatPct, formatRatio } from '../report.format';
import { StubReportApi } from './stub-report.api';

describe('StubReportApi', () => {
  it('INV-7: отчёт незавершённой слепой сессии S-0104 содержит только белый список ключей без тикеров и дат', async () => {
    const api = new StubReportApi();
    const res = await api.getReport('S-0104');

    expect(res.status).toBe('NOT_FINISHED');
    expect(Object.keys(res).sort()).toEqual([
      'blind',
      'createdAt',
      'playedDays',
      'regime',
      'sessionId',
      'status',
      'title',
      'totalDays',
    ]);

    const serialized = JSON.stringify(res);
    for (const forbidden of [
      'SBER',
      'GAZP',
      'YDEX',
      'Сбербанк',
      'Газпром',
      'Яндекс',
      '26.02.2020',
      '21.05.2020',
      'equityCurve',
      'fills',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('возвращает READY для S-0103 и S-0105, BUILDING для S-BUILDING и NOT_FOUND для неизвестной', async () => {
    const api = new StubReportApi();
    const ready = await api.getReport('S-0103');
    expect(ready.status).toBe('READY');
    if (ready.status === 'READY') {
      expect(ready.report.papers.length).toBe(3);
      expect(ready.report.humanMetrics.tradesCount).toBe(ready.report.fills.length);
      expect(ready.report.humanMetrics.maxDrawdownPct).toBeGreaterThanOrEqual(0);
      const c = ready.report.humanMetrics.costsRub;
      expect(c.commissionRub + c.exchangeFeeRub + c.spreadRub + c.slippageRub).toBe(c.totalRub);

      const divTypes = new Set(ready.report.divergences.map((d) => d.type));
      expect(divTypes).toEqual(new Set(['extra', 'missed', 'size', 'timing']));
      for (const div of ready.report.divergences) {
        if (div.type === 'extra') {
          expect(div.because).toBe('алгоритм здесь не действовал бы');
        }
        if (div.type === 'timing') {
          expect(div.deltaBars).not.toBeNull();
        }
      }
      expect(ready.report.reverseCheckTrades.length).toBeGreaterThan(0);
      for (const rev of ready.report.reverseCheckTrades) {
        expect(rev.netProfitRub).toBeGreaterThan(0);
        const entryDiv = ready.report.divergences.find((d) => d.id === rev.entryDivergenceId);
        expect(entryDiv?.type).toBe('extra');
      }
    }

    const early = await api.getReport('S-0105');
    expect(early.status).toBe('READY');
    if (early.status === 'READY') {
      expect(early.report.finishedEarly).toBe(true);
      expect(early.report.playedDays).toBe(28);
      expect(early.report.fills.every((f) => f.day <= 28)).toBe(true);
      expect(early.report.divergences.some((d) => d.paperTicker === 'YDEX')).toBe(false);
    }

    const openActive = await api.getReport('S-OPEN-ACTIVE');
    expect(openActive.status).toBe('NOT_FINISHED');
    if (openActive.status === 'NOT_FINISHED') {
      expect(openActive.blind).toBe(false);
    }

    const building = await api.getReport('S-BUILDING');
    expect(building.status).toBe('BUILDING');

    const missing = await api.getReport('S-UNKNOWN');
    expect(missing).toEqual({ status: 'NOT_FOUND', sessionId: 'S-UNKNOWN' });
  });

  it('maxDrawdownPct и длительность просадки согласованы с кривой equityCurve', async () => {
    const api = new StubReportApi();

    const calcFromCurve = (series: readonly number[]) => {
      let peak = series[0];
      let maxDd = 0;
      let streak = 0;
      let maxStreak = 0;
      for (const val of series) {
        if (val >= peak) {
          peak = val;
          streak = 0;
        } else {
          streak += 1;
          maxStreak = Math.max(maxStreak, streak);
          maxDd = Math.max(maxDd, ((peak - val) / peak) * 100);
        }
      }
      return { dd: Math.round(maxDd * 100) / 100, steps: maxStreak };
    };

    for (const id of ['S-0103', 'S-0105']) {
      const res = await api.getReport(id);
      expect(res.status).toBe('READY');
      if (res.status === 'READY') {
        const rep = res.report;
        const humanCalc = calcFromCurve(rep.equityCurve.map((p) => p.humanCapitalRub));
        const algoCalc = calcFromCurve(rep.equityCurve.map((p) => p.algoCapitalRub));

        expect(rep.humanMetrics.maxDrawdownPct).toBe(humanCalc.dd);
        expect(rep.humanMetrics.maxDrawdownDurationSteps).toBe(humanCalc.steps);
        expect(rep.algoMetrics.maxDrawdownPct).toBe(algoCalc.dd);
        expect(rep.algoMetrics.maxDrawdownDurationSteps).toBe(algoCalc.steps);
        expect(rep.comparison.maxDrawdown.humanPct).toBe(humanCalc.dd);
        expect(rep.comparison.maxDrawdown.algoPct).toBe(algoCalc.dd);
      }
    }
  });

  it('S-0103: цена ошибки и проценты расхождений совпадают с расчётом по формуле decisions.md', async () => {
    const reportApi = new StubReportApi();
    const replayApi = new StubReplayApi();

    const reportRes = await reportApi.getReport('S-0103');
    const replayRes = await replayApi.loadSession('S-0103', 59);
    expect(reportRes.status).toBe('READY');
    expect(replayRes.status).toBe('READY');
    if (reportRes.status !== 'READY' || replayRes.status !== 'READY') {
      return;
    }

    const rep = reportRes.report;
    const candlesByPaper = new Map(
      replayRes.snapshot.papers.map((p) => [p.id, p.candles] as const),
    );
    const lotByPaper = new Map(rep.papers.map((p) => [p.ticker, p.lotSize] as const));
    const closeAt = (ticker: string, step: number): number => {
      const candle = candlesByPaper.get(ticker)?.find((c) => c.step === step);
      if (!candle) {
        throw new Error(`Свеча ${ticker} на шаге ${step} не найдена`);
      }
      return candle.close;
    };
    const round2 = (v: number): number => Math.round(v * 100) / 100;

    // Параметры действий для S-0103 (согласованы с JOURNAL_FILLS и свечами StubReplayApi).
    const actionSpecs: Record<
      string,
      {
        human: { sign: 1 | -1; lots: number; price: number; cost: number } | null;
        algo: { sign: 1 | -1; lots: number; price: number; cost: number } | null;
      }
    > = {
      'DIV-1': {
        human: { sign: 1, lots: 80, price: 234.4, cost: 2_120 },
        algo: { sign: 1, lots: 120, price: 234.4, cost: 3_180 },
      },
      'DIV-2': {
        human: { sign: 1, lots: 90, price: 186.1, cost: 1_890 },
        algo: null,
      },
      'DIV-3': {
        human: null,
        algo: { sign: 1, lots: 45, price: closeAt('YDEX', 19), cost: 1_750 },
      },
      'DIV-4': {
        human: { sign: 1, lots: 40, price: 3015, cost: 1_980 },
        algo: { sign: 1, lots: 40, price: closeAt('YDEX', 45), cost: 1_981.52 },
      },
    };

    let sumRub = 0;
    let sumPct = 0;

    for (const div of rep.divergences) {
      const spec = actionSpecs[div.id];
      expect(spec).toBeDefined();
      const lotSize = lotByPaper.get(div.paperTicker)!;
      const closeE = closeAt(div.paperTicker, div.horizonStep);

      const valueOf = (
        side: { sign: 1 | -1; lots: number; price: number; cost: number } | null,
      ): number => {
        if (!side) {
          return 0;
        }
        return side.sign * side.lots * lotSize * (closeE - side.price) - side.cost;
      };

      const expectedRub = round2(valueOf(spec.algo) - valueOf(spec.human));
      const equityAtT = rep.equityCurve[div.step].humanCapitalRub;
      const expectedPct = round2((expectedRub / equityAtT) * 100);

      expect(div.errorCostRub).toBe(expectedRub);
      expect(div.errorCostPct).toBe(expectedPct);

      sumRub = round2(sumRub + div.errorCostRub);
      sumPct = round2(sumPct + div.errorCostPct);
    }

    expect(rep.divergenceSummary.totalErrorCostRub).toBe(sumRub);
    expect(rep.divergenceSummary.totalErrorCostPct).toBe(sumPct);
  });

  it('F6: formatPct и formatRatio возвращают «—» при null метриках', () => {
    expect(formatPct(null)).toBe('—');
    expect(formatPct(null, true)).toBe('—');
    expect(formatRatio(null)).toBe('—');
  });

  it('возвращает NOT_FINISHED для незавершённой сессии из реестра и READY после завершения', async () => {
    TestBed.configureTestingModule({ providers: [StubReportApi] });
    const registry = TestBed.inject(StubSessionRegistry);
    const api = TestBed.inject(StubReportApi);

    registry.register({
      sessionId: 'S-0106',
      blind: false,
      regime: 'calm',
      timeframe: '1d',
      totalDays: 20,
      playedDays: 4,
      finished: false,
      finishedEarly: false,
      createdAt: '2026-11-18T15:00:00+03:00',
      initialCapitalRub: 1_000_000,
      paperIds: ['SBER'],
      paperCount: 1,
      customStartDate: '2020-02-26',
      netReturnPct: null,
    });

    const unfinished = await api.getReport('S-0106');
    expect(unfinished.status).toBe('NOT_FINISHED');
    if (unfinished.status === 'NOT_FINISHED') {
      expect(unfinished.blind).toBe(false);
      expect(unfinished.playedDays).toBe(4);
    }

    registry.markFinished('S-0106', { playedDays: 4, finishedEarly: true, netReturnPct: 1.5 });
    const ready = await api.getReport('S-0106');
    expect(ready.status).toBe('READY');
    if (ready.status === 'READY') {
      expect(ready.report.sessionId).toBe('S-0106');
      expect(ready.report.replayAvailable).toBe(true);
    }
  });
});

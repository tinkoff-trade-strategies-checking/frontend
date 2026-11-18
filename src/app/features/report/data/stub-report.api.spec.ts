import { StubReportApi } from './stub-report.api';

describe('StubReportApi', () => {
  it('INV-7: отчёт незавершённой слепой сессии S-0104 содержит только белый список ключей без тикеров и дат', async () => {
    const api = new StubReportApi();
    const res = await api.getReport('S-0104');

    expect(res.status).toBe('BLIND_UNFINISHED');
    expect(Object.keys(res).sort()).toEqual([
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
    }

    const early = await api.getReport('S-0105');
    expect(early.status).toBe('READY');
    if (early.status === 'READY') {
      expect(early.report.finishedEarly).toBe(true);
      expect(early.report.playedDays).toBe(28);
      expect(early.report.fills.every((f) => f.day <= 28)).toBe(true);
      expect(early.report.divergences.some((d) => d.paperTicker === 'YDEX')).toBe(false);
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
});

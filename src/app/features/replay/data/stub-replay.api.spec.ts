import { StubReportApi } from '../../report/data/stub-report.api';
import { StubReplayApi } from './stub-replay.api';

describe('StubReplayApi', () => {
  it('INV-1: не предзагружает свечи вперёд и отдаёт по одной свече на шаг', async () => {
    const api = new StubReplayApi();
    const res = await api.loadSession('S-0103');
    expect(res.status).toBe('READY');
    if (res.status !== 'READY') {
      return;
    }

    expect(res.snapshot.step).toBe(0);
    expect(res.snapshot.day).toBe(1);
    expect(res.snapshot.finished).toBe(false);
    for (const paper of res.snapshot.papers) {
      const maxStep = paper.candles.reduce((max, c) => Math.max(max, c.step), -Infinity);
      expect(maxStep).toBe(0);
      expect(paper.candles[paper.candles.length - 1]?.dateLabel).toBe('26.02');
    }

    const step1 = await api.step('S-0103');
    expect(step1.step).toBe(1);
    expect(step1.day).toBe(2);
    expect(step1.bars['SBER']?.step).toBe(1);
  });

  it('S-0103: сделки появляются на своих свечах и итог совпадает с отчётом', async () => {
    const replayApi = new StubReplayApi();
    const reportApi = new StubReportApi();

    const replayRes = await replayApi.loadSession('S-0103');
    const reportRes = await reportApi.getReport('S-0103');
    expect(replayRes.status).toBe('READY');
    expect(reportRes.status).toBe('READY');
    if (replayRes.status !== 'READY' || reportRes.status !== 'READY') {
      return;
    }

    const report = reportRes.report;
    let lastStep = replayRes.snapshot;
    let currentFills = lastStep.fills;
    let currentPortfolio = lastStep.portfolio;

    // На старте (день 1) сделок ещё нет.
    expect(currentFills).toHaveLength(0);

    for (let s = 1; s <= replayRes.session.totalSteps; s++) {
      const stepRes = await replayApi.step('S-0103');
      currentFills = stepRes.fills;
      currentPortfolio = stepRes.portfolio;
      lastStep = {
        ...lastStep,
        step: stepRes.step,
        day: stepRes.day,
        finished: stepRes.finished,
      };

      // Сделки появляются строго начиная со своего дня.
      for (const expectedFill of report.fills) {
        const appeared = currentFills.some((f) => f.id === expectedFill.id);
        expect(appeared).toBe(stepRes.day >= expectedFill.day);
      }
    }

    expect(lastStep.finished).toBe(true);
    expect(lastStep.day).toBe(report.totalDays);
    expect(currentFills).toHaveLength(report.fills.length);
    for (let i = 0; i < report.fills.length; i++) {
      expect(currentFills[i].day).toBe(report.fills[i].day);
      expect(currentFills[i].paperId).toBe(report.fills[i].paperTicker);
      expect(currentFills[i].lots).toBe(report.fills[i].lots);
      expect(currentFills[i].price).toBe(report.fills[i].priceRub);
    }

    expect(currentPortfolio.equityRub).toBe(report.humanMetrics.finalCapitalRub);
    expect(currentPortfolio.pnlPct).toBe(report.humanMetrics.totalReturnPct);
    expect(currentPortfolio.costsRub).toBe(report.humanMetrics.costsRub.totalRub);
  });

  it('INV-7: S-0104 и S-BLIND-ACTIVE недоступны для воспроизведения и не раскрывают данные', async () => {
    const api = new StubReplayApi();
    for (const id of ['S-0104', 'S-BLIND-ACTIVE']) {
      const res = await api.loadSession(id);
      expect(res.status).toBe('BLIND_UNFINISHED');
      const serialized = JSON.stringify(res);
      expect(serialized).not.toMatch(
        /SBER|GAZP|YDEX|Сбербанк|Газпром|Яндекс|26\.02\.2020|21\.05\.2020/,
      );
      await expect(api.step(id)).rejects.toThrow();
    }

    const notFound = await api.loadSession('S-9999');
    expect(notFound.status).toBe('NOT_FOUND');
  });
});

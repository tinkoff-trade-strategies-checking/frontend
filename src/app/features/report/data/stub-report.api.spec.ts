import { StubReportApi } from './stub-report.api';

describe('StubReportApi', () => {
  it('INV-7: отчёт незавершённой слепой сессии S-0104 не раскрывает период, тикеры и названия бумаг', async () => {
    const api = new StubReportApi();
    const res = await api.getReport('S-0104');

    expect(res.status).toBe('BLIND_UNFINISHED');
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

  it('возвращает готовый отчёт для завершённой сессии S-0103 и NOT_FOUND для неизвестной', async () => {
    const api = new StubReportApi();
    const ready = await api.getReport('S-0103');
    expect(ready.status).toBe('READY');
    if (ready.status === 'READY') {
      expect(ready.report.papers.length).toBe(3);
      expect(ready.report.comparison.finalCapital.diffLabel).toContain('Алгоритм лучше');
    }

    const missing = await api.getReport('S-UNKNOWN');
    expect(missing).toEqual({ status: 'NOT_FOUND', sessionId: 'S-UNKNOWN' });
  });
});

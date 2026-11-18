import { StubArenaApi } from '../../arena/data/stub-arena.api';
import { StubReportApi } from '../../report/data/stub-report.api';
import { HISTORY_DEFAULT_PAGE_SIZE, HISTORY_MAX_ITEMS } from './history.models';
import { StubHistoryApi } from './stub-history.api';

describe('StubHistoryApi', () => {
  it('возвращает только прогоны пользователя (owner === USER), отсортированные от новых к старым', async () => {
    const api = new StubHistoryApi();
    const res = await api.list({ pageSize: HISTORY_MAX_ITEMS });

    expect(res.items.length).toBeGreaterThan(20);
    expect(res.items.every((item) => item.owner === 'USER')).toBe(true);
    expect(res.items.some((item) => item.id.startsWith('P-'))).toBe(false);

    for (let i = 1; i < res.items.length; i++) {
      const prevTime = Date.parse(res.items[i - 1].createdAt);
      const currTime = Date.parse(res.items[i].createdAt);
      expect(prevTime).toBeGreaterThanOrEqual(currTime);
    }
  });

  it('INV-7: незавершённая слепая сессия S-0104 не раскрывает бумаги, период и итоговую доходность', async () => {
    const api = new StubHistoryApi();
    const arenaSnapshot = await new StubArenaApi().getSnapshot();
    const res = await api.list();
    const activeBlind = res.items.find((item) => item.id === arenaSnapshot.sessionId);

    expect(activeBlind).toBeDefined();
    expect(activeBlind?.blind).toBe(true);
    expect(activeBlind?.status).toBe('running');
    expect(activeBlind?.title).toBe('Слепая сессия от 18.11.2026');
    expect(activeBlind?.papers).toBeNull();
    expect(activeBlind?.periodLabel).toBeNull();
    expect(activeBlind?.netReturnPct).toBeNull();
  });

  it('согласует S-0103 и S-0105 с заглушкой отчётов', async () => {
    const historyApi = new StubHistoryApi();
    const reportApi = new StubReportApi();

    const [historyPage, report0103, report0105] = await Promise.all([
      historyApi.list(),
      reportApi.getReport('S-0103'),
      reportApi.getReport('S-0105'),
    ]);

    expect(report0103.status).toBe('READY');
    expect(report0105.status).toBe('READY');
    if (report0103.status !== 'READY' || report0105.status !== 'READY') {
      return;
    }

    const item0103 = historyPage.items.find((item) => item.id === 'S-0103');
    const item0105 = historyPage.items.find((item) => item.id === 'S-0105');

    expect(item0103?.blind).toBe(report0103.report.blind);
    expect(item0103?.regime).toBe(report0103.report.regime);
    expect(item0103?.netReturnPct).toBe(report0103.report.humanMetrics.netReturnPct);

    expect(item0105?.blind).toBe(report0105.report.blind);
    expect(item0105?.status).toBe('finished_early');
    expect(item0105?.regime).toBe(report0105.report.regime);
    expect(item0105?.netReturnPct).toBe(report0105.report.humanMetrics.netReturnPct);
  });

  it('фильтрует по типу, признаку «только слепые», статусу и категории периода', async () => {
    const api = new StubHistoryApi();

    const blindOnly = await api.list({ blindOnly: true, pageSize: HISTORY_MAX_ITEMS });
    expect(blindOnly.items.length).toBeGreaterThan(0);
    expect(blindOnly.items.every((item) => item.blind)).toBe(true);
    expect(blindOnly.items.some((item) => item.id === 'S-0105')).toBe(false);

    const algoRuns = await api.list({ kind: 'algo_run', pageSize: HISTORY_MAX_ITEMS });
    expect(algoRuns.items.length).toBeGreaterThan(0);
    expect(algoRuns.items.every((item) => item.kind === 'algo_run')).toBe(true);

    const bankruptOnly = await api.list({ status: 'bankrupt', pageSize: HISTORY_MAX_ITEMS });
    expect(bankruptOnly.items.length).toBeGreaterThan(0);
    expect(bankruptOnly.items.every((item) => item.status === 'bankrupt')).toBe(true);

    const calmOnly = await api.list({ regime: 'calm', pageSize: HISTORY_MAX_ITEMS });
    expect(calmOnly.items.length).toBeGreaterThan(0);
    expect(calmOnly.items.every((item) => item.regime === 'calm')).toBe(true);
  });

  it('разбивает список на страницы по 20 записей и ограничивает pageSize максимумом 100', async () => {
    const api = new StubHistoryApi();

    const page1 = await api.list({ page: 1 });
    expect(page1.pageSize).toBe(HISTORY_DEFAULT_PAGE_SIZE);
    expect(page1.items.length).toBe(HISTORY_DEFAULT_PAGE_SIZE);
    expect(page1.total).toBeGreaterThan(HISTORY_DEFAULT_PAGE_SIZE);
    expect(page1.totalPages).toBe(2);

    const page2 = await api.list({ page: 2 });
    expect(page2.page).toBe(2);
    expect(page2.items.length).toBe(page1.total - HISTORY_DEFAULT_PAGE_SIZE);

    const capped = await api.list({ pageSize: 500 });
    expect(capped.pageSize).toBe(HISTORY_MAX_ITEMS);
  });
});

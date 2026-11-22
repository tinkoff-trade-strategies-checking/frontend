import { StubWorkshopApi } from './stub-workshop.api';
import {
  WORKSHOP_DEFAULT_PAGE_SIZE,
  WORKSHOP_MAX_PAGE_SIZE,
  WORKSHOP_SYSTEM_AUTHOR,
} from './workshop.models';

describe('StubWorkshopApi', () => {
  it('сортирует по умолчанию по дате публикации (новые сверху) и включает «Эталон платформы»', async () => {
    const api = new StubWorkshopApi();
    const res = await api.list({ pageSize: WORKSHOP_MAX_PAGE_SIZE });

    expect(res.items.length).toBeGreaterThan(WORKSHOP_DEFAULT_PAGE_SIZE);
    expect(res.items.some((item) => item.author === WORKSHOP_SYSTEM_AUTHOR)).toBe(true);
    expect(res.items.every((item) => item.license === 'MIT')).toBe(true);

    for (let i = 1; i < res.items.length; i++) {
      const prevTime = Date.parse(res.items[i - 1].publishedAt ?? '');
      const currTime = Date.parse(res.items[i].publishedAt ?? '');
      expect(prevTime).toBeGreaterThanOrEqual(currTime);
    }
  });

  it('скрывает чужие скрытые алгоритмы, но показывает скрытый алгоритм самого автора', async () => {
    const api = new StubWorkshopApi();
    const res = await api.list({ pageSize: WORKSHOP_MAX_PAGE_SIZE });

    expect(res.items.some((item) => item.id === 'A-0005')).toBe(false);
    const foreignDetail = await api.getById('A-0005');
    expect(foreignDetail.status).toBe('NOT_FOUND');

    const ownHidden = res.items.find((item) => item.id === 'A-0004');
    expect(ownHidden).toBeDefined();
    expect(ownHidden?.isMine).toBe(true);
    expect(ownHidden?.visibility).toBe('hidden');

    const ownDetail = await api.getById('A-0004');
    expect(ownDetail.status).toBe('READY');
  });

  it('фильтрует по автору, «мои», «без предупреждений линтера» и поиску по названию и описанию', async () => {
    const api = new StubWorkshopApi();

    const mine = await api.list({ mineOnly: true, pageSize: WORKSHOP_MAX_PAGE_SIZE });
    expect(mine.items.length).toBeGreaterThan(0);
    expect(mine.items.every((item) => item.isMine)).toBe(true);

    const clean = await api.list({ cleanOnly: true, pageSize: WORKSHOP_MAX_PAGE_SIZE });
    expect(clean.items.length).toBeGreaterThan(0);
    expect(clean.items.every((item) => item.linterWarnings.length === 0)).toBe(true);

    const byAuthor = await api.list({
      authorId: 'platform',
      pageSize: WORKSHOP_MAX_PAGE_SIZE,
    });
    expect(byAuthor.items.length).toBe(1);
    expect(byAuthor.items[0].id).toBe('A-0001');
    expect(
      byAuthor.authors.some((a) => a.id === 'platform' && a.name === WORKSHOP_SYSTEM_AUTHOR),
    ).toBe(true);

    const byName = await api.list({ search: 'Donchian', pageSize: WORKSHOP_MAX_PAGE_SIZE });
    expect(byName.items.some((item) => item.id === 'A-0010')).toBe(true);

    const byDescription = await api.list({
      search: 'перекупленности',
      pageSize: WORKSHOP_MAX_PAGE_SIZE,
    });
    expect(byDescription.items.some((item) => item.id === 'A-0002')).toBe(true);
  });

  it('поддерживает сортировку по названию и по автору', async () => {
    const api = new StubWorkshopApi();

    const byName = await api.list({ sort: 'name_asc', pageSize: WORKSHOP_MAX_PAGE_SIZE });
    for (let i = 1; i < byName.items.length; i++) {
      expect(
        byName.items[i - 1].name.localeCompare(byName.items[i].name, 'ru'),
      ).toBeLessThanOrEqual(0);
    }

    const byAuthor = await api.list({ sort: 'author_asc', pageSize: WORKSHOP_MAX_PAGE_SIZE });
    for (let i = 1; i < byAuthor.items.length; i++) {
      expect(
        byAuthor.items[i - 1].author.localeCompare(byAuthor.items[i].author, 'ru'),
      ).toBeLessThanOrEqual(0);
    }
  });

  it('разбивает каталог на страницы по 20 и ограничивает pageSize максимумом 100', async () => {
    const api = new StubWorkshopApi();

    const page1 = await api.list({ page: 1 });
    expect(page1.pageSize).toBe(WORKSHOP_DEFAULT_PAGE_SIZE);
    expect(page1.items.length).toBe(WORKSHOP_DEFAULT_PAGE_SIZE);
    expect(page1.totalPages).toBe(2);

    const page2 = await api.list({ page: 2 });
    expect(page2.page).toBe(2);
    expect(page2.items.length).toBe(page1.total - WORKSHOP_DEFAULT_PAGE_SIZE);

    const capped = await api.list({ pageSize: 500 });
    expect(capped.pageSize).toBe(WORKSHOP_MAX_PAGE_SIZE);
  });

  it('возвращает неизменяемые версии в карточке алгоритма (INV-5)', async () => {
    const api = new StubWorkshopApi();
    const res = await api.getById('A-0003');
    expect(res.status).toBe('READY');
    if (res.status !== 'READY') {
      return;
    }

    expect(res.algorithm.versions.map((v) => v.version)).toEqual([3, 2, 1]);
    expect(res.algorithm.versions.every((v) => v.immutable)).toBe(true);
  });

  it('использует канонические коды диагностик dsl.md v1 и эталон платформы с прогревом 200 баров', async () => {
    const api = new StubWorkshopApi();
    const list = await api.list({ pageSize: WORKSHOP_MAX_PAGE_SIZE });
    const allowedCodes = new Set(['L001', 'W-LA01']);

    for (const item of list.items) {
      for (const warning of item.linterWarnings) {
        expect(allowedCodes.has(warning.code)).toBe(true);
      }
    }

    const platformRef = await api.getById('A-0001');
    expect(platformRef.status).toBe('READY');
    if (platformRef.status === 'READY') {
      expect(platformRef.algorithm.linterWarnings).toEqual([]);
      expect(platformRef.algorithm.description).toContain('200 баров');
    }

    const breakout = await api.getById('A-0003');
    expect(breakout.status).toBe('READY');
    if (breakout.status === 'READY') {
      expect(breakout.algorithm.linterWarnings.map((w) => w.code)).toEqual(['L001', 'W-LA01']);
    }
  });

  it('поддерживает createAlgorithm, saveDraft, check с fix, publish (и отказ STRATEGY_INVALID), fork и setVisibility', async () => {
    const api = new StubWorkshopApi();
    const draft = await api.createAlgorithm({
      name: 'My Strategy',
      description: 'Test',
      source: 'rule enter when close > 70 because "rsi";',
    });
    expect(draft.check?.lookaheadLevel).toBe('WARNING');
    expect(draft.check?.diagnostics[0].fixes.length).toBeGreaterThan(0);

    const badSave = await api.saveDraft(draft.strategyId, { source: 'let x = close[+1];' });
    expect(badSave.check?.lookaheadLevel).toBe('ERROR');
    const failedPub = await api.publish(draft.strategyId, { summary: 'bad' });
    expect(failedPub).toMatchObject({ ok: false, code: 'STRATEGY_INVALID' });

    await api.saveDraft(draft.strategyId, {
      source: 'param fast = 10;\nrule enter when close > 0 because "ok";',
    });
    const pub = await api.publish(draft.strategyId, { summary: 'v1' });
    expect(pub.ok).toBe(true);
    if (pub.ok) {
      expect(pub.version.version).toBe(1);
      expect(pub.version.immutable).toBe(true);
    }

    const hidden = await api.setVisibility(draft.strategyId, 'hidden');
    expect(hidden.visibility).toBe('hidden');

    const forked = await api.fork('A-0001', { version: 2, name: 'Forked Ref' });
    expect(forked.name).toBe('Forked Ref');
    expect(forked.strategyId).not.toBe('A-0001');
  });
});

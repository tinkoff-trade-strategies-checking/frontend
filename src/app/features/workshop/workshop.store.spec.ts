import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import {
  WORKSHOP_API,
  WORKSHOP_COMPARE_LIMIT,
  WorkshopAlgorithmDetail,
  WorkshopApi,
  WorkshopDetailResult,
  WorkshopPage as WorkshopPageData,
  WorkshopQuery,
} from './data/workshop.models';
import { WORKSHOP_SEARCH_DEBOUNCE_MS, WorkshopStore } from './workshop.store';

function stubApi(overrides: Pick<WorkshopApi, 'list' | 'getById'>): WorkshopApi {
  return {
    ...overrides,
    createAlgorithm: () => Promise.reject(new Error('not used')),
    getDraft: () => Promise.reject(new Error('not used')),
    saveDraft: () => Promise.reject(new Error('not used')),
    check: () => Promise.reject(new Error('not used')),
    publish: () => Promise.reject(new Error('not used')),
    fork: () => Promise.reject(new Error('not used')),
    setVisibility: () => Promise.reject(new Error('not used')),
    deleteAlgorithm: () => Promise.reject(new Error('not used')),
  };
}

function makeAlgo(id: string, name = `Algo ${id}`): WorkshopAlgorithmDetail {
  return {
    id,
    name,
    description: `Description ${id}`,
    authorId: 'user',
    author: 'Вы',
    isMine: true,
    isSystem: false,
    visibility: 'public',
    latestVersion: 1,
    publishedAt: '2026-11-18T12:00:00+03:00',
    license: 'MIT',
    linterWarnings: [],
    versions: [
      {
        version: 1,
        publishedAt: '2026-11-18T12:00:00+03:00',
        summary: 'Первая публикация',
        immutable: true,
      },
    ],
  };
}

function makePage(
  items: readonly WorkshopAlgorithmDetail[],
  page = 1,
  totalPages = 1,
): WorkshopPageData {
  return {
    items,
    authors: [{ id: 'user', name: 'Вы' }],
    total: items.length,
    page,
    pageSize: 20,
    totalPages,
  };
}

describe('WorkshopStore', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('применяет debounce для поиска: несколько символов подряд вызывают один запрос list', async () => {
    vi.useFakeTimers();
    const queries: WorkshopQuery[] = [];

    const api = stubApi({
      async list(query = {}): Promise<WorkshopPageData> {
        queries.push(query);
        return makePage([makeAlgo('A-1')]);
      },
      async getById(): Promise<WorkshopDetailResult> {
        return { status: 'NOT_FOUND' };
      },
    });

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);

    store.setSearch('B');
    store.setSearch('Br');
    store.setSearch('Bre');
    store.setSearch('Breakout');

    expect(queries.length).toBe(0);

    await vi.advanceTimersByTimeAsync(WORKSHOP_SEARCH_DEBOUNCE_MS - 1);
    expect(queries.length).toBe(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(queries.length).toBe(1);
    expect(queries[0].search).toBe('Breakout');
  });

  it('очищает отложенный таймер поиска при уничтожении стора', async () => {
    vi.useFakeTimers();
    let calls = 0;

    const api = stubApi({
      async list(): Promise<WorkshopPageData> {
        calls++;
        return makePage([]);
      },
      async getById(): Promise<WorkshopDetailResult> {
        return { status: 'NOT_FOUND' };
      },
    });

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);

    store.setSearch('RSI');
    store.ngOnDestroy();

    await vi.advanceTimersByTimeAsync(WORKSHOP_SEARCH_DEBOUNCE_MS + 50);
    expect(calls).toBe(0);
  });

  it('сбрасывает страницу на 1 при смене любого фильтра и при resetFilters', async () => {
    const queries: WorkshopQuery[] = [];
    const api = stubApi({
      async list(query = {}): Promise<WorkshopPageData> {
        queries.push(query);
        return makePage([makeAlgo('A-1')], query.page ?? 1, 3);
      },
      async getById(): Promise<WorkshopDetailResult> {
        return { status: 'NOT_FOUND' };
      },
    });

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);
    await store.load();

    store.setPage(2);
    await Promise.resolve();
    expect(store.currentPage()).toBe(2);

    store.toggleMineOnly();
    await Promise.resolve();
    expect(store.page()).toBe(1);
    expect(queries.at(-1)?.page).toBe(1);

    store.setPage(3);
    await Promise.resolve();
    store.setAuthor('user');
    await Promise.resolve();
    expect(store.page()).toBe(1);

    store.setPage(2);
    await Promise.resolve();
    store.resetFilters();
    await Promise.resolve();
    expect(store.sort()).toBe('published_desc');
    expect(store.authorId()).toBeNull();
    expect(store.mineOnly()).toBe(false);
    expect(store.cleanOnly()).toBe(false);
    expect(store.search()).toBe('');
    expect(store.page()).toBe(1);
  });

  it('при ошибке загрузки не стирает уже загруженный список и авторов', async () => {
    let shouldFail = false;
    const api = stubApi({
      async list(): Promise<WorkshopPageData> {
        if (shouldFail) {
          throw new Error('network');
        }
        return makePage([makeAlgo('A-1', 'Alpha')]);
      },
      async getById(): Promise<WorkshopDetailResult> {
        return { status: 'NOT_FOUND' };
      },
    });

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);
    await store.load();

    expect(store.items().length).toBe(1);
    expect(store.authors().length).toBe(1);

    shouldFail = true;
    await store.load();

    expect(store.error()).toBe('Не удалось загрузить каталог алгоритмов.');
    expect(store.items().map((x) => x.id)).toEqual(['A-1']);
    expect(store.authors().length).toBe(1);
  });

  it('игнорирует ошибку устаревшего запроса list после успешного нового', async () => {
    let rejectFirst!: (reason?: unknown) => void;
    let resolveSecond!: (page: WorkshopPageData) => void;
    let callCount = 0;

    const api = stubApi({
      list(): Promise<WorkshopPageData> {
        callCount++;
        return new Promise<WorkshopPageData>((resolve, reject) => {
          if (callCount === 1) {
            rejectFirst = reject;
          } else {
            resolveSecond = resolve;
          }
        });
      },
      async getById(): Promise<WorkshopDetailResult> {
        return { status: 'NOT_FOUND' };
      },
    });

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);

    const first = store.load();
    store.toggleMineOnly();

    resolveSecond(makePage([makeAlgo('A-FRESH')]));
    await Promise.resolve();

    rejectFirst(new Error('stale failure'));
    await first;

    expect(store.error()).toBeNull();
    expect(store.items().map((x) => x.id)).toEqual(['A-FRESH']);
    expect(store.loading()).toBe(false);
  });

  it('защищает от гонки selectAlgorithm и closeDetail', async () => {
    const resolvers: ((res: WorkshopDetailResult) => void)[] = [];

    const api = stubApi({
      async list(): Promise<WorkshopPageData> {
        return makePage([]);
      },
      getById(): Promise<WorkshopDetailResult> {
        return new Promise<WorkshopDetailResult>((resolve) => {
          resolvers.push(resolve);
        });
      },
    });

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);

    const p1 = store.selectAlgorithm('A-1');
    const p2 = store.selectAlgorithm('A-2');

    resolvers[1]({ status: 'READY', algorithm: makeAlgo('A-2') });
    await p2;

    resolvers[0]({ status: 'READY', algorithm: makeAlgo('A-1') });
    await p1;

    expect(store.selectedId()).toBe('A-2');
    expect(store.selectedDetail()?.id).toBe('A-2');

    const p3 = store.selectAlgorithm('A-3');
    store.closeDetail();
    resolvers[2]({ status: 'READY', algorithm: makeAlgo('A-3') });
    await p3;

    expect(store.selectedId()).toBeNull();
    expect(store.selectedDetail()).toBeNull();
  });

  it('ограничивает сравнение максимум 5 алгоритмами напрямую в toggleCompare', () => {
    const api = stubApi({
      async list(): Promise<WorkshopPageData> {
        return makePage([]);
      },
      async getById(): Promise<WorkshopDetailResult> {
        return { status: 'NOT_FOUND' };
      },
    });

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);

    for (let i = 1; i <= WORKSHOP_COMPARE_LIMIT + 1; i++) {
      store.toggleCompare({ id: `A-${i}`, name: `Algo ${i}`, latestVersion: 1 });
    }

    expect(store.compareCount()).toBe(WORKSHOP_COMPARE_LIMIT);
    expect(store.isInCompare(`A-${WORKSHOP_COMPARE_LIMIT + 1}`)).toBe(false);

    store.toggleCompare({ id: 'A-1', name: 'Algo 1', latestVersion: 1 });
    expect(store.compareCount()).toBe(WORKSHOP_COMPARE_LIMIT - 1);
  });

  it('создаёт черновик, применяет автоисправление fix и перепроверяет DSL', async () => {
    const checkCalls: string[] = [];
    const fixedSource = 'param threshold = 70;\nif rsi(close, 14) > threshold {}';

    const api: WorkshopApi = {
      ...stubApi({
        async list(): Promise<WorkshopPageData> {
          return makePage([makeAlgo('A-NEW', 'Draft Algo')]);
        },
        async getById(id: string): Promise<WorkshopDetailResult> {
          return {
            status: 'READY',
            algorithm: { ...makeAlgo(id, 'Draft Algo'), latestVersion: 0, versions: [] },
          };
        },
      }),
      async createAlgorithm(cmd) {
        return {
          strategyId: 'A-NEW',
          name: cmd.name,
          description: cmd.description ?? '',
          source: cmd.source,
          updatedAt: '2026-11-22T12:00:00Z',
          check: {
            lookaheadLevel: 'WARNING',
            params: [],
            diagnostics: [
              {
                code: 'L001',
                level: 'WARNING',
                startLine: 1,
                startColumn: 21,
                endLine: 1,
                endColumn: 23,
                message: 'Магическая константа 70',
                fixes: [
                  {
                    description: 'Вынести 70 в параметр threshold',
                    edits: [
                      {
                        startLine: 1,
                        startColumn: 1,
                        endLine: 1,
                        endColumn: 1,
                        replacement: 'param threshold = 70;\n',
                      },
                      {
                        startLine: 1,
                        startColumn: 21,
                        endLine: 1,
                        endColumn: 23,
                        replacement: 'threshold',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        };
      },
      async check(cmd) {
        checkCalls.push(cmd.source);
        return { lookaheadLevel: 'OK', diagnostics: [], params: [] };
      },
    };

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);

    store.openCreateDraft();
    store.setDraftName('Draft Algo');
    store.setDraftSource('if rsi(close, 14) > 70 {}');
    const created = await store.createDraft();

    expect(created).toBe(true);
    expect(store.editorMode()).toBe('edit');
    expect(store.selectedId()).toBe('A-NEW');

    const fix = store.checkResult()?.diagnostics[0]?.fixes[0];
    expect(fix).toBeDefined();
    await store.applyFix(fix!);

    expect(store.draftSource()).toBe(fixedSource);
    expect(checkCalls).toEqual([fixedSource]);
    expect(store.checkResult()?.lookaheadLevel).toBe('OK');
  });

  it('блокирует публикацию при ERROR и обрабатывает STRATEGY_INVALID, но публикует чистую стратегию', async () => {
    let publishCalls = 0;
    const api: WorkshopApi = {
      ...stubApi({
        async list(): Promise<WorkshopPageData> {
          return makePage([makeAlgo('A-1')]);
        },
        async getById(id: string): Promise<WorkshopDetailResult> {
          return { status: 'READY', algorithm: makeAlgo(id) };
        },
      }),
      async getDraft(id: string) {
        return {
          strategyId: id,
          name: 'Algo A-1',
          description: 'Desc',
          source: 'lookahead',
          updatedAt: '2026-11-22T12:00:00Z',
          check: {
            lookaheadLevel: 'ERROR',
            params: [],
            diagnostics: [
              {
                code: 'E-LA01',
                level: 'ERROR',
                startLine: 1,
                startColumn: 1,
                endLine: 1,
                endColumn: 9,
                message: 'Заглядывание в будущее',
                fixes: [],
              },
            ],
          },
        };
      },
      async check() {
        return { lookaheadLevel: 'OK', diagnostics: [], params: [] };
      },
      async publish() {
        publishCalls++;
        if (publishCalls === 1) {
          return {
            ok: false,
            code: 'STRATEGY_INVALID',
            lookaheadLevel: 'ERROR',
            diagnostics: [
              {
                code: 'E-SYN',
                level: 'ERROR',
                startLine: 1,
                startColumn: 1,
                endLine: 1,
                endColumn: 5,
                message: 'Синтаксическая ошибка',
                fixes: [],
              },
            ],
          };
        }
        return {
          ok: true,
          version: {
            id: 'A-1-v2',
            version: 2,
            publishedAt: '2026-11-22T13:00:00Z',
            summary: 'Исправлено',
            immutable: true,
            lookaheadLevel: 'OK',
            diagnostics: [],
            params: [],
          },
        };
      },
    };

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);

    await store.openDraft('A-1');
    expect(await store.publishDraft()).toBe(false);
    expect(publishCalls).toBe(0);
    expect(store.publishError()).toContain('E-LA01');

    await store.checkDraft();
    expect(await store.publishDraft()).toBe(false);
    expect(publishCalls).toBe(1);
    expect(store.publishError()).toContain('E-SYN');
    expect(store.publishError()).toContain('Синтаксическая ошибка');
    expect(store.checkResult()?.lookaheadLevel).toBe('ERROR');
    expect(store.checkResult()?.diagnostics[0]?.code).toBe('E-SYN');

    await store.checkDraft();
    store.setPublishSummary('Исправлено');
    expect(await store.publishDraft()).toBe(true);
    expect(store.publishError()).toBeNull();
    expect(store.draftSuccess()).toContain('v2');
  });

  it('выполняет fork, открывает черновик и переключает видимость только для своих несистемных алгоритмов', async () => {
    const forkCalls: { id: string; version?: number | null }[] = [];
    const visCalls: { id: string; visibility: 'public' | 'hidden' }[] = [];

    const ownAlgo = makeAlgo('A-OWN', 'Own Algo');
    const systemAlgo = { ...makeAlgo('A-SYS', 'System'), isMine: false, isSystem: true };

    const api: WorkshopApi = {
      ...stubApi({
        async list(): Promise<WorkshopPageData> {
          return makePage([ownAlgo, systemAlgo]);
        },
        async getById(id: string): Promise<WorkshopDetailResult> {
          return { status: 'READY', algorithm: id === 'A-SYS' ? systemAlgo : ownAlgo };
        },
      }),
      async fork(id, cmd = {}) {
        forkCalls.push({ id, version: cmd.version });
        return {
          strategyId: 'A-FORK',
          name: 'Own Algo (форк)',
          description: 'Desc',
          source: 'param fast = 10;',
          updatedAt: '2026-11-22T12:00:00Z',
          check: { lookaheadLevel: 'OK', diagnostics: [], params: [] },
        };
      },
      async setVisibility(id, visibility) {
        visCalls.push({ id, visibility });
        return { ...ownAlgo, visibility };
      },
    };

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);
    await store.load();
    await store.selectAlgorithm('A-OWN');

    await store.toggleVisibility(systemAlgo);
    expect(visCalls.length).toBe(0);

    await store.toggleVisibility(ownAlgo);
    expect(visCalls).toEqual([{ id: 'A-OWN', visibility: 'hidden' }]);
    expect(store.selectedDetail()?.visibility).toBe('hidden');
    expect(store.items()[0]?.visibility).toBe('hidden');

    await store.forkAlgorithm('A-OWN', 1);
    expect(forkCalls).toEqual([{ id: 'A-OWN', version: 1 }]);
    expect(store.editorMode()).toBe('edit');
    expect(store.draft()?.strategyId).toBe('A-FORK');
  });

  it('защищает openDraft от гонки и сбрасывает checkResult при изменении исходного кода', async () => {
    const draftResolvers: ((draft: Awaited<ReturnType<WorkshopApi['getDraft']>>) => void)[] = [];
    const api: WorkshopApi = {
      ...stubApi({
        async list(): Promise<WorkshopPageData> {
          return makePage([makeAlgo('A-1'), makeAlgo('A-2')]);
        },
        async getById(id: string): Promise<WorkshopDetailResult> {
          return { status: 'READY', algorithm: makeAlgo(id) };
        },
      }),
      getDraft(): ReturnType<WorkshopApi['getDraft']> {
        return new Promise((resolve) => {
          draftResolvers.push(resolve);
        });
      },
    };

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);

    const p1 = store.openDraft('A-1');
    const p2 = store.openDraft('A-2');

    draftResolvers[1]({
      strategyId: 'A-2',
      name: 'Fresh A-2',
      description: 'Desc 2',
      source: 'param x = 2;',
      updatedAt: '2026-11-22T12:00:00Z',
      check: { lookaheadLevel: 'OK', diagnostics: [], params: [] },
    });
    await p2;

    draftResolvers[0]({
      strategyId: 'A-1',
      name: 'Stale A-1',
      description: 'Desc 1',
      source: 'param x = 1;',
      updatedAt: '2026-11-22T11:00:00Z',
      check: { lookaheadLevel: 'ERROR', diagnostics: [], params: [] },
    });
    await p1;

    expect(store.draft()?.strategyId).toBe('A-2');
    expect(store.draftSource()).toBe('param x = 2;');
    expect(store.checkResult()?.lookaheadLevel).toBe('OK');

    store.setDraftSource('param x = 3;');
    expect(store.checkResult()).toBeNull();

    const p3 = store.openDraft('A-1');
    store.closeEditor();
    draftResolvers[2]({
      strategyId: 'A-1',
      name: 'Closed A-1',
      description: 'Desc 1',
      source: 'param x = 1;',
      updatedAt: '2026-11-22T11:00:00Z',
      check: { lookaheadLevel: 'OK', diagnostics: [], params: [] },
    });
    await p3;

    expect(store.editorMode()).toBe('closed');
    expect(store.draft()?.strategyId).toBe('A-2');
  });

  it('защищает checkDraft от устаревшего ответа при правке текста или смене черновика', async () => {
    let resolveCheck!: (res: Awaited<ReturnType<WorkshopApi['check']>>) => void;
    const api: WorkshopApi = {
      ...stubApi({
        async list(): Promise<WorkshopPageData> {
          return makePage([makeAlgo('A-1')]);
        },
        async getById(id: string): Promise<WorkshopDetailResult> {
          return { status: 'READY', algorithm: makeAlgo(id) };
        },
      }),
      async getDraft(id: string) {
        return {
          strategyId: id,
          name: 'Algo',
          description: '',
          source: 'old code',
          updatedAt: '2026-11-22T12:00:00Z',
          check: null,
        };
      },
      check(): ReturnType<WorkshopApi['check']> {
        return new Promise((resolve) => {
          resolveCheck = resolve;
        });
      },
    };

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);

    await store.openDraft('A-1');
    const pCheck = store.checkDraft();
    store.setDraftSource('new edited code');

    resolveCheck({
      lookaheadLevel: 'ERROR',
      params: [],
      diagnostics: [
        {
          code: 'E-SYN',
          level: 'ERROR',
          startLine: 1,
          startColumn: 1,
          endLine: 1,
          endColumn: 4,
          message: 'Устаревшая ошибка',
          fixes: [],
        },
      ],
    });
    await pCheck;

    expect(store.checkResult()).toBeNull();
    expect(store.draftChecking()).toBe(false);
  });

  it('saveDraft не затирает изменённый текст draftSource и игнорирует ответ при смене draftSeq', async () => {
    const saveResolvers: ((d: Awaited<ReturnType<WorkshopApi['saveDraft']>>) => void)[] = [];
    const api: WorkshopApi = {
      ...stubApi({
        async list(): Promise<WorkshopPageData> {
          return makePage([makeAlgo('A-1')]);
        },
        async getById(id: string): Promise<WorkshopDetailResult> {
          return { status: 'READY', algorithm: makeAlgo(id) };
        },
      }),
      async getDraft(id: string) {
        return {
          strategyId: id,
          name: 'Algo',
          description: '',
          source: 'v1',
          updatedAt: '2026-11-22T12:00:00Z',
          check: null,
        };
      },
      saveDraft(): ReturnType<WorkshopApi['saveDraft']> {
        return new Promise((resolve) => {
          saveResolvers.push(resolve);
        });
      },
    };

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);

    await store.openDraft('A-1');
    const pSave = store.saveDraft();
    store.setDraftSource('v2 typed while saving');

    saveResolvers[0]({
      strategyId: 'A-1',
      name: 'Algo',
      description: '',
      source: 'v1',
      updatedAt: '2026-11-22T12:01:00Z',
      check: { lookaheadLevel: 'OK', diagnostics: [], params: [] },
    });
    expect(await pSave).toBe(true);
    expect(store.draftSource()).toBe('v2 typed while saving');
    expect(store.checkResult()).toBeNull();

    // Закрытие редактора во время saveDraft отбрасывает запоздавший ответ.
    const pSave2 = store.saveDraft();
    store.closeEditor();
    saveResolvers[1]({
      strategyId: 'A-1',
      name: 'Algo',
      description: '',
      source: 'v2 typed while saving',
      updatedAt: '2026-11-22T12:02:00Z',
      check: null,
    });
    expect(await pSave2).toBe(false);
    expect(store.editorMode()).toBe('closed');
    expect(store.draftSuccess()).toBeNull();
  });

  it('createDraft, publishDraft и forkAlgorithm игнорируют ответ при изменении draftSeq', async () => {
    let resolveCreate!: (d: Awaited<ReturnType<WorkshopApi['createAlgorithm']>>) => void;
    let resolvePublish!: (r: Awaited<ReturnType<WorkshopApi['publish']>>) => void;
    let resolveFork!: (d: Awaited<ReturnType<WorkshopApi['fork']>>) => void;

    const api: WorkshopApi = {
      ...stubApi({
        async list(): Promise<WorkshopPageData> {
          return makePage([makeAlgo('A-1')]);
        },
        async getById(id: string): Promise<WorkshopDetailResult> {
          return { status: 'READY', algorithm: makeAlgo(id) };
        },
      }),
      async getDraft(id: string) {
        return {
          strategyId: id,
          name: 'Algo',
          description: '',
          source: 'let x = 1;',
          updatedAt: '2026-11-22T12:00:00Z',
          check: { lookaheadLevel: 'OK', diagnostics: [], params: [] },
        };
      },
      createAlgorithm(): ReturnType<WorkshopApi['createAlgorithm']> {
        return new Promise((resolve) => {
          resolveCreate = resolve;
        });
      },
      publish(): ReturnType<WorkshopApi['publish']> {
        return new Promise((resolve) => {
          resolvePublish = resolve;
        });
      },
      fork(): ReturnType<WorkshopApi['fork']> {
        return new Promise((resolve) => {
          resolveFork = resolve;
        });
      },
    };

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);

    store.openCreateDraft();
    store.setDraftName('New');
    const pCreate = store.createDraft();
    store.closeEditor();
    resolveCreate({
      strategyId: 'A-NEW',
      name: 'New',
      description: '',
      source: '',
      updatedAt: '2026-11-22T12:00:00Z',
      check: null,
    });
    expect(await pCreate).toBe(false);
    expect(store.editorMode()).toBe('closed');
    expect(store.draft()).toBeNull();

    await store.openDraft('A-1');
    const pPublish = store.publishDraft();
    store.closeEditor();
    resolvePublish({
      ok: true,
      version: {
        id: 'A-1-v2',
        version: 2,
        publishedAt: '2026-11-22T12:00:00Z',
        summary: 'v2',
        immutable: true,
      },
    });
    expect(await pPublish).toBe(false);
    expect(store.editorMode()).toBe('closed');
    expect(store.draftSuccess()).toBeNull();

    const pFork = store.forkAlgorithm('A-1');
    store.closeEditor();
    resolveFork({
      strategyId: 'A-FORK',
      name: 'Fork',
      description: '',
      source: '',
      updatedAt: '2026-11-22T12:00:00Z',
      check: null,
    });
    await pFork;
    expect(store.editorMode()).toBe('closed');
    expect(store.draft()?.strategyId).toBe('A-1');
  });

  it('restoreCompare дедуплицирует id, ограничивает до 5 и подтягивает карточки отсутствующих в списке алгоритмов', async () => {
    const api = stubApi({
      async list(): Promise<WorkshopPageData> {
        return makePage([makeAlgo('A-1', 'Alpha')]);
      },
      async getById(id: string): Promise<WorkshopDetailResult> {
        if (id === 'A-MISSING') {
          return { status: 'NOT_FOUND' };
        }
        return { status: 'READY', algorithm: makeAlgo(id, `Loaded ${id}`) };
      },
    });

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);
    await store.load();
    await store.restoreCompare([' A-1 ', 'A-1', 'A-2', 'A-MISSING', 'A-3', 'A-4', 'A-5', 'A-6']);

    expect(store.compareList().map((x) => x.id)).toEqual(['A-1', 'A-2', 'A-3', 'A-4']);
    expect(store.canCompare()).toBe(true);
    expect(store.compareIdsParam()).toBe('A-1,A-2,A-3,A-4');
  });

  it('restoreCompare защищён от гонки: устаревший запрос не перезаписывает новый выбор', async () => {
    let resolveSlow!: (res: WorkshopDetailResult) => void;
    const api = stubApi({
      async list(): Promise<WorkshopPageData> {
        return makePage([]);
      },
      async getById(id: string): Promise<WorkshopDetailResult> {
        if (id === 'A-SLOW') {
          return new Promise<WorkshopDetailResult>((resolve) => {
            resolveSlow = resolve;
          });
        }
        return { status: 'READY', algorithm: makeAlgo(id, `Algo ${id}`) };
      },
    });

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);

    const first = store.restoreCompare(['A-SLOW']);
    const second = store.restoreCompare(['A-FAST']);
    await second;

    resolveSlow({ status: 'READY', algorithm: makeAlgo('A-SLOW', 'Slow') });
    await first;

    expect(store.compareList().map((x) => x.id)).toEqual(['A-FAST']);
  });

  it('confirmDelete удаляет свой алгоритм, очищает compareList/selectedDetail и сбрасывает deleteConfirmId', async () => {
    const deleteCalls: string[] = [];
    const mine = { ...makeAlgo('A-MINE', 'My Algo'), isMine: true };

    const api: WorkshopApi = {
      ...stubApi({
        async list(): Promise<WorkshopPageData> {
          return makePage(deleteCalls.length > 0 ? [] : [mine]);
        },
        async getById(id: string): Promise<WorkshopDetailResult> {
          return { status: 'READY', algorithm: { ...mine, id } };
        },
      }),
      async deleteAlgorithm(id: string): Promise<void> {
        deleteCalls.push(id);
      },
    };

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);

    store.toggleCompare({ id: 'A-MINE', name: 'My Algo', latestVersion: 1 });
    await store.selectAlgorithm('A-MINE');
    store.requestDelete('A-MINE');
    expect(store.deleteConfirmId()).toBe('A-MINE');

    const ok = await store.confirmDelete('A-MINE');
    expect(ok).toBe(true);
    expect(deleteCalls).toEqual(['A-MINE']);
    expect(store.compareList()).toEqual([]);
    expect(store.selectedId()).toBeNull();
    expect(store.selectedDetail()).toBeNull();
    expect(store.deleteConfirmId()).toBeNull();
    expect(store.items()).toEqual([]);
  });

  it('confirmDelete при ошибке API выставляет actionError и не закрывает карточку', async () => {
    const mine = { ...makeAlgo('A-MINE', 'My Algo'), isMine: true };
    const api: WorkshopApi = {
      ...stubApi({
        async list(): Promise<WorkshopPageData> {
          return makePage([mine]);
        },
        async getById(): Promise<WorkshopDetailResult> {
          return { status: 'READY', algorithm: mine };
        },
      }),
      async deleteAlgorithm(): Promise<void> {
        throw new Error('delete failed');
      },
    };

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);

    await store.selectAlgorithm('A-MINE');
    store.requestDelete('A-MINE');
    const ok = await store.confirmDelete('A-MINE');

    expect(ok).toBe(false);
    expect(store.selectedId()).toBe('A-MINE');
    expect(store.actionError()).toBe('Не удалось удалить алгоритм.');
  });

  it('confirmDelete запрещён для системного и чужого алгоритмов', async () => {
    let deleteCount = 0;
    const sysAlgo = { ...makeAlgo('A-SYS', 'System'), isMine: true, isSystem: true };
    const alienAlgo = { ...makeAlgo('A-ALIEN', 'Alien'), isMine: false, isSystem: false };

    const api: WorkshopApi = {
      ...stubApi({
        async list(): Promise<WorkshopPageData> {
          return makePage([sysAlgo, alienAlgo]);
        },
        async getById(id: string): Promise<WorkshopDetailResult> {
          return { status: 'READY', algorithm: id === 'A-SYS' ? sysAlgo : alienAlgo };
        },
      }),
      async deleteAlgorithm(): Promise<void> {
        deleteCount++;
      },
    };

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);

    await store.selectAlgorithm('A-SYS');
    expect(await store.confirmDelete('A-SYS')).toBe(false);
    await store.selectAlgorithm('A-ALIEN');
    expect(await store.confirmDelete('A-ALIEN')).toBe(false);
    expect(deleteCount).toBe(0);
  });

  it('confirmDelete защищён от гонки: переключение на другой алгоритм во время удаления не закрывает новую карточку', async () => {
    let resolveDelete!: () => void;
    const mine = { ...makeAlgo('A-MINE', 'My Algo'), isMine: true };
    const other = makeAlgo('A-OTHER', 'Other Algo');

    const api: WorkshopApi = {
      ...stubApi({
        async list(): Promise<WorkshopPageData> {
          return makePage([other]);
        },
        async getById(id: string): Promise<WorkshopDetailResult> {
          return { status: 'READY', algorithm: id === 'A-MINE' ? mine : other };
        },
      }),
      deleteAlgorithm(): Promise<void> {
        return new Promise<void>((resolve) => {
          resolveDelete = resolve;
        });
      },
    };

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);

    await store.selectAlgorithm('A-MINE');
    store.requestDelete('A-MINE');
    const pendingDelete = store.confirmDelete('A-MINE');

    await store.selectAlgorithm('A-OTHER');
    expect(store.deleteConfirmId()).toBeNull();

    resolveDelete();
    await pendingDelete;

    expect(store.selectedId()).toBe('A-OTHER');
    expect(store.selectedDetail()?.id).toBe('A-OTHER');
  });

  it('setMineOnly(true) сбрасывает sort author_asc на published_desc и закрывает открытую карточку чужого алгоритма', async () => {
    const mine = { ...makeAlgo('A-MINE', 'My Algo'), isMine: true };
    const alien = { ...makeAlgo('A-ALIEN', 'Alien Algo'), isMine: false };
    const api = stubApi({
      async list(): Promise<WorkshopPageData> {
        return makePage([mine, alien]);
      },
      async getById(id: string): Promise<WorkshopDetailResult> {
        return { status: 'READY', algorithm: id === 'A-MINE' ? mine : alien };
      },
    });

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);

    store.setSort('author_asc');
    await store.selectAlgorithm('A-ALIEN');
    expect(store.selectedId()).toBe('A-ALIEN');

    store.setMineOnly(true);
    expect(store.sort()).toBe('published_desc');
    expect(store.selectedId()).toBeNull();
    expect(store.selectedDetail()).toBeNull();

    // Своя карточка при переходе в «Мои алгоритмы» остаётся открытой.
    await store.setMineOnly(false);
    await store.selectAlgorithm('A-MINE');
    store.setMineOnly(true);
    expect(store.selectedId()).toBe('A-MINE');
  });

  it('не добавляет неопубликованный черновик (latestVersion === 0) в сравнение и не меняет его видимость', async () => {
    let visibilityCalls = 0;
    const draft = { ...makeAlgo('A-DRAFT', 'Draft'), isMine: true, latestVersion: 0, versions: [] };
    const api: WorkshopApi = {
      ...stubApi({
        async list(): Promise<WorkshopPageData> {
          return makePage([draft]);
        },
        async getById(): Promise<WorkshopDetailResult> {
          return { status: 'READY', algorithm: draft };
        },
      }),
      async setVisibility() {
        visibilityCalls++;
        return draft;
      },
    };

    TestBed.configureTestingModule({
      providers: [{ provide: WORKSHOP_API, useValue: api }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);

    store.toggleCompare({ id: 'A-DRAFT', name: 'Draft', latestVersion: 0 });
    expect(store.compareCount()).toBe(0);

    await store.toggleVisibility(draft);
    expect(visibilityCalls).toBe(0);
  });
});

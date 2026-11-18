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

    const api: WorkshopApi = {
      async list(query = {}): Promise<WorkshopPageData> {
        queries.push(query);
        return makePage([makeAlgo('A-1')]);
      },
      async getById(): Promise<WorkshopDetailResult> {
        return { status: 'NOT_FOUND' };
      },
    };

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

    const api: WorkshopApi = {
      async list(): Promise<WorkshopPageData> {
        calls++;
        return makePage([]);
      },
      async getById(): Promise<WorkshopDetailResult> {
        return { status: 'NOT_FOUND' };
      },
    };

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
    const api: WorkshopApi = {
      async list(query = {}): Promise<WorkshopPageData> {
        queries.push(query);
        return makePage([makeAlgo('A-1')], query.page ?? 1, 3);
      },
      async getById(): Promise<WorkshopDetailResult> {
        return { status: 'NOT_FOUND' };
      },
    };

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
    const api: WorkshopApi = {
      async list(): Promise<WorkshopPageData> {
        if (shouldFail) {
          throw new Error('network');
        }
        return makePage([makeAlgo('A-1', 'Alpha')]);
      },
      async getById(): Promise<WorkshopDetailResult> {
        return { status: 'NOT_FOUND' };
      },
    };

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

    const api: WorkshopApi = {
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
    };

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

    const api: WorkshopApi = {
      async list(): Promise<WorkshopPageData> {
        return makePage([]);
      },
      getById(): Promise<WorkshopDetailResult> {
        return new Promise<WorkshopDetailResult>((resolve) => {
          resolvers.push(resolve);
        });
      },
    };

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
    const api: WorkshopApi = {
      async list(): Promise<WorkshopPageData> {
        return makePage([]);
      },
      async getById(): Promise<WorkshopDetailResult> {
        return { status: 'NOT_FOUND' };
      },
    };

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
});

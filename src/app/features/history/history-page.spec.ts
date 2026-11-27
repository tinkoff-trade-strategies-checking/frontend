import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import {
  HISTORY_API,
  HistoryApi,
  HistoryEntry,
  HistoryPage as HistoryPageData,
  HistoryQuery,
} from './data/history.models';
import { StubHistoryApi } from './data/stub-history.api';
import { HistoryPage } from './history-page';
import { HistoryStore } from './history.store';

describe('HistoryPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryPage],
      providers: [provideRouter([]), provideTaiga()],
    }).compileComponents();
  });

  it('загружает первую страницу из 20 записей и показывает S-0104, S-0105 и S-0103', async () => {
    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const rows = Array.from(el.querySelectorAll('tbody tr'));
    expect(rows.length).toBe(20);
    expect(rows[0].getAttribute('data-session-id')).toBe('S-0104');

    const text = el.textContent ?? '';
    expect(text).toContain('Слепая сессия от 18.11.2026');
    expect(text).toContain('Неслепая');
    expect(text).toContain('S-0103');
  });

  it('INV-7: незавершённая слепая сессия S-0104 отображается без бумаг, периода и итога', async () => {
    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const row = el.querySelector('tr[data-session-id="S-0104"]');
    expect(row).not.toBeNull();
    const rowText = row?.textContent ?? '';

    expect(rowText).toContain('Слепая сессия от 18.11.2026');
    expect(rowText).toContain('Идёт');
    expect(rowText).toContain('—');
    expect(rowText).not.toMatch(/\b(SBER|GAZP|YDEX|GMKN|MGNT)\b/);
    expect(rowText).not.toContain('26.02.2020');

    const continueLink = row?.querySelector('a[href="/arena"]');
    expect(continueLink?.textContent?.trim()).toBe('Продолжить');
  });

  it('показывает ссылки «Открыть отчёт» и «Воспроизвести» для завершённой сессии S-0103', async () => {
    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const row = el.querySelector('tr[data-session-id="S-0103"]');
    expect(row).not.toBeNull();

    const reportLink = row?.querySelector('a[href="/report/S-0103"]');
    const replayLink = row?.querySelector('a[href="/replay/S-0103"]');
    expect(reportLink?.textContent?.trim()).toBe('Открыть отчёт');
    expect(replayLink?.textContent?.trim()).toBe('Воспроизвести');
  });

  it('фильтр «Только слепые» скрывает неслепые сессии и прогоны', async () => {
    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('tr[data-session-id="S-0105"]')).not.toBeNull();

    const blindBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Только слепые'),
    );
    expect(blindBtn).toBeDefined();
    blindBtn?.click();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('tr[data-session-id="S-0105"]')).toBeNull();
    expect(el.querySelector('tr[data-session-id="S-0104"]')).not.toBeNull();
    expect(el.querySelector('tr[data-session-id="S-0103"]')).not.toBeNull();
  });

  it('переключает страницы пагинации (страница 1 → страница 2)', async () => {
    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('tbody tr').length).toBe(20);
    expect(el.textContent).toContain('Страница 1 из 2');

    const nextBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Вперёд',
    );
    expect(nextBtn).toBeDefined();
    nextBtn?.click();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Страница 2 из 2');
    expect(el.querySelectorAll('tbody tr').length).toBe(5);
  });
});

describe('HistoryStore', () => {
  it('защищён от гонок: устаревший запрос не перезаписывает более свежий', async () => {
    let resolveFirst!: (page: HistoryPageData) => void;
    let resolveSecond!: (page: HistoryPageData) => void;
    let callCount = 0;

    const realStub = new StubHistoryApi();
    const firstData = await realStub.list({ page: 1 });
    const secondData = await realStub.list({ blindOnly: true, page: 1 });

    const deferredApi: HistoryApi = {
      list(): Promise<HistoryPageData> {
        callCount += 1;
        if (callCount === 1) {
          return new Promise((resolve) => {
            resolveFirst = resolve;
          });
        }
        return new Promise((resolve) => {
          resolveSecond = resolve;
        });
      },
    };

    TestBed.configureTestingModule({
      providers: [{ provide: HISTORY_API, useValue: deferredApi }, HistoryStore],
    });
    const store = TestBed.inject(HistoryStore);

    const firstLoad = store.load();
    store.toggleBlindOnly();

    resolveSecond(secondData);
    await Promise.resolve();
    expect(store.items().every((item) => item.blind)).toBe(true);

    resolveFirst(firstData);
    await firstLoad;

    expect(store.items().every((item) => item.blind)).toBe(true);
    expect(store.loading()).toBe(false);
  });
});

function emptyPage(page = 1, totalPages = 1): HistoryPageData {
  return { items: [], total: 0, page, pageSize: 20, totalPages };
}

function storeWith(api: HistoryApi): HistoryStore {
  TestBed.configureTestingModule({
    providers: [{ provide: HISTORY_API, useValue: api }, HistoryStore],
  });
  return TestBed.inject(HistoryStore);
}

describe('HistoryStore: фильтры, ошибки, пагинация', () => {
  it('сбрасывает страницу на первую при смене фильтра', async () => {
    const queries: HistoryQuery[] = [];
    const store = storeWith({
      async list(query = {}) {
        queries.push(query);
        return new StubHistoryApi().list(query);
      },
    });

    await store.load();
    store.setPage(2);
    await Promise.resolve();
    await Promise.resolve();
    expect(store.page()).toBe(2);

    store.setRegime('calm');
    expect(store.page()).toBe(1);
    expect(queries[queries.length - 1]).toMatchObject({ regime: 'calm', page: 1 });
  });

  it('при ошибке источника сбрасывает данные и выставляет error', async () => {
    let fail = false;
    const stub = new StubHistoryApi();
    const store = storeWith({
      list: (query) => (fail ? Promise.reject(new Error('boom')) : stub.list(query)),
    });

    await store.load();
    expect(store.items().length).toBeGreaterThan(0);

    fail = true;
    await store.load();
    expect(store.error()).not.toBeNull();
    expect(store.pageData()).toBeNull();
    expect(store.items()).toEqual([]);
    expect(store.loading()).toBe(false);
  });

  it('пустой результат: нет записей, одна страница, без ошибки', async () => {
    const store = storeWith({ list: async () => emptyPage() });
    await store.load();
    expect(store.items()).toEqual([]);
    expect(store.total()).toBe(0);
    expect(store.error()).toBeNull();
    expect(store.hasPrevPage()).toBe(false);
    expect(store.hasNextPage()).toBe(false);
  });

  it('последняя страница: hasNextPage = false, hasPrevPage = true', async () => {
    const stub = new StubHistoryApi();
    const store = storeWith(stub);
    await store.load();
    expect(store.hasNextPage()).toBe(true);
    store.setPage(2);
    await vi.waitFor(() => expect(store.currentPage()).toBe(2));
    expect(store.hasNextPage()).toBe(false);
    expect(store.hasPrevPage()).toBe(true);
  });

  it('INV-7: «утекающая» запись маскируется в сторе', async () => {
    const leaky = {
      id: 'S-LEAK',
      kind: 'session',
      owner: 'USER',
      blind: true,
      status: 'running',
      createdAt: '2026-11-18T14:20:00+03:00',
      regime: 'stress',
      title: 'Секретный кризис',
      papers: ['SBER', 'GAZP'],
      periodLabel: '26.02.2020 — 21.05.2020',
      netReturnPct: 6.43,
      playedDays: 14,
      totalDays: 60,
      algoName: null,
    } as unknown as HistoryEntry;
    const store = storeWith({
      list: async () => ({ ...emptyPage(), items: [leaky], total: 1 }),
    });
    await store.load();
    const [item] = store.items();
    expect(item).not.toHaveProperty('title');
    expect(item).not.toHaveProperty('papers');
    expect(item).not.toHaveProperty('periodLabel');
    expect(item).not.toHaveProperty('netReturnPct');
  });
});

describe('HistoryPage: ошибка и утечки', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryPage],
      providers: [provideRouter([]), provideTaiga()],
    }).compileComponents();
  });

  it('INV-7: «утекающая» запись не попадает на страницу', async () => {
    const leaky = {
      id: 'S-LEAK',
      kind: 'session',
      owner: 'USER',
      blind: true,
      status: 'running',
      createdAt: '2026-11-18T14:20:00+03:00',
      regime: 'stress',
      title: 'Секретный кризис',
      papers: ['SBER', 'GAZP'],
      periodLabel: '26.02.2020 — 21.05.2020',
      netReturnPct: 6.43,
      playedDays: 14,
      totalDays: 60,
      algoName: null,
    } as unknown as HistoryEntry;
    TestBed.overrideComponent(HistoryPage, {
      set: {
        providers: [
          {
            provide: HISTORY_API,
            useValue: { list: async () => ({ ...emptyPage(), items: [leaky], total: 1 }) },
          },
          HistoryStore,
        ],
      },
    });
    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).querySelector('tbody')?.textContent ?? '';
    expect(text).toContain('Слепая сессия от 18.11.2026');
    expect(text).not.toMatch(/SBER|GAZP|2020|Секретный|6,43/);
  });

  it('при ошибке показывает баннер, но не «под фильтры ничего нет»', async () => {
    TestBed.overrideComponent(HistoryPage, {
      set: {
        providers: [
          { provide: HISTORY_API, useValue: { list: () => Promise.reject(new Error('x')) } },
          HistoryStore,
        ],
      },
    });
    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Не удалось загрузить историю сессий.');
    expect(text).not.toContain('под выбранные фильтры нет');
  });

  it('разделяет пустое состояние: без фильтров — приветствие и кнопка на /new, с фильтрами — «Сбросить фильтры»', async () => {
    TestBed.overrideComponent(HistoryPage, {
      set: {
        providers: [
          { provide: HISTORY_API, useValue: { list: async () => emptyPage() } },
          HistoryStore,
        ],
      },
    });
    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Здесь появятся ваши тренировки');
    const startLink = el.querySelector('.welcome-empty a[href="/new"]');
    expect(startLink?.textContent?.trim()).toBe('Начать первую тренировку');
    expect(el.textContent).not.toContain('Сбросить фильтры');

    const store = fixture.debugElement.injector.get(HistoryStore);
    store.toggleBlindOnly();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Сессий и прогонов под выбранные фильтры нет.');
    expect(el.textContent).toContain('Сбросить фильтры');
    expect(el.textContent).not.toContain('Начать первую тренировку');
  });
});

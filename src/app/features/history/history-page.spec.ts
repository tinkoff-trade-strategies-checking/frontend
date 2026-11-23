import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { vi } from 'vitest';
import { RUNS_API, RunsApi } from '../runs/data/runs.models';
import { StubRunsApi } from '../runs/data/stub-runs.api';
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

  it('для algo_run ведёт в /runs/:id, /runs/:id/report и вызывает repeatRun по кнопке «Повторить»', async () => {
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const runningRow = el.querySelector('tr[data-session-id="R-0203"]');
    expect(runningRow?.querySelector('a[href="/runs/R-0203"]')?.textContent?.trim()).toBe(
      'Прогресс',
    );

    const doneRow = el.querySelector('tr[data-session-id="R-0205"]');
    expect(doneRow?.querySelector('a[href="/runs/R-0205/report"]')?.textContent?.trim()).toBe(
      'Открыть отчёт',
    );

    const repeatBtn = Array.from(doneRow?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Повторить',
    );
    expect(repeatBtn).toBeDefined();
    repeatBtn?.click();

    await vi.waitFor(() => expect(navSpy).toHaveBeenCalled());
    expect(navSpy).toHaveBeenCalledWith(['/runs', expect.stringMatching(/^R-\d{4}$/)]);
  });

  it('переключает фильтры «Статус» и «Период» (и обратно в «Все») через HistoryFilters', async () => {
    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const statusSelect = el.querySelector(
      'select[aria-label="Статус"]',
    ) as HTMLSelectElement | null;
    const regimeSelect = el.querySelector(
      'select[aria-label="Период"]',
    ) as HTMLSelectElement | null;
    expect(statusSelect).not.toBeNull();
    expect(regimeSelect).not.toBeNull();

    const selectByText = (select: HTMLSelectElement, label: string): void => {
      const idx = Array.from(select.options).findIndex((o) => o.textContent?.trim() === label);
      expect(idx).toBeGreaterThanOrEqual(0);
      select.selectedIndex = idx;
      select.dispatchEvent(new Event('change'));
    };

    selectByText(statusSelect!, 'Идёт');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('tr[data-session-id="S-0104"]')).not.toBeNull();
    expect(el.querySelector('tr[data-session-id="S-0103"]')).toBeNull();

    selectByText(statusSelect!, 'Все');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('tr[data-session-id="S-0103"]')).not.toBeNull();

    selectByText(regimeSelect!, 'Стрессовый');
    await fixture.whenStable();
    fixture.detectChanges();
    const stressRows = Array.from(el.querySelectorAll('tbody tr'));
    expect(stressRows.length).toBeGreaterThan(0);
    expect(stressRows.every((r) => r.textContent?.includes('Стрессовый'))).toBe(true);

    selectByText(regimeSelect!, 'Все периоды');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(20);
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
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HistoryPage],
      providers: [provideRouter([]), provideTaiga()],
    });
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
          { provide: RUNS_API, useClass: StubRunsApi },
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
          { provide: RUNS_API, useClass: StubRunsApi },
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

  it('отображает статусы invalid/failed и показывает ошибку если repeatRun не удался', async () => {
    const items: HistoryEntry[] = [
      {
        id: 'R-INV',
        kind: 'algo_run',
        owner: 'USER',
        blind: false,
        status: 'invalid',
        createdAt: '2026-11-18T10:00:00+03:00',
        regime: 'calm',
        title: 'Битая стратегия',
        papers: ['SBER'],
        periodLabel: '10.04.2023 — 05.07.2023',
        netReturnPct: null,
        playedDays: 0,
        totalDays: 60,
        algoName: 'Битая стратегия',
      },
      {
        id: 'R-FAIL',
        kind: 'algo_run',
        owner: 'USER',
        blind: false,
        status: 'failed',
        createdAt: '2026-11-18T09:00:00+03:00',
        regime: 'stress',
        title: 'Сбой воркера',
        papers: ['GAZP'],
        periodLabel: '10.04.2023 — 05.07.2023',
        netReturnPct: null,
        playedDays: 5,
        totalDays: 60,
        algoName: 'Сбой воркера',
      },
    ];
    const failingRuns: Pick<RunsApi, 'repeatRun'> = {
      repeatRun: () => Promise.reject(new Error('boom')),
    };
    TestBed.overrideComponent(HistoryPage, {
      set: {
        providers: [
          {
            provide: HISTORY_API,
            useValue: { list: async () => ({ ...emptyPage(), items, total: 2 }) },
          },
          { provide: RUNS_API, useValue: failingRuns },
          HistoryStore,
        ],
      },
    });
    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('С ошибкой DSL');
    expect(el.textContent).toContain('Ошибка');

    const repeatBtn = Array.from(
      el.querySelectorAll<HTMLButtonElement>('tr[data-session-id="R-INV"] button'),
    ).find((b) => b.textContent?.trim() === 'Повторить');
    repeatBtn?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Не удалось повторить прогон.');
  });
});

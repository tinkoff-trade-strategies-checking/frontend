import { TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
import {
  WORKSHOP_API,
  WORKSHOP_COMPARE_LIMIT,
  WorkshopAlgorithmDetail,
  WorkshopApi,
  WorkshopDetailResult,
  WorkshopPage as WorkshopPageData,
} from './data/workshop.models';
import { WorkshopPage } from './workshop-page';
import { WorkshopStore } from './workshop.store';

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
  };
}

describe('WorkshopPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkshopPage],
      providers: [provideTaiga()],
    }).compileComponents();
  });

  it('загружает первую страницу из 20 алгоритмов, показывает лицензию MIT, версии и пометку «Скрыт» для своего скрытого алгоритма', async () => {
    const fixture = TestBed.createComponent(WorkshopPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const rows = Array.from(el.querySelectorAll('tbody tr'));
    expect(rows.length).toBe(20);
    expect(el.textContent).toContain('Страница 1 из 2');
    expect(el.textContent).toContain('Эталон платформы');
    expect(el.textContent).toContain('MIT');

    const ownHiddenRow = el.querySelector('tr[data-algo-id="A-0004"]');
    expect(ownHiddenRow).not.toBeNull();
    expect(ownHiddenRow?.textContent).toContain('Скрыт');

    expect(el.querySelector('tr[data-algo-id="A-0005"]')).toBeNull();
  });

  it('фильтрует алгоритмы по «Мои», «Без предупреждений линтера», автору и поиску', async () => {
    const fixture = TestBed.createComponent(WorkshopPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;

    const mineBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Мои',
    );
    expect(mineBtn).toBeDefined();
    mineBtn?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const mineRows = Array.from(el.querySelectorAll('tbody tr'));
    expect(mineRows.length).toBe(4);
    expect(el.querySelector('tr[data-algo-id="A-0004"]')).not.toBeNull();

    const cleanBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Без предупреждений линтера',
    );
    cleanBtn?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('tr[data-algo-id="A-0002"]')).toBeNull();
    expect(el.querySelector('tr[data-algo-id="A-0004"]')).not.toBeNull();
  });

  it('переключает страницы пагинации (страница 1 → страница 2)', async () => {
    const fixture = TestBed.createComponent(WorkshopPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const nextBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Вперёд',
    );
    nextBtn?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Страница 2 из 2');
    expect(el.querySelectorAll('tbody tr').length).toBe(5);
  });

  it('открывает карточку алгоритма с версиями (INV-5), предупреждениями линтера и неактивными действиями «Форк» и «Запустить прогон»', async () => {
    const fixture = TestBed.createComponent(WorkshopPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const rowA3 = el.querySelector('tr[data-algo-id="A-0003"]');
    const openBtn = rowA3?.querySelector('button');
    openBtn?.click();

    await fixture.whenStable();
    fixture.detectChanges();

    const detail = el.querySelector('.detail-panel');
    expect(detail).not.toBeNull();
    const detailText = detail?.textContent ?? '';
    expect(detailText).toContain('Breakout ATR');
    expect(detailText).toContain('L001');
    expect(detailText).toContain('W-LA01');
    expect(detailText).toContain('неизменяема');
    expect(detailText).toContain('v3');
    expect(detailText).toContain('v2');
    expect(detailText).toContain('v1');
    expect(detailText).toContain('пока недоступны');

    const forkBtn = Array.from(detail?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Форк',
    ) as HTMLButtonElement | undefined;
    const runBtn = Array.from(detail?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Запустить прогон',
    ) as HTMLButtonElement | undefined;

    expect(forkBtn?.disabled).toBe(true);
    expect(forkBtn?.title).toContain('Пока недоступно');
    expect(runBtn?.disabled).toBe(true);
    expect(runBtn?.title).toContain('Пока недоступно');
  });

  it('ограничивает добавление в сравнение максимум 5 алгоритмами', async () => {
    const fixture = TestBed.createComponent(WorkshopPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const ids = ['A-0001', 'A-0002', 'A-0003', 'A-0004', 'A-0006'];

    for (const id of ids) {
      const openBtn = el.querySelector(`tr[data-algo-id="${id}"] button`);
      openBtn?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      fixture.detectChanges();

      const addBtn = Array.from(el.querySelectorAll('.detail-panel button')).find((b) =>
        b.textContent?.includes('Добавить в сравнение'),
      ) as HTMLButtonElement | undefined;
      expect(addBtn?.disabled).toBe(false);
      addBtn?.click();
      fixture.detectChanges();
    }

    expect(el.textContent).toContain(
      `В сравнении: ${WORKSHOP_COMPARE_LIMIT} из ${WORKSHOP_COMPARE_LIMIT}`,
    );

    const openSixth = el.querySelector('tr[data-algo-id="A-0007"] button');
    openSixth?.dispatchEvent(new Event('click'));
    await fixture.whenStable();
    fixture.detectChanges();

    const addSixthBtn = Array.from(el.querySelectorAll('.detail-panel button')).find((b) =>
      b.textContent?.includes('Добавить в сравнение'),
    ) as HTMLButtonElement | undefined;
    expect(addSixthBtn?.disabled).toBe(true);
  });

  it('при ошибке первой загрузки не показывает таблицу и «Страница 1 из 1», кнопка «Повторить» перезагружает', async () => {
    let shouldFail = true;
    const fakeApi = stubApi({
      async list(): Promise<WorkshopPageData> {
        if (shouldFail) {
          throw new Error('offline');
        }
        return {
          items: [
            {
              id: 'A-1',
              name: 'Recovered Algo',
              description: 'Desc',
              authorId: 'user',
              author: 'Вы',
              isMine: true,
              isSystem: false,
              visibility: 'public',
              latestVersion: 1,
              publishedAt: '2026-11-18T12:00:00+03:00',
              license: 'MIT',
              linterWarnings: [],
            },
          ],
          authors: [{ id: 'user', name: 'Вы' }],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        };
      },
      async getById(): Promise<WorkshopDetailResult> {
        return { status: 'NOT_FOUND' };
      },
    });

    TestBed.overrideProvider(WORKSHOP_API, { useValue: fakeApi });
    const fixture = TestBed.createComponent(WorkshopPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('table')).toBeNull();
    expect(el.textContent).not.toContain('Страница 1 из 1');
    expect(el.textContent).toContain('Не удалось загрузить каталог алгоритмов.');

    shouldFail = false;
    const retryBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Повторить',
    );
    expect(retryBtn).toBeDefined();
    retryBtn?.click();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Recovered Algo');
  });

  it('при пустом результате не показывает таблицу и пагинацию, а «текущая» ставится по latestVersion', async () => {
    let returnEmpty = true;
    const fakeApi = stubApi({
      async list(): Promise<WorkshopPageData> {
        if (returnEmpty) {
          return { items: [], authors: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
        }
        return {
          items: [
            {
              id: 'A-1',
              name: 'Versioned Algo',
              description: 'Desc',
              authorId: 'user',
              author: 'Вы',
              isMine: true,
              isSystem: false,
              visibility: 'public',
              latestVersion: 2,
              publishedAt: '2026-11-18T12:00:00+03:00',
              license: 'MIT',
              linterWarnings: [],
            },
          ],
          authors: [{ id: 'user', name: 'Вы' }],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        };
      },
      async getById(): Promise<WorkshopDetailResult> {
        return {
          status: 'READY',
          algorithm: {
            id: 'A-1',
            name: 'Versioned Algo',
            description: 'Desc',
            authorId: 'user',
            author: 'Вы',
            isMine: true,
            isSystem: false,
            visibility: 'public',
            latestVersion: 2,
            publishedAt: '2026-11-18T12:00:00+03:00',
            license: 'MIT',
            linterWarnings: [],
            versions: [
              {
                version: 1,
                publishedAt: '2026-11-10T10:00:00+03:00',
                summary: 'Старая',
                immutable: true,
              },
              {
                version: 2,
                publishedAt: '2026-11-18T12:00:00+03:00',
                summary: 'Новая',
                immutable: true,
              },
            ],
          },
        };
      },
    });

    TestBed.overrideProvider(WORKSHOP_API, { useValue: fakeApi });
    const fixture = TestBed.createComponent(WorkshopPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('table')).toBeNull();
    expect(el.textContent).not.toContain('Страница 1 из 1');
    expect(el.textContent).toContain('Алгоритмы под выбранные фильтры не найдены.');

    returnEmpty = false;
    const resetBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Сбросить фильтры',
    );
    resetBtn?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const openBtn = el.querySelector('tr[data-algo-id="A-1"] button');
    openBtn?.dispatchEvent(new Event('click'));
    await fixture.whenStable();
    fixture.detectChanges();

    const versionItems = Array.from(el.querySelectorAll('.version-item'));
    expect(versionItems.length).toBe(2);
    expect(versionItems[0].textContent).not.toContain('текущая');
    expect(versionItems[1].textContent).toContain('текущая');
  });
});

describe('WorkshopStore race protection', () => {
  it('игнорирует устаревший ответ list при быстром переключении фильтров', async () => {
    let resolveFirst!: (page: WorkshopPageData) => void;
    let resolveSecond!: (page: WorkshopPageData) => void;
    let callCount = 0;

    const fakeApi = stubApi({
      list(): Promise<WorkshopPageData> {
        callCount++;
        return new Promise<WorkshopPageData>((resolve) => {
          if (callCount === 1) {
            resolveFirst = resolve;
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
      providers: [{ provide: WORKSHOP_API, useValue: fakeApi }, WorkshopStore],
    });
    const store = TestBed.inject(WorkshopStore);

    const firstLoad = store.load();
    store.toggleMineOnly();

    const freshDetail: WorkshopAlgorithmDetail = {
      id: 'A-NEW',
      name: 'Fresh Algo',
      description: 'Fresh',
      authorId: 'user',
      author: 'Вы',
      isMine: true,
      isSystem: false,
      visibility: 'public',
      latestVersion: 1,
      publishedAt: '2026-11-18T12:00:00+03:00',
      license: 'MIT',
      linterWarnings: [],
      versions: [],
    };

    resolveSecond({
      items: [freshDetail],
      authors: [{ id: 'user', name: 'Вы' }],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
    await Promise.resolve();

    resolveFirst({
      items: [],
      authors: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
    await firstLoad;

    expect(store.items().map((x) => x.id)).toEqual(['A-NEW']);
    expect(store.loading()).toBe(false);
  });
});

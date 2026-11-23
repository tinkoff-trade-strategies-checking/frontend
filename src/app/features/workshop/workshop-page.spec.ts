import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { RUNS_API, RunsApi } from '../runs/data/runs.models';
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
    deleteAlgorithm: () => Promise.reject(new Error('not used')),
  };
}

function findRowButton(
  el: HTMLElement,
  algoId: string,
  label: string,
): HTMLButtonElement | undefined {
  return Array.from(
    el.querySelectorAll<HTMLButtonElement>(`tr[data-algo-id="${algoId}"] button`),
  ).find((b) => b.textContent?.trim() === label);
}

describe('WorkshopPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkshopPage],
      providers: [provideTaiga(), provideRouter([])],
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
      (b) => b.textContent?.trim() === 'Мои алгоритмы',
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

  it('открывает карточку алгоритма с версиями (INV-5), предупреждениями линтера и активными действиями «Форк» и «Запустить прогон»', async () => {
    const fixture = TestBed.createComponent(WorkshopPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const openBtn = findRowButton(el, 'A-0003', 'Открыть');
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

    const buttons = Array.from(detail?.querySelectorAll('button') ?? []);
    const forkBtn = buttons.find((b) => b.textContent?.trim() === 'Форк') as
      HTMLButtonElement | undefined;
    const runBtn = buttons.find((b) => b.textContent?.trim() === 'Запустить прогон') as
      HTMLButtonElement | undefined;
    const hideBtn = buttons.find((b) => b.textContent?.trim() === 'Скрыть');

    expect(forkBtn?.disabled).toBe(false);
    expect(runBtn?.disabled).toBe(false);
    expect(hideBtn).toBeUndefined();
  });

  it('ограничивает добавление в сравнение максимум 5 алгоритмами', async () => {
    const fixture = TestBed.createComponent(WorkshopPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const ids = ['A-0001', 'A-0002', 'A-0003', 'A-0004', 'A-0006'];

    for (const id of ids) {
      const openBtn = findRowButton(el, id, 'Открыть');
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

    const openSixth = findRowButton(el, 'A-0007', 'Открыть');
    openSixth?.dispatchEvent(new Event('click'));
    await fixture.whenStable();
    fixture.detectChanges();

    const addSixthBtn = Array.from(el.querySelectorAll('.detail-panel button')).find((b) =>
      b.textContent?.includes('Добавить в сравнение'),
    ) as HTMLButtonElement | undefined;
    expect(addSixthBtn?.disabled).toBe(true);
  });

  it('при 1 выбранном алгоритме кнопка «Сравнить (1)» отключена с подсказкой, при 2 — активна ссылка на /workshop/compare', async () => {
    const fixture = TestBed.createComponent(WorkshopPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const addAlgo = async (id: string) => {
      findRowButton(el, id, 'Открыть')?.dispatchEvent(new Event('click'));
      await fixture.whenStable();
      fixture.detectChanges();
      const addBtn = Array.from(el.querySelectorAll('.detail-panel button')).find((b) =>
        b.textContent?.includes('Добавить в сравнение'),
      ) as HTMLButtonElement | undefined;
      addBtn?.click();
      fixture.detectChanges();
    };

    await addAlgo('A-0002');
    const compareBtn = Array.from(el.querySelectorAll('.compare-bar button')).find((b) =>
      b.textContent?.includes('Сравнить (1)'),
    ) as HTMLButtonElement | undefined;
    expect(compareBtn?.disabled).toBe(true);
    expect(el.querySelector('.compare-bar')?.textContent).toContain(
      'Выберите ещё минимум один алгоритм',
    );

    await addAlgo('A-0003');
    const compareLink = el.querySelector('.compare-bar a') as HTMLAnchorElement | null;
    expect(compareLink?.textContent).toContain('Сравнить (2)');
    expect(compareLink?.getAttribute('href')).toContain('/workshop/compare');
    expect(compareLink?.getAttribute('href')).toContain('ids=A-0002,A-0003');
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

    const openBtn = findRowButton(el, 'A-1', 'Открыть');
    openBtn?.dispatchEvent(new Event('click'));
    await fixture.whenStable();
    fixture.detectChanges();

    const versionItems = Array.from(el.querySelectorAll('.version-item'));
    expect(versionItems.length).toBe(2);
    expect(versionItems[0].textContent).not.toContain('текущая');
    expect(versionItems[1].textContent).toContain('текущая');
  });

  it('создаёт черновик, показывает ошибки DSL, применяет fix, публикует версию и разрешает запуск', async () => {
    const fixture = TestBed.createComponent(WorkshopPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const newBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Новый алгоритм',
    );
    newBtn?.click();
    fixture.detectChanges();

    const nameInput = el.querySelector('#workshop-draft-name') as HTMLInputElement;
    const sourceInput = el.querySelector('#workshop-draft-source') as HTMLTextAreaElement;
    nameInput.value = 'Мой тест-алгоритм';
    nameInput.dispatchEvent(new Event('input'));
    sourceInput.value = 'if rsi(close, 14) > 70 { lookahead }';
    sourceInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const createBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Создать черновик',
    );
    createBtn?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('E-LA01');
    const publishBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Опубликовать версию',
    ) as HTMLButtonElement;
    expect(publishBtn.disabled).toBe(true);
    expect(el.textContent).toContain('Публикация невозможна');

    sourceInput.value = 'if rsi(close, 14) > 70 { }';
    sourceInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const checkBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Проверить',
    );
    checkBtn?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const fixBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Исправить:'),
    );
    expect(fixBtn).toBeDefined();
    fixBtn?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(sourceInput.value).toContain('param threshold = 70;');
    expect(el.textContent).toContain('OK · Без ошибок');

    const saveBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Сохранить черновик',
    );
    saveBtn?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const backBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('.detail-panel button')).find(
      (b) => b.textContent?.trim() === 'К карточке',
    );
    backBtn?.click();
    fixture.detectChanges();

    const runBtnBefore = Array.from(
      el.querySelectorAll<HTMLButtonElement>('.detail-panel button'),
    ).find((b) => b.textContent?.trim() === 'Запустить прогон');
    expect(runBtnBefore?.disabled).toBe(true);
    expect(el.querySelector('.detail-panel')?.textContent).toContain('Черновик');

    const editDraftBtn = Array.from(
      el.querySelectorAll<HTMLButtonElement>('.detail-panel button'),
    ).find((b) => b.textContent?.trim() === 'Редактировать черновик');
    editDraftBtn?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const summaryInput = el.querySelector('#workshop-publish-summary') as HTMLInputElement;
    summaryInput.value = 'Первый релиз';
    summaryInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const publishBtnReady = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Опубликовать версию',
    );
    expect(publishBtnReady?.disabled).toBe(false);
    publishBtnReady?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const toCardBtn = Array.from(
      el.querySelectorAll<HTMLButtonElement>('.detail-panel button'),
    ).find((b) => b.textContent?.trim() === 'К карточке');
    toCardBtn?.click();
    fixture.detectChanges();

    const runBtnAfter = Array.from(
      el.querySelectorAll<HTMLButtonElement>('.detail-panel button'),
    ).find((b) => b.textContent?.trim() === 'Запустить прогон');
    expect(runBtnAfter?.disabled).toBe(false);
  });

  it('выполняет форк алгоритма и переключает видимость своего алгоритма', async () => {
    const fixture = TestBed.createComponent(WorkshopPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const openOwnBtn = findRowButton(el, 'A-0002', 'Открыть');
    openOwnBtn?.dispatchEvent(new Event('click'));
    await fixture.whenStable();
    fixture.detectChanges();

    const hideBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('.detail-panel button')).find(
      (b) => b.textContent?.trim() === 'Скрыть',
    );
    expect(hideBtn).toBeDefined();
    hideBtn?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('tr[data-algo-id="A-0002"]')?.textContent).toContain('Скрыт');
    const restoreBtn = Array.from(
      el.querySelectorAll<HTMLButtonElement>('.detail-panel button'),
    ).find((b) => b.textContent?.trim() === 'Вернуть в каталог');
    expect(restoreBtn).toBeDefined();

    const forkBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('.detail-panel button')).find(
      (b) => b.textContent?.trim() === 'Форк',
    );
    forkBtn?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.detail-panel')?.textContent).toContain('Редактор черновика');
    const nameInput = el.querySelector('#workshop-draft-name') as HTMLInputElement;
    expect(nameInput.value).toContain('(форк)');
  });

  it('открывает форму запуска прогона, валидирует параметры DSL, обрабатывает STRATEGY_INVALID и переходит на /runs/:id', async () => {
    const createdCmds: unknown[] = [];
    let rejectNext = true;
    const fakeRunsApi: RunsApi = {
      async createRun(cmd) {
        createdCmds.push(cmd);
        if (rejectNext) {
          return {
            accepted: false,
            reason: 'STRATEGY_INVALID',
            field: 'strategyVersionId',
            barsCount: null,
            maxBars: null,
            detail: 'Версия не прошла валидацию.',
          };
        }
        return { accepted: true, runId: 'R-9999' };
      },
      async getRun() {
        throw new Error('not used');
      },
      events() {
        throw new Error('not used');
      },
      async repeatRun() {
        throw new Error('not used');
      },
      async getRunReport() {
        throw new Error('not used');
      },
    };

    TestBed.overrideProvider(RUNS_API, { useValue: fakeRunsApi });
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(WorkshopPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const openBtn = findRowButton(el, 'A-0001', 'Открыть');
    openBtn?.dispatchEvent(new Event('click'));
    await fixture.whenStable();
    fixture.detectChanges();

    const openRunBtn = Array.from(
      el.querySelectorAll<HTMLButtonElement>('.detail-panel button'),
    ).find((b) => b.textContent?.trim() === 'Запустить прогон');
    openRunBtn?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const fastInput = el.querySelector('#run-param-fast') as HTMLInputElement;
    expect(fastInput).not.toBeNull();
    fastInput.value = '999';
    fastInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(el.querySelector('.detail-panel')?.textContent).toContain('Максимальное значение: 50.');
    const submitBtn = Array.from(el.querySelectorAll('.detail-panel button')).find(
      (b) => b.textContent?.trim() === 'Запустить',
    ) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    fastInput.value = '20';
    fastInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const blindCheckbox = el.querySelector('#run-blind-checkbox') as HTMLInputElement;
    blindCheckbox.click();
    fixture.detectChanges();

    expect(submitBtn.disabled).toBe(false);
    submitBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.detail-panel')?.textContent).toContain('STRATEGY_INVALID');
    expect(navSpy).not.toHaveBeenCalled();

    rejectNext = false;
    submitBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(createdCmds.length).toBe(2);
    expect(createdCmds[1]).toMatchObject({
      strategyVersionId: 'A-0001-v2',
      blind: true,
      paramOverrides: expect.objectContaining({ fast: 20 }),
    });
    expect(navSpy).toHaveBeenCalledWith(['/runs', 'R-9999']);
  });

  it('открывает создание нового черновика при переходе на /workshop?create=1', async () => {
    const queryParamMap$ = new Subject<ReturnType<typeof convertToParamMap>>();
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { queryParamMap: queryParamMap$.asObservable() },
    });

    const fixture = TestBed.createComponent(WorkshopPage);
    fixture.detectChanges();
    queryParamMap$.next(convertToParamMap({ create: '1' }));
    await fixture.whenStable();
    fixture.detectChanges();

    const store = fixture.debugElement.injector.get(WorkshopStore);
    expect(store.editorMode()).toBe('create');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Новый алгоритм');
    void of(true);
  });

  it('показывает исходный код версии в карточке, добавляет в сравнение из строки таблицы и удаляет свой алгоритм', async () => {
    const fixture = TestBed.createComponent(WorkshopPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const compareRowBtn = findRowButton(el, 'A-0002', '+ Сравнить');
    expect(compareRowBtn).toBeDefined();
    compareRowBtn?.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('В сравнении: 1 из 5');
    expect(findRowButton(el, 'A-0002', '✓ В сравнении')).toBeDefined();

    findRowButton(el, 'A-0002', 'Открыть')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const detail = el.querySelector('.detail-panel');
    expect(detail?.textContent).toContain('Исходный код версии');
    expect(detail?.textContent).toContain('Скопировать код');
    expect(detail?.querySelectorAll('.code-line').length).toBeGreaterThan(0);

    const deleteBtn = Array.from(detail?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Удалить',
    ) as HTMLButtonElement | undefined;
    expect(deleteBtn).toBeDefined();
    deleteBtn?.click();
    fixture.detectChanges();

    expect(detail?.textContent).toContain('Удалить алгоритм из Мастерской?');
    const confirmBtn = Array.from(detail?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Удалить алгоритм',
    ) as HTMLButtonElement | undefined;
    confirmBtn?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('tr[data-algo-id="A-0002"]')).toBeNull();
  });

  it('на вкладке «Мои алгоритмы» скрывает сортировку «По автору», а для черновика (latestVersion === 0) скрывает сравнение и «Скрыть»', async () => {
    const fixture = TestBed.createComponent(WorkshopPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const store = fixture.debugElement.injector.get(WorkshopStore);

    // В «Каталог сообщества» есть сортировка «По автору».
    const sortButtonsCatalog = Array.from(el.querySelectorAll('tui-segmented button')).map((b) =>
      b.textContent?.trim(),
    );
    expect(sortButtonsCatalog).toContain('По автору');

    // Открываем чужой алгоритм и включаем «По автору», затем переключаемся на «Мои алгоритмы».
    store.setSort('author_asc');
    findRowButton(el, 'A-0003', 'Открыть')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('.detail-panel')).not.toBeNull();

    const mineTab = Array.from(el.querySelectorAll('button[role="tab"]')).find(
      (b) => b.textContent?.trim() === 'Мои алгоритмы',
    ) as HTMLButtonElement | undefined;
    mineTab?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const sortButtonsMine = Array.from(el.querySelectorAll('tui-segmented button')).map((b) =>
      b.textContent?.trim(),
    );
    expect(sortButtonsMine).not.toContain('По автору');
    expect(store.sort()).toBe('published_desc');
    expect(el.querySelector('.detail-panel')).toBeNull();

    // Создаём черновик (latestVersion === 0) и проверяем таблицу и карточку.
    store.openCreateDraft();
    fixture.detectChanges();
    store.setDraftName('Новый черновик UI');
    store.setDraftSource('rule x when close > open buy 10% market because "тест";');
    await store.createDraft();
    await fixture.whenStable();
    fixture.detectChanges();

    const draftId = store.draft()!.strategyId;
    expect(findRowButton(el, draftId, '+ Сравнить')).toBeUndefined();

    await store.selectAlgorithm(draftId);
    fixture.detectChanges();
    const detailBtns = Array.from(el.querySelectorAll('.detail-panel button')).map((b) =>
      b.textContent?.trim(),
    );
    expect(detailBtns).not.toContain('Добавить в сравнение');
    expect(detailBtns).not.toContain('Скрыть');
    expect(detailBtns).not.toContain('Вернуть в каталог');
  });

  it('при пустой вкладке «Мои алгоритмы» показывает дружелюбный empty-state с кнопками создания и перехода в каталог', async () => {
    const emptyMineApi = stubApi({
      async list(query): Promise<WorkshopPageData> {
        return {
          items: query?.mineOnly
            ? []
            : [
                {
                  id: 'A-PUB',
                  name: 'Public Algo',
                  description: 'Desc',
                  authorId: 'other',
                  author: 'Автор',
                  isMine: false,
                  isSystem: false,
                  visibility: 'public',
                  latestVersion: 1,
                  publishedAt: '2026-11-18T12:00:00+03:00',
                  license: 'MIT',
                  linterWarnings: [],
                },
              ],
          authors: [{ id: 'other', name: 'Автор' }],
          total: query?.mineOnly ? 0 : 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        };
      },
      async getById(): Promise<WorkshopDetailResult> {
        return { status: 'NOT_FOUND' };
      },
    });

    TestBed.overrideProvider(WORKSHOP_API, { useValue: emptyMineApi });

    const fixture = TestBed.createComponent(WorkshopPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const store = fixture.debugElement.injector.get(WorkshopStore);

    store.setMineOnly(true);
    await fixture.whenStable();
    fixture.detectChanges();

    const empty = el.querySelector('.empty-state-mine');
    expect(empty?.textContent).toContain(
      'Здесь хранятся все ваши черновики, копии и опубликованные алгоритмы',
    );

    const catalogBtn = Array.from(empty?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Открыть каталог сообщества',
    ) as HTMLButtonElement | undefined;
    catalogBtn?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(store.mineOnly()).toBe(false);

    store.setMineOnly(true);
    await fixture.whenStable();
    fixture.detectChanges();
    const createBtn = Array.from(el.querySelectorAll('.empty-state-mine button')).find(
      (b) => b.textContent?.trim() === 'Создать алгоритм',
    ) as HTMLButtonElement | undefined;
    createBtn?.click();
    fixture.detectChanges();
    expect(store.editorMode()).toBe('create');
  });

  it('открывает карточку как оверлей поверх таблицы, закрывается по клику на подложку и Escape, но не сбрасывает непустой черновик', async () => {
    const fixture = TestBed.createComponent(WorkshopPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const store = fixture.debugElement.injector.get(WorkshopStore);

    findRowButton(el, 'A-0001', 'Открыть')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.workshop-layout.with-detail')).toBeNull();
    const backdrop = el.querySelector<HTMLElement>('.detail-backdrop');
    expect(backdrop).not.toBeNull();
    expect(el.querySelector('.detail-panel')).not.toBeNull();

    // Клик по подложке закрывает карточку.
    backdrop!.click();
    fixture.detectChanges();
    expect(el.querySelector('.detail-panel')).toBeNull();
    expect(el.querySelector('.detail-backdrop')).toBeNull();

    // Escape закрывает открытую карточку (если не открыт выпадающий список Taiga UI).
    findRowButton(el, 'A-0001', 'Открыть')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    const fakeDropdown = document.createElement('tui-dropdown');
    document.body.appendChild(fakeDropdown);
    try {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(el.querySelector('.detail-panel')).not.toBeNull();
    } finally {
      fakeDropdown.remove();
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('.detail-panel')).toBeNull();

    // Пустой новый черновик закрывается по Escape.
    store.openCreateDraft();
    fixture.detectChanges();
    expect(el.querySelector('.detail-panel')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('.detail-panel')).toBeNull();

    // Черновик с введённым текстом не сбрасывается случайным кликом по подложке или Escape.
    store.openCreateDraft();
    store.setDraftName('Несохранённый черновик');
    fixture.detectChanges();
    el.querySelector<HTMLElement>('.detail-backdrop')!.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(store.editorMode()).toBe('create');
    expect(el.querySelector('.detail-panel')).not.toBeNull();
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

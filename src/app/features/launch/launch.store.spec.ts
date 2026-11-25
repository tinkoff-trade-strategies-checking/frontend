import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { STUB_MODE } from '../../core/api-mode';
import {
  WORKSHOP_API,
  WorkshopAlgorithmSummary,
  WorkshopApi,
  WorkshopPage,
} from '../workshop/data/workshop.models';
import { LAUNCH_API, LAUNCH_PRESETS } from './data/launch.models';
import { StubLaunchApi } from './data/stub-launch.api';
import { LaunchStore, pickSafeArchiveDate } from './launch.store';

function makeAlgorithm(
  overrides: Partial<WorkshopAlgorithmSummary> = {},
): WorkshopAlgorithmSummary {
  return {
    id: 'algo-1',
    name: 'Momentum RSI',
    description: 'desc',
    authorId: 'u-1',
    author: 'Иван Петров',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 2,
    latestVersionId: 'algo-1-v2',
    publishedAt: '2026-11-18T12:00:00Z',
    license: 'MIT',
    linterWarnings: [],
    ...overrides,
  };
}

function makeWorkshopPage(items: readonly WorkshopAlgorithmSummary[]): WorkshopPage {
  return {
    items,
    authors: [],
    total: items.length,
    page: 1,
    pageSize: 100,
    totalPages: 1,
  };
}

describe('LaunchStore: фоновый алгоритм', () => {
  function setup(workshopListImpl: WorkshopApi['list']) {
    const launchApi = new StubLaunchApi();
    const workshopApi = {
      list: vi.fn(workshopListImpl),
    } as unknown as WorkshopApi;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LAUNCH_API, useValue: launchApi },
        { provide: WORKSHOP_API, useValue: workshopApi },
        { provide: STUB_MODE, useValue: true },
        LaunchStore,
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    return {
      store: TestBed.inject(LaunchStore),
      launchApi,
      workshopApi,
    };
  }

  it('загружает опубликованные алгоритмы, фильтрует черновики (latestVersion === 0) и системный эталон', async () => {
    const { store, workshopApi } = setup(async () =>
      makeWorkshopPage([
        makeAlgorithm({
          id: 'A-SYS',
          name: 'Эталон платформы',
          author: 'Эталон платформы',
          isSystem: true,
          latestVersion: 2,
        }),
        makeAlgorithm({
          id: 'A-DRAFT',
          name: 'Новый черновик',
          latestVersion: 0,
          latestVersionId: null,
          publishedAt: null,
        }),
        makeAlgorithm({
          id: 'A-PUB-1',
          name: 'Momentum RSI',
          author: 'Вы',
          latestVersion: 2,
        }),
        makeAlgorithm({
          id: 'A-PUB-2',
          name: 'Breakout ATR',
          author: 'Алексей Смирнов',
          latestVersion: 3,
        }),
      ]),
    );

    await store.init();

    expect(workshopApi.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 100,
      sort: 'published_desc',
    });
    expect(store.backgroundAlgorithmId()).toBeNull();
    expect(store.backgroundAlgorithms().map((item) => item.id)).toEqual(['A-PUB-1', 'A-PUB-2']);
    expect(store.backgroundAlgorithmsError()).toBe(false);
  });

  it('передаёт выбранный backgroundAlgorithmId и null по умолчанию в startSession', async () => {
    const { store, launchApi } = setup(async () =>
      makeWorkshopPage([makeAlgorithm({ id: 'A-PUB-1', name: 'Momentum RSI', latestVersion: 2 })]),
    );
    const startSpy = vi.spyOn(launchApi, 'startSession');

    await store.init();
    expect(await store.launch()).toBe(true);
    expect(startSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ backgroundAlgorithmId: null }),
    );

    store.setBackgroundAlgorithm('A-PUB-1');
    expect(store.selectedBackgroundAlgorithm()?.id).toBe('A-PUB-1');
    expect(await store.launch()).toBe(true);
    expect(startSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ backgroundAlgorithmId: 'A-PUB-1' }),
    );
  });

  it('при ошибке загрузки каталога не блокирует запуск с «Эталоном платформы» по умолчанию', async () => {
    const { store, launchApi } = setup(async () => {
      throw new Error('Workshop unavailable');
    });
    const startSpy = vi.spyOn(launchApi, 'startSession');

    await store.init();

    expect(store.error()).toBeNull();
    expect(store.backgroundAlgorithms()).toEqual([]);
    expect(store.backgroundAlgorithmsError()).toBe(true);
    expect(store.backgroundAlgorithmId()).toBeNull();
    expect(store.canSubmit()).toBe(true);
    expect(await store.launch()).toBe(true);
    expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({ backgroundAlgorithmId: null }));
  });

  it('не обновляет список после уничтожения стора', async () => {
    let resolveList!: (page: WorkshopPage) => void;
    const { store } = setup(
      () =>
        new Promise<WorkshopPage>((resolve) => {
          resolveList = resolve;
        }),
    );

    const initPromise = store.init();
    TestBed.resetTestingModule();
    resolveList(makeWorkshopPage([makeAlgorithm({ id: 'A-LATE', latestVersion: 1 })]));
    await initPromise;

    expect(store.backgroundAlgorithms()).toEqual([]);
  });

  it('pickSafeArchiveDate учитывает запас до archiveTo и обходит выходные', () => {
    // 2024-06-03 подходит, если до archiveTo >= 90 дней для defaultDuration = 60.
    expect(pickSafeArchiveDate('2020-01-03', '2025-12-31', 60)).toBe('2024-06-03');

    // Когда 2024-06-03 слишком близко к правому краю (меньше 90 дней до 2024-07-01), отступаем к archiveFrom.
    // 2020-01-03 + 30d = 2020-02-02 (воскресенье) -> сдвигается на понедельник 2020-02-03.
    expect(pickSafeArchiveDate('2020-01-03', '2024-07-01', 60)).toBe('2020-02-03');

    // Суббота на archiveFrom при коротком окне сдвигается на понедельник.
    expect(pickSafeArchiveDate('2024-02-03', '2024-03-15', 60)).toBe('2024-02-05');
  });

  it('ограничение maxDurationDaysByTimeframe действует для всех ручных сессий (и random, и custom)', async () => {
    const { store } = setup(() => Promise.resolve(makeWorkshopPage([])));
    await store.init();

    expect(store.isBlind()).toBe(true);
    expect(store.isPairDisabled(60, '1m')).toBe(true);
    expect(store.isPairDisabled(60, '5m')).toBe(true);
    expect(store.isPairDisabled(60, '1d')).toBe(false);

    await store.setStartMode('custom');
    expect(store.isBlind()).toBe(false);
    expect(store.isPairDisabled(60, '1m')).toBe(true);
    expect(store.isPairDisabled(60, '5m')).toBe(true);
    expect(store.isPairDisabled(60, '1d')).toBe(false);

    store.setTimeframe('1m');
    expect(store.pairExceedsLimit()).toBe(true);
    expect(store.canSubmit()).toBe(false);
    expect(store.submitError()).toContain('больше 5');
  });

  it('applyPreset устанавливает все параметры сценария, включает слепой режим и сбрасывает custom-бумаги', async () => {
    const { store } = setup(() => Promise.resolve(makeWorkshopPage([])));
    await store.init();

    expect(store.activePresetId()).toBe('quarter');

    await store.setStartMode('custom');
    store.setInitialCapital(500_000);
    expect(store.isBlind()).toBe(false);
    expect(store.selectedPaperIds().length).toBeGreaterThan(0);
    expect(store.activePresetId()).toBeNull();

    store.applyPreset(LAUNCH_PRESETS[0]);
    expect(store.activePresetId()).toBe('quick');
    expect(store.isBlind()).toBe(true);
    expect(store.durationDays()).toBe(20);
    expect(store.timeframe()).toBe('1d');
    expect(store.regime()).toBe('medium');
    expect(store.paperCount()).toBe(3);
    expect(store.initialCapitalRub()).toBe(1_000_000);
    expect(store.selectedPaperIds()).toEqual([]);
    expect(store.customPapers()).toEqual([]);

    store.applyPreset(LAUNCH_PRESETS[2]);
    expect(store.activePresetId()).toBe('stress');
    expect(store.regime()).toBe('stress');
  });

  it('позволяет выбрать произвольное количество бумаг без верхнего лимита и блокирует запуск при 0 бумаг', async () => {
    const { store, launchApi } = setup(() => Promise.resolve(makeWorkshopPage([])));
    const startSpy = vi.spyOn(launchApi, 'startSession');
    await store.init();
    await store.setStartMode('custom');

    const allIds = store.customPapers().map((p) => p.id);
    expect(allIds.length).toBeGreaterThanOrEqual(50);

    // Выбор всех бумаг не ограничен 5 штуками.
    store.setSelectedPaperIds(allIds);
    expect(store.selectedPaperIds().length).toBe(allIds.length);
    expect(store.canSubmit()).toBe(true);
    expect(await store.launch()).toBe(true);
    expect(startSpy).toHaveBeenLastCalledWith(expect.objectContaining({ paperIds: allIds }));

    // Сброс всех бумаг блокирует запуск до выбора хотя бы одной.
    store.setSelectedPaperIds([]);
    expect(store.canSubmit()).toBe(false);
    expect(store.submitBlockHint()).toContain('хотя бы одну бумагу');

    // Пресеты количества бумаг в слепом режиме компактны, а не 60 кнопок.
    expect(store.paperCountOptions().length).toBeLessThanOrEqual(7);
  });
});

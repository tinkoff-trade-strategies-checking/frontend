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
import { LAUNCH_API } from './data/launch.models';
import { StubLaunchApi } from './data/stub-launch.api';
import { LaunchStore } from './launch.store';

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
});

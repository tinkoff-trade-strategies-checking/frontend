import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, vi } from 'vitest';
import { STUB_MODE } from '../../core/api-mode';
import { REAL_FEATURES } from '../../core/real-features';
import { LAUNCH_API } from './data/launch.models';
import { StubLaunchApi } from './data/stub-launch.api';
import { LaunchStore } from './launch.store';

describe('LaunchStore: переход после запуска', () => {
  const initialFeatures = { ...REAL_FEATURES };

  afterEach(() => Object.assign(REAL_FEATURES, initialFeatures));

  async function launch(stubMode: boolean): Promise<ReturnType<typeof vi.spyOn>> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LAUNCH_API, useClass: StubLaunchApi },
        { provide: STUB_MODE, useValue: stubMode },
        LaunchStore,
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const store = TestBed.inject(LaunchStore);
    await store.init();
    expect(await store.launch()).toBe(true);
    return navigate;
  }

  it('настоящий режим, арена не подключена: в историю, а не на заглушку арены', async () => {
    const navigate = await launch(false);
    expect(navigate).toHaveBeenCalledWith(['/history']);
  });

  it('настоящий режим, арена подключена: на арену запущенной сессии', async () => {
    REAL_FEATURES.arena = true;
    const navigate = await launch(false);
    expect(navigate).toHaveBeenCalledWith(['/arena', expect.stringMatching(/^S-/)]);
  });

  it('заглушки: на арену', async () => {
    const navigate = await launch(true);
    expect(navigate).toHaveBeenCalledWith(['/arena', expect.stringMatching(/^S-/)]);
  });
});

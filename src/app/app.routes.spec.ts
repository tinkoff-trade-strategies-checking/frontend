import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { afterEach, vi } from 'vitest';
import { routes } from './app.routes';
import { STUB_MODE } from './core/api-mode';
import { AuthService } from './core/auth/auth.service';
import { REAL_FEATURES } from './core/real-features';

describe('маршруты по режимам', () => {
  const initialFeatures = { ...REAL_FEATURES };

  afterEach(() => Object.assign(REAL_FEATURES, initialFeatures));

  async function setup(stubMode: boolean): Promise<Router> {
    TestBed.configureTestingModule({
      providers: [
        provideTaiga(),
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STUB_MODE, useValue: stubMode },
      ],
    });
    TestBed.inject(AuthService).user.set({ id: 'u', email: 'a@b.c', role: 'USER' });
    return TestBed.inject(Router);
  }

  async function go(router: Router, url: string): Promise<string> {
    await router.navigateByUrl(url);
    return router.url.split('?')[0];
  }

  it('заглушки: корень и неизвестный адрес ведут на арену, отчёт — на демо-сессию', async () => {
    const router = await setup(true);
    expect(await go(router, '/')).toBe('/arena');
    expect(await go(router, '/нет-такого')).toBe('/arena');
    expect(await go(router, '/report')).toMatch(/^\/report\/.+/);
  });

  it('настоящий режим: корень и неизвестный адрес ведут на запуск, а не на заглушку арены', async () => {
    const router = await setup(false);
    expect(await go(router, '/')).toBe('/new');
    expect(await go(router, '/нет-такого')).toBe('/new');
  });

  it('настоящий режим: арена, отчёт и воспроизведение закрыты, пока не подключены, и ведут в историю', async () => {
    const router = await setup(false);
    Object.assign(REAL_FEATURES, { arena: false, report: false, replay: false });
    for (const url of ['/arena', '/arena/s-1', '/report', '/report/s-1', '/replay/s-1']) {
      expect(await go(router, url)).toBe('/history');
    }
  });

  it('настоящий режим: подключённый раздел открывается', async () => {
    const router = await setup(false);
    Object.assign(REAL_FEATURES, { arena: false, report: true, replay: false });
    expect(await go(router, '/report/s-1')).toBe('/report/s-1');
    expect(await go(router, '/replay/s-1')).toBe('/history');
  });

  it('заглушки: все разделы открыты независимо от реестра', async () => {
    const router = await setup(true);
    expect(await go(router, '/arena/S-0104')).toBe('/arena/S-0104');
    expect(await go(router, '/replay/S-0103')).toBe('/replay/S-0103');
  });

  it('вход всегда доступен', async () => {
    const router = await setup(false);
    vi.spyOn(TestBed.inject(AuthService), 'restore').mockResolvedValue({
      id: 'u',
      email: 'a@b.c',
      role: 'USER',
    });
    expect(await go(router, '/login')).toMatch(/^\/(login|new)$/);
  });
});

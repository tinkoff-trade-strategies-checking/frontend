import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { STUB_MODE } from '../api-mode';
import { CurrentUser } from '../../api/models/current-user';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

const USER: CurrentUser = {
  id: 'u-1',
  email: 'a@b.c',
  role: 'USER',
  guest: false,
  uiMode: 'beginner',
};
const UNAUTHORIZED = { status: 401, statusText: 'Unauthorized' };

describe('AuthService и authGuard', () => {
  let auth: AuthService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STUB_MODE, useValue: false },
      ],
    });
    auth = TestBed.inject(AuthService);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('restore: 200 — профиль, 401 — null', async () => {
    const ok = auth.restore();
    controller.expectOne('/api/v1/me').flush(USER);
    expect(await ok).toEqual(USER);
    expect(auth.user()).toEqual(USER);

    const anon = auth.restore();
    controller.expectOne('/api/v1/me').flush({ code: 'UNAUTHENTICATED' }, UNAUTHORIZED);
    expect(await anon).toBeNull();
    expect(auth.user()).toBeNull();
  });

  it('restore: сбой сервера пробрасывается', async () => {
    const pending = auth.restore();
    controller.expectOne('/api/v1/me').flush({}, { status: 503, statusText: 'Unavailable' });
    await expect(pending).rejects.toBeTruthy();
  });

  it('login: тело с почтой и паролем, затем профиль', async () => {
    const done = auth.login('a@b.c', 'secret');
    const req = controller.expectOne('/api/v1/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.c', password: 'secret' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await vi.waitFor(() => controller.expectOne('/api/v1/me').flush(USER));
    await done;
    expect(auth.user()).toEqual(USER);
  });

  it('logout: забывает профиль и перечитывает /me за новым токеном', async () => {
    auth.user.set(USER);
    const done = auth.logout();
    controller.expectOne('/api/v1/auth/logout').flush(null, { status: 204, statusText: 'No' });
    await vi.waitFor(() => controller.expectOne('/api/v1/me').flush({}, UNAUTHORIZED));
    await done;
    expect(auth.user()).toBeNull();
  });

  it('guard: пускает с профилем, иначе — /login с returnUrl', async () => {
    const state = { url: '/history' } as RouterStateSnapshot;
    auth.user.set(USER);
    expect(await TestBed.runInInjectionContext(() => authGuard({} as never, state))).toBe(true);

    auth.user.set(null);
    const pending = TestBed.runInInjectionContext(() => authGuard({} as never, state));
    await vi.waitFor(() => controller.expectOne('/api/v1/me').flush({}, UNAUTHORIZED));
    const result = (await pending) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login?returnUrl=%2Fhistory');
  });
});

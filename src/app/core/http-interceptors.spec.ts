import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
  withXsrfConfiguration,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth/auth.service';
import { apiErrorInterceptor, credentialsInterceptor } from './http-interceptors';

describe('http-interceptors', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=tok-1; path=/';
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(
          withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
          withInterceptors([credentialsInterceptor, apiErrorInterceptor]),
        ),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    controller.verify();
    document.cookie = 'XSRF-TOKEN=; path=/; max-age=0';
  });

  it('запросы к API идут с cookie, изменяющие — с заголовком X-XSRF-TOKEN из cookie', () => {
    http.post('/api/v1/sessions', {}).subscribe();
    const post = controller.expectOne('/api/v1/sessions');
    expect(post.request.withCredentials).toBe(true);
    expect(post.request.headers.get('X-XSRF-TOKEN')).toBe('tok-1');
    post.flush({});

    http.get('/api/v1/me').subscribe();
    const get = controller.expectOne('/api/v1/me');
    expect(get.request.withCredentials).toBe(true);
    expect(get.request.headers.has('X-XSRF-TOKEN')).toBe(false);
    get.flush({});
  });

  it('чужие адреса не трогает', () => {
    http.get('https://example.com/x').subscribe();
    const req = controller.expectOne('https://example.com/x');
    expect(req.request.withCredentials).toBe(false);
    req.flush({});
  });

  it('401 вне /me и входа: забывает профиль и уводит на /login с адресом возврата', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const auth = TestBed.inject(AuthService);
    auth.user.set({ id: 'u', email: 'a@b.c', role: 'USER', guest: false, uiMode: 'beginner' });

    http.get('/api/v1/history').subscribe({ error: () => undefined });
    controller
      .expectOne('/api/v1/history')
      .flush({ code: 'UNAUTHENTICATED' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.user()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], expect.anything());
  });

  it('401 на выходе (сессия уже истекла) не даёт лишней переадресации', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    http.post('/api/v1/auth/logout', {}).subscribe({ error: () => undefined });
    controller
      .expectOne('/api/v1/auth/logout')
      .flush({ code: 'UNAUTHENTICATED' }, { status: 401, statusText: 'Unauthorized' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('401 на /me и на входе не уводит на /login', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    http.get('/api/v1/me').subscribe({ error: () => undefined });
    controller.expectOne('/api/v1/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    http.post('/api/v1/auth/login', {}).subscribe({ error: () => undefined });
    controller
      .expectOne('/api/v1/auth/login')
      .flush({ code: 'INVALID_CREDENTIALS' }, { status: 401, statusText: 'Unauthorized' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('403 CSRF_INVALID: перечитывает /me и один раз повторяет команду с тем же Idempotency-Key', () => {
    let result: unknown;
    http
      .post(
        '/api/v1/sessions/s/player',
        { action: 'play' },
        { headers: { 'Idempotency-Key': 'k-1' } },
      )
      .subscribe((value) => (result = value));
    controller
      .expectOne('/api/v1/sessions/s/player')
      .flush({ code: 'CSRF_INVALID' }, { status: 403, statusText: 'Forbidden' });

    document.cookie = 'XSRF-TOKEN=tok-2; path=/';
    controller.expectOne('/api/v1/me').flush({});

    const retry = controller.expectOne('/api/v1/sessions/s/player');
    expect(retry.request.headers.get('Idempotency-Key')).toBe('k-1');
    expect(retry.request.headers.get('X-XSRF-TOKEN')).toBe('tok-2');
    retry.flush({ ok: true });
    expect(result).toEqual({ ok: true });
  });

  it('403 CSRF_INVALID повторяется только один раз', () => {
    let failed = false;
    http.post('/api/v1/sessions/s/finish', {}).subscribe({ error: () => (failed = true) });
    controller
      .expectOne('/api/v1/sessions/s/finish')
      .flush({ code: 'CSRF_INVALID' }, { status: 403, statusText: 'Forbidden' });
    controller.expectOne('/api/v1/me').flush({});
    controller
      .expectOne('/api/v1/sessions/s/finish')
      .flush({ code: 'CSRF_INVALID' }, { status: 403, statusText: 'Forbidden' });
    expect(failed).toBe(true);
  });
});

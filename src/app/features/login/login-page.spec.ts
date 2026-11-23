import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { vi } from 'vitest';
import { STUB_MODE } from '../../core/api-mode';
import { LoginPage, safeReturnUrl } from './login-page';

describe('safeReturnUrl', () => {
  it('пускает только внутренние адреса', () => {
    expect(safeReturnUrl('/history')).toBe('/history');
    expect(safeReturnUrl('//evil.example')).toBe('/new');
    expect(safeReturnUrl('https://evil.example')).toBe('/new');
    expect(safeReturnUrl('/login?x=1')).toBe('/new');
    expect(safeReturnUrl(null)).toBe('/new');
  });
});

describe('LoginPage', () => {
  let controller: HttpTestingController;

  async function setup(stubMode: boolean) {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideTaiga(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STUB_MODE, useValue: stubMode },
      ],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    return vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  }

  it('режим заглушек: сразу уходит на /new и не обращается к API', async () => {
    const navigate = await setup(true);
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/new');
    controller.verify();
  });

  it('неверный пароль: сообщение по коду INVALID_CREDENTIALS, остаётся на странице', async () => {
    const navigate = await setup(false);
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    // Токен CSRF приходит с ответом /me, даже с 401.
    controller.expectOne('/api/v1/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    const email = root.querySelector<HTMLInputElement>('#login-email[tuiInput]')!;
    const password = root.querySelector<HTMLInputElement>('#login-password[tuiInput]')!;
    expect(email).not.toBeNull();
    expect(password).not.toBeNull();
    expect(root.querySelector('tui-icon[tuiPassword]')).not.toBeNull();
    email.value = 'a@b.c';
    email.dispatchEvent(new Event('input'));
    password.value = 'wrong';
    password.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    root.querySelector('form')!.dispatchEvent(new Event('submit'));

    await vi.waitFor(() =>
      controller
        .expectOne('/api/v1/auth/login')
        .flush({ code: 'INVALID_CREDENTIALS' }, { status: 401, statusText: 'Unauthorized' }),
    );
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.querySelector('[role="alert"]')?.textContent).toContain(
        'Неверная почта или пароль',
      );
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('Enter в поле пароля отправляет форму; пустые поля не отправляются', async () => {
    await setup(false);
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    controller.expectOne('/api/v1/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const email = root.querySelector<HTMLInputElement>('#login-email[tuiInput]')!;
    const password = root.querySelector<HTMLInputElement>('#login-password[tuiInput]')!;
    expect(email).not.toBeNull();
    expect(password).not.toBeNull();
    expect(root.querySelector('tui-icon[tuiPassword]')).not.toBeNull();

    password.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    controller.expectNone('/api/v1/auth/login');

    email.value = 'a@b.c';
    email.dispatchEvent(new Event('input'));
    password.value = 'secret';
    password.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    password.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    const req = controller.expectOne('/api/v1/auth/login');
    expect(req.request.body).toEqual({ email: 'a@b.c', password: 'secret' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await vi.waitFor(() => controller.expectOne('/api/v1/me').flush({}));
  });

  it('уже авторизован: сразу уходит на /new', async () => {
    const navigate = await setup(false);
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    controller.expectOne('/api/v1/me').flush({ id: 'u', email: 'a@b.c', role: 'USER' });
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/new'));
  });

  it('отображает бренд-шапку с заголовком и тремя преимуществами', async () => {
    await setup(false);
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    controller.expectOne('/api/v1/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('h1')?.textContent).toContain('Тренажёр и лаборатория стратегий');
    const chips = Array.from(root.querySelectorAll('.login-chips li')).map((li) =>
      li.textContent?.trim(),
    );
    expect(chips).toEqual([
      'Без заглядывания в будущее',
      'Реальные комиссии и ликвидность MOEX',
      'Разбор ошибок по шагам',
    ]);
  });
});

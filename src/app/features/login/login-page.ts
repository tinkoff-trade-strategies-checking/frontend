import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TuiButton, TuiIcon, TuiInput, TuiNotification } from '@taiga-ui/core';
import { TuiPassword } from '@taiga-ui/kit';
import { STUB_MODE } from '../../core/api-mode';
import { errorMessage } from '../../core/api-problem';
import { AuthService } from '../../core/auth/auth.service';

/** Возврат только на внутренний адрес: `//host` и `http://…` не пускаем (открытый редирект). */
export function safeReturnUrl(value: string | null): string {
  return value !== null && /^\/(?!\/)/.test(value) && !value.startsWith('/login') ? value : '/new';
}

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, TuiButton, TuiIcon, TuiInput, TuiNotification, TuiPassword],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="login-shell">
      <div class="login-hero">
        <svg
          class="login-logo"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="4"
            y="4"
            width="56"
            height="56"
            rx="16"
            fill="#1A1D24"
            stroke="#2E3442"
            stroke-width="2"
          />
          <path d="M18 17H46" stroke="#FFDD2D" stroke-width="4" stroke-linecap="round" />
          <path d="M32 17V48" stroke="#FFDD2D" stroke-width="3" stroke-linecap="round" />
          <rect x="17" y="29" width="6" height="14" rx="2" fill="#E6ECF5" />
          <path d="M20 24V29M20 43V47" stroke="#E6ECF5" stroke-width="2" stroke-linecap="round" />
          <rect
            x="41"
            y="26"
            width="6"
            height="15"
            rx="2"
            stroke="#FFDD2D"
            stroke-width="2"
            stroke-dasharray="3 2.5"
            opacity="0.55"
          />
          <circle cx="32" cy="17" r="3.5" fill="#FFDD2D" />
        </svg>
        <span class="login-eyebrow">Т-Инвестиции · Янтарный Тик</span>
        <h1>Тренажёр и лаборатория стратегий</h1>
        <ul class="login-chips" aria-label="Преимущества тренажёра">
          <li>Без заглядывания в будущее</li>
          <li>Реальные комиссии и ликвидность MOEX</li>
          <li>Разбор ошибок по шагам</li>
        </ul>
      </div>

      <div class="login-card panel">
        <div class="login-card-header">
          <h2>Вход</h2>
          <p>Введите почту и пароль, чтобы продолжить работу с сессиями и алгоритмами.</p>
        </div>
        @if (error(); as message) {
          <div tuiNotification appearance="negative" size="s" role="alert">{{ message }}</div>
        }
        <form (ngSubmit)="submit()" class="login-form">
          <tui-textfield>
            <label tuiLabel for="login-email">Почта</label>
            <input
              id="login-email"
              tuiInput
              type="email"
              name="email"
              autocomplete="username"
              maxlength="254"
              required
              [ngModel]="email()"
              (ngModelChange)="email.set($event ?? '')"
            />
          </tui-textfield>
          <tui-textfield>
            <label tuiLabel for="login-password">Пароль</label>
            <input
              id="login-password"
              tuiInput
              type="password"
              name="password"
              autocomplete="current-password"
              required
              [ngModel]="password()"
              (ngModelChange)="password.set($event ?? '')"
              (keydown.enter)="onEnter($event)"
            />
            <tui-icon tuiPassword />
          </tui-textfield>
          <button
            tuiButton
            type="submit"
            appearance="primary"
            class="login-submit"
            [disabled]="submitting()"
          >
            Войти
          </button>
        </form>
      </div>
    </section>
  `,
  styles: `
    .login-shell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.75rem;
      max-width: 34rem;
      margin: 2.5rem auto;
      padding: 0 1rem;
    }

    .login-hero {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 0.75rem;
    }

    .login-logo {
      width: 3.5rem;
      height: 3.5rem;
      display: block;
    }

    .login-eyebrow {
      font-size: 0.8125rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--tui-text-action);
    }

    .login-hero h1 {
      margin: 0;
      font-size: 1.75rem;
      line-height: 1.2;
      font-weight: 700;
      color: var(--tui-text-primary);
    }

    .login-chips {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.5rem;
      list-style: none;
      margin: 0.25rem 0 0;
      padding: 0;
    }

    .login-chips li {
      padding: 0.375rem 0.75rem;
      border-radius: 999px;
      font-size: 0.8125rem;
      font-weight: 500;
      background: var(--ttsc-surface-alt);
      border: 1px solid var(--ttsc-border);
      color: var(--tui-text-secondary);
    }

    .login-card {
      width: 100%;
      max-width: 25rem;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      padding: 1.75rem;
    }

    .login-card-header h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--tui-text-primary);
    }

    .login-card-header p {
      margin: 0.375rem 0 0;
      font-size: 0.875rem;
      color: var(--tui-text-secondary);
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .login-submit {
      width: 100%;
      font-weight: 600;
    }
  `,
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly stubMode = inject(STUB_MODE);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    if (this.stubMode) {
      await this.leave();
      return;
    }
    // Заодно получаем CSRF-токен: без него вход даёт 403.
    try {
      if ((await this.auth.restore()) !== null) {
        await this.leave();
      }
    } catch {
      this.error.set('Сервер недоступен. Попробуйте позже.');
    }
  }

  /** Enter в поле пароля отправляет форму сам, не полагаясь на неявную отправку браузера (автозаполнение). */
  protected onEnter(event: Event): void {
    event.preventDefault();
    void this.submit();
  }

  protected async submit(): Promise<void> {
    if (this.submitting() || !this.email() || !this.password()) {
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.email().trim(), this.password());
      await this.leave();
    } catch (error) {
      this.error.set(errorMessage(error, 'Не удалось войти. Попробуйте ещё раз.'));
    } finally {
      this.submitting.set(false);
    }
  }

  private leave(): Promise<boolean> {
    return this.router.navigateByUrl(
      safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')),
    );
  }
}

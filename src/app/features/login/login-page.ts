import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TuiButton, TuiNotification, TuiTextfield } from '@taiga-ui/core';
import { STUB_MODE } from '../../core/api-mode';
import { errorMessage } from '../../core/api-problem';
import { AuthService } from '../../core/auth/auth.service';

/** Возврат только на внутренний адрес: `//host` и `http://…` не пускаем (открытый редирект). */
export function safeReturnUrl(value: string | null): string {
  return value !== null && /^\/(?!\/)/.test(value) && !value.startsWith('/login') ? value : '/new';
}

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, TuiButton, TuiNotification, TuiTextfield],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="login-page">
      <h1>Вход</h1>
      @if (error(); as message) {
        <div tuiNotification appearance="negative" size="s" role="alert">{{ message }}</div>
      }
      <form (ngSubmit)="submit()" class="login-form">
        <tui-textfield>
          <label tuiLabel for="login-email">Почта</label>
          <input
            id="login-email"
            tuiTextfield
            type="email"
            name="email"
            autocomplete="username"
            maxlength="254"
            required
            [ngModel]="email()"
            (ngModelChange)="email.set($event)"
          />
        </tui-textfield>
        <tui-textfield>
          <label tuiLabel for="login-password">Пароль</label>
          <input
            id="login-password"
            tuiTextfield
            type="password"
            name="password"
            autocomplete="current-password"
            required
            [ngModel]="password()"
            (ngModelChange)="password.set($event)"
          />
        </tui-textfield>
        <button
          tuiButton
          type="submit"
          appearance="primary"
          [disabled]="submitting() || !email() || !password()"
        >
          Войти
        </button>
      </form>
    </section>
  `,
  styles: `
    .login-page {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-width: 24rem;
      margin: 2rem auto;
    }
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
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

  protected async submit(): Promise<void> {
    if (this.submitting()) {
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

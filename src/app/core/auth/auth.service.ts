import { inject, Injectable, signal } from '@angular/core';
import { Api } from '../../api/api';
import { getCurrentUser } from '../../api/fn/identity/get-current-user';
import { login } from '../../api/fn/identity/login';
import { logout } from '../../api/fn/identity/logout';
import { CurrentUser } from '../../api/models/current-user';
import { toProblem } from '../api-problem';

/**
 * Вход по cookie-сессии. `GET /me` и выдаёт профиль, и ставит cookie `XSRF-TOKEN` (даже в ответе 401):
 * без него вход и любые команды дают 403. Токен подставляет Angular (`withXsrfConfiguration`).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(Api);

  readonly user = signal<CurrentUser | null>(null);

  /** Профиль текущего пользователя; `null` — не авторизован (401). Остальные ошибки пробрасываются. */
  async restore(): Promise<CurrentUser | null> {
    try {
      const user = await this.api.invoke(getCurrentUser);
      this.user.set(user);
      return user;
    } catch (error) {
      if (toProblem(error).status === 401) {
        this.user.set(null);
        return null;
      }
      throw error;
    }
  }

  async login(email: string, password: string): Promise<void> {
    await this.api.invoke(login, { body: { email, password } });
    // После входа токен и cookie SESSION сменились; профиль нужен для шапки.
    await this.restore();
  }

  async logout(): Promise<void> {
    try {
      await this.api.invoke(logout);
    } finally {
      this.user.set(null);
      // Новый CSRF-токен после выхода приходит следующим GET /me (401).
      await this.restore().catch(() => null);
    }
  }

  /** Сессия оборвалась (401 на запросе): забываем профиль. */
  forget(): void {
    this.user.set(null);
  }
}

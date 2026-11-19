import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { STUB_MODE } from '../api-mode';
import { AuthService } from './auth.service';

/** Пускает только авторизованных; остальных отправляет на `/login` с адресом возврата. В режиме заглушек входа нет. */
export const authGuard: CanActivateFn = async (_route, state) => {
  if (inject(STUB_MODE)) {
    return true;
  }
  const auth = inject(AuthService);
  const router = inject(Router);
  try {
    if (auth.user() !== null || (await auth.restore()) !== null) {
      return true;
    }
  } catch {
    // Сервер недоступен: страница входа покажет ошибку при попытке войти.
  }
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

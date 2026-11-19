import {
  HttpClient,
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, of, switchMap, throwError } from 'rxjs';
import { ApiConfiguration } from '../api/api-configuration';
import { toProblem } from './api-problem';
import { AuthService } from './auth/auth.service';

const CSRF_HEADER = 'X-XSRF-TOKEN';

/** Запрос уже повторён после обновления CSRF-токена: второй раз не повторяем. */
const CSRF_RETRIED = new HttpContextToken<boolean>(() => false);

function isApiRequest(url: string, rootUrl: string): boolean {
  return url.startsWith(rootUrl);
}

/** Cookie сессии уходит с каждым запросом к API (`SESSION` — HttpOnly, читает только браузер). */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url, inject(ApiConfiguration).rootUrl)) {
    return next(req);
  }
  return next(req.clone({ withCredentials: true }));
};

/**
 * 401 на любом запросе, кроме `/me` и входа, — сессия истекла: на `/login` с адресом возврата.
 * 403 `CSRF_INVALID` на изменяющем запросе — один раз перечитываем `/me` (новый токен) и повторяем запрос;
 * `Idempotency-Key` в повторе тот же, поэтому дубля команды нет.
 */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const rootUrl = inject(ApiConfiguration).rootUrl;
  if (!isApiRequest(req.url, rootUrl)) {
    return next(req);
  }
  const http = inject(HttpClient);
  const auth = inject(AuthService);
  const router = inject(Router);
  const isAuthEndpoint = req.url.endsWith('/me') || req.url.endsWith('/auth/login');

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }
      const problem = toProblem(error);
      if (problem.status === 401 && !isAuthEndpoint) {
        auth.forget();
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }
      if (
        problem.status === 403 &&
        problem.code === 'CSRF_INVALID' &&
        req.method !== 'GET' &&
        !req.context.get(CSRF_RETRIED)
      ) {
        return http.get(`${rootUrl}/me`).pipe(
          catchError(() => of(null)),
          switchMap(() =>
            http.request(
              req.clone({
                headers: req.headers.delete(CSRF_HEADER),
                context: req.context.set(CSRF_RETRIED, true),
              }),
            ),
          ),
        );
      }
      return throwError(() => error);
    }),
  );
};

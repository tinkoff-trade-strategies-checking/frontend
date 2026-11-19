import { HttpErrorResponse } from '@angular/common/http';
import { ProblemCode } from '../api/models/problem-code';

/** Ошибка API, разобранная из ответа `application/problem+json` (RFC 9457). Ветвимся по `code`. */
export interface ApiProblem {
  /** HTTP-статус; 0 — нет связи с сервером, -1 — ошибка не из HTTP. */
  readonly status: number;
  readonly code: ProblemCode | null;
  readonly detail: string | null;
  /** Секунды из `Retry-After` (429), иначе `null`. */
  readonly retryAfterSec: number | null;
  readonly field: string | null;
  readonly barsCount: number | null;
  readonly maxBars: number | null;
}

function pickString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === 'string' ? value : null;
}

function pickNumber(body: Record<string, unknown>, key: string): number | null {
  const value = body[key];
  return typeof value === 'number' ? value : null;
}

/** Тело ошибки: объект (responseType json) или JSON-строка (вход и выход читаются как text). */
function parseBody(raw: unknown): Record<string, unknown> {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export function toProblem(error: unknown): ApiProblem {
  if (!(error instanceof HttpErrorResponse)) {
    return {
      status: -1,
      code: null,
      detail: null,
      retryAfterSec: null,
      field: null,
      barsCount: null,
      maxBars: null,
    };
  }
  const body = parseBody(error.error);
  const retryAfterHeader = error.headers?.get('Retry-After') ?? null;
  const retryAfter = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
  return {
    status: error.status,
    code: pickString(body, 'code') as ProblemCode | null,
    detail: pickString(body, 'detail'),
    retryAfterSec: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
    field: pickString(body, 'field'),
    barsCount: pickNumber(body, 'barsCount'),
    maxBars: pickNumber(body, 'maxBars'),
  };
}

const MESSAGES: Readonly<Partial<Record<ProblemCode, string>>> = {
  UNAUTHENTICATED: 'Сессия входа истекла. Войдите снова.',
  INVALID_CREDENTIALS: 'Неверная почта или пароль.',
  CSRF_INVALID: 'Не удалось подтвердить запрос. Обновите страницу и повторите.',
  FORBIDDEN: 'Нет доступа.',
  NOT_FOUND: 'Не найдено.',
  BAD_REQUEST: 'Некорректный запрос.',
  INVALID_PARAMS: 'Некорректные параметры.',
  SESSION_NOT_ACTIVE: 'Сессия уже завершена.',
  PLAYER_STATE_CONFLICT: 'Команда не подходит текущему состоянию плеера.',
  IDEMPOTENCY_KEY_IN_PROGRESS: 'Предыдущий запрос ещё выполняется.',
  IDEMPOTENCY_KEY_REUSED: 'Повторный запрос не совпадает с исходным. Обновите страницу.',
  TOO_MANY_REQUESTS: 'Слишком много попыток.',
  SERVICE_UNAVAILABLE: 'Сервис временно недоступен. Попробуйте позже.',
  INTERNAL_ERROR: 'Внутренняя ошибка сервера. Попробуйте позже.',
};

/** Текст для пользователя по коду ошибки; без кода — по статусу. */
export function problemMessage(problem: ApiProblem, fallback: string): string {
  if (problem.code === 'TOO_MANY_REQUESTS' && problem.retryAfterSec !== null) {
    return `Слишком много попыток. Повторите через ${problem.retryAfterSec} с.`;
  }
  const byCode = problem.code === null ? undefined : MESSAGES[problem.code];
  if (byCode !== undefined) {
    return byCode;
  }
  if (problem.status === 0) {
    return 'Нет связи с сервером. Проверьте соединение.';
  }
  if (problem.status === 503) {
    return MESSAGES.SERVICE_UNAVAILABLE as string;
  }
  return fallback;
}

export function errorMessage(error: unknown, fallback: string): string {
  return problemMessage(toProblem(error), fallback);
}

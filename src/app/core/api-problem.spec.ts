import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { errorMessage, PROBLEM_MESSAGES, toProblem } from './api-problem';

function httpError(status: number, body: unknown, headers?: Record<string, string>) {
  return new HttpErrorResponse({ status, error: body, headers: new HttpHeaders(headers) });
}

describe('api-problem', () => {
  it('разбирает код, поле и лимиты из problem+json', () => {
    const problem = toProblem(
      httpError(422, { code: 'TOO_MANY_BARS', field: null, barsCount: 9000, maxBars: 5000 }),
    );
    expect(problem).toMatchObject({
      status: 422,
      code: 'TOO_MANY_BARS',
      barsCount: 9000,
      maxBars: 5000,
    });
  });

  it('не HTTP-ошибка и тело не JSON не роняют разбор', () => {
    expect(toProblem(new Error('x')).status).toBe(-1);
    expect(toProblem(httpError(502, '<html>')).code).toBeNull();
  });

  it('сообщение выбирается по code, а не по detail', () => {
    expect(errorMessage(httpError(401, { code: 'INVALID_CREDENTIALS', detail: 'x' }), 'f')).toBe(
      'Неверная почта или пароль.',
    );
    expect(errorMessage(httpError(409, { code: 'PLAYER_STATE_CONFLICT' }), 'f')).toContain(
      'плеера',
    );
  });

  it('429 показывает Retry-After', () => {
    expect(
      errorMessage(httpError(429, { code: 'TOO_MANY_REQUESTS' }, { 'Retry-After': '30' }), 'f'),
    ).toContain('30 с');
  });

  it('нет связи, 503 без кода и неизвестная ошибка', () => {
    expect(errorMessage(httpError(0, null), 'f')).toContain('Нет связи');
    expect(errorMessage(httpError(503, null), 'f')).toContain('недоступен');
    expect(errorMessage(new Error('x'), 'запасной текст')).toBe('запасной текст');
  });

  it('для каждого кода контракта решено, что показывать: текст или null (разбирает вызывающий)', () => {
    // Тип Record<ProblemCode, …> исчерпывающий — новый код из api:sync не соберётся без записи.
    const entries = Object.entries(PROBLEM_MESSAGES);
    expect(entries.length).toBeGreaterThanOrEqual(20);
    for (const [code, message] of entries) {
      expect(message === null || message.length > 0, code).toBe(true);
    }
    expect(PROBLEM_MESSAGES.TOO_MANY_BARS).toBeNull();
    expect(errorMessage(httpError(422, { code: 'TOO_MANY_BARS' }), 'запасной')).toBe('запасной');
    expect(errorMessage(httpError(422, { code: 'STRATEGY_INVALID' }), 'запасной')).toContain('DSL');
    expect(errorMessage(httpError(409, { code: 'CONFLICT' }), 'запасной')).toContain('Конфликт');
  });
});

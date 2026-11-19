import { toProblem } from './api-problem';

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

const RETRY_DELAYS_MS = [300, 1000];

/**
 * Выполняет команду с одним `Idempotency-Key` на все попытки: при обрыве сети (статус 0) повтор
 * с тем же ключом не пишет в журнал второй раз (INV-8). Если первый запрос ещё выполняется
 * (409 `IDEMPOTENCY_KEY_IN_PROGRESS`), повторяем с паузой: после его завершения придёт сохранённый ответ.
 * Другие ошибки не повторяем.
 */
export async function withIdempotency<T>(
  command: (key: string) => Promise<T>,
  delaysMs: readonly number[] = RETRY_DELAYS_MS,
): Promise<T> {
  const key = newIdempotencyKey();
  for (let attempt = 0; ; attempt++) {
    try {
      return await command(key);
    } catch (error) {
      const problem = toProblem(error);
      const retryable = problem.status === 0 || problem.code === 'IDEMPOTENCY_KEY_IN_PROGRESS';
      if (!retryable || attempt >= delaysMs.length) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
    }
  }
}

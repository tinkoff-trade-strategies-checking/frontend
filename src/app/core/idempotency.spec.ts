import { HttpErrorResponse } from '@angular/common/http';
import { withIdempotency } from './idempotency';

describe('withIdempotency', () => {
  it('при обрыве сети повторяет команду с тем же ключом', async () => {
    const keys: string[] = [];
    let calls = 0;
    const result = await withIdempotency(
      async (key) => {
        keys.push(key);
        if (++calls < 3) {
          throw new HttpErrorResponse({ status: 0 });
        }
        return 'ok';
      },
      [0, 0],
    );
    expect(result).toBe('ok');
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('409 IDEMPOTENCY_KEY_IN_PROGRESS (первый запрос ещё выполняется) повторяет с паузой и тем же ключом', async () => {
    const keys: string[] = [];
    let calls = 0;
    const result = await withIdempotency(
      async (key) => {
        keys.push(key);
        if (++calls < 2) {
          throw new HttpErrorResponse({
            status: 409,
            error: { code: 'IDEMPOTENCY_KEY_IN_PROGRESS' },
          });
        }
        return 'saved';
      },
      [0],
    );
    expect(result).toBe('saved');
    expect(new Set(keys).size).toBe(1);
  });

  it('ответ сервера с ошибкой не повторяет', async () => {
    let calls = 0;
    await expect(
      withIdempotency(async () => {
        calls++;
        throw new HttpErrorResponse({ status: 409, error: { code: 'PLAYER_STATE_CONFLICT' } });
      }, [0, 0]),
    ).rejects.toBeTruthy();
    expect(calls).toBe(1);
  });

  it('новая команда — новый ключ', async () => {
    const keys: string[] = [];
    await withIdempotency(async (k) => keys.push(k));
    await withIdempotency(async (k) => keys.push(k));
    expect(keys[0]).not.toBe(keys[1]);
  });
});

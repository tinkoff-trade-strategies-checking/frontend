import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { SessionEvent } from '../api/models/session-event';

/** Минимум от `fetch`, нужный потоку (подменяется в тестах). */
export type SessionFetch = (
  url: string,
  init: {
    readonly headers: Record<string, string>;
    readonly credentials: 'include';
    readonly cache: 'no-store';
    readonly signal: AbortSignal;
  },
) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  readonly body: ReadableStream<Uint8Array> | null;
}>;

export const SESSION_FETCH = new InjectionToken<SessionFetch>('SESSION_FETCH', {
  providedIn: 'root',
  factory: () => (url, init) => fetch(url, init),
});

/** Сообщение потока: событие контракта или признак «сервер закрыл поток окончательно». */
export type SessionStreamItem =
  SessionEvent | { readonly type: 'stream_failed'; readonly status: number };

/** Ответы, после которых переподключение бессмысленно: не авторизован, нет доступа, нет сессии, плохой запрос. */
const FATAL_STATUSES = new Set([400, 401, 403, 404]);
const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 10_000;

interface Parsed {
  readonly id: string | null;
  readonly data: string;
}

function parseBlock(block: string): Parsed | null {
  let id: string | null = null;
  const data: string[] = [];
  for (const line of block.split('\n')) {
    if (line === '' || line.startsWith(':')) {
      continue;
    }
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'id') {
      id = value;
    } else if (field === 'data') {
      data.push(value);
    }
  }
  return data.length === 0 ? null : { id, data: data.join('\n') };
}

/**
 * Поток событий сессии (SSE) поверх `fetch`: заголовок `Last-Event-ID` задаётся самим клиентом
 * (`EventSource` этого не умеет), поэтому поток начинается ровно с номера из снимка (INV-8), а после
 * обрыва продолжается с последнего полученного события — сервер досылает пропущенное из журнала.
 * 400/401/403/404 — поток закрыт окончательно (`stream_failed`), остальное — повтор с нарастающей паузой.
 */
export function sessionEventStream(
  url: string,
  lastEventId: number | null,
  fetchFn: SessionFetch,
): Observable<SessionStreamItem> {
  return new Observable<SessionStreamItem>((subscriber) => {
    const abort = new AbortController();
    let closed = false;
    let last: string | null = lastEventId === null ? null : String(lastEventId);
    let backoff = MIN_BACKOFF_MS;
    let wake: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const pause = (ms: number): Promise<void> =>
      new Promise((resolve) => {
        wake = resolve;
        timer = setTimeout(resolve, ms);
      });

    const emit = (block: string): void => {
      const parsed = parseBlock(block);
      if (!parsed) {
        return;
      }
      try {
        const event = JSON.parse(parsed.data) as SessionEvent;
        last = parsed.id ?? event.eventId ?? last;
        subscriber.next(event);
      } catch {
        // Битое событие пропускаем: пропуск номера заметит подписчик и перечитает снимок.
        last = parsed.id ?? last;
      }
    };

    const run = async (): Promise<void> => {
      while (!closed) {
        try {
          const headers: Record<string, string> = { Accept: 'text/event-stream' };
          if (last !== null) {
            headers['Last-Event-ID'] = last;
          }
          const response = await fetchFn(url, {
            headers,
            credentials: 'include',
            cache: 'no-store',
            signal: abort.signal,
          });
          if (FATAL_STATUSES.has(response.status)) {
            subscriber.next({ type: 'stream_failed', status: response.status });
            subscriber.complete();
            return;
          }
          if (response.ok && response.body) {
            backoff = MIN_BACKOFF_MS;
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            for (;;) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }
              buffer += decoder.decode(value, { stream: true }).replaceAll('\r\n', '\n');
              let end = buffer.indexOf('\n\n');
              while (end !== -1) {
                emit(buffer.slice(0, end));
                buffer = buffer.slice(end + 2);
                end = buffer.indexOf('\n\n');
              }
            }
          }
        } catch {
          // Обрыв сети или отмена: ниже проверим, закрыты ли мы, и повторим.
        }
        if (closed) {
          return;
        }
        await pause(backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      }
    };
    void run();

    return () => {
      closed = true;
      abort.abort();
      if (timer !== null) {
        clearTimeout(timer);
      }
      (wake as (() => void) | null)?.();
    };
  });
}

import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { SessionEvent } from '../api/models/session-event';

/** Минимум от `EventSource`, нужный потоку (подменяется в тестах). */
export interface EventSourceLike {
  readonly readyState: number;
  onopen: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  close(): void;
}

export type EventSourceFactory = (url: string) => EventSourceLike;

export const EVENT_SOURCE_FACTORY = new InjectionToken<EventSourceFactory>('EVENT_SOURCE_FACTORY', {
  providedIn: 'root',
  // Cookie сессии нужна и потоку; `Last-Event-ID` браузер подставляет сам при своих переподключениях.
  factory: () => (url) => new EventSource(url, { withCredentials: true }),
});

/** Сообщение потока: событие контракта или признак «соединение восстановлено, события могли потеряться». */
export type SessionStreamItem = SessionEvent | { readonly type: 'resync' };

/** `EventSource.CLOSED`: браузер сдался (например, 401/404) и сам не переподключится. */
const CLOSED = 2;
const EVENT_TYPES = [
  'step',
  'order_updated',
  'paused',
  'player',
  'finished',
  'report_ready',
] as const;
const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 10_000;

/**
 * Поток событий сессии (SSE). После любого обрыва, когда соединение снова открылось, отдаёт `resync`:
 * подписчик перечитывает снимок (INV-8) и отбрасывает дубли по номеру шага. Если браузер закрыл
 * соединение окончательно, открываем новое с нарастающей паузой.
 */
export function sessionEventStream(
  url: string,
  factory: EventSourceFactory,
): Observable<SessionStreamItem> {
  return new Observable<SessionStreamItem>((subscriber) => {
    let source: EventSourceLike | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let backoff = MIN_BACKOFF_MS;
    let lostConnection = false;
    let closed = false;

    const open = (): void => {
      const current = factory(url);
      source = current;
      current.onopen = () => {
        backoff = MIN_BACKOFF_MS;
        if (lostConnection) {
          lostConnection = false;
          subscriber.next({ type: 'resync' });
        }
      };
      current.onerror = () => {
        lostConnection = true;
        if (current.readyState === CLOSED && !closed) {
          current.close();
          timer = setTimeout(open, backoff);
          backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        }
      };
      for (const type of EVENT_TYPES) {
        current.addEventListener(type, (message) => {
          try {
            subscriber.next(JSON.parse(message.data) as SessionEvent);
          } catch {
            // Битое событие пропускаем: состояние восстановит следующий снимок.
          }
        });
      }
    };
    open();

    return () => {
      closed = true;
      if (timer !== null) {
        clearTimeout(timer);
      }
      source?.close();
    };
  });
}

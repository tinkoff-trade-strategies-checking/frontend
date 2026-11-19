import { vi } from 'vitest';
import { EventSourceLike, SessionStreamItem, sessionEventStream } from './session-events';

class FakeSource implements EventSourceLike {
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;
  private readonly listeners = new Map<string, (event: MessageEvent<string>) => void>();

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    this.listeners.set(type, listener);
  }

  close(): void {
    this.closed = true;
    this.readyState = 2;
  }

  emit(type: string, data: string): void {
    this.listeners.get(type)?.({ data } as MessageEvent<string>);
  }
}

describe('sessionEventStream', () => {
  afterEach(() => vi.useRealTimers());

  it('отдаёт события контракта по именам и пропускает битый JSON', () => {
    const sources: FakeSource[] = [];
    const items: SessionStreamItem[] = [];
    const sub = sessionEventStream('/api/v1/sessions/s/events', () => {
      const source = new FakeSource();
      sources.push(source);
      return source;
    }).subscribe((item) => items.push(item));

    sources[0].emit(
      'player',
      JSON.stringify({ type: 'player', eventId: '1', playing: true, speed: 1 }),
    );
    sources[0].emit('step', '{не json');
    expect(items).toEqual([{ type: 'player', eventId: '1', playing: true, speed: 1 }]);

    sub.unsubscribe();
    expect(sources[0].closed).toBe(true);
  });

  it('после обрыва и нового открытия просит перечитать снимок, на первом открытии — нет', () => {
    let source!: FakeSource;
    const items: SessionStreamItem[] = [];
    sessionEventStream('/x', () => (source = new FakeSource())).subscribe((i) => items.push(i));

    source.onopen?.(new Event('open'));
    expect(items).toEqual([]);
    source.readyState = 0; // браузер сам переподключается
    source.onerror?.(new Event('error'));
    source.onopen?.(new Event('open'));
    expect(items).toEqual([{ type: 'resync' }]);
  });

  it('если браузер закрыл соединение, открывает новое с паузой и затем просит снимок', () => {
    vi.useFakeTimers();
    const sources: FakeSource[] = [];
    const items: SessionStreamItem[] = [];
    sessionEventStream('/x', () => {
      const source = new FakeSource();
      sources.push(source);
      return source;
    }).subscribe((i) => items.push(i));

    sources[0].readyState = 2;
    sources[0].onerror?.(new Event('error'));
    expect(sources).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(sources).toHaveLength(2);
    sources[1].onopen?.(new Event('open'));
    expect(items).toEqual([{ type: 'resync' }]);
  });

  it('отписка останавливает переподключение', () => {
    vi.useFakeTimers();
    const sources: FakeSource[] = [];
    const sub = sessionEventStream('/x', () => {
      const source = new FakeSource();
      sources.push(source);
      return source;
    }).subscribe();
    sources[0].readyState = 2;
    sources[0].onerror?.(new Event('error'));
    sub.unsubscribe();
    vi.advanceTimersByTime(20_000);
    expect(sources).toHaveLength(1);
  });
});

import { vi } from 'vitest';
import { SessionFetch, SessionStreamItem, sessionEventStream } from './session-events';

const encoder = new TextEncoder();

function sse(...blocks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const block of blocks) {
        controller.enqueue(encoder.encode(block));
      }
      controller.close();
    },
  });
}

function event(id: number, type: string, extra: Record<string, unknown> = {}): string {
  return `id: ${id}\nevent: ${type}\ndata: ${JSON.stringify({ type, eventId: String(id), ...extra })}\n\n`;
}

function response(status: number, body: ReadableStream<Uint8Array> | null = null) {
  return { ok: status >= 200 && status < 300, status, body };
}

describe('sessionEventStream', () => {
  afterEach(() => vi.useRealTimers());

  it('начинается с Last-Event-ID из снимка и отдаёт события по порядку, комментарии пропускает', async () => {
    const calls: Record<string, string>[] = [];
    const fetchFn: SessionFetch = vi.fn(async (_url, init) => {
      calls.push(init.headers);
      return response(
        200,
        sse(
          ': heartbeat\n\n',
          event(8, 'player', { playing: true, speed: 1 }),
          // событие разорвано по границе чанков и пришло CRLF-ом
          'id: 9\r\nevent: paused\r\ndata: {"type":"paused","eventId":"9",',
          '"reason":"user"}\r\n\r\n',
        ),
      );
    });
    const items: SessionStreamItem[] = [];
    const sub = sessionEventStream('/api/v1/sessions/s/events', 7, fetchFn).subscribe((i) =>
      items.push(i),
    );
    await vi.waitFor(() => expect(items).toHaveLength(2));
    sub.unsubscribe();
    expect(calls[0]).toMatchObject({ 'Last-Event-ID': '7', Accept: 'text/event-stream' });
    expect(items.map((i) => (i.type === 'stream_failed' ? i.type : i.eventId))).toEqual(['8', '9']);
  });

  it('без номера в снимке заголовка нет', async () => {
    const fetchFn: SessionFetch = vi.fn(async () => response(200, sse(event(1, 'report_ready'))));
    const sub = sessionEventStream('/x', null, fetchFn).subscribe();
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled());
    sub.unsubscribe();
    expect(vi.mocked(fetchFn).mock.calls[0][1].headers).not.toHaveProperty('Last-Event-ID');
  });

  it('битый JSON пропускается, поток живёт', async () => {
    const fetchFn: SessionFetch = vi.fn(async () =>
      response(200, sse('id: 1\ndata: {не json\n\n', event(2, 'report_ready'))),
    );
    const items: SessionStreamItem[] = [];
    const sub = sessionEventStream('/x', null, fetchFn).subscribe((i) => items.push(i));
    await vi.waitFor(() => expect(items).toHaveLength(1));
    sub.unsubscribe();
    expect(items[0]).toMatchObject({ type: 'report_ready', eventId: '2' });
  });

  it.each([400, 401, 403, 404])(
    'ответ %i закрывает поток окончательно, без переподключения',
    async (status) => {
      const fetchFn: SessionFetch = vi.fn(async () => response(status));
      const items: SessionStreamItem[] = [];
      let completed = false;
      sessionEventStream('/x', 5, fetchFn).subscribe({
        next: (i) => items.push(i),
        complete: () => (completed = true),
      });
      await vi.waitFor(() => expect(completed).toBe(true));
      expect(items).toEqual([{ type: 'stream_failed', status }]);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    },
  );

  it('обрыв потока: переподключение с номером последнего события и паузой', async () => {
    vi.useFakeTimers();
    const headers: Record<string, string>[] = [];
    let n = 0;
    const fetchFn: SessionFetch = vi.fn(async (_url, init) => {
      headers.push(init.headers);
      n++;
      return n === 1
        ? response(200, sse(event(3, 'player', { playing: true, speed: 1 })))
        : response(200, new ReadableStream({ start: () => undefined }));
    });
    const items: SessionStreamItem[] = [];
    const sub = sessionEventStream('/x', 2, fetchFn).subscribe((i) => items.push(i));
    await vi.advanceTimersByTimeAsync(0);
    expect(items).toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(headers[1]['Last-Event-ID']).toBe('3');
    sub.unsubscribe();
  });

  it('сбой сети (fetch отклонён) — повтор с нарастающей паузой, 5xx — тоже повтор', async () => {
    vi.useFakeTimers();
    let n = 0;
    const fetchFn: SessionFetch = vi.fn(async () => {
      n++;
      if (n === 1) {
        throw new TypeError('network');
      }
      return n === 2
        ? response(503)
        : response(200, new ReadableStream({ start: () => undefined }));
    });
    const sub = sessionEventStream('/x', null, fetchFn).subscribe();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    sub.unsubscribe();
  });

  it('отписка останавливает переподключение и прерывает запрос', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetchFn: SessionFetch = vi.fn(async (_url, init) => {
      signal = init.signal;
      throw new TypeError('network');
    });
    const sub = sessionEventStream('/x', null, fetchFn).subscribe();
    await vi.advanceTimersByTimeAsync(0);
    sub.unsubscribe();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(signal?.aborted).toBe(true);
  });
});

import { TestBed } from '@angular/core/testing';
import { REPLAY_API } from './data/replay.models';
import { StubReplayApi } from './data/stub-replay.api';
import { ReplayStore } from './replay.store';

describe('ReplayStore', () => {
  let store: ReplayStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: REPLAY_API, useClass: StubReplayApi }, ReplayStore],
    });
    store = TestBed.inject(ReplayStore);
  });

  it('загружает S-0103 и предоставляет read-only ArenaApi', async () => {
    await store.load('S-0103');
    expect(store.ready()?.session.sessionId).toBe('S-0103');
    const api = store.arenaApi();
    expect(api).not.toBeNull();
    if (!api) {
      return;
    }

    const snap = await api.getSnapshot();
    expect(snap.sessionId).toBe('S-0103');
    expect(snap.papers.map((p) => p.label)).toEqual(['SBER', 'GAZP', 'YDEX']);

    await expect(
      api.placeOrder({
        seenStep: 0,
        paperId: 'SBER',
        side: 'buy',
        type: 'market',
        lots: 1,
        tif: 'day',
      }),
    ).rejects.toThrow();
    await expect(api.cancelOrder({ seenStep: 0, orderId: 'O-1' })).rejects.toThrow();
    await expect(api.finishSession()).rejects.toThrow();
  });

  it('для S-0104 возвращает BLIND_UNFINISHED без arenaApi', async () => {
    await store.load('S-0104');
    expect(store.result()?.status).toBe('BLIND_UNFINISHED');
    expect(store.ready()).toBeNull();
    expect(store.arenaApi()).toBeNull();
  });
});

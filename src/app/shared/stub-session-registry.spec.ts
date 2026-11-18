import { TestBed } from '@angular/core/testing';
import { StubSessionRegistry } from './stub-session-registry';

describe('StubSessionRegistry', () => {
  it('регистрирует S-0104 при старте, выделяет новые id с S-0106 и обновляет прогресс и завершение', () => {
    TestBed.configureTestingModule({});
    const registry = TestBed.inject(StubSessionRegistry);

    const s0104 = registry.get('S-0104');
    expect(s0104).toBeDefined();
    expect(s0104?.finished).toBe(false);
    expect(s0104?.playedDays).toBe(1);
    expect(registry.lastFinishedSessionId()).toBeNull();

    const id = registry.allocateSessionId();
    expect(id).toBe('S-0106');
    registry.register({
      sessionId: id,
      blind: false,
      regime: 'medium',
      timeframe: '1d',
      totalDays: 20,
      playedDays: 1,
      finished: false,
      finishedEarly: false,
      createdAt: '2026-11-18T15:00:00+03:00',
      initialCapitalRub: 1_000_000,
      paperIds: ['SBER'],
      paperCount: 1,
      customStartDate: '2020-02-26',
      netReturnPct: null,
    });

    registry.updateProgress(id, 7);
    expect(registry.get(id)?.playedDays).toBe(7);

    registry.markFinished(id, { playedDays: 7, finishedEarly: true, netReturnPct: 2.34 });
    expect(registry.get(id)?.finished).toBe(true);
    expect(registry.get(id)?.netReturnPct).toBe(2.34);
    expect(registry.lastFinishedSessionId()).toBe(id);
    expect(registry.list()[0].sessionId).toBe(id);
  });
});

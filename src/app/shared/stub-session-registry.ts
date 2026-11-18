import { inject, Injectable, signal } from '@angular/core';
import {
  CandleTimeframe,
  MarketRegime,
  SessionDurationDays,
} from '../features/launch/data/launch.models';

export interface StubSessionRecord {
  readonly sessionId: string;
  readonly blind: boolean;
  readonly regime: MarketRegime;
  readonly timeframe: CandleTimeframe;
  readonly totalDays: SessionDurationDays;
  readonly playedDays: number;
  readonly finished: boolean;
  readonly finishedEarly: boolean;
  readonly createdAt: string;
  readonly initialCapitalRub: number;
  readonly paperIds: readonly string[] | null;
  readonly paperCount: number;
  readonly customStartDate: string | null;
  readonly netReturnPct: number | null;
}

export function formatMoscowDate(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatMoscowDateTime(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(iso))
    .replace(',', '');
}

@Injectable({ providedIn: 'root' })
export class StubSessionRegistry {
  private readonly sessions = new Map<string, StubSessionRecord>();
  private nextSessionSeq = 106;

  readonly lastFinishedSessionId = signal<string | null>(null);

  constructor() {
    this.sessions.set('S-0104', {
      sessionId: 'S-0104',
      blind: true,
      regime: 'stress',
      timeframe: '1d',
      totalDays: 60,
      playedDays: 1,
      finished: false,
      finishedEarly: false,
      createdAt: '2026-11-18T14:20:00+03:00',
      initialCapitalRub: 1_000_000,
      paperIds: null,
      paperCount: 3,
      customStartDate: null,
      netReturnPct: null,
    });
  }

  allocateSessionId(): string {
    return `S-${String(this.nextSessionSeq++).padStart(4, '0')}`;
  }

  register(record: StubSessionRecord): void {
    this.sessions.set(record.sessionId, record);
  }

  get(sessionId: string): StubSessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  list(): readonly StubSessionRecord[] {
    return Array.from(this.sessions.values()).reverse();
  }

  updateProgress(sessionId: string, playedDays: number): void {
    const existing = this.sessions.get(sessionId);
    if (!existing || existing.finished) {
      return;
    }
    this.sessions.set(sessionId, { ...existing, playedDays });
  }

  markFinished(
    sessionId: string,
    details: {
      readonly playedDays: number;
      readonly finishedEarly: boolean;
      readonly netReturnPct: number;
    },
  ): void {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      this.sessions.set(sessionId, {
        ...existing,
        playedDays: details.playedDays,
        finished: true,
        finishedEarly: details.finishedEarly,
        netReturnPct: details.netReturnPct,
      });
    }
    this.lastFinishedSessionId.set(sessionId);
  }
}

export function injectSessionRegistry(): StubSessionRegistry | null {
  try {
    return inject(StubSessionRegistry, { optional: true });
  } catch {
    // Юнит-тесты создают Stub*Api напрямую через `new`, вне контекста Angular DI.
    return null;
  }
}

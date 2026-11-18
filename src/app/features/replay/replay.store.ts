import { computed, inject, Injectable, signal } from '@angular/core';
import {
  ArenaApi,
  ArenaCommandResult,
  ArenaFinishResult,
  ArenaSnapshot,
  ArenaStepResult,
  OrderEstimateResult,
} from '../arena/data/arena.models';
import { REPLAY_API, ReplaySessionResult } from './data/replay.models';

class ReplayArenaApiAdapter implements ArenaApi {
  constructor(
    private readonly initialSnapshot: ArenaSnapshot,
    private readonly stepFn: () => Promise<ArenaStepResult>,
  ) {}

  async getSnapshot(): Promise<ArenaSnapshot> {
    return this.initialSnapshot;
  }

  step(): Promise<ArenaStepResult> {
    return this.stepFn();
  }

  async estimateOrder(): Promise<OrderEstimateResult> {
    return { amountPct: 0 };
  }

  async placeOrder(): Promise<ArenaCommandResult> {
    throw new Error('В режиме воспроизведения выставление заявок недоступно.');
  }

  async cancelOrder(): Promise<ArenaCommandResult> {
    throw new Error('В режиме воспроизведения отмена заявок недоступна.');
  }

  async replaceOrder(): Promise<ArenaCommandResult> {
    throw new Error('В режиме воспроизведения замена заявок недоступна.');
  }

  async finishSession(): Promise<ArenaFinishResult> {
    throw new Error('Сессия уже завершена.');
  }
}

@Injectable()
export class ReplayStore {
  private readonly api = inject(REPLAY_API);
  private loadSeq = 0;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<ReplaySessionResult | null>(null);

  readonly ready = computed(() => {
    const res = this.result();
    return res?.status === 'READY' ? res : null;
  });

  readonly arenaApi = computed<ArenaApi | null>(() => {
    const res = this.ready();
    if (!res) {
      return null;
    }
    const sessionId = res.session.sessionId;
    return new ReplayArenaApiAdapter(res.snapshot, () => this.api.step(sessionId));
  });

  async load(sessionId: string, initialStep?: number): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);

    try {
      const res = await this.api.loadSession(sessionId, initialStep);
      if (seq !== this.loadSeq) {
        return;
      }
      this.result.set(res);
    } catch (err) {
      if (seq !== this.loadSeq) {
        return;
      }
      this.error.set(err instanceof Error ? err.message : 'Не удалось загрузить воспроизведение.');
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}

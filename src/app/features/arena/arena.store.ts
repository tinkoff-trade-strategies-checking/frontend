import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import {
  ARENA_API,
  ArenaCommandResult,
  ArenaFill,
  ArenaOrder,
  ArenaPaper,
  ArenaPortfolio,
  ArenaSpeed,
  OrderSide,
  OrderType,
  TimeInForce,
} from './data/arena.models';

export interface OrderDraft {
  readonly paperId: string;
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly lots: number;
  readonly tif: TimeInForce;
  readonly limitPrice?: number;
  readonly stopPrice?: number;
  readonly takeProfitPrice?: number;
  readonly trailingPct?: number;
}

const EMPTY_PORTFOLIO: ArenaPortfolio = {
  equityPct: 100,
  cashPct: 100,
  investedPct: 0,
  pnlPct: 0,
  costsPct: 0,
  positions: {},
};

@Injectable()
export class ArenaStore {
  private readonly api = inject(ARENA_API);
  private readonly destroyRef = inject(DestroyRef);

  private timerId: ReturnType<typeof setInterval> | null = null;
  private stepInFlight = false;

  readonly loading = signal(false);
  readonly sessionId = signal('');
  readonly blind = signal(true);
  readonly step = signal(0);
  readonly totalSteps = signal(0);
  readonly day = signal(0);
  readonly totalDays = signal(0);
  readonly finished = signal(false);
  readonly papers = signal<readonly ArenaPaper[]>([]);
  readonly portfolio = signal<ArenaPortfolio>(EMPTY_PORTFOLIO);
  readonly orders = signal<readonly ArenaOrder[]>([]);
  readonly fills = signal<readonly ArenaFill[]>([]);

  readonly selectedPaperId = signal('A');
  readonly playing = signal(false);
  readonly speed = signal<ArenaSpeed>(1);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly editingOrder = signal<ArenaOrder | null>(null);

  readonly selectedPaper = computed<ArenaPaper | null>(() => {
    const id = this.selectedPaperId();
    const list = this.papers();
    return list.find((p) => p.id === id) ?? list[0] ?? null;
  });

  readonly activeOrders = computed(() => this.orders().filter((o) => o.status === 'active'));

  readonly progressPct = computed(() => {
    const total = this.totalSteps();
    if (total <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((this.step() / total) * 100));
  });

  readonly canStep = computed(() => !this.finished() && this.step() < this.totalSteps());

  constructor() {
    this.destroyRef.onDestroy(() => this.stopTimer());
  }

  async init(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.pause();

    try {
      // INV-8: состояние всегда восстанавливается из источника, без локального кеша.
      const snap = await this.api.getSnapshot();
      this.sessionId.set(snap.sessionId);
      this.blind.set(snap.blind);
      this.step.set(snap.step);
      this.totalSteps.set(snap.totalSteps);
      this.day.set(snap.day);
      this.totalDays.set(snap.totalDays);
      this.finished.set(snap.finished);
      this.papers.set(snap.papers);
      this.portfolio.set(snap.portfolio);
      this.orders.set(snap.orders);
      this.fills.set(snap.fills);
      if (snap.papers.length > 0 && !snap.papers.some((p) => p.id === this.selectedPaperId())) {
        this.selectedPaperId.set(snap.papers[0].id);
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Не удалось загрузить сессию.');
    } finally {
      this.loading.set(false);
    }
  }

  selectPaper(paperId: string): void {
    this.selectedPaperId.set(paperId);
  }

  setSpeed(speed: ArenaSpeed): void {
    this.speed.set(speed);
    if (this.playing()) {
      this.startTimer();
    }
  }

  togglePlay(): void {
    if (this.playing()) {
      this.pause();
    } else if (this.canStep()) {
      this.playing.set(true);
      this.startTimer();
    }
  }

  pause(): void {
    this.playing.set(false);
    this.stopTimer();
  }

  async stepOnce(): Promise<void> {
    if (this.stepInFlight || !this.canStep()) {
      return;
    }
    this.stepInFlight = true;
    this.error.set(null);

    try {
      const res = await this.api.step();
      this.step.set(res.step);
      this.day.set(res.day);
      this.finished.set(res.finished);
      this.portfolio.set(res.portfolio);
      this.orders.set(res.orders);
      this.fills.set(res.fills);

      this.papers.update((current) =>
        current.map((paper) => {
          const bar = res.bars[paper.id];
          const stat = res.paperStats[paper.id];
          if (!bar) {
            return paper;
          }
          const alreadyHas = paper.candles.some((c) => c.step === bar.step);
          return {
            ...paper,
            candles: alreadyHas ? paper.candles : [...paper.candles, bar],
            changePct: stat ? stat.changePct : paper.changePct,
            lastPrice: stat ? stat.lastPrice : bar.close,
          };
        }),
      );

      if (res.finished) {
        this.pause();
      }
    } catch (err) {
      this.pause();
      this.error.set(err instanceof Error ? err.message : 'Ошибка при переходе к следующей свече.');
    } finally {
      this.stepInFlight = false;
    }
  }

  async placeOrder(draft: OrderDraft): Promise<ArenaCommandResult> {
    this.error.set(null);
    this.notice.set(null);
    // INV-2: заявка всегда уходит с номером последней свечи, которую видел пользователь.
    const result = await this.api.placeOrder({
      seenStep: this.step(),
      paperId: draft.paperId,
      side: draft.side,
      type: draft.type,
      lots: draft.lots,
      tif: draft.tif,
      limitPrice: draft.limitPrice,
      stopPrice: draft.stopPrice,
      takeProfitPrice: draft.takeProfitPrice,
      trailingPct: draft.trailingPct,
    });

    this.applyCommandResult(result, 'Заявка выставлена.');
    return result;
  }

  async cancelOrder(orderId: string): Promise<ArenaCommandResult> {
    this.error.set(null);
    this.notice.set(null);
    // INV-2: отмена всегда уходит с seenStep.
    const result = await this.api.cancelOrder({
      seenStep: this.step(),
      orderId,
    });

    if (this.editingOrder()?.id === orderId) {
      this.editingOrder.set(null);
    }
    this.applyCommandResult(result, 'Заявка отменена.');
    return result;
  }

  startEditOrder(order: ArenaOrder): void {
    this.editingOrder.set(order);
    this.selectedPaperId.set(order.paperId);
  }

  cancelEditOrder(): void {
    this.editingOrder.set(null);
  }

  async replaceOrder(
    orderId: string,
    draft: Omit<OrderDraft, 'paperId' | 'side' | 'type'>,
  ): Promise<ArenaCommandResult> {
    this.error.set(null);
    this.notice.set(null);
    // INV-2: замена всегда уходит с seenStep.
    const result = await this.api.replaceOrder({
      seenStep: this.step(),
      orderId,
      lots: draft.lots,
      tif: draft.tif,
      limitPrice: draft.limitPrice,
      stopPrice: draft.stopPrice,
      takeProfitPrice: draft.takeProfitPrice,
      trailingPct: draft.trailingPct,
    });

    if (result.accepted) {
      this.editingOrder.set(null);
    }
    this.applyCommandResult(result, 'Заявка заменена.');
    return result;
  }

  async finishSession(): Promise<void> {
    this.pause();
    this.error.set(null);
    const res = await this.api.finishSession();
    this.finished.set(true);
    this.portfolio.set(res.portfolio);
    this.editingOrder.set(null);
    this.notice.set(`Сессия ${res.sessionId} завершена на дне ${res.finishedAtDay}.`);
  }

  private applyCommandResult(result: ArenaCommandResult, successText: string): void {
    this.orders.set(result.orders);
    this.portfolio.set(result.portfolio);
    if (result.accepted) {
      this.notice.set(successText);
    } else {
      this.error.set(result.reason ?? 'Команда отклонена.');
    }
  }

  private startTimer(): void {
    this.stopTimer();
    const intervalMs = Math.max(10, Math.round(1000 / this.speed()));
    this.timerId = setInterval(() => {
      void this.stepOnce();
    }, intervalMs);
  }

  private stopTimer(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}

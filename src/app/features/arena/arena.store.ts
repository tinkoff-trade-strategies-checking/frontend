import { HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { errorMessage, toProblem } from '../../core/api-problem';
import { formatRejectReason } from './arena.format';
import {
  ARENA_API,
  ArenaApi,
  ArenaCandle,
  ArenaCommandResult,
  ArenaEvent,
  EstimateOrderCommand,
  OrderEstimateResult,
  ArenaFill,
  ArenaOrder,
  ArenaPaper,
  ArenaPortfolio,
  ArenaSnapshot,
  ArenaSpeed,
  ArenaStepResult,
  isOrderActive,
  isOrderClosed,
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

/** Столько раз перечитываем снимок, если он старее уже применённых событий. */
const MAX_STALE_SNAPSHOT_RETRIES = 3;
/** Сколько ждём `report_ready` после `finished`, прежде чем закрыть поток. */
const FINISHED_STREAM_GRACE_MS = 30_000;

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
  private readonly defaultApi = inject(ARENA_API);
  private readonly destroyRef = inject(DestroyRef);
  private customApi: ArenaApi | null = null;

  private get api(): ArenaApi {
    return this.customApi ?? this.defaultApi;
  }

  private timerId: ReturnType<typeof setInterval> | null = null;
  private queue: Promise<void> = Promise.resolve();
  private estimateSeq = 0;
  private stepping = false;
  private eventsSub: Subscription | null = null;
  private finishedCloseTimer: ReturnType<typeof setTimeout> | null = null;
  /** Номер последнего события потока, учтённого на экране (INV-8); `null` — ещё не знаем. */
  private lastEventId: number | null = null;
  private snapshotRetries = 0;

  readonly loading = signal(false);
  readonly sessionId = signal('');
  readonly blind = signal(true);
  readonly step = signal(0);
  readonly totalSteps = signal(0);
  readonly day = signal(1);
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
  /** Отчёт готов (событие `report_ready`). */
  readonly reportReady = signal(false);
  readonly editingOrder = signal<ArenaOrder | null>(null);
  readonly estimate = signal<OrderEstimateResult | null>(null);
  readonly estimatedPct = computed(() => this.estimate()?.amountPct ?? null);

  readonly selectedPaper = computed<ArenaPaper | null>(() => {
    const id = this.selectedPaperId();
    const list = this.papers();
    return list.find((p) => p.id === id) ?? list[0] ?? null;
  });

  readonly activeOrders = computed(() => this.orders().filter(isOrderActive));
  readonly closedOrders = computed(() => this.orders().filter(isOrderClosed));

  readonly progressPct = computed(() => {
    const total = this.totalSteps();
    if (total <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((this.step() / total) * 100));
  });

  readonly canStep = computed(() => !this.finished() && this.step() < this.totalSteps());

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopTimer();
      this.closeEvents();
    });
  }

  init(customApi?: ArenaApi, sessionId?: string): Promise<void> {
    this.customApi = customApi ?? null;
    return this.enqueue(async () => {
      this.loading.set(true);
      this.error.set(null);
      this.notice.set(null);
      this.reportReady.set(false);
      this.stopLocal();
      this.closeEvents();
      this.lastEventId = null;

      try {
        // INV-8: состояние всегда восстанавливается из источника, без локального кеша.
        const snap = await this.api.getSnapshot(sessionId);
        this.applySnapshot(snap);
        this.lastEventId = snap.lastEventId ?? null;
        if (!snap.finished) {
          this.openEvents(this.lastEventId);
        }
      } catch (err) {
        this.error.set(messageOf(err, 'Не удалось загрузить сессию.'));
      } finally {
        this.loading.set(false);
      }
    });
  }

  /**
   * Перечитать снимок без сброса экрана и переоткрыть поток с его номера (INV-8). Снимок старее уже
   * применённых событий отбрасываем и читаем заново: иначе экран откатился бы назад.
   */
  resync(reopenEvents = true): Promise<void> {
    return this.enqueue(() => this.refreshSnapshot(reopenEvents, true));
  }

  private async refreshSnapshot(reopenEvents: boolean, reportErrors: boolean): Promise<void> {
    for (let attempt = 0; attempt < MAX_STALE_SNAPSHOT_RETRIES; attempt++) {
      try {
        const snap = await this.api.getSnapshot(this.sessionId() || undefined);
        const snapId = snap.lastEventId ?? null;
        if (snapId !== null && this.lastEventId !== null && snapId < this.lastEventId) {
          continue;
        }
        this.applySnapshot(snap);
        if (snapId !== null) {
          this.lastEventId = snapId;
        }
        if (reopenEvents && this.serverDriven && !snap.finished) {
          this.closeEvents();
          this.openEvents(this.lastEventId);
        }
        return;
      } catch (err) {
        if (reportErrors) {
          this.error.set(messageOf(err, 'Не удалось обновить сессию.'));
        }
        return;
      }
    }
  }

  selectPaper(paperId: string): void {
    this.selectedPaperId.set(paperId);
  }

  setSpeed(speed: ArenaSpeed): void {
    if (this.serverDriven) {
      void this.command('speed', speed);
      return;
    }
    this.speed.set(speed);
    if (this.playing()) {
      this.startTimer();
    }
  }

  togglePlay(): void {
    if (this.playing()) {
      this.pause();
    } else if (this.canStep()) {
      if (this.serverDriven) {
        void this.command('play');
        return;
      }
      this.playing.set(true);
      this.startTimer();
    }
  }

  /** Пауза по команде пользователя; при серверном времени отправляется на сервер. */
  pause(): void {
    if (this.serverDriven && this.playing()) {
      this.playing.set(false);
      void this.command('pause');
      return;
    }
    this.stopLocal();
  }

  /** INV-6: оценку по параметрам формы считает ядро; клиент её не пересчитывает. */
  async estimateOrder(
    command: Omit<EstimateOrderCommand, 'lots'> & { lots: number | null },
  ): Promise<void> {
    const seq = ++this.estimateSeq;
    const { lots } = command;
    if (lots === null || !Number.isInteger(lots) || lots < 1) {
      this.estimate.set(null);
      return;
    }
    try {
      const res = await this.api.estimateOrder({ ...command, lots });
      if (seq === this.estimateSeq) {
        this.estimate.set(res);
      }
    } catch {
      if (seq === this.estimateSeq) {
        this.estimate.set(null);
      }
    }
  }

  stepOnce(fromTimer = false): Promise<void> {
    return this.enqueue(async () => {
      if ((fromTimer && !this.playing()) || !this.canStep()) {
        return;
      }
      this.stepping = true;
      this.error.set(null);
      this.notice.set(null);

      try {
        const res = await this.api.step();
        if (this.applyStepResult(res) === 'gap') {
          await this.refreshSnapshot(true, false);
        }
        if (this.finished()) {
          this.stopLocal();
        }
      } catch (err) {
        this.stopLocal();
        this.error.set(messageOf(err, 'Ошибка при переходе к следующей свече.'));
        await this.recoverFromConflict(err);
      } finally {
        this.stepping = false;
      }
    });
  }

  placeOrder(draft: OrderDraft): Promise<ArenaCommandResult | null> {
    // INV-2: фиксируем seenStep синхронно в момент клика до постановки в очередь.
    const seenStep = this.step();
    return this.enqueue(async () => {
      this.error.set(null);
      this.notice.set(null);
      try {
        const result = await this.api.placeOrder({
          seenStep,
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
      } catch (err) {
        this.error.set(messageOf(err, 'Не удалось выставить заявку.'));
        return null;
      }
    });
  }

  cancelOrder(orderId: string): Promise<ArenaCommandResult | null> {
    // INV-2: фиксируем seenStep синхронно в момент клика до постановки в очередь.
    const seenStep = this.step();
    return this.enqueue(async () => {
      this.error.set(null);
      this.notice.set(null);
      try {
        const result = await this.api.cancelOrder({
          seenStep,
          orderId,
        });
        if (this.editingOrder()?.id === orderId) {
          this.editingOrder.set(null);
        }
        this.applyCommandResult(result, 'Заявка отменена.');
        return result;
      } catch (err) {
        this.error.set(messageOf(err, 'Не удалось отменить заявку.'));
        return null;
      }
    });
  }

  startEditOrder(order: ArenaOrder): void {
    this.editingOrder.set(order);
    this.selectedPaperId.set(order.paperId);
  }

  cancelEditOrder(): void {
    this.editingOrder.set(null);
  }

  replaceOrder(
    orderId: string,
    draft: Omit<OrderDraft, 'paperId' | 'side' | 'type'>,
  ): Promise<ArenaCommandResult | null> {
    // INV-2: фиксируем seenStep синхронно в момент клика до постановки в очередь.
    const seenStep = this.step();
    return this.enqueue(async () => {
      this.error.set(null);
      this.notice.set(null);
      try {
        const result = await this.api.replaceOrder({
          seenStep,
          orderId,
          lots: draft.lots,
          tif: draft.tif,
          limitPrice: draft.limitPrice,
          stopPrice: draft.stopPrice,
          takeProfitPrice: draft.takeProfitPrice,
          trailingPct: draft.trailingPct,
        });
        this.editingOrder.set(null);
        this.applyCommandResult(result, 'Заявка заменена.');
        if (result.partial && result.accepted) {
          // Замена снимает старую заявку (у OCO — обе ноги) и создаёт новые, а в ответе только новые:
          // состояние берём с сервера (INV-8), а не додумываем на экране.
          await this.refreshSnapshot(false, false);
        }
        return result;
      } catch (err) {
        this.editingOrder.set(null);
        this.error.set(messageOf(err, 'Не удалось заменить заявку.'));
        return null;
      }
    });
  }

  finishSession(): Promise<void> {
    return this.enqueue(async () => {
      this.stopLocal();
      this.error.set(null);
      try {
        const res = await this.api.finishSession();
        this.finished.set(true);
        this.portfolio.set(res.portfolio);
        if (res.orders) {
          this.orders.set(res.partial ? mergeById(this.orders(), res.orders) : res.orders);
        }
        this.editingOrder.set(null);
        this.notice.set(`Сессия ${res.sessionId} завершена на дне ${res.finishedAtDay}.`);
      } catch (err) {
        this.error.set(messageOf(err, 'Не удалось завершить сессию.'));
      }
    });
  }

  private get serverDriven(): boolean {
    return this.api.serverDriven === true;
  }

  /** Остановить таймер и сбросить флаг на экране, не трогая сервер. */
  private stopLocal(): void {
    this.playing.set(false);
    this.stopTimer();
  }

  /** Команда плеера на сервер; ответ — актуальное состояние плеера. */
  private command(action: 'play' | 'pause' | 'step' | 'speed', speed?: ArenaSpeed): Promise<void> {
    return this.enqueue(async () => {
      if (!this.api.control) {
        return;
      }
      this.error.set(null);
      try {
        const state = await this.api.control(action, speed);
        this.playing.set(state.playing);
        this.speed.set(state.speed);
        if (state.stepResult) {
          if (this.applyStepResult(state.stepResult) === 'gap') {
            await this.refreshSnapshot(true, false);
          }
        }
        if (state.finished) {
          this.finished.set(true);
        }
      } catch (err) {
        this.error.set(messageOf(err, 'Не удалось выполнить команду плеера.'));
        // Сервер мог и не принять команду, и принять: экран показывает то, что на сервере (INV-8).
        await this.refreshSnapshot(false, false);
      }
    });
  }

  /** 409 (состояние плеера разошлось с сервером) и неактивная сессия — перечитать снимок. */
  private async recoverFromConflict(err: unknown): Promise<void> {
    if (!this.serverDriven) {
      return;
    }
    const problem = toProblem(err);
    if (problem.status === 409 || problem.code === 'SESSION_NOT_ACTIVE') {
      await this.refreshSnapshot(false, false);
    }
  }

  private applySnapshot(snap: ArenaSnapshot): void {
    // INV-7: пока слепая сессия идёт, даты не показываем, даже если пришли. Воспроизведение (customApi) —
    // всегда завершённая сессия, её даты раскрыты.
    const hideDates = snap.blind && !snap.finished && !this.customApi;
    this.sessionId.set(snap.sessionId);
    this.blind.set(snap.blind);
    this.step.set(snap.step);
    this.totalSteps.set(snap.totalSteps);
    this.day.set(snap.day);
    this.totalDays.set(snap.totalDays);
    this.finished.set(snap.finished);
    this.papers.set(
      snap.papers.map((paper) => ({
        ...paper,
        candles: hideDates ? paper.candles.map(stripCandleDates) : paper.candles,
      })),
    );
    this.portfolio.set(snap.portfolio);
    this.orders.set(snap.orders);
    this.fills.set(hideDates ? snap.fills.map(stripFillDate) : snap.fills);
    if (snap.playing !== undefined) {
      this.playing.set(snap.playing && !snap.finished);
    }
    if (snap.speed !== undefined) {
      this.speed.set(snap.speed);
    }
    if (snap.papers.length > 0 && !snap.papers.some((p) => p.id === this.selectedPaperId())) {
      this.selectedPaperId.set(snap.papers[0].id);
    }
  }

  /**
   * Применить результат шага (ответ на команду или событие SSE). Шаг, который уже виден, пропускаем;
   * если первая свеча пачки не следует за последней известной (пропущены события), ничего не применяем
   * и возвращаем `gap`: состояние тогда берётся снимком (INV-8).
   */
  private applyStepResult(res: ArenaStepResult): 'applied' | 'duplicate' | 'gap' {
    if (this.serverDriven && res.step <= this.step()) {
      return 'duplicate';
    }
    if (this.serverDriven && this.hasGap(res)) {
      return 'gap';
    }
    const hideDates = this.blind() && !this.finished() && !res.finished && !this.customApi;
    const strip = (c: ArenaCandle): ArenaCandle => (hideDates ? stripCandleDates(c) : c);
    this.step.set(res.step);
    this.day.set(res.day);
    this.finished.update((was) => was || res.finished);
    this.portfolio.set(res.portfolio);
    this.orders.set(this.serverDriven ? mergeById(this.orders(), res.orders) : res.orders);
    const fills = hideDates ? res.fills.map(stripFillDate) : res.fills;
    this.fills.set(this.serverDriven ? mergeById(this.fills(), fills) : fills);

    this.papers.update((current) =>
      current.map((paper) => {
        const batch = res.batches?.[paper.id] ?? (res.bars[paper.id] ? [res.bars[paper.id]] : []);
        const stat = res.paperStats[paper.id];
        if (batch.length === 0) {
          return paper;
        }
        const known = new Set(paper.candles.map((c) => c.step));
        const fresh = batch.filter((c) => !known.has(c.step)).map(strip);
        const last = batch[batch.length - 1];
        return {
          ...paper,
          candles: fresh.length > 0 ? [...paper.candles, ...fresh] : paper.candles,
          changePct: stat ? stat.changePct : paper.changePct,
          lastPrice: stat ? stat.lastPrice : last.close,
        };
      }),
    );
    return 'applied';
  }

  private hasGap(res: ArenaStepResult): boolean {
    return this.papers().some((paper) => {
      const batch = res.batches?.[paper.id] ?? (res.bars[paper.id] ? [res.bars[paper.id]] : []);
      const lastKnown = paper.candles.at(-1)?.step;
      return batch.length > 0 && lastKnown !== undefined && batch[0].step > lastKnown + 1;
    });
  }

  private openEvents(lastEventId: number | null): void {
    if (!this.api.events) {
      return;
    }
    this.eventsSub = this.api.events(lastEventId).subscribe((event) => this.handleEvent(event));
  }

  private closeEvents(): void {
    this.eventsSub?.unsubscribe();
    this.eventsSub = null;
    if (this.finishedCloseTimer !== null) {
      clearTimeout(this.finishedCloseTimer);
      this.finishedCloseTimer = null;
    }
  }

  /**
   * Номера событий в сессии идут подряд. Событие с номером не больше учтённого — повтор, пропускаем;
   * с пропуском номера — часть событий потеряна, перечитываем снимок и переоткрываем поток с его номера.
   */
  private handleEvent(event: ArenaEvent): void {
    if (event.type === 'stream_failed') {
      // Поток закрыт сервером (401, 404…): снимок покажет причину, переподключения нет.
      this.closeEvents();
      this.error.set('Поток событий недоступен. Обновите страницу.');
      void this.resync(false);
      return;
    }
    const id = event.eventId;
    if (id !== null && this.lastEventId !== null) {
      if (id <= this.lastEventId) {
        return;
      }
      if (id !== this.lastEventId + 1) {
        void this.resync();
        return;
      }
    }
    if (event.type === 'step' && this.applyStepResult(event.result) === 'gap') {
      void this.resync();
      return;
    }
    if (id !== null) {
      this.lastEventId = id;
    }
    switch (event.type) {
      case 'step':
        if (this.finished()) {
          this.stopLocal();
        }
        break;
      case 'order_updated':
        this.orders.update((list) => mergeById(list, [event.order]));
        this.portfolio.set(event.portfolio);
        break;
      case 'player':
        this.playing.set(event.playing);
        this.speed.set(event.speed);
        break;
      case 'paused':
        this.playing.set(false);
        if (event.reason === 'disconnect') {
          this.notice.set('Время остановлено: соединение с сервером прерывалось.');
        } else if (event.reason === 'worker_failure') {
          this.error.set('Время остановлено: сбой расчёта на сервере. Нажмите «Пуск».');
        } else if (event.reason === 'restart') {
          this.notice.set('Время остановлено: сервер перезапускался.');
        }
        break;
      case 'finished':
        this.finished.set(true);
        this.stopLocal();
        this.portfolio.set(event.result.portfolio);
        if (event.result.orders) {
          this.orders.update((list) => mergeById(list, event.result.orders ?? []));
        }
        // После `finished` приходит только `report_ready`; не дождёмся — закроем поток сами.
        this.finishedCloseTimer = setTimeout(() => this.closeEvents(), FINISHED_STREAM_GRACE_MS);
        break;
      case 'report_ready':
        this.reportReady.set(true);
        this.closeEvents();
        break;
    }
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private applyCommandResult(result: ArenaCommandResult, successText: string): void {
    this.orders.set(result.partial ? mergeById(this.orders(), result.orders) : result.orders);
    this.portfolio.set(result.portfolio);
    if (result.accepted) {
      this.notice.set(successText);
    } else {
      this.error.set(formatRejectReason(result.reason, result.field));
    }
  }

  private startTimer(): void {
    this.stopTimer();
    const intervalMs = Math.max(10, Math.round(1000 / this.speed()));
    this.timerId = setInterval(() => {
      if (!this.playing() || this.stepping) {
        return;
      }
      void this.stepOnce(true);
    }, intervalMs);
  }

  private stopTimer(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}

function messageOf(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    return errorMessage(err, fallback);
  }
  return err instanceof Error ? err.message : fallback;
}

/** Влить изменённые элементы в список по `id`: существующие заменить, новые добавить в конец. */
function mergeById<T extends { readonly id: string }>(
  current: readonly T[],
  incoming: readonly T[],
): readonly T[] {
  const byId = new Map(incoming.map((item) => [item.id, item]));
  const merged = current.map((item) => byId.get(item.id) ?? item);
  const known = new Set(current.map((item) => item.id));
  return [...merged, ...incoming.filter((item) => !known.has(item.id))];
}

function stripCandleDates(candle: ArenaCandle): ArenaCandle {
  const { dateLabel, fullDateLabel, ...rest } = candle;
  void dateLabel;
  void fullDateLabel;
  return rest;
}

function stripFillDate(fill: ArenaFill): ArenaFill {
  const { dateLabel, ...rest } = fill;
  void dateLabel;
  return rest;
}

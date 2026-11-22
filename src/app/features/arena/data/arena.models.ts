import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export type ArenaSpeed = 1 | 5 | 10 | 100;

export type OrderSide = 'buy' | 'sell';

export type OrderType =
  'market' | 'limit' | 'stop' | 'stop_limit' | 'take_profit' | 'trailing' | 'oco';

export type TimeInForce = 'day' | 'gtc';

export type OrderStatus = 'active' | 'filled' | 'partial' | 'cancelled' | 'expired' | 'rejected';

export type ArenaRejectReason =
  | 'INVALID_PARAMS'
  | 'INSUFFICIENT_CASH'
  | 'INSUFFICIENT_POSITION'
  | 'SESSION_NOT_ACTIVE'
  | 'ORDER_NOT_ACTIVE'
  | 'LIQUIDITY_LIMIT'
  | 'REPLACED'
  | 'DAY_EXPIRED'
  | 'OCO_SIBLING_FILLED'
  | 'POSITION_CLOSED'
  | 'SESSION_END'
  | 'CANCELLED_BY_USER';

export interface ArenaCandle {
  readonly step: number;
  readonly day: number;
  readonly candleInDay: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  readonly dateLabel?: string;
  readonly fullDateLabel?: string;
}

export interface ArenaPaper {
  readonly id: string;
  readonly label: string;
  readonly sector: string;
  readonly candles: readonly ArenaCandle[];
  readonly changePct: number;
  readonly lastPrice: number;
}

export interface ArenaOrder {
  readonly id: string;
  readonly paperId: string;
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly lots: number;
  readonly filledLots: number;
  readonly tif: TimeInForce;
  readonly status: OrderStatus;
  readonly step: number;
  readonly seenStep: number;
  readonly limitPrice?: number;
  readonly stopPrice?: number;
  readonly takeProfitPrice?: number;
  readonly trailingPct?: number;
  readonly peakPrice?: number;
  readonly rejectReason?: ArenaRejectReason;
  readonly rejectField?: string;
  /** Вторая нога OCO («стоп + тейк»). */
  readonly ocoSiblingId?: string;
}

export interface ArenaFill {
  readonly id: string;
  readonly orderId: string;
  readonly paperId: string;
  readonly step: number;
  readonly day: number;
  readonly candleInDay: number;
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly lots: number;
  readonly price: number;
  readonly amountPct: number;
  readonly costPct: number;
  readonly dateLabel?: string;
  readonly note?: string;
}

export interface ArenaPosition {
  readonly paperId: string;
  readonly lots: number;
  readonly avgPrice: number | null;
  readonly pnlPct: number;
  readonly valuePct: number;
}

export interface ArenaPortfolio {
  readonly equityPct: number;
  readonly cashPct: number;
  readonly investedPct: number;
  readonly pnlPct: number;
  readonly costsPct: number;
  readonly equityRub?: number;
  readonly cashRub?: number;
  readonly investedRub?: number;
  readonly pnlRub?: number;
  readonly costsRub?: number;
  readonly positions: Readonly<Record<string, ArenaPosition>>;
}

export interface ArenaSnapshot {
  readonly sessionId: string;
  readonly blind: boolean;
  readonly step: number;
  readonly totalSteps: number;
  readonly day: number;
  readonly totalDays: number;
  readonly finished: boolean;
  readonly papers: readonly ArenaPaper[];
  readonly portfolio: ArenaPortfolio;
  readonly orders: readonly ArenaOrder[];
  readonly fills: readonly ArenaFill[];
  /** Состояние плеера на сервере (INV-8); у заглушек и воспроизведения не задано. */
  readonly playing?: boolean;
  readonly speed?: ArenaSpeed;
  /** Номер последнего события потока, учтённого в снимке (INV-8); `null` — сервер не сообщил. */
  readonly lastEventId?: number | null;
}

export interface ArenaPaperStat {
  readonly changePct: number;
  readonly lastPrice: number;
}

export interface ArenaStepResult {
  readonly step: number;
  readonly day: number;
  readonly finished: boolean;
  /** Последняя свеча пачки по бумаге. */
  readonly bars: Readonly<Record<string, ArenaCandle>>;
  /** Все свечи пачки по бумаге (на ×10 и ×100 за такт проходит несколько); у заглушек не задано. */
  readonly batches?: Readonly<Record<string, readonly ArenaCandle[]>>;
  /** `orders` и `fills` — только изменения за шаг (результат сервера), а не полный список: вливать по id. */
  readonly partial?: boolean;
  readonly paperStats: Readonly<Record<string, ArenaPaperStat>>;
  readonly portfolio: ArenaPortfolio;
  readonly orders: readonly ArenaOrder[];
  readonly fills: readonly ArenaFill[];
}

export interface PlaceOrderCommand {
  readonly seenStep: number;
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

export interface CancelOrderCommand {
  readonly seenStep: number;
  readonly orderId: string;
}

export interface ReplaceOrderCommand {
  readonly seenStep: number;
  readonly orderId: string;
  readonly lots: number;
  readonly tif: TimeInForce;
  readonly limitPrice?: number;
  readonly stopPrice?: number;
  readonly takeProfitPrice?: number;
  readonly trailingPct?: number;
}

export interface EstimateOrderCommand {
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

export interface OrderEstimateLeg {
  readonly type: OrderType;
  readonly canPlace: boolean;
  readonly reason?: ArenaRejectReason;
  readonly field?: string;
  readonly amountPct: number;
  readonly commissionPct: number;
  readonly requiredCashPct: number;
}

export interface OrderEstimateResult {
  readonly amountPct: number;
  /** Известный заранее отказ: `false` — заявку ядро не примет (причина в `reason`). */
  readonly canPlace?: boolean;
  readonly reason?: ArenaRejectReason;
  readonly field?: string;
  readonly commissionPct?: number;
  readonly requiredCashPct?: number;
  /** Оценка по ногам: у OCO — стоп и тейк-профит отдельно. */
  readonly legs?: readonly OrderEstimateLeg[];
}

export interface ArenaCommandResult {
  readonly accepted: boolean;
  readonly reason?: ArenaRejectReason;
  readonly field?: string;
  readonly order?: ArenaOrder;
  readonly orders: readonly ArenaOrder[];
  /** `orders` — только затронутые заявки (их надо влить в список по id), а не весь список. */
  readonly partial?: boolean;
  readonly portfolio: ArenaPortfolio;
}

export interface ArenaFinishResult {
  readonly sessionId: string;
  readonly finishedAtStep: number;
  readonly finishedAtDay: number;
  readonly portfolio: ArenaPortfolio;
  readonly orders?: readonly ArenaOrder[];
  readonly partial?: boolean;
}

export interface ArenaPlayerState {
  readonly playing: boolean;
  readonly speed: ArenaSpeed;
  readonly step: number;
  readonly day: number;
  readonly finished: boolean;
  readonly stepResult: ArenaStepResult | null;
}

export type PlayerAction = 'play' | 'pause' | 'step' | 'speed';

export type ArenaPauseReason = 'user' | 'disconnect' | 'worker_failure' | 'restart';

/** События SSE (`SessionEvent`), приведённые к моделям экрана. `eventId` — номер события в сессии. */
export type ArenaEvent =
  | { readonly type: 'step'; readonly eventId: number | null; readonly result: ArenaStepResult }
  | {
      readonly type: 'order_updated';
      readonly eventId: number | null;
      readonly order: ArenaOrder;
      readonly portfolio: ArenaPortfolio;
    }
  | { readonly type: 'paused'; readonly eventId: number | null; readonly reason: ArenaPauseReason }
  | {
      readonly type: 'player';
      readonly eventId: number | null;
      readonly playing: boolean;
      readonly speed: ArenaSpeed;
    }
  | {
      readonly type: 'finished';
      readonly eventId: number | null;
      readonly result: ArenaFinishResult;
    }
  | { readonly type: 'report_ready'; readonly eventId: number | null }
  /** Поток закрыт сервером окончательно (401, 404…): состояние и причину покажет перечитанный снимок. */
  | { readonly type: 'stream_failed'; readonly status: number };

export interface ArenaApi {
  /**
   * Время ведёт сервер: плеер управляется командами, шаги приходят потоком событий.
   * Без флага (заглушки, воспроизведение) шаги по таймеру делает клиент.
   */
  readonly serverDriven?: boolean;
  /** Клиентский таймер может брать пачку шагов за команду (воспроизведение на высоких скоростях). */
  readonly batchStep?: boolean;
  control?(action: PlayerAction, speed?: ArenaSpeed): Promise<ArenaPlayerState>;
  /** Поток событий с номера `lastEventId` (из снимка): сервер досылает всё, что было после него. */
  events?(lastEventId: number | null): Observable<ArenaEvent>;
  getSnapshot(sessionId?: string): Promise<ArenaSnapshot>;
  /** `count` — сколько шагов пройти за одну команду; учитывается, только если `batchStep`. */
  step(count?: number): Promise<ArenaStepResult>;
  estimateOrder(command: EstimateOrderCommand): Promise<OrderEstimateResult>;
  placeOrder(command: PlaceOrderCommand): Promise<ArenaCommandResult>;
  cancelOrder(command: CancelOrderCommand): Promise<ArenaCommandResult>;
  replaceOrder(command: ReplaceOrderCommand): Promise<ArenaCommandResult>;
  finishSession(): Promise<ArenaFinishResult>;
}

export const ARENA_API = new InjectionToken<ArenaApi>('ARENA_API');

export const ORDER_TYPE_LABELS: Readonly<Record<OrderType, string>> = {
  market: 'Рыночная',
  limit: 'Лимитная',
  stop: 'Стоп-рыночная',
  stop_limit: 'Стоп-лимитная',
  take_profit: 'Тейк-профит',
  trailing: 'Трейлинг-стоп',
  oco: 'OCO: стоп + тейк',
};

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  active: 'Активна',
  filled: 'Исполнена',
  partial: 'Частично исполнена',
  cancelled: 'Отменена',
  expired: 'Истёк срок',
  rejected: 'Отклонена',
};

const CLOSED_ORDER_STATUSES = new Set<OrderStatus>(['cancelled', 'rejected', 'expired']);

/** Остаток частично исполненной лимитной заявки остаётся активным, если нет причины снятия. */
export function isOrderActive(order: ArenaOrder): boolean {
  return (
    order.status === 'active' ||
    (order.status === 'partial' && !order.rejectReason && order.filledLots < order.lots)
  );
}

export function isOrderClosed(order: ArenaOrder): boolean {
  return (
    CLOSED_ORDER_STATUSES.has(order.status) ||
    (order.status === 'partial' && Boolean(order.rejectReason))
  );
}

export const ARENA_SPEEDS: readonly ArenaSpeed[] = [1, 5, 10, 100];

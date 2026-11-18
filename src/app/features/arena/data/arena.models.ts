import { InjectionToken } from '@angular/core';

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
  | 'LIQUIDITY_LIMIT';

export interface ArenaCandle {
  readonly step: number;
  readonly day: number;
  readonly candleInDay: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
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
}

export interface ArenaPaperStat {
  readonly changePct: number;
  readonly lastPrice: number;
}

export interface ArenaStepResult {
  readonly step: number;
  readonly day: number;
  readonly finished: boolean;
  readonly bars: Readonly<Record<string, ArenaCandle>>;
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
  readonly lots: number;
}

export interface OrderEstimateResult {
  readonly amountPct: number;
}

export interface ArenaCommandResult {
  readonly accepted: boolean;
  readonly reason?: ArenaRejectReason;
  readonly field?: string;
  readonly order?: ArenaOrder;
  readonly orders: readonly ArenaOrder[];
  readonly portfolio: ArenaPortfolio;
}

export interface ArenaFinishResult {
  readonly sessionId: string;
  readonly finishedAtStep: number;
  readonly finishedAtDay: number;
  readonly portfolio: ArenaPortfolio;
}

export interface ArenaApi {
  getSnapshot(): Promise<ArenaSnapshot>;
  step(): Promise<ArenaStepResult>;
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
  partial: 'Частично',
  cancelled: 'Отменена',
  expired: 'Истёк срок',
  rejected: 'Отклонена',
};

export const ARENA_SPEEDS: readonly ArenaSpeed[] = [1, 5, 10, 100];

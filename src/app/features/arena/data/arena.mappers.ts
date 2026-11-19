import { BlindCandle } from '../../../api/models/blind-candle';
import { BlindFill } from '../../../api/models/blind-fill';
import { BlindOrder } from '../../../api/models/blind-order';
import { BlindPortfolio } from '../../../api/models/blind-portfolio';
import { FinishResult } from '../../../api/models/finish-result';
import { OpenCandle } from '../../../api/models/open-candle';
import { OpenFill } from '../../../api/models/open-fill';
import { OpenOrder } from '../../../api/models/open-order';
import { OpenPortfolio } from '../../../api/models/open-portfolio';
import { OrderEstimate } from '../../../api/models/order-estimate';
import { OrderCommandResult } from '../../../api/models/order-command-result';
import { PaperStat } from '../../../api/models/paper-stat';
import { PlayerState } from '../../../api/models/player-state';
import { SessionEvent } from '../../../api/models/session-event';
import { Snapshot } from '../../../api/models/snapshot';
import { StepResult } from '../../../api/models/step-result';
import {
  ArenaCandle,
  ArenaEvent,
  ArenaFill,
  ArenaFinishResult,
  ArenaOrder,
  ArenaPaper,
  OrderEstimateResult,
  ArenaPlayerState,
  ArenaPortfolio,
  ArenaPosition,
  ArenaSnapshot,
  ArenaSpeed,
  ArenaStepResult,
  ArenaCommandResult,
  ArenaPaperStat,
} from './arena.models';

/**
 * Цены, проценты и суммы приходят десятичными строками (INV-6). Число нужно графику и подписям,
 * арифметики над ним клиент не делает.
 */
export function num(value: string): number {
  return Number(value);
}

function numOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function opt(value: string | null): number | undefined {
  return value === null ? undefined : Number(value);
}

/** Ключ бумаги на экране: в слепом режиме — индекс в сессии, в раскрытом — id из каталога (INV-7). */
export function paperKeyOfBlind(paperIndex: number): string {
  return String(paperIndex);
}

const MOSCOW_DATE_TIME = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const MOSCOW_DATE = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function mapBlindCandle(candle: BlindCandle): ArenaCandle {
  return {
    step: candle.step,
    day: candle.day,
    candleInDay: candle.candleInDay,
    open: num(candle.open),
    high: num(candle.high),
    low: num(candle.low),
    close: num(candle.close),
    volume: num(candle.volume),
  };
}

export function mapOpenCandle(candle: OpenCandle): ArenaCandle {
  return {
    step: candle.step,
    day: candle.day,
    candleInDay: candle.candleInDay,
    open: num(candle.open),
    high: num(candle.high),
    low: num(candle.low),
    close: num(candle.close),
    volume: candle.volume,
    dateLabel: MOSCOW_DATE.format(new Date(candle.openedAt)),
    fullDateLabel: MOSCOW_DATE_TIME.format(new Date(candle.openedAt)).replace(',', ''),
  };
}

export function mapOrder(order: BlindOrder | OpenOrder): ArenaOrder {
  return {
    id: order.id,
    paperId: order.mode === 'BLIND' ? paperKeyOfBlind(order.paperIndex) : order.paperId,
    side: order.side,
    type: order.type,
    lots: order.lots,
    filledLots: order.filledLots,
    tif: order.tif,
    status: order.status,
    step: order.step,
    seenStep: order.seenStep,
    limitPrice: opt(order.limitPrice),
    stopPrice: opt(order.stopPrice),
    takeProfitPrice: opt(order.takeProfitPrice),
    trailingPct: opt(order.trailingPct),
    peakPrice: opt(order.trailingStopLevel),
    rejectReason: order.reason ?? undefined,
    rejectField: order.rejectField ?? undefined,
    ocoSiblingId: order.ocoSiblingId ?? undefined,
  };
}

export function mapFill(fill: BlindFill | OpenFill): ArenaFill {
  const common = {
    id: fill.id,
    orderId: fill.orderId,
    step: fill.step,
    day: fill.day,
    candleInDay: fill.candleInDay,
    side: fill.side,
    type: fill.type,
    lots: fill.lots,
    price: num(fill.price),
    note: fill.stopAndTakeSameBar ? 'Стоп и тейк на одной свече — исполнен стоп' : undefined,
  };
  if ('paperIndex' in fill) {
    return {
      ...common,
      paperId: paperKeyOfBlind(fill.paperIndex),
      amountPct: num(fill.amountPct),
      costPct: num(fill.costPct),
    };
  }
  return {
    ...common,
    paperId: fill.paperId,
    amountPct: num(fill.amountPct),
    costPct: num(fill.costPct),
    dateLabel: MOSCOW_DATE_TIME.format(new Date(fill.executedAt)).replace(',', ''),
  };
}

export function mapPortfolio(portfolio: BlindPortfolio | OpenPortfolio): ArenaPortfolio {
  const positions: Record<string, ArenaPosition> = {};
  for (const position of portfolio.positions) {
    const key = 'paperIndex' in position ? paperKeyOfBlind(position.paperIndex) : position.paperId;
    positions[key] = {
      paperId: key,
      lots: position.lots,
      avgPrice: numOrNull(position.avgPrice),
      pnlPct: num(position.pnlPct),
      valuePct: num(position.valuePct),
    };
  }
  const base = {
    equityPct: num(portfolio.equityPct),
    cashPct: num(portfolio.cashPct),
    investedPct: num(portfolio.investedPct),
    pnlPct: num(portfolio.pnlPct),
    costsPct: num(portfolio.costsPct),
    positions,
  };
  if (portfolio.mode === 'BLIND') {
    return base;
  }
  return {
    ...base,
    equityRub: num(portfolio.equity),
    cashRub: num(portfolio.cash),
    investedRub: num(portfolio.invested),
    pnlRub: num(portfolio.pnl),
    costsRub: num(portfolio.costs),
  };
}

function mapStat(stat: PaperStat, fallbackPrice: number): ArenaPaperStat {
  return {
    changePct: stat.changePct === null ? 0 : num(stat.changePct),
    lastPrice: stat.lastPrice === null ? fallbackPrice : num(stat.lastPrice),
  };
}

/** Номер события потока: строка `eventId`/`id:` или число; не число — `null`. */
export function parseEventId(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function mapSnapshot(snapshot: Snapshot): ArenaSnapshot {
  const papers: ArenaPaper[] =
    snapshot.mode === 'BLIND'
      ? snapshot.papers.map((paper) => {
          const candles = paper.candles.map(mapBlindCandle);
          return {
            id: paperKeyOfBlind(paper.paperIndex),
            label: paper.label,
            sector: paper.sector,
            candles,
            ...mapStat(paper.stat, candles.at(-1)?.close ?? 0),
          };
        })
      : snapshot.papers.map((paper) => {
          const candles = paper.candles.map(mapOpenCandle);
          return {
            id: paper.id,
            label: paper.ticker,
            sector: paper.sector,
            candles,
            ...mapStat(paper.stat, candles.at(-1)?.close ?? 0),
          };
        });
  return {
    sessionId: snapshot.sessionId,
    blind: snapshot.mode === 'BLIND',
    step: snapshot.step,
    totalSteps: snapshot.totalSteps,
    day: snapshot.day,
    totalDays: snapshot.totalDays,
    finished: snapshot.finished,
    papers,
    portfolio: mapPortfolio(snapshot.portfolio),
    orders: (snapshot.orders as (BlindOrder | OpenOrder)[]).map(mapOrder),
    fills: (snapshot.fills as (BlindFill | OpenFill)[]).map(mapFill),
    lastEventId: parseEventId((snapshot as { lastEventId?: string | number | null }).lastEventId),
    playing: snapshot.playing ?? undefined,
    speed: (snapshot.speed ?? undefined) as ArenaSpeed | undefined,
  };
}

export function mapStepResult(result: StepResult): ArenaStepResult {
  const batches: Record<string, readonly ArenaCandle[]> = {};
  const bars: Record<string, ArenaCandle> = {};
  const rawBars: Record<string, (BlindCandle | OpenCandle)[]> = result.bars;
  for (const [key, list] of Object.entries(rawBars)) {
    const mapped = list.map((candle) =>
      result.mode === 'BLIND'
        ? mapBlindCandle(candle as BlindCandle)
        : mapOpenCandle(candle as OpenCandle),
    );
    const last = mapped.at(-1);
    if (last) {
      batches[key] = mapped;
      bars[key] = last;
    }
  }
  const paperStats: Record<string, ArenaPaperStat> = {};
  for (const [key, stat] of Object.entries(result.paperStats)) {
    paperStats[key] = mapStat(stat, bars[key]?.close ?? 0);
  }
  return {
    step: result.step,
    day: result.day,
    finished: result.finished,
    bars,
    batches,
    paperStats,
    partial: true,
    portfolio: mapPortfolio(result.portfolio),
    orders: (result.orders as (BlindOrder | OpenOrder)[]).map(mapOrder),
    fills: (result.fills as (BlindFill | OpenFill)[]).map(mapFill),
  };
}

export function mapPlayerState(state: PlayerState): ArenaPlayerState {
  return {
    playing: state.playing,
    speed: state.speed as ArenaSpeed,
    step: state.step,
    day: state.day,
    finished: state.finished,
    stepResult: state.stepResult === null ? null : mapStepResult(state.stepResult),
  };
}

export function mapCommandResult(result: OrderCommandResult): ArenaCommandResult {
  return {
    accepted: result.accepted,
    reason: result.reason ?? undefined,
    field: result.field ?? undefined,
    order: result.order === null ? undefined : mapOrder(result.order),
    orders: (result.orders as (BlindOrder | OpenOrder)[]).map(mapOrder),
    partial: true,
    portfolio: mapPortfolio(result.portfolio),
  };
}

export function mapFinishResult(result: FinishResult): ArenaFinishResult {
  return {
    sessionId: result.sessionId,
    finishedAtStep: result.finishedAtStep,
    finishedAtDay: result.finishedAtDay,
    portfolio: mapPortfolio(result.portfolio),
    orders: (result.orders as (BlindOrder | OpenOrder)[]).map(mapOrder),
    partial: true,
  };
}

export function mapEstimate(estimate: OrderEstimate): OrderEstimateResult {
  return {
    amountPct: num(estimate.amountPct),
    canPlace: estimate.canPlace,
    reason: estimate.reason ?? undefined,
    field: estimate.field ?? undefined,
    commissionPct: num(estimate.commissionPct),
    requiredCashPct: num(estimate.requiredCashPct),
    legs: estimate.legs.map((leg) => ({
      type: leg.type,
      canPlace: leg.canPlace,
      reason: leg.reason ?? undefined,
      field: leg.field ?? undefined,
      amountPct: num(leg.amountPct),
      commissionPct: num(leg.commissionPct),
      requiredCashPct: num(leg.requiredCashPct),
    })),
  };
}

/** SSE `SessionEvent` → событие экрана; неизвестный тип пропускаем (контракт может расти). */
export function mapEvent(event: SessionEvent): ArenaEvent | null {
  const eventId = parseEventId(event.eventId);
  switch (event.type) {
    case 'step':
      return { type: 'step', eventId, result: mapStepResult(event.result) };
    case 'order_updated':
      return {
        type: 'order_updated',
        eventId,
        order: mapOrder(event.order),
        portfolio: mapPortfolio(event.portfolio),
      };
    case 'paused':
      return { type: 'paused', eventId, reason: event.reason };
    case 'player':
      return { type: 'player', eventId, playing: event.playing, speed: event.speed as ArenaSpeed };
    case 'finished':
      return { type: 'finished', eventId, result: mapFinishResult(event.result) };
    case 'report_ready':
      return { type: 'report_ready', eventId };
    default:
      return null;
  }
}

/** Число → десятичная строка цены контракта (`^\d+(\.\d{1,9})?$`), без экспоненты и хвостовых нулей. */
export function toPriceString(value: number): string {
  return toDecimalString(value, 9);
}

/** Число → десятичная строка процента контракта (до 6 знаков). */
export function toPctString(value: number): string {
  return toDecimalString(value, 6);
}

function toDecimalString(value: number, digits: number): string {
  const fixed = value.toFixed(digits);
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

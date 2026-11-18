import { Injectable } from '@angular/core';
import {
  ArenaApi,
  ArenaCandle,
  ArenaCommandResult,
  ArenaFill,
  ArenaFinishResult,
  ArenaOrder,
  ArenaPaper,
  ArenaPaperStat,
  ArenaPortfolio,
  ArenaPosition,
  ArenaRejectReason,
  ArenaSnapshot,
  ArenaStepResult,
  CancelOrderCommand,
  EstimateOrderCommand,
  OrderEstimateResult,
  PlaceOrderCommand,
  ReplaceOrderCommand,
} from './arena.models';

interface PaperConfig {
  readonly id: string;
  readonly label: string;
  readonly sector: string;
  readonly drift: number;
  readonly volatility: number;
  readonly phase: number;
}

const PAPER_CONFIGS: readonly PaperConfig[] = [
  {
    id: 'A',
    label: 'Бумага A',
    sector: 'Нефть и газ',
    drift: 0.0018,
    volatility: 0.018,
    phase: 0.4,
  },
  { id: 'B', label: 'Бумага B', sector: 'Финансы', drift: 0.001, volatility: 0.022, phase: 1.7 },
  { id: 'C', label: 'Бумага C', sector: 'IT', drift: 0.0025, volatility: 0.026, phase: 2.9 },
];

const WARMUP_BARS = 20;
const TOTAL_DAYS = 60;
const LAST_STEP = TOTAL_DAYS - 1;
const COMMISSION_RATE = 0.003;
const LOT_CAPITAL_WEIGHT = 0.01;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function generateCandles(cfg: PaperConfig): ArenaCandle[] {
  const raw: {
    step: number;
    day: number;
    candleInDay: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[] = [];

  let price = 100;
  for (let i = 0; i < WARMUP_BARS + TOTAL_DAYS; i++) {
    const step = i - WARMUP_BARS;
    const day = step < 0 ? 0 : step + 1;
    const candleInDay = step < 0 ? i + 1 : 1;

    const wave =
      Math.sin((i + 1) * 0.43 + cfg.phase) * cfg.volatility +
      Math.cos((i + 1) * 0.17 + cfg.phase * 2) * (cfg.volatility * 0.6);
    const open = price;
    const close = Math.max(20, open * (1 + cfg.drift + wave));
    const spread = Math.max(open, close) * (cfg.volatility * 0.55);
    const high =
      Math.max(open, close) + spread * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.3 + cfg.phase)));
    const low = Math.max(
      10,
      Math.min(open, close) - spread * (0.4 + 0.6 * Math.abs(Math.cos(i * 1.1 + cfg.phase))),
    );
    const volume = Math.round(80 + 60 * Math.abs(Math.sin(i * 0.7 + cfg.phase)));

    raw.push({ step, day, candleInDay, open, high, low, close, volume });
    price = close;
  }

  // INV-7 (decisions.md, «Слепой режим»): P0 = open шага 0, V_ref = средний объём баров прогрева.
  const stepZeroBar = raw[WARMUP_BARS];
  const priceScale = 100 / stepZeroBar.open;
  const warmupVolumeAvg =
    raw.slice(0, WARMUP_BARS).reduce((sum, b) => sum + b.volume, 0) / WARMUP_BARS || 1;

  return raw.map((bar) => ({
    step: bar.step,
    day: bar.day,
    candleInDay: bar.candleInDay,
    open: round2(bar.open * priceScale),
    high: round2(bar.high * priceScale),
    low: round2(bar.low * priceScale),
    close: round2(bar.close * priceScale),
    volume: round2((100 * bar.volume) / warmupVolumeAvg),
  }));
}

@Injectable()
export class StubArenaApi implements ArenaApi {
  private readonly sessionId = 'S-0104';
  private readonly allCandles = new Map<string, readonly ArenaCandle[]>();
  private cursor = 0;
  private finished = false;
  private cashPct = 100;
  private costsPct = 0;
  private readonly positions = new Map<string, { lots: number; totalCostPct: number }>();
  private orders: ArenaOrder[] = [];
  private fills: ArenaFill[] = [];
  private nextOrderSeq = 1;
  private nextFillSeq = 1;

  constructor() {
    for (const cfg of PAPER_CONFIGS) {
      this.allCandles.set(cfg.id, generateCandles(cfg));
      this.positions.set(cfg.id, { lots: 0, totalCostPct: 0 });
    }
  }

  async getSnapshot(): Promise<ArenaSnapshot> {
    return {
      sessionId: this.sessionId,
      blind: true,
      step: this.cursor,
      totalSteps: LAST_STEP,
      day: this.cursor + 1,
      totalDays: TOTAL_DAYS,
      finished: this.finished,
      papers: this.buildVisiblePapers(),
      portfolio: this.buildPortfolio(),
      orders: [...this.orders],
      fills: [...this.fills],
    };
  }

  async step(): Promise<ArenaStepResult> {
    if (!this.finished && this.cursor < LAST_STEP) {
      this.cursor += 1;
      this.executeMarketOrdersAtCursor();
      if (this.cursor >= LAST_STEP) {
        this.finished = true;
      }
    }

    const bars: Record<string, ArenaCandle> = {};
    const paperStats: Record<string, ArenaPaperStat> = {};
    for (const cfg of PAPER_CONFIGS) {
      bars[cfg.id] = this.candleAt(cfg.id, this.cursor);
      paperStats[cfg.id] = this.computePaperStat(cfg.id);
    }

    return {
      step: this.cursor,
      day: this.cursor + 1,
      finished: this.finished,
      bars,
      paperStats,
      portfolio: this.buildPortfolio(),
      orders: [...this.orders],
      fills: [...this.fills],
    };
  }

  async estimateOrder(command: EstimateOrderCommand): Promise<OrderEstimateResult> {
    if (
      !this.allCandles.has(command.paperId) ||
      !Number.isFinite(command.lots) ||
      command.lots <= 0
    ) {
      return { amountPct: 0 };
    }
    const close = this.candleAt(command.paperId, this.cursor).close;
    return { amountPct: round2(command.lots * close * LOT_CAPITAL_WEIGHT) };
  }

  async placeOrder(command: PlaceOrderCommand): Promise<ArenaCommandResult> {
    if (this.finished) {
      return this.reject('SESSION_NOT_ACTIVE');
    }
    if (
      !Number.isInteger(command.seenStep) ||
      command.seenStep < 0 ||
      command.seenStep > this.cursor
    ) {
      return this.reject('INVALID_PARAMS', 'seenStep');
    }
    if (!Number.isInteger(command.lots) || command.lots < 1) {
      return this.reject('INVALID_PARAMS', 'lots');
    }
    if (!this.allCandles.has(command.paperId)) {
      return this.reject('INVALID_PARAMS', 'paperId');
    }

    const validation = this.validateOrder(command);
    if (validation) {
      return this.reject(validation.reason, validation.field);
    }

    const currentClose = this.candleAt(command.paperId, this.cursor).close;
    const order: ArenaOrder = {
      id: `ORD-${this.nextOrderSeq++}`,
      paperId: command.paperId,
      side: command.side,
      type: command.type,
      lots: command.lots,
      filledLots: 0,
      tif: command.tif,
      status: 'active',
      step: this.cursor,
      seenStep: command.seenStep,
      limitPrice: command.limitPrice,
      stopPrice: command.stopPrice,
      takeProfitPrice: command.takeProfitPrice,
      trailingPct: command.trailingPct,
      peakPrice: command.type === 'trailing' ? currentClose : undefined,
    };

    this.orders = [order, ...this.orders];
    return {
      accepted: true,
      order,
      orders: [...this.orders],
      portfolio: this.buildPortfolio(),
    };
  }

  async cancelOrder(command: CancelOrderCommand): Promise<ArenaCommandResult> {
    if (this.finished) {
      return this.reject('SESSION_NOT_ACTIVE');
    }
    if (
      !Number.isInteger(command.seenStep) ||
      command.seenStep < 0 ||
      command.seenStep > this.cursor
    ) {
      return this.reject('INVALID_PARAMS', 'seenStep');
    }
    const existing = this.orders.find((o) => o.id === command.orderId);
    if (!existing || existing.status !== 'active') {
      return this.reject('ORDER_NOT_ACTIVE');
    }

    this.orders = this.orders.map((o) =>
      o.id === command.orderId ? { ...o, status: 'cancelled' as const } : o,
    );

    return {
      accepted: true,
      orders: [...this.orders],
      portfolio: this.buildPortfolio(),
    };
  }

  async replaceOrder(command: ReplaceOrderCommand): Promise<ArenaCommandResult> {
    if (this.finished) {
      return this.reject('SESSION_NOT_ACTIVE');
    }
    if (
      !Number.isInteger(command.seenStep) ||
      command.seenStep < 0 ||
      command.seenStep > this.cursor
    ) {
      return this.reject('INVALID_PARAMS', 'seenStep');
    }
    if (!Number.isInteger(command.lots) || command.lots < 1) {
      return this.reject('INVALID_PARAMS', 'lots');
    }

    const existing = this.orders.find((o) => o.id === command.orderId);
    if (!existing || existing.status !== 'active') {
      return this.reject('ORDER_NOT_ACTIVE');
    }

    const validation = this.validateOrder({
      ...existing,
      seenStep: command.seenStep,
      lots: command.lots,
      tif: command.tif,
      limitPrice: command.limitPrice,
      stopPrice: command.stopPrice,
      takeProfitPrice: command.takeProfitPrice,
      trailingPct: command.trailingPct,
    });
    if (validation) {
      return this.reject(validation.reason, validation.field);
    }

    const replaced: ArenaOrder = {
      ...existing,
      id: `ORD-${this.nextOrderSeq++}`,
      lots: command.lots,
      filledLots: 0,
      tif: command.tif,
      step: this.cursor,
      seenStep: command.seenStep,
      limitPrice: command.limitPrice,
      stopPrice: command.stopPrice,
      takeProfitPrice: command.takeProfitPrice,
      trailingPct: command.trailingPct,
      status: 'active',
    };

    this.orders = [
      replaced,
      ...this.orders.map((o) =>
        o.id === command.orderId ? { ...o, status: 'cancelled' as const } : o,
      ),
    ];

    return {
      accepted: true,
      order: replaced,
      orders: [...this.orders],
      portfolio: this.buildPortfolio(),
    };
  }

  async finishSession(): Promise<ArenaFinishResult> {
    this.finished = true;
    return {
      sessionId: this.sessionId,
      finishedAtStep: this.cursor,
      finishedAtDay: this.cursor + 1,
      portfolio: this.buildPortfolio(),
    };
  }

  private reject(reason: ArenaRejectReason, field?: string): ArenaCommandResult {
    return {
      accepted: false,
      reason,
      field,
      orders: [...this.orders],
      portfolio: this.buildPortfolio(),
    };
  }

  private validateOrder(
    cmd: PlaceOrderCommand,
  ): { reason: ArenaRejectReason; field?: string } | null {
    const currentClose = this.candleAt(cmd.paperId, this.cursor).close;

    if (cmd.type === 'trailing') {
      if (cmd.side !== 'sell') {
        return { reason: 'INVALID_PARAMS', field: 'side' };
      }
      if (cmd.trailingPct == null || cmd.trailingPct <= 0 || cmd.trailingPct > 50) {
        return { reason: 'INVALID_PARAMS', field: 'trailingPct' };
      }
    }

    if (cmd.type === 'oco') {
      if (cmd.side !== 'sell') {
        return { reason: 'INVALID_PARAMS', field: 'side' };
      }
      if (cmd.stopPrice == null || cmd.stopPrice <= 0) {
        return { reason: 'INVALID_PARAMS', field: 'stopPrice' };
      }
      if (
        cmd.takeProfitPrice == null ||
        cmd.takeProfitPrice <= currentClose ||
        cmd.stopPrice >= cmd.takeProfitPrice
      ) {
        return { reason: 'INVALID_PARAMS', field: 'takeProfitPrice' };
      }
    }

    if (cmd.type === 'limit' && (cmd.limitPrice == null || cmd.limitPrice <= 0)) {
      return { reason: 'INVALID_PARAMS', field: 'limitPrice' };
    }
    if (cmd.type === 'stop' && (cmd.stopPrice == null || cmd.stopPrice <= 0)) {
      return { reason: 'INVALID_PARAMS', field: 'stopPrice' };
    }
    if (cmd.type === 'stop_limit') {
      if (cmd.stopPrice == null || cmd.stopPrice <= 0) {
        return { reason: 'INVALID_PARAMS', field: 'stopPrice' };
      }
      if (cmd.limitPrice == null || cmd.limitPrice <= 0) {
        return { reason: 'INVALID_PARAMS', field: 'limitPrice' };
      }
    }
    if (cmd.type === 'take_profit') {
      if (cmd.side !== 'sell') {
        return { reason: 'INVALID_PARAMS', field: 'side' };
      }
      if (cmd.takeProfitPrice == null || cmd.takeProfitPrice <= currentClose) {
        return { reason: 'INVALID_PARAMS', field: 'takeProfitPrice' };
      }
    }

    // Проверка средств/позиции по close последнего бара с комиссией (decisions.md:47).
    if (cmd.side === 'buy') {
      const requiredPct = cmd.lots * currentClose * LOT_CAPITAL_WEIGHT * (1 + COMMISSION_RATE);
      if (requiredPct > this.cashPct) {
        return { reason: 'INSUFFICIENT_CASH' };
      }
    } else {
      const pos = this.positions.get(cmd.paperId)!;
      if (cmd.lots > pos.lots) {
        return { reason: 'INSUFFICIENT_POSITION' };
      }
    }

    return null;
  }

  private executeMarketOrdersAtCursor(): void {
    const updatedOrders: ArenaOrder[] = [];

    for (const order of this.orders) {
      if (order.status !== 'active' || order.type !== 'market') {
        updatedOrders.push(order);
        continue;
      }

      const bar = this.candleAt(order.paperId, this.cursor);
      const execPrice = bar.open;
      const pos = this.positions.get(order.paperId)!;

      if (order.side === 'buy') {
        const unitCost = execPrice * LOT_CAPITAL_WEIGHT * (1 + COMMISSION_RATE);
        const maxAffordableLots = Math.floor(this.cashPct / unitCost);
        const execLots = Math.min(order.lots, maxAffordableLots);

        if (execLots <= 0) {
          updatedOrders.push({
            ...order,
            status: 'rejected',
            rejectReason: 'INSUFFICIENT_CASH',
          });
          continue;
        }

        const amountPct = round2(execLots * execPrice * LOT_CAPITAL_WEIGHT);
        const costPct = round2(amountPct * COMMISSION_RATE);
        this.cashPct = round2(this.cashPct - amountPct - costPct);
        this.costsPct = round2(this.costsPct + costPct);
        pos.lots += execLots;
        pos.totalCostPct = round2(pos.totalCostPct + amountPct);

        this.recordFill(order, bar, execLots, execPrice, amountPct, costPct);
        updatedOrders.push({
          ...order,
          filledLots: execLots,
          status: execLots < order.lots ? 'partial' : 'filled',
          rejectReason: execLots < order.lots ? 'INSUFFICIENT_CASH' : undefined,
        });
      } else {
        const execLots = Math.min(order.lots, pos.lots);
        if (execLots <= 0) {
          updatedOrders.push({
            ...order,
            status: 'rejected',
            rejectReason: 'INSUFFICIENT_POSITION',
          });
          continue;
        }

        const avgCostPerLot = pos.totalCostPct / pos.lots;
        const amountPct = round2(execLots * execPrice * LOT_CAPITAL_WEIGHT);
        const costPct = round2(amountPct * COMMISSION_RATE);
        this.cashPct = round2(this.cashPct + amountPct - costPct);
        this.costsPct = round2(this.costsPct + costPct);
        pos.lots -= execLots;
        pos.totalCostPct = pos.lots === 0 ? 0 : round2(pos.totalCostPct - avgCostPerLot * execLots);

        this.recordFill(order, bar, execLots, execPrice, amountPct, costPct);
        updatedOrders.push({
          ...order,
          filledLots: execLots,
          status: execLots < order.lots ? 'partial' : 'filled',
          rejectReason: execLots < order.lots ? 'INSUFFICIENT_POSITION' : undefined,
        });
      }
    }

    this.orders = updatedOrders;
  }

  private recordFill(
    order: ArenaOrder,
    bar: ArenaCandle,
    lots: number,
    price: number,
    amountPct: number,
    costPct: number,
  ): void {
    const fill: ArenaFill = {
      id: `FILL-${this.nextFillSeq++}`,
      orderId: order.id,
      paperId: order.paperId,
      step: bar.step,
      day: bar.day,
      candleInDay: bar.candleInDay,
      side: order.side,
      type: order.type,
      lots,
      price,
      amountPct,
      costPct,
    };
    this.fills = [fill, ...this.fills];
  }

  private candleAt(paperId: string, step: number): ArenaCandle {
    const list = this.allCandles.get(paperId)!;
    const index = WARMUP_BARS + step;
    return list[Math.max(0, Math.min(list.length - 1, index))];
  }

  private computePaperStat(paperId: string): ArenaPaperStat {
    const startPrice = this.candleAt(paperId, 0).open;
    const lastPrice = this.candleAt(paperId, this.cursor).close;
    return {
      changePct: round2(((lastPrice - startPrice) / startPrice) * 100),
      lastPrice,
    };
  }

  private buildVisiblePapers(): ArenaPaper[] {
    const endIndex = WARMUP_BARS + this.cursor + 1;
    return PAPER_CONFIGS.map((cfg) => {
      const candles = this.allCandles.get(cfg.id)!.slice(0, endIndex);
      const stat = this.computePaperStat(cfg.id);
      return {
        id: cfg.id,
        label: cfg.label,
        sector: cfg.sector,
        candles,
        changePct: stat.changePct,
        lastPrice: stat.lastPrice,
      };
    });
  }

  private buildPortfolio(): ArenaPortfolio {
    const positions: Record<string, ArenaPosition> = {};
    let investedPct = 0;

    for (const cfg of PAPER_CONFIGS) {
      const pos = this.positions.get(cfg.id)!;
      const lastPrice = this.candleAt(cfg.id, this.cursor).close;
      const valuePct = round2(pos.lots * lastPrice * LOT_CAPITAL_WEIGHT);
      const avgPrice =
        pos.lots > 0 ? round2(pos.totalCostPct / (pos.lots * LOT_CAPITAL_WEIGHT)) : null;
      const pnlPct = pos.lots > 0 ? round2(valuePct - pos.totalCostPct) : 0;
      investedPct = round2(investedPct + valuePct);

      positions[cfg.id] = {
        paperId: cfg.id,
        lots: pos.lots,
        avgPrice,
        pnlPct,
        valuePct,
      };
    }

    const equityPct = round2(this.cashPct + investedPct);
    const pnlPct = round2(equityPct - 100);

    return {
      equityPct,
      cashPct: round2(this.cashPct),
      investedPct,
      pnlPct,
      costsPct: round2(this.costsPct),
      positions,
    };
  }
}

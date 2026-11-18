import { Injectable } from '@angular/core';
import {
  ArenaCandle,
  ArenaFill,
  ArenaOrder,
  ArenaPaper,
  ArenaPaperStat,
  ArenaPortfolio,
  ArenaPosition,
  ArenaStepResult,
} from '../../arena/data/arena.models';
import { ReplayApi, ReplaySessionMeta, ReplaySessionResult } from './replay.models';

const INITIAL_CAPITAL_RUB = 1_000_000;
const WARMUP_BARS = 20;
const TOTAL_DAYS = 60;
const LAST_STEP = TOTAL_DAYS - 1;

interface PaperSpec {
  readonly id: string;
  readonly label: string;
  readonly sector: string;
  readonly lotSize: number;
  readonly startPrice: number;
  readonly endPrice: number;
  readonly phase: number;
  readonly anchors: Readonly<Record<number, number>>;
}

const PAPER_SPECS: readonly PaperSpec[] = [
  {
    id: 'SBER',
    label: 'SBER',
    sector: 'Финансы',
    lotSize: 10,
    startPrice: 241.5,
    endPrice: 290.0,
    phase: 0.4,
    anchors: {
      3: 234.4, // F-1 (день 4, 02.03)
      18: 192.0,
      30: 215.5,
      43: 248.0,
      59: 290.0,
    },
  },
  {
    id: 'GAZP',
    label: 'GAZP',
    sector: 'Нефть и газ',
    lotSize: 10,
    startPrice: 214.2,
    endPrice: 210.2,
    phase: 1.7,
    anchors: {
      3: 208.5,
      18: 186.1, // F-2 (день 19, 23.03)
      30: 199.8, // F-3 (день 31, 09.04)
      43: 204.0,
      59: 210.2,
    },
  },
  {
    id: 'YDEX',
    label: 'YDEX',
    sector: 'IT',
    lotSize: 1,
    startPrice: 3120,
    endPrice: 3370,
    phase: 2.9,
    anchors: {
      3: 3040,
      18: 2680,
      30: 2890,
      43: 3015, // F-4 (день 44, 28.04)
      59: 3370,
    },
  },
];

interface JournalOrderSpec {
  readonly order: ArenaOrder;
  readonly resolveStep: number;
  readonly finalStatus: ArenaOrder['status'];
  readonly filledLotsAtResolve: number;
}

const JOURNAL_ORDERS: readonly JournalOrderSpec[] = [
  {
    order: {
      id: 'O-1',
      paperId: 'SBER',
      side: 'buy',
      type: 'market',
      lots: 80,
      filledLots: 0,
      tif: 'day',
      status: 'active',
      step: 2,
      seenStep: 2,
    },
    resolveStep: 3,
    finalStatus: 'filled',
    filledLotsAtResolve: 80,
  },
  {
    order: {
      id: 'O-R1',
      paperId: 'YDEX',
      side: 'buy',
      type: 'market',
      lots: 500,
      filledLots: 0,
      tif: 'day',
      status: 'rejected',
      step: 10,
      seenStep: 10,
      rejectReason: 'INSUFFICIENT_CASH',
    },
    resolveStep: 10,
    finalStatus: 'rejected',
    filledLotsAtResolve: 0,
  },
  {
    order: {
      id: 'O-2',
      paperId: 'GAZP',
      side: 'buy',
      type: 'limit',
      lots: 100,
      filledLots: 0,
      tif: 'gtc',
      status: 'active',
      step: 16,
      seenStep: 16,
      limitPrice: 186.1,
    },
    resolveStep: 18,
    finalStatus: 'partial',
    filledLotsAtResolve: 90,
  },
  {
    order: {
      id: 'O-3',
      paperId: 'GAZP',
      side: 'sell',
      type: 'market',
      lots: 80,
      filledLots: 0,
      tif: 'day',
      status: 'active',
      step: 29,
      seenStep: 29,
    },
    resolveStep: 30,
    finalStatus: 'filled',
    filledLotsAtResolve: 80,
  },
  {
    order: {
      id: 'O-4',
      paperId: 'YDEX',
      side: 'buy',
      type: 'market',
      lots: 40,
      filledLots: 0,
      tif: 'day',
      status: 'active',
      step: 42,
      seenStep: 42,
    },
    resolveStep: 43,
    finalStatus: 'filled',
    filledLotsAtResolve: 40,
  },
];

interface JournalFillSpec {
  readonly fill: Omit<ArenaFill, 'amountPct' | 'costPct'>;
  readonly costRub: number;
}

const JOURNAL_FILLS: readonly JournalFillSpec[] = [
  {
    fill: {
      id: 'F-1',
      orderId: 'O-1',
      paperId: 'SBER',
      step: 3,
      day: 4,
      candleInDay: 1,
      side: 'buy',
      type: 'market',
      lots: 80,
      price: 234.4,
      dateLabel: '02.03',
    },
    costRub: 2_120,
  },
  {
    fill: {
      id: 'F-2',
      orderId: 'O-2',
      paperId: 'GAZP',
      step: 18,
      day: 19,
      candleInDay: 1,
      side: 'buy',
      type: 'limit',
      lots: 90,
      price: 186.1,
      dateLabel: '23.03',
      note: 'частично: лимит ликвидности 10 % объёма свечи',
    },
    costRub: 1_890,
  },
  {
    fill: {
      id: 'F-3',
      orderId: 'O-3',
      paperId: 'GAZP',
      step: 30,
      day: 31,
      candleInDay: 1,
      side: 'sell',
      type: 'market',
      lots: 80,
      price: 199.8,
      dateLabel: '09.04',
    },
    costRub: 1_810,
  },
  {
    fill: {
      id: 'F-4',
      orderId: 'O-4',
      paperId: 'YDEX',
      step: 43,
      day: 44,
      candleInDay: 1,
      side: 'buy',
      type: 'market',
      lots: 40,
      price: 3015,
      dateLabel: '28.04',
    },
    costRub: 1_980,
  },
];

const PINNED_DAY_DATES: Readonly<Record<number, { short: string; full: string }>> = {
  4: { short: '02.03', full: '02.03.2020' },
  19: { short: '23.03', full: '23.03.2020' },
  31: { short: '09.04', full: '09.04.2020' },
  44: { short: '28.04', full: '28.04.2020' },
  60: { short: '21.05', full: '21.05.2020' },
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatUtcDate(date: Date): { short: string; full: string } {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  return { short: `${dd}.${mm}`, full: `${dd}.${mm}.${yyyy}` };
}

function buildStepDates(): Map<number, { short: string; full: string }> {
  const result = new Map<number, { short: string; full: string }>();
  const start = new Date(Date.UTC(2020, 1, 26));

  // Прогрев: 20 торговых дней до 26.02.2020.
  let d = new Date(start.getTime());
  for (let step = -1; step >= -WARMUP_BARS; step--) {
    do {
      d = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
    result.set(step, formatUtcDate(d));
  }

  // Основной период: 60 дней с 26.02.2020 по 21.05.2020.
  const holidayTimestamps = new Set([
    Date.UTC(2020, 2, 9),
    Date.UTC(2020, 4, 1),
    Date.UTC(2020, 4, 11),
  ]);
  d = new Date(start.getTime());
  for (let day = 1; day <= TOTAL_DAYS; day++) {
    const step = day - 1;
    const pinned = PINNED_DAY_DATES[day];
    if (pinned) {
      result.set(step, pinned);
    } else {
      result.set(step, formatUtcDate(d));
    }
    do {
      d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    } while (d.getUTCDay() === 0 || d.getUTCDay() === 6 || holidayTimestamps.has(d.getTime()));
  }

  return result;
}

function buildPaperCandles(
  spec: PaperSpec,
  stepDates: ReadonlyMap<number, { short: string; full: string }>,
): ArenaCandle[] {
  const anchorSteps = Object.keys(spec.anchors)
    .map(Number)
    .sort((a, b) => a - b);

  const targetClose = (step: number): number => {
    if (step in spec.anchors) {
      return spec.anchors[step];
    }
    if (step <= 0) {
      const drift = Math.sin((step + WARMUP_BARS) * 0.35 + spec.phase) * 0.025;
      return spec.startPrice * (1 + drift);
    }
    let prevStep = 0;
    let prevPrice = spec.startPrice;
    let nextStep = LAST_STEP;
    let nextPrice = spec.endPrice;
    for (const s of anchorSteps) {
      if (s < step) {
        prevStep = s;
        prevPrice = spec.anchors[s];
      } else if (s > step) {
        nextStep = s;
        nextPrice = spec.anchors[s];
        break;
      }
    }
    const ratio = (step - prevStep) / Math.max(1, nextStep - prevStep);
    const base = prevPrice + (nextPrice - prevPrice) * ratio;
    const wave = Math.sin(step * 0.45 + spec.phase) * (base * 0.015);
    return base + wave;
  };

  const candles: ArenaCandle[] = [];
  let prevClose = spec.startPrice;

  for (let i = 0; i < WARMUP_BARS + TOTAL_DAYS; i++) {
    const step = i - WARMUP_BARS;
    const day = step < 0 ? 0 : step + 1;
    const candleInDay = step < 0 ? i + 1 : 1;
    const open = step === 0 ? spec.startPrice : prevClose;
    const close = round2(targetClose(step));
    const spread = Math.max(open, close) * 0.012;
    const high = round2(Math.max(open, close) + spread * (0.4 + 0.5 * Math.abs(Math.sin(i))));
    const low = round2(
      Math.max(0.01, Math.min(open, close) - spread * (0.4 + 0.5 * Math.abs(Math.cos(i)))),
    );
    const volume = Math.round(1_200 + 600 * Math.abs(Math.sin(i * 0.7 + spec.phase)));
    const date = stepDates.get(step);

    candles.push({
      step,
      day,
      candleInDay,
      open: round2(open),
      high,
      low,
      close,
      volume,
      dateLabel: date?.short,
      fullDateLabel: date?.full,
    });
    prevClose = close;
  }

  return candles;
}

const SESSION_META_S0103: ReplaySessionMeta = {
  sessionId: 'S-0103',
  blind: true,
  periodLabel: '26.02.2020 — 21.05.2020 · Весна 2020: обвал и отскок',
  regime: 'stress',
  totalSteps: LAST_STEP,
  totalDays: TOTAL_DAYS,
};

@Injectable()
export class StubReplayApi implements ReplayApi {
  private readonly stepDates = buildStepDates();
  private readonly candlesByPaper = new Map<string, readonly ArenaCandle[]>(
    PAPER_SPECS.map((spec) => [spec.id, buildPaperCandles(spec, this.stepDates)]),
  );
  private readonly cursors = new Map<string, number>();

  async loadSession(sessionId: string, initialStep?: number): Promise<ReplaySessionResult> {
    if (sessionId === 'S-0104' || sessionId === 'S-BLIND-ACTIVE') {
      // INV-7: активная слепая сессия не раскрывает тикеры, названия и реальные даты.
      return {
        status: 'NOT_FINISHED',
        sessionId,
        blind: true,
        title: 'Слепая сессия от 18.11.2026',
        createdAt: '18.11.2026 14:20',
        playedDays: 14,
        totalDays: TOTAL_DAYS,
        regime: 'stress',
      };
    }

    if (sessionId === 'S-OPEN-ACTIVE') {
      return {
        status: 'NOT_FINISHED',
        sessionId,
        blind: false,
        title: 'Неслепая сессия от 18.11.2026',
        createdAt: '18.11.2026 14:25',
        playedDays: 10,
        totalDays: TOTAL_DAYS,
        regime: 'medium',
      };
    }

    if (sessionId !== 'S-0103') {
      return { status: 'NOT_FOUND', sessionId };
    }

    const rawStep =
      initialStep !== undefined && Number.isFinite(initialStep) ? Math.trunc(initialStep) : 0;
    const cursor = Math.max(0, Math.min(LAST_STEP, rawStep));
    this.cursors.set(sessionId, cursor);

    return {
      status: 'READY',
      session: SESSION_META_S0103,
      snapshot: {
        sessionId,
        blind: true,
        step: cursor,
        totalSteps: LAST_STEP,
        day: cursor + 1,
        totalDays: TOTAL_DAYS,
        finished: cursor >= LAST_STEP,
        papers: this.buildPapersUpTo(cursor),
        portfolio: this.buildPortfolioAt(cursor),
        orders: this.buildOrdersAt(cursor),
        fills: this.buildFillsAt(cursor),
      },
    };
  }

  async step(sessionId: string): Promise<ArenaStepResult> {
    if (sessionId !== 'S-0103') {
      throw new Error(`Сессия ${sessionId} недоступна для воспроизведения.`);
    }

    const current = this.cursors.get(sessionId) ?? 0;
    const next = Math.min(LAST_STEP, current + 1);
    this.cursors.set(sessionId, next);

    const bars: Record<string, ArenaCandle> = {};
    const paperStats: Record<string, ArenaPaperStat> = {};

    for (const spec of PAPER_SPECS) {
      const candles = this.candlesByPaper.get(spec.id) ?? [];
      const bar = candles.find((c) => c.step === next);
      if (bar) {
        bars[spec.id] = bar;
        paperStats[spec.id] = {
          lastPrice: bar.close,
          changePct: round2(((bar.close - spec.startPrice) / spec.startPrice) * 100),
        };
      }
    }

    return {
      step: next,
      day: next + 1,
      finished: next >= LAST_STEP,
      bars,
      paperStats,
      portfolio: this.buildPortfolioAt(next),
      orders: this.buildOrdersAt(next),
      fills: this.buildFillsAt(next),
    };
  }

  private buildPapersUpTo(step: number): ArenaPaper[] {
    return PAPER_SPECS.map((spec) => {
      const all = this.candlesByPaper.get(spec.id) ?? [];
      // INV-1: выдаём только свечи не дальше текущего курсора.
      const visible = all.filter((c) => c.step <= step);
      const last = visible[visible.length - 1];
      const lastPrice = last ? last.close : spec.startPrice;
      const changePct = round2(((lastPrice - spec.startPrice) / spec.startPrice) * 100);
      return {
        id: spec.id,
        label: spec.label,
        sector: spec.sector,
        candles: visible,
        changePct,
        lastPrice,
      };
    });
  }

  private buildOrdersAt(step: number): ArenaOrder[] {
    return JOURNAL_ORDERS.filter((item) => item.order.step <= step).map((item) => {
      if (step >= item.resolveStep) {
        return {
          ...item.order,
          status: item.finalStatus,
          filledLots: item.filledLotsAtResolve,
        };
      }
      return item.order;
    });
  }

  private buildFillsAt(step: number): ArenaFill[] {
    return JOURNAL_FILLS.filter((item) => item.fill.step <= step).map((item) => {
      const spec = PAPER_SPECS.find((p) => p.id === item.fill.paperId)!;
      const amountRub = item.fill.lots * spec.lotSize * item.fill.price;
      return {
        ...item.fill,
        amountPct: round2((amountRub / INITIAL_CAPITAL_RUB) * 100),
        costPct: round2((item.costRub / INITIAL_CAPITAL_RUB) * 100),
      };
    });
  }

  private buildPortfolioAt(step: number): ArenaPortfolio {
    let cashRub = INITIAL_CAPITAL_RUB;
    let costsRub = 0;
    const holdings = new Map<string, { lots: number; costBasisRub: number }>();

    for (const item of JOURNAL_FILLS) {
      if (item.fill.step > step) {
        continue;
      }
      const spec = PAPER_SPECS.find((p) => p.id === item.fill.paperId)!;
      const tradeValue = item.fill.lots * spec.lotSize * item.fill.price;
      costsRub += item.costRub;

      const cur = holdings.get(spec.id) ?? { lots: 0, costBasisRub: 0 };
      if (item.fill.side === 'buy') {
        cashRub -= tradeValue + item.costRub;
        holdings.set(spec.id, {
          lots: cur.lots + item.fill.lots,
          costBasisRub: cur.costBasisRub + tradeValue,
        });
      } else {
        cashRub += tradeValue - item.costRub;
        const remainingLots = Math.max(0, cur.lots - item.fill.lots);
        const ratio = cur.lots > 0 ? remainingLots / cur.lots : 0;
        holdings.set(spec.id, {
          lots: remainingLots,
          costBasisRub: cur.costBasisRub * ratio,
        });
      }
    }

    let investedRub = 0;
    const positions: Record<string, ArenaPosition> = {};

    for (const spec of PAPER_SPECS) {
      const bar = (this.candlesByPaper.get(spec.id) ?? []).find((c) => c.step === step);
      const price = bar ? bar.close : spec.startPrice;
      const pos = holdings.get(spec.id) ?? { lots: 0, costBasisRub: 0 };
      const marketValueRub = pos.lots * spec.lotSize * price;
      investedRub += marketValueRub;

      const avgPrice = pos.lots > 0 ? round2(pos.costBasisRub / (pos.lots * spec.lotSize)) : null;
      const pnlPct =
        pos.lots > 0 && pos.costBasisRub > 0
          ? round2(((marketValueRub - pos.costBasisRub) / pos.costBasisRub) * 100)
          : 0;

      positions[spec.id] = {
        paperId: spec.id,
        lots: pos.lots,
        avgPrice,
        pnlPct,
        valuePct: round2((marketValueRub / INITIAL_CAPITAL_RUB) * 100),
      };
    }

    const equityRub = Math.round(cashRub + investedRub);
    const pnlRub = equityRub - INITIAL_CAPITAL_RUB;

    return {
      equityPct: round2((equityRub / INITIAL_CAPITAL_RUB) * 100),
      cashPct: round2((cashRub / INITIAL_CAPITAL_RUB) * 100),
      investedPct: round2((investedRub / INITIAL_CAPITAL_RUB) * 100),
      pnlPct: round2((pnlRub / INITIAL_CAPITAL_RUB) * 100),
      costsPct: round2((costsRub / INITIAL_CAPITAL_RUB) * 100),
      equityRub,
      cashRub: Math.round(cashRub),
      investedRub: Math.round(investedRub),
      pnlRub,
      costsRub,
      positions,
    };
  }
}

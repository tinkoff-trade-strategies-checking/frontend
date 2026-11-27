import { formatPct, formatPrice, formatRub } from './arena.format';

export type ArenaDrawingTool = 'none' | 'freehand' | 'hline' | 'trendline' | 'fib' | 'ruler';

export interface ArenaDrawingToolOption {
  readonly id: ArenaDrawingTool;
  readonly label: string;
  readonly hint: string;
}

export const ARENA_DRAWING_TOOLS: readonly ArenaDrawingToolOption[] = [
  { id: 'none', label: 'Курсор', hint: 'Перемещение графика' },
  {
    id: 'freehand',
    label: 'Карандаш',
    hint: 'Зажмите и ведите курсор — свободное рисование на графике',
  },
  {
    id: 'hline',
    label: 'Уровень',
    hint: '1 клик — горизонтальный уровень поддержки/сопротивления',
  },
  {
    id: 'trendline',
    label: 'Тренд',
    hint: 'Перетаскивание или 2 клика — трендовая линия между двумя точками',
  },
  {
    id: 'fib',
    label: 'Фибоначчи',
    hint: 'Перетаскивание или 2 клика — уровни коррекции Фибоначчи',
  },
  {
    id: 'ruler',
    label: 'Линейка',
    hint: 'Перетаскивание или 2 клика — измерение движения цены и баров',
  },
];

export interface DrawingAnchor {
  readonly time: number;
  readonly price: number;
}

export interface FreehandDrawing {
  readonly id: string;
  readonly kind: 'freehand';
  readonly points: readonly DrawingAnchor[];
}

export interface HLineDrawing {
  readonly id: string;
  readonly kind: 'hline';
  readonly price: number;
}

export interface TrendlineDrawing {
  readonly id: string;
  readonly kind: 'trendline';
  readonly start: DrawingAnchor;
  readonly end: DrawingAnchor;
}

export interface FibDrawing {
  readonly id: string;
  readonly kind: 'fib';
  readonly start: DrawingAnchor;
  readonly end: DrawingAnchor;
}

export interface RulerDrawing {
  readonly id: string;
  readonly kind: 'ruler';
  readonly start: DrawingAnchor;
  readonly end: DrawingAnchor;
}

export type ArenaDrawing =
  FreehandDrawing | HLineDrawing | TrendlineDrawing | FibDrawing | RulerDrawing;

export type DrawingsByPaper = Readonly<Record<string, readonly ArenaDrawing[]>>;

export const FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;

export interface FibLevel {
  readonly ratio: number;
  readonly label: string;
  readonly price: number;
}

export interface RulerMetrics {
  readonly priceDelta: number;
  readonly pctDelta: number;
  readonly barsDelta: number;
  readonly isPositive: boolean;
}

export interface ChartCoordinateProjector {
  timeToX(time: number): number | null;
  priceToY(price: number): number | null;
  readonly width: number;
  readonly height: number;
}

export interface ProjectedFreehand {
  readonly id: string;
  readonly kind: 'freehand';
  readonly pointsAttr: string;
  readonly pointCount: number;
}

export interface ProjectedHLine {
  readonly id: string;
  readonly kind: 'hline';
  readonly y: number;
  readonly width: number;
  readonly priceLabel: string;
}

export interface ProjectedTrendline {
  readonly id: string;
  readonly kind: 'trendline';
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface ProjectedFibLevel {
  readonly ratio: number;
  readonly label: string;
  readonly priceLabel: string;
  readonly y: number;
}

export interface ProjectedFibBand {
  readonly y: number;
  readonly height: number;
  readonly index: number;
}

export interface ProjectedFib {
  readonly id: string;
  readonly kind: 'fib';
  readonly x1: number;
  readonly x2: number;
  readonly levels: readonly ProjectedFibLevel[];
  readonly bands: readonly ProjectedFibBand[];
}

export interface ProjectedRuler {
  readonly id: string;
  readonly kind: 'ruler';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly labelX: number;
  readonly labelY: number;
  readonly labelWidth: number;
  readonly labelHeight: number;
  readonly isPositive: boolean;
  readonly lines: readonly [string, string, string];
}

export type ProjectedDrawing =
  ProjectedFreehand | ProjectedHLine | ProjectedTrendline | ProjectedFib | ProjectedRuler;

const RULER_LABEL_WIDTH = 152;
const RULER_LABEL_HEIGHT = 54;

export function computeFibLevels(startPrice: number, endPrice: number): readonly FibLevel[] {
  const span = startPrice - endPrice;
  return FIB_RATIOS.map((ratio) => {
    const pct = ratio * 100;
    const label = Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
    return {
      ratio,
      label,
      price: endPrice + span * ratio,
    };
  });
}

function findNearestTimeIndex(targetTime: number, orderedTimes: readonly number[]): number {
  let lo = 0;
  let hi = orderedTimes.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (orderedTimes[mid] < targetTime) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  if (lo > 0) {
    const prevDist = Math.abs(orderedTimes[lo - 1] - targetTime);
    const currDist = Math.abs(orderedTimes[lo] - targetTime);
    if (prevDist <= currDist) {
      return lo - 1;
    }
  }
  return lo;
}

export function snapTimeToOrderedTimes(
  targetTime: number,
  orderedTimes: readonly number[],
): number | null {
  if (orderedTimes.length === 0) {
    return null;
  }
  const idx = findNearestTimeIndex(targetTime, orderedTimes);
  return orderedTimes[idx] ?? null;
}

export function computeRulerMetrics(
  start: DrawingAnchor,
  end: DrawingAnchor,
  orderedTimes?: readonly number[],
): RulerMetrics {
  const priceDelta = end.price - start.price;
  const pctDelta = start.price !== 0 ? (priceDelta / Math.abs(start.price)) * 100 : 0;

  let barsDelta: number;
  if (orderedTimes && orderedTimes.length > 0) {
    const startIdx = findNearestTimeIndex(start.time, orderedTimes);
    const endIdx = findNearestTimeIndex(end.time, orderedTimes);
    barsDelta = Math.abs(endIdx - startIdx);
  } else {
    barsDelta = Math.abs(Math.round(end.time - start.time));
  }

  return {
    priceDelta,
    pctDelta,
    barsDelta,
    isPositive: priceDelta >= 0,
  };
}

export function formatBarsCount(bars: number): string {
  const n = Math.abs(Math.trunc(bars));
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) {
    return `${n} баров`;
  }
  if (mod10 === 1) {
    return `${n} бар`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${n} бара`;
  }
  return `${n} баров`;
}

/**
 * Форматирует изменение цены для линейки.
 * INV-7: в слепом режиме не показываем символ ₽.
 */
export function formatPriceDelta(delta: number, blind: boolean): string {
  if (!blind) {
    return formatRub(delta, true);
  }
  const formatted = formatPrice(Math.abs(delta));
  if (delta > 0) {
    return `+${formatted}`;
  }
  if (delta < 0) {
    return `−${formatted}`;
  }
  return formatted;
}

export function formatRulerLines(
  metrics: RulerMetrics,
  blind: boolean,
): readonly [string, string, string] {
  return [
    formatPct(metrics.pctDelta, true),
    formatPriceDelta(metrics.priceDelta, blind),
    formatBarsCount(metrics.barsDelta),
  ];
}

export function clampLabelBox(
  x: number,
  y: number,
  boxWidth: number,
  boxHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  padding = 6,
): { readonly x: number; readonly y: number } {
  const maxX = Math.max(padding, viewportWidth - boxWidth - padding);
  const maxY = Math.max(padding, viewportHeight - boxHeight - padding);
  return {
    x: Math.min(Math.max(x, padding), maxX),
    y: Math.min(Math.max(y, padding), maxY),
  };
}

export function projectDrawing(
  drawing: ArenaDrawing,
  proj: ChartCoordinateProjector,
  blind: boolean,
  orderedTimes?: readonly number[],
): ProjectedDrawing | null {
  if (proj.width <= 0 || proj.height <= 0) {
    return null;
  }

  switch (drawing.kind) {
    case 'freehand': {
      const coords: { readonly x: number; readonly y: number }[] = [];
      for (const point of drawing.points) {
        const x = proj.timeToX(point.time);
        const y = proj.priceToY(point.price);
        if (x !== null && y !== null && Number.isFinite(x) && Number.isFinite(y)) {
          coords.push({ x, y });
        }
      }
      if (coords.length < 2) {
        return null;
      }
      return {
        id: drawing.id,
        kind: 'freehand',
        pointsAttr: coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '),
        pointCount: coords.length,
      };
    }

    case 'hline': {
      const y = proj.priceToY(drawing.price);
      if (y === null || !Number.isFinite(y)) {
        return null;
      }
      return {
        id: drawing.id,
        kind: 'hline',
        y,
        width: proj.width,
        priceLabel: formatPrice(drawing.price),
      };
    }

    case 'trendline': {
      const x1 = proj.timeToX(drawing.start.time);
      const y1 = proj.priceToY(drawing.start.price);
      const x2 = proj.timeToX(drawing.end.time);
      const y2 = proj.priceToY(drawing.end.price);
      if (x1 === null || y1 === null || x2 === null || y2 === null) {
        return null;
      }
      return {
        id: drawing.id,
        kind: 'trendline',
        x1,
        y1,
        x2,
        y2,
      };
    }

    case 'fib': {
      const rawX1 = proj.timeToX(drawing.start.time);
      const rawX2 = proj.timeToX(drawing.end.time);
      if (rawX1 === null || rawX2 === null) {
        return null;
      }
      const x1 = Math.min(rawX1, rawX2);
      const x2 = Math.max(rawX1, rawX2);
      const fibLevels = computeFibLevels(drawing.start.price, drawing.end.price);
      const projectedLevels: ProjectedFibLevel[] = [];
      for (const lvl of fibLevels) {
        const y = proj.priceToY(lvl.price);
        if (y === null || !Number.isFinite(y)) {
          return null;
        }
        projectedLevels.push({
          ratio: lvl.ratio,
          label: lvl.label,
          priceLabel: formatPrice(lvl.price),
          y,
        });
      }

      const bands: ProjectedFibBand[] = [];
      for (let i = 0; i < projectedLevels.length - 1; i++) {
        const yA = projectedLevels[i].y;
        const yB = projectedLevels[i + 1].y;
        bands.push({
          y: Math.min(yA, yB),
          height: Math.abs(yB - yA),
          index: i,
        });
      }

      return {
        id: drawing.id,
        kind: 'fib',
        x1,
        x2: Math.max(x2, x1 + 24),
        levels: projectedLevels,
        bands,
      };
    }

    case 'ruler': {
      const x1 = proj.timeToX(drawing.start.time);
      const y1 = proj.priceToY(drawing.start.price);
      const x2 = proj.timeToX(drawing.end.time);
      const y2 = proj.priceToY(drawing.end.price);
      if (x1 === null || y1 === null || x2 === null || y2 === null) {
        return null;
      }
      const x = Math.min(x1, x2);
      const y = Math.min(y1, y2);
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);
      const metrics = computeRulerMetrics(drawing.start, drawing.end, orderedTimes);
      const preferredLabelX = x + width / 2 - RULER_LABEL_WIDTH / 2;
      const preferredLabelY = y2 <= y1 ? y - RULER_LABEL_HEIGHT - 8 : y + height + 8;
      const clamped = clampLabelBox(
        preferredLabelX,
        preferredLabelY,
        RULER_LABEL_WIDTH,
        RULER_LABEL_HEIGHT,
        proj.width,
        proj.height,
      );

      return {
        id: drawing.id,
        kind: 'ruler',
        x,
        y,
        width,
        height,
        x1,
        y1,
        x2,
        y2,
        labelX: clamped.x,
        labelY: clamped.y,
        labelWidth: RULER_LABEL_WIDTH,
        labelHeight: RULER_LABEL_HEIGHT,
        isPositive: metrics.isPositive,
        lines: formatRulerLines(metrics, blind),
      };
    }
  }
}

export function projectDrawings(
  drawings: readonly ArenaDrawing[],
  proj: ChartCoordinateProjector,
  blind: boolean,
  orderedTimes?: readonly number[],
): readonly ProjectedDrawing[] {
  const result: ProjectedDrawing[] = [];
  for (const d of drawings) {
    const projected = projectDrawing(d, proj, blind, orderedTimes);
    if (projected) {
      result.push(projected);
    }
  }
  return result;
}

export function getDrawingsForPaper(
  store: DrawingsByPaper,
  paperKey: string,
): readonly ArenaDrawing[] {
  if (!paperKey) {
    return [];
  }
  return store[paperKey] ?? [];
}

export function addDrawingForPaper(
  store: DrawingsByPaper,
  paperKey: string,
  drawing: ArenaDrawing,
): DrawingsByPaper {
  if (!paperKey) {
    return store;
  }
  const existing = store[paperKey] ?? [];
  return {
    ...store,
    [paperKey]: [...existing, drawing],
  };
}

export function undoDrawingForPaper(store: DrawingsByPaper, paperKey: string): DrawingsByPaper {
  const existing = store[paperKey];
  if (!existing || existing.length === 0) {
    return store;
  }
  return {
    ...store,
    [paperKey]: existing.slice(0, -1),
  };
}

export function clearDrawingsForPaper(store: DrawingsByPaper, paperKey: string): DrawingsByPaper {
  const existing = store[paperKey];
  if (!existing || existing.length === 0) {
    return store;
  }
  return {
    ...store,
    [paperKey]: [],
  };
}

import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  CandlestickData,
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  HistogramData,
  HistogramSeries,
  IChartApi,
  IPriceLine,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  LineData,
  LineSeries,
  LineStyle,
  SeriesMarker,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';
import { formatBlindAxisTick, formatBlindCandleLabel } from '../arena.format';
import {
  addDrawingForPaper,
  ArenaDrawing,
  ArenaDrawingTool,
  ChartCoordinateProjector,
  clearDrawingsForPaper,
  DrawingAnchor,
  DrawingsByPaper,
  getDrawingsForPaper,
  projectDrawing,
  projectDrawings,
  ProjectedDrawing,
  snapTimeToOrderedTimes,
  undoDrawingForPaper,
} from '../arena-drawing';
import {
  computeAdxSeries,
  computeAtrSeries,
  computeBollingerSeries,
  computeCciSeries,
  computeEmaSeries,
  computeMacdSeries,
  computeMfiSeries,
  computeObvSeries,
  computeRsiSeries,
  computeSmaSeries,
  computeStochSeries,
  computeVwapSeries,
  computeWilliamsRSeries,
  TaOscillatorId,
  TaSeriesPoint,
} from '../arena-ta';
import { ArenaCandle, ArenaFill, ArenaOrder } from '../data/arena.models';

function toChartTime(step: number): UTCTimestamp {
  // Монотонный синтетический ключ без привязки к реальным датам (INV-7).
  return (step + 1000) as UTCTimestamp;
}

function toLineData(points: readonly TaSeriesPoint[]): LineData<Time>[] {
  return points.map((p) => ({ time: toChartTime(p.step), value: p.value }));
}

function readCssColor(el: HTMLElement, name: string, fallback = 'currentColor'): string {
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return value || fallback;
}

function withAlpha(color: string, alpha: number): string {
  const rgbMatch = /^rgba?\(\s*(\d+)\s*[,\s]\s*(\d+)\s*[,\s]\s*(\d+)/i.exec(color);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
  }
  const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (hexMatch) {
    const hex = hexMatch[1];
    const full = hex.length === 3 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex;
    const r = Number.parseInt(full.slice(0, 2), 16);
    const g = Number.parseInt(full.slice(2, 4), 16);
    const b = Number.parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

const BASE_CHART_HEIGHT = 360;
const MULTI_PANE_CHART_HEIGHT = 480;
const DRAG_THRESHOLD_PX = 6;
const FREEHAND_MIN_STEP_PX = 3;

@Component({
  selector: 'app-arena-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="chart-wrapper"
      [class.with-oscillator]="oscillator() !== 'none'"
      [class.drawing-active]="drawingTool() !== 'none'"
    >
      <div #container class="chart-host" aria-label="График свечей"></div>

      @if (overlayWidth() > 0 && overlayHeight() > 0) {
        <svg
          class="drawing-overlay"
          [class.interactive]="drawingTool() !== 'none'"
          [attr.viewBox]="'0 0 ' + overlayWidth() + ' ' + overlayHeight()"
          [attr.width]="overlayWidth()"
          [attr.height]="overlayHeight()"
          aria-hidden="true"
          (pointerdown)="onOverlayPointerDown($event)"
          (pointermove)="onOverlayPointerMove($event)"
          (pointerup)="onOverlayPointerUp($event)"
          (pointercancel)="onOverlayPointerCancel($event)"
          (pointerleave)="onOverlayPointerLeave()"
        >
          @for (item of projectedDrawings(); track item.id) {
            @switch (item.kind) {
              @case ('freehand') {
                <g class="drawing-freehand">
                  <polyline [attr.points]="item.pointsAttr" />
                </g>
              }
              @case ('hline') {
                <g class="drawing-hline">
                  <line
                    [attr.x1]="0"
                    [attr.y1]="item.y"
                    [attr.x2]="item.width"
                    [attr.y2]="item.y"
                  />
                  <rect [attr.x]="6" [attr.y]="item.y - 18" width="66" height="16" rx="3" />
                  <text [attr.x]="12" [attr.y]="item.y - 6">{{ item.priceLabel }}</text>
                </g>
              }
              @case ('trendline') {
                <g class="drawing-trendline">
                  <line
                    [attr.x1]="item.x1"
                    [attr.y1]="item.y1"
                    [attr.x2]="item.x2"
                    [attr.y2]="item.y2"
                  />
                  <circle [attr.cx]="item.x1" [attr.cy]="item.y1" r="3.5" />
                  <circle [attr.cx]="item.x2" [attr.cy]="item.y2" r="3.5" />
                </g>
              }
              @case ('fib') {
                <g class="drawing-fib">
                  @for (band of item.bands; track band.index) {
                    <rect
                      class="fib-band"
                      [class.fib-band-alt]="band.index % 2 === 1"
                      [attr.x]="item.x1"
                      [attr.y]="band.y"
                      [attr.width]="item.x2 - item.x1"
                      [attr.height]="band.height"
                    />
                  }
                  @for (lvl of item.levels; track lvl.ratio) {
                    <line
                      class="fib-line"
                      [class.fib-line-golden]="lvl.ratio === 0.618 || lvl.ratio === 0.5"
                      [attr.x1]="item.x1"
                      [attr.y1]="lvl.y"
                      [attr.x2]="item.x2"
                      [attr.y2]="lvl.y"
                    />
                    <text class="fib-label" [attr.x]="item.x1 + 4" [attr.y]="lvl.y - 3">
                      {{ lvl.label }} · {{ lvl.priceLabel }}
                    </text>
                  }
                </g>
              }
              @case ('ruler') {
                <g
                  class="drawing-ruler"
                  [class.ruler-pos]="item.isPositive"
                  [class.ruler-neg]="!item.isPositive"
                >
                  <rect
                    class="ruler-box"
                    [attr.x]="item.x"
                    [attr.y]="item.y"
                    [attr.width]="item.width"
                    [attr.height]="item.height"
                  />
                  <line
                    class="ruler-diag"
                    [attr.x1]="item.x1"
                    [attr.y1]="item.y1"
                    [attr.x2]="item.x2"
                    [attr.y2]="item.y2"
                  />
                  <rect
                    class="ruler-pill"
                    [attr.x]="item.labelX"
                    [attr.y]="item.labelY"
                    [attr.width]="item.labelWidth"
                    [attr.height]="item.labelHeight"
                    rx="5"
                  />
                  <text
                    class="ruler-text ruler-text-strong"
                    [attr.x]="item.labelX + 8"
                    [attr.y]="item.labelY + 16"
                  >
                    {{ item.lines[0] }}
                  </text>
                  <text class="ruler-text" [attr.x]="item.labelX + 8" [attr.y]="item.labelY + 32">
                    {{ item.lines[1] }}
                  </text>
                  <text
                    class="ruler-text ruler-text-muted"
                    [attr.x]="item.labelX + 8"
                    [attr.y]="item.labelY + 47"
                  >
                    {{ item.lines[2] }}
                  </text>
                </g>
              }
            }
          }

          @if (projectedDraft(); as draft) {
            <g class="drawing-draft">
              @switch (draft.kind) {
                @case ('freehand') {
                  <g class="drawing-freehand">
                    <polyline [attr.points]="draft.pointsAttr" />
                  </g>
                }
                @case ('trendline') {
                  <g class="drawing-trendline">
                    <line
                      [attr.x1]="draft.x1"
                      [attr.y1]="draft.y1"
                      [attr.x2]="draft.x2"
                      [attr.y2]="draft.y2"
                    />
                    <circle [attr.cx]="draft.x1" [attr.cy]="draft.y1" r="3.5" />
                    <circle [attr.cx]="draft.x2" [attr.cy]="draft.y2" r="3.5" />
                  </g>
                }
                @case ('fib') {
                  <g class="drawing-fib">
                    @for (band of draft.bands; track band.index) {
                      <rect
                        class="fib-band"
                        [class.fib-band-alt]="band.index % 2 === 1"
                        [attr.x]="draft.x1"
                        [attr.y]="band.y"
                        [attr.width]="draft.x2 - draft.x1"
                        [attr.height]="band.height"
                      />
                    }
                    @for (lvl of draft.levels; track lvl.ratio) {
                      <line
                        class="fib-line"
                        [attr.x1]="draft.x1"
                        [attr.y1]="lvl.y"
                        [attr.x2]="draft.x2"
                        [attr.y2]="lvl.y"
                      />
                      <text class="fib-label" [attr.x]="draft.x1 + 4" [attr.y]="lvl.y - 3">
                        {{ lvl.label }} · {{ lvl.priceLabel }}
                      </text>
                    }
                  </g>
                }
                @case ('ruler') {
                  <g
                    class="drawing-ruler"
                    [class.ruler-pos]="draft.isPositive"
                    [class.ruler-neg]="!draft.isPositive"
                  >
                    <rect
                      class="ruler-box"
                      [attr.x]="draft.x"
                      [attr.y]="draft.y"
                      [attr.width]="draft.width"
                      [attr.height]="draft.height"
                    />
                    <line
                      class="ruler-diag"
                      [attr.x1]="draft.x1"
                      [attr.y1]="draft.y1"
                      [attr.x2]="draft.x2"
                      [attr.y2]="draft.y2"
                    />
                    <rect
                      class="ruler-pill"
                      [attr.x]="draft.labelX"
                      [attr.y]="draft.labelY"
                      [attr.width]="draft.labelWidth"
                      [attr.height]="draft.labelHeight"
                      rx="5"
                    />
                    <text
                      class="ruler-text ruler-text-strong"
                      [attr.x]="draft.labelX + 8"
                      [attr.y]="draft.labelY + 16"
                    >
                      {{ draft.lines[0] }}
                    </text>
                    <text
                      class="ruler-text"
                      [attr.x]="draft.labelX + 8"
                      [attr.y]="draft.labelY + 32"
                    >
                      {{ draft.lines[1] }}
                    </text>
                    <text
                      class="ruler-text ruler-text-muted"
                      [attr.x]="draft.labelX + 8"
                      [attr.y]="draft.labelY + 47"
                    >
                      {{ draft.lines[2] }}
                    </text>
                  </g>
                }
              }
            </g>
          }

          @if (projectedPendingPoint(); as pt) {
            <circle class="drawing-anchor-dot" [attr.cx]="pt.x" [attr.cy]="pt.y" r="4.5" />
          }
        </svg>
      }
    </div>
  `,
  styles: `
    .chart-wrapper {
      position: relative;
      width: 100%;
      height: 360px;
    }

    .chart-wrapper.with-oscillator {
      height: 480px;
    }

    .chart-wrapper.drawing-active {
      cursor: crosshair;
    }

    .chart-host {
      width: 100%;
      height: 100%;
    }

    .drawing-overlay {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 4;
      overflow: hidden;
      font-family: var(--tui-font-text, inherit);
    }

    .drawing-overlay.interactive {
      pointer-events: auto;
      cursor: crosshair;
      touch-action: none;
    }

    .drawing-freehand polyline {
      fill: none;
      stroke: var(--tui-text-action, #3b82f6);
      stroke-width: 2.25;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .drawing-hline line {
      stroke: var(--tui-text-action, #3b82f6);
      stroke-width: 1.5;
      stroke-dasharray: 5 3;
    }

    .drawing-hline rect {
      fill: var(--tui-text-action, #3b82f6);
      opacity: 0.9;
    }

    .drawing-hline text {
      fill: #ffffff;
      font-size: 10px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .drawing-trendline line {
      stroke: var(--tui-background-accent-1, #f59e0b);
      stroke-width: 2;
    }

    .drawing-trendline circle {
      fill: var(--tui-background-accent-1, #f59e0b);
      stroke: var(--tui-background-base, #ffffff);
      stroke-width: 1.5;
    }

    .drawing-fib .fib-band {
      fill: rgba(59, 130, 246, 0.08);
    }

    .drawing-fib .fib-band.fib-band-alt {
      fill: rgba(168, 85, 247, 0.08);
    }

    .drawing-fib .fib-line {
      stroke: var(--tui-text-action, #3b82f6);
      stroke-width: 1;
      stroke-dasharray: 3 3;
      opacity: 0.85;
    }

    .drawing-fib .fib-line.fib-line-golden {
      stroke: var(--tui-background-accent-1, #f59e0b);
      stroke-width: 1.5;
      stroke-dasharray: none;
    }

    .drawing-fib .fib-label {
      fill: var(--tui-text-primary, currentColor);
      font-size: 10px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }

    .drawing-ruler.ruler-pos .ruler-box {
      fill: rgba(34, 197, 94, 0.14);
      stroke: var(--tui-text-positive, #22c55e);
      stroke-width: 1.25;
    }

    .drawing-ruler.ruler-neg .ruler-box {
      fill: rgba(239, 68, 68, 0.14);
      stroke: var(--tui-text-negative, #ef4444);
      stroke-width: 1.25;
    }

    .drawing-ruler.ruler-pos .ruler-diag {
      stroke: var(--tui-text-positive, #22c55e);
      stroke-width: 1.25;
      stroke-dasharray: 4 3;
    }

    .drawing-ruler.ruler-neg .ruler-diag {
      stroke: var(--tui-text-negative, #ef4444);
      stroke-width: 1.25;
      stroke-dasharray: 4 3;
    }

    .drawing-ruler .ruler-pill {
      fill: var(--tui-background-base, #1e293b);
      stroke: var(--tui-border-normal, #64748b);
      stroke-width: 1;
      opacity: 0.94;
    }

    .drawing-ruler .ruler-text {
      fill: var(--tui-text-primary, currentColor);
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }

    .drawing-ruler.ruler-pos .ruler-text-strong {
      fill: var(--tui-text-positive, #22c55e);
      font-weight: 700;
    }

    .drawing-ruler.ruler-neg .ruler-text-strong {
      fill: var(--tui-text-negative, #ef4444);
      font-weight: 700;
    }

    .drawing-ruler .ruler-text-muted {
      fill: var(--tui-text-secondary, currentColor);
      font-size: 10px;
    }

    .drawing-draft {
      opacity: 0.78;
    }

    .drawing-anchor-dot {
      fill: var(--tui-text-action, #3b82f6);
      stroke: var(--tui-background-base, #ffffff);
      stroke-width: 1.5;
    }
  `,
})
export class ArenaChart {
  private readonly destroyRef = inject(DestroyRef);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');

  readonly paperId = input<string>('');
  readonly paperKey = input<string>('');
  readonly blind = input(true);
  readonly chartMode = input<'candles' | 'line'>('candles');
  readonly candles = input.required<readonly ArenaCandle[]>();
  readonly orders = input<readonly ArenaOrder[]>([]);
  readonly fills = input<readonly ArenaFill[]>([]);
  readonly showSma20 = input(false);
  readonly showSma50 = input(false);
  readonly showEma20 = input(false);
  readonly showEma50 = input(false);
  readonly showBollinger = input(false);
  readonly showVwap = input(false);
  readonly oscillator = input<TaOscillatorId>('none');
  readonly drawingTool = input<ArenaDrawingTool>('none');
  readonly undoNonce = input(0);
  readonly clearNonce = input(0);

  readonly drawingsCountChange = output<number>();
  readonly drawingToolChange = output<ArenaDrawingTool>();

  protected readonly overlayWidth = signal(0);
  protected readonly overlayHeight = signal(0);
  protected readonly projectedDrawings = signal<readonly ProjectedDrawing[]>([]);
  protected readonly projectedDraft = signal<ProjectedDrawing | null>(null);
  protected readonly projectedPendingPoint = signal<{
    readonly x: number;
    readonly y: number;
  } | null>(null);

  private readonly drawingsByPaper = signal<DrawingsByPaper>({});
  private orderedTimes: number[] = [];
  private pendingAnchor: DrawingAnchor | null = null;
  private hoverAnchor: DrawingAnchor | null = null;
  private freehandDraftPoints: DrawingAnchor[] = [];
  private dragStartScreen: { readonly x: number; readonly y: number } | null = null;
  private lastFreehandScreen: { readonly x: number; readonly y: number } | null = null;
  private activePointerId: number | null = null;
  private isDragging = false;
  private dragMoved = false;
  private drawingSeq = 0;
  private lastUndoNonce = 0;
  private lastClearNonce = 0;
  private overlayRafId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private cleanupDomListeners: (() => void) | null = null;

  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick'> | null = null;
  private closeLineSeries: ISeriesApi<'Line'> | null = null;
  private lineColor = '#3b82f6';
  private volumeSeries: ISeriesApi<'Histogram'> | null = null;
  private sma20Series: ISeriesApi<'Line'> | null = null;
  private sma50Series: ISeriesApi<'Line'> | null = null;
  private ema20Series: ISeriesApi<'Line'> | null = null;
  private ema50Series: ISeriesApi<'Line'> | null = null;
  private bbUpperSeries: ISeriesApi<'Line'> | null = null;
  private bbMiddleSeries: ISeriesApi<'Line'> | null = null;
  private bbLowerSeries: ISeriesApi<'Line'> | null = null;
  private vwapSeries: ISeriesApi<'Line'> | null = null;
  private markersPlugin: ISeriesMarkersPluginApi<Time> | null = null;
  private themeObserver: MutationObserver | null = null;
  private priceLines: IPriceLine[] = [];
  private oscSeries: (ISeriesApi<'Line'> | ISeriesApi<'Histogram'>)[] = [];
  private activeOscillator: TaOscillatorId = 'none';
  private candleByTime = new Map<number, ArenaCandle>();
  private lastFittedPaperId: string | null = null;

  private positiveColor = 'currentColor';
  private negativeColor = 'currentColor';
  private warningColor = 'currentColor';
  private textColor = 'currentColor';
  private borderColor = 'currentColor';
  private positiveVolumeColor = 'currentColor';
  private negativeVolumeColor = 'currentColor';
  private sma20Color = '#3b82f6';
  private sma50Color = '#f59e0b';
  private ema20Color = '#22d3ee';
  private ema50Color = '#c084fc';
  private bbColor = 'rgba(59, 130, 246, 0.7)';
  private vwapColor = '#fb923c';
  private currentChartHeight = BASE_CHART_HEIGHT;
  private readonly populatedOverlays = new Set<string>();

  constructor() {
    afterNextRender(() => {
      this.initChart();
      this.observeTheme();
      this.syncData();
    });

    effect(() => {
      // Отслеживаем все входные сигналы для перерисовки при обновлении бумаги, свечей, заявок и индикаторов.
      this.paperId();
      this.paperKey();
      this.blind();
      this.chartMode();
      this.candles();
      this.orders();
      this.fills();
      this.showSma20();
      this.showSma50();
      this.showEma20();
      this.showEma50();
      this.showBollinger();
      this.showVwap();
      this.oscillator();
      this.syncData();
    });

    effect(() => {
      // Сбрасываем незавершённый черновик при смене инструмента или бумаги, блокируем pan и синхронизируем счётчик.
      this.drawingTool();
      const key = this.activePaperKey();
      const store = this.drawingsByPaper();
      this.resetDraftState();
      this.syncChartScrollLock();
      this.drawingsCountChange.emit(getDrawingsForPaper(store, key).length);
      this.scheduleOverlayRender();
    });

    effect(() => {
      const nonce = this.undoNonce();
      if (nonce === this.lastUndoNonce) {
        return;
      }
      this.lastUndoNonce = nonce;
      if (this.pendingAnchor || this.freehandDraftPoints.length > 0) {
        this.resetDraftState();
      } else {
        const key = this.activePaperKey();
        this.drawingsByPaper.update((store) => undoDrawingForPaper(store, key));
      }
      this.scheduleOverlayRender();
    });

    effect(() => {
      const nonce = this.clearNonce();
      if (nonce === this.lastClearNonce) {
        return;
      }
      this.lastClearNonce = nonce;
      this.resetDraftState();
      const key = this.activePaperKey();
      this.drawingsByPaper.update((store) => clearDrawingsForPaper(store, key));
      this.scheduleOverlayRender();
    });

    this.destroyRef.onDestroy(() => {
      if (this.overlayRafId !== null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.overlayRafId);
        this.overlayRafId = null;
      }
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
      this.cleanupDomListeners?.();
      this.cleanupDomListeners = null;
      this.themeObserver?.disconnect();
      this.themeObserver = null;
      if (this.chart) {
        this.chart.timeScale().unsubscribeVisibleLogicalRangeChange(this.handleRangeOrSizeChange);
        this.chart.timeScale().unsubscribeSizeChange(this.handleRangeOrSizeChange);
        this.chart.remove();
        this.chart = null;
      }
    });
  }

  private observeTheme(): void {
    if (typeof MutationObserver === 'undefined') {
      return;
    }
    const observer = new MutationObserver(() => {
      this.applyThemeColors();
      this.syncData();
    });
    const opts: MutationObserverInit = {
      attributes: true,
      attributeFilter: ['tuiTheme', 'tuitheme', 'data-theme', 'class'],
    };
    observer.observe(document.documentElement, opts);
    if (document.body) {
      observer.observe(document.body, opts);
    }
    const themeHost = this.container().nativeElement.closest('[tuiTheme]');
    if (themeHost && themeHost !== document.documentElement && themeHost !== document.body) {
      observer.observe(themeHost, opts);
    }
    this.themeObserver = observer;
  }

  private readThemePalette() {
    const el = this.container().nativeElement;
    this.textColor = readCssColor(el, '--tui-text-secondary');
    this.borderColor = readCssColor(el, '--tui-border-normal');
    this.sma20Color = readCssColor(el, '--tui-text-action', '#3b82f6');
    this.sma50Color = readCssColor(el, '--tui-background-accent-1', '#f59e0b');
    this.ema20Color = '#22d3ee';
    this.ema50Color = '#c084fc';
    this.bbColor = withAlpha(this.sma20Color, 0.7);
    this.vwapColor = '#fb923c';
    this.positiveColor = readCssColor(el, '--tui-text-positive', '#22c55e');
    this.negativeColor = readCssColor(el, '--tui-text-negative', '#ef4444');
    this.warningColor = readCssColor(el, '--tui-background-accent-2', '#f59e0b');
    this.positiveVolumeColor = withAlpha(this.positiveColor, 0.35);
    this.negativeVolumeColor = withAlpha(this.negativeColor, 0.35);
    return {
      textColor: this.textColor,
      borderColor: this.borderColor,
      sma20Color: this.sma20Color,
      sma50Color: this.sma50Color,
      ema20Color: this.ema20Color,
      ema50Color: this.ema50Color,
      bbColor: this.bbColor,
      vwapColor: this.vwapColor,
    };
  }

  private applyThemeColors(): void {
    if (!this.chart || !this.candleSeries) {
      return;
    }
    const palette = this.readThemePalette();
    this.chart.applyOptions({
      layout: {
        background: { color: 'transparent' },
        textColor: palette.textColor,
      },
      grid: {
        vertLines: { color: palette.borderColor },
        horzLines: { color: palette.borderColor },
      },
      rightPriceScale: { borderColor: palette.borderColor },
      timeScale: { borderColor: palette.borderColor },
    });
    this.applyChartModeStyle();
    this.sma20Series?.applyOptions({ color: palette.sma20Color });
    this.sma50Series?.applyOptions({ color: palette.sma50Color });
    this.ema20Series?.applyOptions({ color: palette.ema20Color });
    this.ema50Series?.applyOptions({ color: palette.ema50Color });
    this.bbUpperSeries?.applyOptions({ color: palette.bbColor });
    this.bbMiddleSeries?.applyOptions({ color: withAlpha(palette.bbColor, 0.65) });
    this.bbLowerSeries?.applyOptions({ color: palette.bbColor });
    this.vwapSeries?.applyOptions({ color: palette.vwapColor });
  }

  /** «Линия / Свечи»: в режиме линии свечи прозрачны (шкала, маркеры и рисунки остаются привязаны к ним). */
  private applyChartModeStyle(): void {
    if (!this.candleSeries) {
      return;
    }
    const line = this.chartMode() === 'line';
    const clear = 'rgba(0, 0, 0, 0)';
    this.candleSeries.applyOptions({
      upColor: line ? clear : this.positiveColor,
      downColor: line ? clear : this.negativeColor,
      wickUpColor: line ? clear : this.positiveColor,
      wickDownColor: line ? clear : this.negativeColor,
    });
    this.closeLineSeries?.applyOptions({ visible: line, color: this.lineColor });
  }

  private initChart(): void {
    const el = this.container().nativeElement;
    const palette = this.readThemePalette();

    const formatTooltipTime = (time: Time): string => {
      const candle = typeof time === 'number' ? this.candleByTime.get(time) : undefined;
      if (!candle) {
        return '';
      }
      if (candle.fullDateLabel ?? candle.dateLabel) {
        return candle.fullDateLabel ?? candle.dateLabel ?? '';
      }
      return formatBlindCandleLabel(candle.day, candle.candleInDay);
    };

    const formatTick = (time: Time): string => {
      const candle = typeof time === 'number' ? this.candleByTime.get(time) : undefined;
      if (!candle) {
        return '';
      }
      if (candle.dateLabel) {
        return candle.dateLabel;
      }
      return formatBlindAxisTick(candle.step, candle.day);
    };

    const initialHeight =
      this.oscillator() !== 'none' ? MULTI_PANE_CHART_HEIGHT : BASE_CHART_HEIGHT;
    this.currentChartHeight = initialHeight;

    const chart = createChart(el, {
      autoSize: true,
      height: initialHeight,
      layout: {
        attributionLogo: false,
        background: { color: 'transparent' },
        textColor: palette.textColor,
      },
      grid: {
        vertLines: { color: palette.borderColor },
        horzLines: { color: palette.borderColor },
      },
      rightPriceScale: {
        borderColor: palette.borderColor,
        scaleMargins: {
          top: 0.08,
          bottom: 0.25,
        },
      },
      timeScale: {
        borderColor: palette.borderColor,
        minBarSpacing: 8,
        rightOffset: 6,
        tickMarkFormatter: (time: Time) => formatTick(time),
      },
      localization: {
        timeFormatter: (time: Time) => formatTooltipTime(time),
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: this.positiveColor,
      downColor: this.negativeColor,
      borderVisible: false,
      wickUpColor: this.positiveColor,
      wickDownColor: this.negativeColor,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.78,
        bottom: 0.02,
      },
    });

    this.chart = chart;
    this.candleSeries = candleSeries;
    this.volumeSeries = volumeSeries;
    this.markersPlugin = createSeriesMarkers(candleSeries, []);
    this.syncChartScrollLock();

    chart.timeScale().subscribeVisibleLogicalRangeChange(this.handleRangeOrSizeChange);
    chart.timeScale().subscribeSizeChange(this.handleRangeOrSizeChange);

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.scheduleOverlayRender());
      ro.observe(el);
      this.resizeObserver = ro;
    }

    const onPointerOrWheel = () => this.scheduleOverlayRender();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      if (this.pendingAnchor || this.freehandDraftPoints.length > 0) {
        this.resetDraftState();
        this.scheduleOverlayRender();
      } else if (this.drawingTool() !== 'none') {
        this.drawingToolChange.emit('none');
      }
    };
    el.addEventListener('wheel', onPointerOrWheel, { passive: true });
    el.addEventListener('pointerup', onPointerOrWheel, { passive: true });
    el.addEventListener('pointermove', onPointerOrWheel, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    this.cleanupDomListeners = () => {
      el.removeEventListener('wheel', onPointerOrWheel);
      el.removeEventListener('pointerup', onPointerOrWheel);
      el.removeEventListener('pointermove', onPointerOrWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }

  private activePaperKey(): string {
    return this.paperKey() || this.paperId();
  }

  private nextDrawingId(): string {
    this.drawingSeq += 1;
    return `d-${this.drawingSeq}`;
  }

  private resetDraftState(): void {
    this.pendingAnchor = null;
    this.hoverAnchor = null;
    this.freehandDraftPoints = [];
    this.dragStartScreen = null;
    this.lastFreehandScreen = null;
    this.activePointerId = null;
    this.isDragging = false;
    this.dragMoved = false;
  }

  private syncChartScrollLock(): void {
    if (!this.chart) {
      return;
    }
    const canPan = this.drawingTool() === 'none';
    this.chart.applyOptions({
      handleScroll: {
        pressedMouseMove: canPan,
        horzTouchDrag: canPan,
        vertTouchDrag: canPan,
      },
    });
  }

  private readonly handleRangeOrSizeChange = (): void => {
    this.scheduleOverlayRender();
  };

  private pointerToOverlayPoint(event: PointerEvent): { readonly x: number; readonly y: number } {
    const target = event.currentTarget as Element | null;
    if (!target) {
      return { x: event.offsetX, y: event.offsetY };
    }
    const rect = target.getBoundingClientRect();
    const width = this.overlayWidth();
    const height = this.overlayHeight();
    const rawX = event.clientX - rect.left;
    const rawY = event.clientY - rect.top;
    return {
      x: width > 0 ? Math.min(Math.max(rawX, 0), width) : rawX,
      y: height > 0 ? Math.min(Math.max(rawY, 0), height) : rawY,
    };
  }

  private resolveAnchorFromPoint(x: number, y: number): DrawingAnchor | null {
    if (!this.chart || !this.candleSeries) {
      return null;
    }
    const price = this.candleSeries.coordinateToPrice(y);
    if (price === null || !Number.isFinite(price)) {
      return null;
    }

    let time: number | null = null;
    const coordTime = this.chart.timeScale().coordinateToTime(x);
    if (typeof coordTime === 'number') {
      time = coordTime;
    }
    if (time === null && this.orderedTimes.length > 0) {
      const logical = this.chart.timeScale().coordinateToLogical(x);
      if (logical !== null && Number.isFinite(logical)) {
        const clampedIndex = Math.min(
          Math.max(Math.round(logical), 0),
          this.orderedTimes.length - 1,
        );
        time = this.orderedTimes[clampedIndex] ?? null;
      }
    }
    if (time === null) {
      return null;
    }

    const snapped = snapTimeToOrderedTimes(time, this.orderedTimes);
    return { time: snapped ?? time, price };
  }

  protected onOverlayPointerDown(event: PointerEvent): void {
    const tool = this.drawingTool();
    if (tool === 'none') {
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const point = this.pointerToOverlayPoint(event);
    const anchor = this.resolveAnchorFromPoint(point.x, point.y);
    const key = this.activePaperKey();
    if (!anchor || !key) {
      return;
    }

    if (tool === 'hline') {
      const drawing: ArenaDrawing = {
        id: this.nextDrawingId(),
        kind: 'hline',
        price: anchor.price,
      };
      this.drawingsByPaper.update((store) => addDrawingForPaper(store, key, drawing));
      this.scheduleOverlayRender();
      return;
    }

    const target = event.currentTarget as Element | null;
    if (tool === 'freehand') {
      this.freehandDraftPoints = [anchor];
      this.lastFreehandScreen = point;
      this.activePointerId = event.pointerId;
      this.isDragging = true;
      this.dragMoved = false;
      target?.setPointerCapture?.(event.pointerId);
      this.scheduleOverlayRender();
      return;
    }

    // Второй клик в режиме click-click для Тренд / Фибоначчи / Линейка.
    if (this.pendingAnchor) {
      const drawing: ArenaDrawing = {
        id: this.nextDrawingId(),
        kind: tool,
        start: this.pendingAnchor,
        end: anchor,
      };
      this.resetDraftState();
      this.drawingsByPaper.update((store) => addDrawingForPaper(store, key, drawing));
      this.scheduleOverlayRender();
      return;
    }

    // Старт рисования (может завершиться либо перетаскиванием, либо вторым кликом).
    this.pendingAnchor = anchor;
    this.hoverAnchor = anchor;
    this.dragStartScreen = point;
    this.activePointerId = event.pointerId;
    this.isDragging = true;
    this.dragMoved = false;
    target?.setPointerCapture?.(event.pointerId);
    this.scheduleOverlayRender();
  }

  protected onOverlayPointerMove(event: PointerEvent): void {
    const tool = this.drawingTool();
    if (tool === 'none') {
      return;
    }
    event.stopPropagation();

    const point = this.pointerToOverlayPoint(event);
    const anchor = this.resolveAnchorFromPoint(point.x, point.y);
    if (!anchor) {
      return;
    }

    if (tool === 'freehand') {
      if (!this.isDragging || event.pointerId !== this.activePointerId) {
        return;
      }
      const prev = this.lastFreehandScreen;
      if (!prev || Math.hypot(point.x - prev.x, point.y - prev.y) >= FREEHAND_MIN_STEP_PX) {
        this.freehandDraftPoints = [...this.freehandDraftPoints, anchor];
        this.lastFreehandScreen = point;
        this.dragMoved = true;
        this.scheduleOverlayRender();
      }
      return;
    }

    if (this.isDragging && event.pointerId === this.activePointerId && this.dragStartScreen) {
      if (
        Math.hypot(point.x - this.dragStartScreen.x, point.y - this.dragStartScreen.y) >=
        DRAG_THRESHOLD_PX
      ) {
        this.dragMoved = true;
      }
      this.hoverAnchor = anchor;
      this.scheduleOverlayRender();
      return;
    }

    if (this.pendingAnchor) {
      this.hoverAnchor = anchor;
      this.scheduleOverlayRender();
    }
  }

  protected onOverlayPointerUp(event: PointerEvent): void {
    const tool = this.drawingTool();
    if (tool === 'none') {
      return;
    }
    event.stopPropagation();

    if (!this.isDragging || event.pointerId !== this.activePointerId) {
      return;
    }

    const target = event.currentTarget as Element | null;
    target?.releasePointerCapture?.(event.pointerId);

    const point = this.pointerToOverlayPoint(event);
    const anchor = this.resolveAnchorFromPoint(point.x, point.y);
    const key = this.activePaperKey();

    if (tool === 'freehand') {
      const points =
        anchor && this.freehandDraftPoints.length > 0
          ? [...this.freehandDraftPoints, anchor]
          : this.freehandDraftPoints;
      if (key && points.length >= 2) {
        const drawing: ArenaDrawing = {
          id: this.nextDrawingId(),
          kind: 'freehand',
          points,
        };
        this.drawingsByPaper.update((store) => addDrawingForPaper(store, key, drawing));
      }
      this.resetDraftState();
      this.scheduleOverlayRender();
      return;
    }

    this.isDragging = false;
    this.activePointerId = null;
    this.dragStartScreen = null;

    if (this.dragMoved && this.pendingAnchor && key && tool !== 'hline') {
      const endAnchor = anchor ?? this.hoverAnchor;
      if (endAnchor) {
        const drawing: ArenaDrawing = {
          id: this.nextDrawingId(),
          kind: tool,
          start: this.pendingAnchor,
          end: endAnchor,
        };
        this.resetDraftState();
        this.drawingsByPaper.update((store) => addDrawingForPaper(store, key, drawing));
        this.scheduleOverlayRender();
      }
    }
  }

  protected onOverlayPointerCancel(event: PointerEvent): void {
    if (this.drawingTool() === 'none') {
      return;
    }
    event.stopPropagation();
    const target = event.currentTarget as Element | null;
    if (this.activePointerId !== null) {
      target?.releasePointerCapture?.(this.activePointerId);
    }
    this.resetDraftState();
    this.scheduleOverlayRender();
  }

  protected onOverlayPointerLeave(): void {
    if (this.isDragging) {
      return;
    }
    if (this.pendingAnchor) {
      this.hoverAnchor = null;
      this.scheduleOverlayRender();
    }
  }

  private scheduleOverlayRender(): void {
    if (!this.chart || !this.candleSeries) {
      return;
    }
    // Нечего перерисовывать: инструмент не выбран, рисунков нет, оверлей уже пуст.
    if (
      this.drawingTool() === 'none' &&
      this.projectedDrawings().length === 0 &&
      this.projectedDraft() === null &&
      getDrawingsForPaper(this.drawingsByPaper(), this.activePaperKey()).length === 0
    ) {
      return;
    }
    if (typeof requestAnimationFrame === 'undefined') {
      this.renderOverlay();
      return;
    }
    if (this.overlayRafId !== null) {
      return;
    }
    this.overlayRafId = requestAnimationFrame(() => {
      this.overlayRafId = null;
      this.renderOverlay();
    });
  }

  private renderOverlay(): void {
    if (!this.chart || !this.candleSeries) {
      return;
    }
    const paneSize = this.chart.paneSize(0);
    const width = paneSize.width;
    const height = paneSize.height;
    this.overlayWidth.set(width);
    this.overlayHeight.set(height);

    if (width <= 0 || height <= 0) {
      this.projectedDrawings.set([]);
      this.projectedDraft.set(null);
      this.projectedPendingPoint.set(null);
      return;
    }

    const timeScale = this.chart.timeScale();
    const series = this.candleSeries;
    const projector: ChartCoordinateProjector = {
      width,
      height,
      timeToX: (time) => timeScale.timeToCoordinate(time as UTCTimestamp),
      priceToY: (price) => series.priceToCoordinate(price),
    };

    const blind = this.blind();
    const saved = getDrawingsForPaper(this.drawingsByPaper(), this.activePaperKey());
    this.projectedDrawings.set(projectDrawings(saved, projector, blind, this.orderedTimes));

    const tool = this.drawingTool();
    if (tool === 'freehand' && this.freehandDraftPoints.length >= 2) {
      const draft: ArenaDrawing = {
        id: '__draft__',
        kind: 'freehand',
        points: this.freehandDraftPoints,
      };
      this.projectedDraft.set(projectDrawing(draft, projector, blind, this.orderedTimes));
    } else if (
      this.pendingAnchor &&
      this.hoverAnchor &&
      tool !== 'none' &&
      tool !== 'hline' &&
      tool !== 'freehand'
    ) {
      const draft: ArenaDrawing = {
        id: '__draft__',
        kind: tool,
        start: this.pendingAnchor,
        end: this.hoverAnchor,
      };
      this.projectedDraft.set(projectDrawing(draft, projector, blind, this.orderedTimes));
    } else {
      this.projectedDraft.set(null);
    }

    if (this.pendingAnchor) {
      const x = projector.timeToX(this.pendingAnchor.time);
      const y = projector.priceToY(this.pendingAnchor.price);
      this.projectedPendingPoint.set(x !== null && y !== null ? { x, y } : null);
    } else {
      this.projectedPendingPoint.set(null);
    }
  }

  private clearOscillatorPane(): void {
    if (!this.chart) {
      return;
    }
    for (const s of this.oscSeries) {
      this.chart.removeSeries(s);
    }
    this.oscSeries = [];
    while (this.chart.panes().length > 1) {
      this.chart.removePane(1);
    }
    this.activeOscillator = 'none';
  }

  private syncOscillator(list: readonly ArenaCandle[]): void {
    if (!this.chart) {
      return;
    }
    const osc = this.oscillator();
    const targetHeight = osc !== 'none' ? MULTI_PANE_CHART_HEIGHT : BASE_CHART_HEIGHT;
    if (this.currentChartHeight !== targetHeight) {
      this.currentChartHeight = targetHeight;
      this.chart.applyOptions({ height: targetHeight });
    }

    if (osc === 'none') {
      if (this.activeOscillator !== 'none') {
        this.clearOscillatorPane();
      }
      return;
    }

    if (this.activeOscillator !== osc) {
      this.clearOscillatorPane();
      this.chart.addPane();
      const panes = this.chart.panes();
      if (panes.length >= 2) {
        panes[0].setStretchFactor(3);
        panes[1].setStretchFactor(1.25);
      }
      this.buildOscillatorSeries(osc);
      this.activeOscillator = osc;
    }

    this.updateOscillatorData(osc, list);
  }

  private addReferenceLine(
    series: ISeriesApi<'Line'>,
    price: number,
    color: string,
    title: string,
  ): void {
    series.createPriceLine({
      price,
      color,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title,
    });
  }

  private buildOscillatorSeries(osc: TaOscillatorId): void {
    if (!this.chart) {
      return;
    }
    const refColor = withAlpha(this.textColor, 0.45);
    const primaryLine = (color: string, title: string) =>
      this.chart!.addSeries(
        LineSeries,
        {
          color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title,
        },
        1,
      );

    switch (osc) {
      case 'rsi': {
        const line = primaryLine('#a855f7', 'RSI(14)');
        this.addReferenceLine(line, 70, withAlpha(this.negativeColor, 0.55), '70');
        this.addReferenceLine(line, 30, withAlpha(this.positiveColor, 0.55), '30');
        this.oscSeries = [line];
        break;
      }
      case 'macd': {
        const hist = this.chart.addSeries(
          HistogramSeries,
          {
            priceLineVisible: false,
            lastValueVisible: false,
            title: 'Hist',
          },
          1,
        );
        const macdLine = primaryLine('#3b82f6', 'MACD');
        const signalLine = primaryLine('#f97316', 'Signal');
        this.addReferenceLine(macdLine, 0, refColor, '0');
        this.oscSeries = [hist, macdLine, signalLine];
        break;
      }
      case 'stoch': {
        const kLine = primaryLine('#3b82f6', '%K');
        const dLine = primaryLine('#f97316', '%D');
        this.addReferenceLine(kLine, 80, withAlpha(this.negativeColor, 0.55), '80');
        this.addReferenceLine(kLine, 20, withAlpha(this.positiveColor, 0.55), '20');
        this.oscSeries = [kLine, dLine];
        break;
      }
      case 'adx': {
        const adxLine = primaryLine('#eab308', 'ADX');
        const plusLine = primaryLine(this.positiveColor, '+DI');
        const minusLine = primaryLine(this.negativeColor, '−DI');
        this.addReferenceLine(adxLine, 20, refColor, '20');
        this.oscSeries = [adxLine, plusLine, minusLine];
        break;
      }
      case 'cci': {
        const line = primaryLine('#06b6d4', 'CCI(14)');
        this.addReferenceLine(line, 100, withAlpha(this.positiveColor, 0.55), '+100');
        this.addReferenceLine(line, -100, withAlpha(this.negativeColor, 0.55), '−100');
        this.oscSeries = [line];
        break;
      }
      case 'willr': {
        const line = primaryLine('#ec4899', '%R(14)');
        this.addReferenceLine(line, -20, withAlpha(this.negativeColor, 0.55), '−20');
        this.addReferenceLine(line, -80, withAlpha(this.positiveColor, 0.55), '−80');
        this.oscSeries = [line];
        break;
      }
      case 'atr': {
        const line = primaryLine('#f59e0b', 'ATR(14)');
        this.oscSeries = [line];
        break;
      }
      case 'obv': {
        const line = primaryLine('#14b8a6', 'OBV');
        this.oscSeries = [line];
        break;
      }
      case 'mfi': {
        const line = primaryLine('#8b5cf6', 'MFI(14)');
        this.addReferenceLine(line, 80, withAlpha(this.negativeColor, 0.55), '80');
        this.addReferenceLine(line, 20, withAlpha(this.positiveColor, 0.55), '20');
        this.oscSeries = [line];
        break;
      }
      case 'none':
        break;
    }
  }

  private updateOscillatorData(osc: TaOscillatorId, list: readonly ArenaCandle[]): void {
    if (this.oscSeries.length === 0) {
      return;
    }
    switch (osc) {
      case 'rsi':
        (this.oscSeries[0] as ISeriesApi<'Line'>).setData(toLineData(computeRsiSeries(list, 14)));
        break;
      case 'macd': {
        const macd = computeMacdSeries(list, 12, 26, 9);
        const histData: HistogramData<Time>[] = macd.histogram.map((p) => ({
          time: toChartTime(p.step),
          value: p.value,
          color: p.value >= 0 ? this.positiveVolumeColor : this.negativeVolumeColor,
        }));
        (this.oscSeries[0] as ISeriesApi<'Histogram'>).setData(histData);
        (this.oscSeries[1] as ISeriesApi<'Line'>).setData(toLineData(macd.macd));
        (this.oscSeries[2] as ISeriesApi<'Line'>).setData(toLineData(macd.signal));
        break;
      }
      case 'stoch': {
        const stoch = computeStochSeries(list, 9, 6, 3);
        (this.oscSeries[0] as ISeriesApi<'Line'>).setData(toLineData(stoch.k));
        (this.oscSeries[1] as ISeriesApi<'Line'>).setData(toLineData(stoch.d));
        break;
      }
      case 'adx': {
        const adx = computeAdxSeries(list, 14);
        (this.oscSeries[0] as ISeriesApi<'Line'>).setData(toLineData(adx.adx));
        (this.oscSeries[1] as ISeriesApi<'Line'>).setData(toLineData(adx.plusDi));
        (this.oscSeries[2] as ISeriesApi<'Line'>).setData(toLineData(adx.minusDi));
        break;
      }
      case 'cci':
        (this.oscSeries[0] as ISeriesApi<'Line'>).setData(toLineData(computeCciSeries(list, 14)));
        break;
      case 'willr':
        (this.oscSeries[0] as ISeriesApi<'Line'>).setData(
          toLineData(computeWilliamsRSeries(list, 14)),
        );
        break;
      case 'atr':
        (this.oscSeries[0] as ISeriesApi<'Line'>).setData(toLineData(computeAtrSeries(list, 14)));
        break;
      case 'obv':
        (this.oscSeries[0] as ISeriesApi<'Line'>).setData(toLineData(computeObvSeries(list)));
        break;
      case 'mfi':
        (this.oscSeries[0] as ISeriesApi<'Line'>).setData(toLineData(computeMfiSeries(list, 14)));
        break;
      case 'none':
        break;
    }
  }

  private ensureCloseLineSeries(): ISeriesApi<'Line'> {
    if (!this.closeLineSeries) {
      this.closeLineSeries = this.chart!.addSeries(LineSeries, {
        color: this.lineColor,
        lineWidth: 2,
        visible: this.chartMode() === 'line',
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
      });
    }
    return this.closeLineSeries;
  }

  private ensureSma20Series(): ISeriesApi<'Line'> {
    if (!this.sma20Series) {
      this.sma20Series = this.chart!.addSeries(LineSeries, {
        priceLineVisible: false,
        lastValueVisible: false,
        color: this.sma20Color,
        lineWidth: 2,
      });
    }
    return this.sma20Series;
  }

  private ensureSma50Series(): ISeriesApi<'Line'> {
    if (!this.sma50Series) {
      this.sma50Series = this.chart!.addSeries(LineSeries, {
        priceLineVisible: false,
        lastValueVisible: false,
        color: this.sma50Color,
        lineWidth: 2,
      });
    }
    return this.sma50Series;
  }

  private ensureEma20Series(): ISeriesApi<'Line'> {
    if (!this.ema20Series) {
      this.ema20Series = this.chart!.addSeries(LineSeries, {
        priceLineVisible: false,
        lastValueVisible: false,
        color: this.ema20Color,
        lineWidth: 2,
      });
    }
    return this.ema20Series;
  }

  private ensureEma50Series(): ISeriesApi<'Line'> {
    if (!this.ema50Series) {
      this.ema50Series = this.chart!.addSeries(LineSeries, {
        priceLineVisible: false,
        lastValueVisible: false,
        color: this.ema50Color,
        lineWidth: 2,
      });
    }
    return this.ema50Series;
  }

  private ensureBollingerSeries(): void {
    const overlayBase = {
      priceLineVisible: false,
      lastValueVisible: false,
    };
    if (!this.bbUpperSeries) {
      this.bbUpperSeries = this.chart!.addSeries(LineSeries, {
        ...overlayBase,
        color: this.bbColor,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
      });
    }
    if (!this.bbMiddleSeries) {
      this.bbMiddleSeries = this.chart!.addSeries(LineSeries, {
        ...overlayBase,
        color: withAlpha(this.bbColor, 0.65),
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
      });
    }
    if (!this.bbLowerSeries) {
      this.bbLowerSeries = this.chart!.addSeries(LineSeries, {
        ...overlayBase,
        color: this.bbColor,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
      });
    }
  }

  private ensureVwapSeries(): ISeriesApi<'Line'> {
    if (!this.vwapSeries) {
      this.vwapSeries = this.chart!.addSeries(LineSeries, {
        priceLineVisible: false,
        lastValueVisible: false,
        color: this.vwapColor,
        lineWidth: 2,
        lineStyle: LineStyle.SparseDotted,
      });
    }
    return this.vwapSeries;
  }

  private syncData(): void {
    if (!this.chart || !this.candleSeries || !this.volumeSeries) {
      return;
    }

    const list = this.candles();
    this.candleByTime.clear();
    this.orderedTimes = [];

    const data: CandlestickData<Time>[] = [];
    const volumeData: HistogramData<Time>[] = [];
    for (const c of list) {
      const t = toChartTime(c.step);
      this.candleByTime.set(t as number, c);
      this.orderedTimes.push(t as number);
      data.push({
        time: t,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      });
      volumeData.push({
        time: t,
        value: c.volume,
        color: c.close >= c.open ? this.positiveVolumeColor : this.negativeVolumeColor,
      });
    }

    // INV-1: отображаем только уже полученные свечи без дорисовывания вперёд.
    this.candleSeries.setData(data);
    if (this.chartMode() === 'line') {
      this.ensureCloseLineSeries().setData(data.map((d) => ({ time: d.time, value: d.close })));
      this.populatedOverlays.add('closeLine');
    } else if (this.populatedOverlays.delete('closeLine')) {
      this.closeLineSeries?.setData([]);
    }
    this.applyChartModeStyle();
    this.volumeSeries.setData(volumeData);

    if (this.showSma20()) {
      this.ensureSma20Series().setData(toLineData(computeSmaSeries(list, 20)));
      this.populatedOverlays.add('sma20');
    } else if (this.populatedOverlays.delete('sma20')) {
      this.sma20Series?.setData([]);
    }

    if (this.showSma50()) {
      this.ensureSma50Series().setData(toLineData(computeSmaSeries(list, 50)));
      this.populatedOverlays.add('sma50');
    } else if (this.populatedOverlays.delete('sma50')) {
      this.sma50Series?.setData([]);
    }

    if (this.showEma20()) {
      this.ensureEma20Series().setData(toLineData(computeEmaSeries(list, 20)));
      this.populatedOverlays.add('ema20');
    } else if (this.populatedOverlays.delete('ema20')) {
      this.ema20Series?.setData([]);
    }

    if (this.showEma50()) {
      this.ensureEma50Series().setData(toLineData(computeEmaSeries(list, 50)));
      this.populatedOverlays.add('ema50');
    } else if (this.populatedOverlays.delete('ema50')) {
      this.ema50Series?.setData([]);
    }

    if (this.showBollinger()) {
      this.ensureBollingerSeries();
      const bb = computeBollingerSeries(list, 20, 2);
      this.bbUpperSeries!.setData(toLineData(bb.upper));
      this.bbMiddleSeries!.setData(toLineData(bb.middle));
      this.bbLowerSeries!.setData(toLineData(bb.lower));
      this.populatedOverlays.add('bb');
    } else if (this.populatedOverlays.delete('bb')) {
      this.bbUpperSeries?.setData([]);
      this.bbMiddleSeries?.setData([]);
      this.bbLowerSeries?.setData([]);
    }

    if (this.showVwap()) {
      this.ensureVwapSeries().setData(toLineData(computeVwapSeries(list)));
      this.populatedOverlays.add('vwap');
    } else if (this.populatedOverlays.delete('vwap')) {
      this.vwapSeries?.setData([]);
    }

    this.syncOscillator(list);

    for (const line of this.priceLines) {
      this.candleSeries.removePriceLine(line);
    }
    this.priceLines = [];

    for (const order of this.orders()) {
      const color = order.side === 'buy' ? this.positiveColor : this.negativeColor;
      if (order.limitPrice != null) {
        this.priceLines.push(
          this.candleSeries.createPriceLine({
            price: order.limitPrice,
            color,
            lineWidth: 1,
            lineStyle: 2,
            title: `Лимит ${order.lots} лот.`,
          }),
        );
      }
      if (order.stopPrice != null) {
        this.priceLines.push(
          this.candleSeries.createPriceLine({
            price: order.stopPrice,
            color: this.warningColor,
            lineWidth: 1,
            lineStyle: 2,
            title: `Стоп ${order.lots} лот.`,
          }),
        );
      }
      if (order.takeProfitPrice != null) {
        this.priceLines.push(
          this.candleSeries.createPriceLine({
            price: order.takeProfitPrice,
            color,
            lineWidth: 1,
            lineStyle: 2,
            title: `Тейк ${order.lots} лот.`,
          }),
        );
      }
    }

    if (this.markersPlugin) {
      // lightweight-charts 5 требует маркеры, отсортированные по времени по возрастанию.
      const markers: SeriesMarker<Time>[] = [...this.fills()]
        .sort((a, b) => a.step - b.step)
        .map((fill) => ({
          time: toChartTime(fill.step),
          position: fill.side === 'buy' ? 'belowBar' : 'aboveBar',
          color: fill.side === 'buy' ? this.positiveColor : this.negativeColor,
          shape: fill.side === 'buy' ? 'arrowUp' : 'arrowDown',
          text: `${fill.side === 'buy' ? '+' : '−'}${fill.lots} лот.`,
        }));
      this.markersPlugin.setMarkers(markers);
    }

    const currentPaperId = this.paperId();
    if (list.length > 0 && this.lastFittedPaperId !== currentPaperId) {
      this.lastFittedPaperId = currentPaperId;
      this.chart.timeScale().fitContent();
    }

    this.scheduleOverlayRender();
  }
}

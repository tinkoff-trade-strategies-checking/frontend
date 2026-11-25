import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
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

@Component({
  selector: 'app-arena-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #container
      class="chart-host"
      [class.with-oscillator]="oscillator() !== 'none'"
      aria-label="График свечей"
    ></div>
  `,
  styles: `
    .chart-host {
      width: 100%;
      height: 360px;
    }

    .chart-host.with-oscillator {
      height: 480px;
    }
  `,
})
export class ArenaChart {
  private readonly destroyRef = inject(DestroyRef);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');

  readonly paperId = input<string>('');
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

  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick'> | null = null;
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

  constructor() {
    afterNextRender(() => {
      this.initChart();
      this.observeTheme();
      this.syncData();
    });

    effect(() => {
      // Отслеживаем все входные сигналы для перерисовки при обновлении бумаги, свечей, заявок и индикаторов.
      this.paperId();
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

    this.destroyRef.onDestroy(() => {
      this.themeObserver?.disconnect();
      this.themeObserver = null;
      this.chart?.remove();
      this.chart = null;
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
    const sma20Color = readCssColor(el, '--tui-text-action', '#3b82f6');
    const sma50Color = readCssColor(el, '--tui-background-accent-1', '#f59e0b');
    const ema20Color = '#22d3ee';
    const ema50Color = '#c084fc';
    const bbColor = withAlpha(sma20Color, 0.7);
    const vwapColor = '#fb923c';
    this.positiveColor = readCssColor(el, '--tui-text-positive', '#22c55e');
    this.negativeColor = readCssColor(el, '--tui-text-negative', '#ef4444');
    this.warningColor = readCssColor(el, '--tui-background-accent-2', '#f59e0b');
    this.positiveVolumeColor = withAlpha(this.positiveColor, 0.35);
    this.negativeVolumeColor = withAlpha(this.negativeColor, 0.35);
    return {
      textColor: this.textColor,
      borderColor: this.borderColor,
      sma20Color,
      sma50Color,
      ema20Color,
      ema50Color,
      bbColor,
      vwapColor,
    };
  }

  private applyThemeColors(): void {
    if (!this.chart || !this.candleSeries || !this.sma20Series || !this.sma50Series) {
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
    this.candleSeries.applyOptions({
      upColor: this.positiveColor,
      downColor: this.negativeColor,
      wickUpColor: this.positiveColor,
      wickDownColor: this.negativeColor,
    });
    this.sma20Series.applyOptions({ color: palette.sma20Color });
    this.sma50Series.applyOptions({ color: palette.sma50Color });
    this.ema20Series?.applyOptions({ color: palette.ema20Color });
    this.ema50Series?.applyOptions({ color: palette.ema50Color });
    this.bbUpperSeries?.applyOptions({ color: palette.bbColor });
    this.bbMiddleSeries?.applyOptions({ color: withAlpha(palette.bbColor, 0.65) });
    this.bbLowerSeries?.applyOptions({ color: palette.bbColor });
    this.vwapSeries?.applyOptions({ color: palette.vwapColor });
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

    const chart = createChart(el, {
      autoSize: true,
      height: this.oscillator() !== 'none' ? MULTI_PANE_CHART_HEIGHT : BASE_CHART_HEIGHT,
      layout: {
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

    const overlayBase = {
      priceLineVisible: false,
      lastValueVisible: false,
    };

    this.sma20Series = chart.addSeries(LineSeries, {
      ...overlayBase,
      color: palette.sma20Color,
      lineWidth: 2,
    });
    this.sma50Series = chart.addSeries(LineSeries, {
      ...overlayBase,
      color: palette.sma50Color,
      lineWidth: 2,
    });
    this.ema20Series = chart.addSeries(LineSeries, {
      ...overlayBase,
      color: palette.ema20Color,
      lineWidth: 2,
    });
    this.ema50Series = chart.addSeries(LineSeries, {
      ...overlayBase,
      color: palette.ema50Color,
      lineWidth: 2,
    });
    this.bbUpperSeries = chart.addSeries(LineSeries, {
      ...overlayBase,
      color: palette.bbColor,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
    });
    this.bbMiddleSeries = chart.addSeries(LineSeries, {
      ...overlayBase,
      color: withAlpha(palette.bbColor, 0.65),
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
    });
    this.bbLowerSeries = chart.addSeries(LineSeries, {
      ...overlayBase,
      color: palette.bbColor,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
    });
    this.vwapSeries = chart.addSeries(LineSeries, {
      ...overlayBase,
      color: palette.vwapColor,
      lineWidth: 2,
      lineStyle: LineStyle.SparseDotted,
    });

    this.chart = chart;
    this.candleSeries = candleSeries;
    this.volumeSeries = volumeSeries;
    this.markersPlugin = createSeriesMarkers(candleSeries, []);
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
    this.chart.applyOptions({ height: targetHeight });

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

  private syncData(): void {
    if (
      !this.chart ||
      !this.candleSeries ||
      !this.volumeSeries ||
      !this.sma20Series ||
      !this.sma50Series
    ) {
      return;
    }

    const list = this.candles();
    this.candleByTime.clear();

    const data: CandlestickData<Time>[] = [];
    const volumeData: HistogramData<Time>[] = [];
    for (const c of list) {
      const t = toChartTime(c.step);
      this.candleByTime.set(t as number, c);
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
    this.volumeSeries.setData(volumeData);
    this.sma20Series.setData(this.showSma20() ? toLineData(computeSmaSeries(list, 20)) : []);
    this.sma50Series.setData(this.showSma50() ? toLineData(computeSmaSeries(list, 50)) : []);
    this.ema20Series?.setData(this.showEma20() ? toLineData(computeEmaSeries(list, 20)) : []);
    this.ema50Series?.setData(this.showEma50() ? toLineData(computeEmaSeries(list, 50)) : []);

    if (this.showBollinger()) {
      const bb = computeBollingerSeries(list, 20, 2);
      this.bbUpperSeries?.setData(toLineData(bb.upper));
      this.bbMiddleSeries?.setData(toLineData(bb.middle));
      this.bbLowerSeries?.setData(toLineData(bb.lower));
    } else {
      this.bbUpperSeries?.setData([]);
      this.bbMiddleSeries?.setData([]);
      this.bbLowerSeries?.setData([]);
    }

    this.vwapSeries?.setData(this.showVwap() ? toLineData(computeVwapSeries(list)) : []);

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
  }
}

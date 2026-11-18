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
  IChartApi,
  IPriceLine,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  LineData,
  LineSeries,
  SeriesMarker,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';
import { formatBlindAxisTick, formatBlindCandleLabel } from '../arena.format';
import { ArenaCandle, ArenaFill, ArenaOrder } from '../data/arena.models';

function toChartTime(step: number): UTCTimestamp {
  // Монотонный синтетический ключ без привязки к реальным датам (INV-7).
  return (step + 1000) as UTCTimestamp;
}

function readCssColor(el: HTMLElement, name: string, fallback = 'currentColor'): string {
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return value || fallback;
}

function computeSma(candles: readonly ArenaCandle[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) {
      sum -= candles[i - period].close;
    }
    if (i >= period - 1) {
      result.push({
        time: toChartTime(candles[i].step),
        value: Math.round((sum / period) * 100) / 100,
      });
    }
  }
  return result;
}

@Component({
  selector: 'app-arena-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #container class="chart-host" aria-label="График свечей"></div>`,
  styles: `
    .chart-host {
      width: 100%;
      height: 360px;
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

  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick'> | null = null;
  private sma20Series: ISeriesApi<'Line'> | null = null;
  private sma50Series: ISeriesApi<'Line'> | null = null;
  private markersPlugin: ISeriesMarkersPluginApi<Time> | null = null;
  private priceLines: IPriceLine[] = [];
  private candleByTime = new Map<number, ArenaCandle>();
  private lastFittedPaperId: string | null = null;

  private positiveColor = 'currentColor';
  private negativeColor = 'currentColor';
  private warningColor = 'currentColor';

  constructor() {
    afterNextRender(() => {
      this.initChart();
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
      this.syncData();
    });

    this.destroyRef.onDestroy(() => {
      this.chart?.remove();
      this.chart = null;
    });
  }

  private initChart(): void {
    const el = this.container().nativeElement;
    const textColor = readCssColor(el, '--tui-text-secondary');
    const borderColor = readCssColor(el, '--tui-border-normal');
    const sma20Color = readCssColor(el, '--tui-text-action');
    const sma50Color = readCssColor(el, '--tui-background-accent-1');
    this.positiveColor = readCssColor(el, '--tui-text-positive');
    this.negativeColor = readCssColor(el, '--tui-text-negative');
    this.warningColor = readCssColor(el, '--tui-background-accent-2');

    const formatTooltipTime = (time: Time): string => {
      const candle = typeof time === 'number' ? this.candleByTime.get(time) : undefined;
      if (!candle) {
        return '';
      }
      return formatBlindCandleLabel(candle.day, candle.candleInDay);
    };

    const formatTick = (time: Time): string => {
      const candle = typeof time === 'number' ? this.candleByTime.get(time) : undefined;
      if (!candle) {
        return '';
      }
      return formatBlindAxisTick(candle.step, candle.day);
    };

    const chart = createChart(el, {
      autoSize: true,
      height: 360,
      layout: {
        background: { color: 'transparent' },
        textColor,
      },
      grid: {
        vertLines: { color: borderColor },
        horzLines: { color: borderColor },
      },
      rightPriceScale: {
        borderColor,
      },
      timeScale: {
        borderColor,
        minBarSpacing: 8,
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

    const sma20Series = chart.addSeries(LineSeries, {
      color: sma20Color,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const sma50Series = chart.addSeries(LineSeries, {
      color: sma50Color,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    this.chart = chart;
    this.candleSeries = candleSeries;
    this.sma20Series = sma20Series;
    this.sma50Series = sma50Series;
    this.markersPlugin = createSeriesMarkers(candleSeries, []);
  }

  private syncData(): void {
    if (!this.chart || !this.candleSeries || !this.sma20Series || !this.sma50Series) {
      return;
    }

    const list = this.candles();
    this.candleByTime.clear();

    const data: CandlestickData<Time>[] = list.map((c) => {
      const t = toChartTime(c.step);
      this.candleByTime.set(t as number, c);
      return {
        time: t,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      };
    });

    // INV-1: отображаем только уже полученные свечи без дорисовывания вперёд.
    this.candleSeries.setData(data);
    this.sma20Series.setData(this.showSma20() ? computeSma(list, 20) : []);
    this.sma50Series.setData(this.showSma50() ? computeSma(list, 50) : []);

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

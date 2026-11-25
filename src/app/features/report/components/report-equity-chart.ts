import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineData,
  LineSeries,
  LineStyle,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';
import { EquityCurvePoint } from '../data/report.models';

function toChartTime(step: number): UTCTimestamp {
  return (step + 1000) as UTCTimestamp;
}

function readCssColor(el: HTMLElement, name: string, fallback = 'currentColor'): string {
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return value || fallback;
}

@Component({
  selector: 'app-report-equity-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-legend tui-text_body-xs">
      <span class="legend-item"><span class="swatch swatch-human"></span>{{ primaryLabel() }}</span>
      @if (hasAlgo()) {
        <span class="legend-item"><span class="swatch swatch-algo"></span>Алгоритм</span>
      }
      @if (hasBenchmark()) {
        <span class="legend-item"><span class="swatch swatch-bench"></span>IMOEX</span>
      }
    </div>
    <div #container class="chart-host" aria-label="Кривая капитала"></div>
  `,
  styles: `
    .chart-legend {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      padding: 0 0.5rem 0.375rem;
      color: var(--tui-text-secondary);
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
    }

    .swatch {
      display: inline-block;
      width: 1rem;
      height: 0;
      border-top: 2px solid currentColor;
    }

    .swatch-human {
      border-top-color: var(--tui-text-action);
    }

    .swatch-algo {
      border-top-color: var(--tui-text-positive);
    }

    .swatch-bench {
      border-top-color: var(--tui-text-tertiary, var(--tui-text-secondary));
      border-top-style: dashed;
    }

    .chart-host {
      width: 100%;
      height: 260px;
    }
  `,
})
export class ReportEquityChart {
  private readonly destroyRef = inject(DestroyRef);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');

  readonly points = input.required<readonly EquityCurvePoint[]>();
  readonly primaryLabel = input('Вы');
  protected readonly hasAlgo = computed(() => this.points().some((p) => p.algoCapitalRub !== null));
  protected readonly hasBenchmark = computed(() =>
    this.points().some((p) => p.benchmarkCapitalRub !== null),
  );

  private chart: IChartApi | null = null;
  private humanSeries: ISeriesApi<'Line'> | null = null;
  private algoSeries: ISeriesApi<'Line'> | null = null;
  private benchSeries: ISeriesApi<'Line'> | null = null;
  private themeObserver: MutationObserver | null = null;
  private labelByTime = new Map<number, string>();

  constructor() {
    afterNextRender(() => {
      this.initChart();
      this.observeTheme();
      this.syncData();
    });

    effect(() => {
      this.points();
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
    const observer = new MutationObserver(() => this.applyThemeColors());
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
    const textColor = readCssColor(el, '--tui-text-secondary');
    const borderColor = readCssColor(el, '--tui-border-normal');
    const humanColor = readCssColor(el, '--tui-text-action');
    const algoColor = readCssColor(el, '--tui-text-positive');
    const benchColor = readCssColor(el, '--tui-text-tertiary', textColor);
    return { textColor, borderColor, humanColor, algoColor, benchColor };
  }

  private applyThemeColors(): void {
    if (!this.chart || !this.humanSeries || !this.algoSeries || !this.benchSeries) {
      return;
    }
    const { textColor, borderColor, humanColor, algoColor, benchColor } = this.readThemePalette();
    this.chart.applyOptions({
      layout: { background: { color: 'transparent' }, textColor },
      grid: { vertLines: { color: borderColor }, horzLines: { color: borderColor } },
      rightPriceScale: { borderColor },
      timeScale: { borderColor },
    });
    this.humanSeries.applyOptions({ color: humanColor });
    this.algoSeries.applyOptions({ color: algoColor });
    this.benchSeries.applyOptions({ color: benchColor });
  }

  private initChart(): void {
    const el = this.container().nativeElement;
    const { textColor, borderColor, humanColor, algoColor, benchColor } = this.readThemePalette();

    this.chart = createChart(el, {
      autoSize: true,
      layout: {
        attributionLogo: false,
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
        tickMarkFormatter: (time: Time) => this.labelByTime.get(Number(time)) ?? '',
      },
      localization: {
        timeFormatter: (time: Time) => this.labelByTime.get(Number(time)) ?? '',
        priceFormatter: (price: number) => `${Math.round(price).toLocaleString('ru-RU')} ₽`,
      },
    });

    this.humanSeries = this.chart.addSeries(LineSeries, {
      color: humanColor,
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    this.algoSeries = this.chart.addSeries(LineSeries, {
      color: algoColor,
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    this.benchSeries = this.chart.addSeries(LineSeries, {
      color: benchColor,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
    });
  }

  private nonNullData(
    pts: readonly EquityCurvePoint[],
    pick: (p: EquityCurvePoint) => number | null,
  ): LineData<Time>[] {
    const data: LineData<Time>[] = [];
    for (const p of pts) {
      const value = pick(p);
      if (value !== null) {
        data.push({ time: toChartTime(p.step), value });
      }
    }
    return data;
  }

  private syncData(): void {
    if (!this.chart || !this.humanSeries || !this.algoSeries || !this.benchSeries) {
      return;
    }

    const pts = this.points();
    this.labelByTime = new Map(pts.map((p) => [Number(toChartTime(p.step)), p.dateLabel]));

    const humanData: LineData<Time>[] = pts.map((p) => ({
      time: toChartTime(p.step),
      value: p.humanCapitalRub,
    }));
    const algoData = this.nonNullData(pts, (p) => p.algoCapitalRub);
    const benchData = this.nonNullData(pts, (p) => p.benchmarkCapitalRub);

    this.humanSeries.setData(humanData);
    this.algoSeries.setData(algoData);
    this.benchSeries.setData(benchData);
    if (pts.length > 0) {
      this.chart.timeScale().setVisibleLogicalRange({
        from: -2,
        to: pts.length + 0.5,
      });
    } else {
      this.chart.timeScale().fitContent();
    }
  }
}

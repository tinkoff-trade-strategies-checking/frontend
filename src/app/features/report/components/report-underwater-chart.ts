import {
  afterNextRender,
  ChangeDetectionStrategy,
  computed,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  AreaData,
  AreaSeries,
  createChart,
  IChartApi,
  ISeriesApi,
  LineData,
  LineSeries,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';
import { UnderwaterPoint } from '../data/report.models';

function toChartTime(step: number): UTCTimestamp {
  return (step + 1000) as UTCTimestamp;
}

function readCssColor(el: HTMLElement, name: string, fallback = 'currentColor'): string {
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return value || fallback;
}

@Component({
  selector: 'app-report-underwater-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-legend tui-text_body-xs">
      <span class="legend-item"><span class="swatch swatch-human"></span>Вы, %</span>
      @if (hasAlgo()) {
        <span class="legend-item"><span class="swatch swatch-algo"></span>Алгоритм, %</span>
      }
    </div>
    <div #container class="chart-host" aria-label="Underwater-просадка"></div>
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
      border-top-color: var(--tui-text-negative);
    }

    .swatch-algo {
      border-top-color: var(--tui-text-action);
    }

    .chart-host {
      width: 100%;
      height: 200px;
    }
  `,
})
export class ReportUnderwaterChart {
  private readonly destroyRef = inject(DestroyRef);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');

  readonly points = input.required<readonly UnderwaterPoint[]>();
  /** Ряд алгоритма есть, только когда был фоновый прогон; иначе его нет ни в легенде, ни на графике. */
  protected readonly hasAlgo = computed(() =>
    this.points().some((p) => p.algoDrawdownPct !== null),
  );

  private chart: IChartApi | null = null;
  private humanSeries: ISeriesApi<'Area'> | null = null;
  private algoSeries: ISeriesApi<'Line'> | null = null;
  private labelByTime = new Map<number, string>();

  constructor() {
    afterNextRender(() => {
      this.initChart();
      this.syncData();
    });

    effect(() => {
      this.points();
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
    const negativeColor = readCssColor(el, '--tui-text-negative');
    const fillBg = readCssColor(el, '--tui-background-neutral-2', 'transparent');
    const algoColor = readCssColor(el, '--tui-text-action');

    this.chart = createChart(el, {
      autoSize: true,
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
        tickMarkFormatter: (time: Time) => this.labelByTime.get(Number(time)) ?? '',
      },
      localization: {
        timeFormatter: (time: Time) => this.labelByTime.get(Number(time)) ?? '',
        priceFormatter: (price: number) =>
          `${price.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} %`,
      },
    });

    this.humanSeries = this.chart.addSeries(AreaSeries, {
      lineColor: negativeColor,
      topColor: fillBg,
      bottomColor: 'transparent',
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
  }

  private syncData(): void {
    if (!this.chart || !this.humanSeries || !this.algoSeries) {
      return;
    }

    const pts = this.points();
    this.labelByTime = new Map(pts.map((p) => [Number(toChartTime(p.step)), p.dateLabel]));

    const humanData: AreaData<Time>[] = pts.map((p) => ({
      time: toChartTime(p.step),
      value: p.humanDrawdownPct,
    }));
    // Просадка алгоритма — null, пока фонового прогона нет (ФТ-18…20 отложены): точек линии нет.
    const algoData: LineData<Time>[] = pts.flatMap((p) =>
      p.algoDrawdownPct === null ? [] : [{ time: toChartTime(p.step), value: p.algoDrawdownPct }],
    );

    this.humanSeries.setData(humanData);
    this.algoSeries.setData(algoData);
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

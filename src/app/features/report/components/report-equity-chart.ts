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
  template: `<div #container class="chart-host" aria-label="Кривая капитала"></div>`,
  styles: `
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

  private chart: IChartApi | null = null;
  private humanSeries: ISeriesApi<'Line'> | null = null;
  private algoSeries: ISeriesApi<'Line'> | null = null;
  private benchSeries: ISeriesApi<'Line'> | null = null;
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
    const humanColor = readCssColor(el, '--tui-text-action');
    const algoColor = readCssColor(el, '--tui-text-positive');
    const benchColor = readCssColor(el, '--tui-text-tertiary', textColor);

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
      },
    });

    this.humanSeries = this.chart.addSeries(LineSeries, {
      color: humanColor,
      lineWidth: 2,
      title: 'Вы',
    });

    this.algoSeries = this.chart.addSeries(LineSeries, {
      color: algoColor,
      lineWidth: 2,
      title: 'Алгоритм',
    });

    this.benchSeries = this.chart.addSeries(LineSeries, {
      color: benchColor,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: 'IMOEX',
    });
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
    const algoData: LineData<Time>[] = pts.map((p) => ({
      time: toChartTime(p.step),
      value: p.algoCapitalRub,
    }));
    const benchData: LineData<Time>[] = pts.map((p) => ({
      time: toChartTime(p.step),
      value: p.benchmarkCapitalRub,
    }));

    this.humanSeries.setData(humanData);
    this.algoSeries.setData(algoData);
    this.benchSeries.setData(benchData);
    this.chart.timeScale().fitContent();
  }
}

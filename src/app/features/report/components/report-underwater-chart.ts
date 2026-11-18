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
  template: `<div #container class="chart-host" aria-label="Underwater-просадка"></div>`,
  styles: `
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
      },
    });

    this.humanSeries = this.chart.addSeries(AreaSeries, {
      lineColor: negativeColor,
      topColor: fillBg,
      bottomColor: 'transparent',
      lineWidth: 2,
      title: 'Вы, %',
    });

    this.algoSeries = this.chart.addSeries(LineSeries, {
      color: algoColor,
      lineWidth: 2,
      title: 'Алгоритм, %',
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
    const algoData: LineData<Time>[] = pts.map((p) => ({
      time: toChartTime(p.step),
      value: p.algoDrawdownPct,
    }));

    this.humanSeries.setData(humanData);
    this.algoSeries.setData(algoData);
    this.chart.timeScale().fitContent();
  }
}

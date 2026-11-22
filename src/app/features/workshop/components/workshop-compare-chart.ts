import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { TuiSegmented } from '@taiga-ui/kit';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineData,
  LineSeries,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';
import { CompareChartSeries } from '../workshop-compare.store';

export type CompareChartMode = 'pct' | 'rub';

function toChartTime(step: number): UTCTimestamp {
  return (step + 1000) as UTCTimestamp;
}

function resolveCssColor(el: HTMLElement, value: string): string {
  const match = /var\((--[^,)]+)(?:,\s*(.+))?\)/.exec(value.trim());
  if (!match) {
    return value;
  }
  const resolved = getComputedStyle(el).getPropertyValue(match[1]).trim();
  if (resolved) {
    return resolved;
  }
  return match[2] ? resolveCssColor(el, match[2]) : 'currentColor';
}

@Component({
  selector: 'app-workshop-compare-chart',
  imports: [TuiSegmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-toolbar">
      <div class="chart-legend tui-text_body-xs" role="group" aria-label="Серии графика">
        @for (item of series(); track item.id) {
          <button
            type="button"
            class="legend-btn"
            [class.legend-hidden]="isHidden(item.id)"
            [attr.aria-pressed]="!isHidden(item.id)"
            (click)="toggleSeries(item.id)"
          >
            <span class="swatch" [style.border-top-color]="item.colorVar"></span>
            <span>{{ item.name }}</span>
          </button>
        }
      </div>
      <tui-segmented
        size="s"
        [activeItemIndex]="mode() === 'pct' ? 0 : 1"
        (activeItemIndexChange)="setMode($event === 0 ? 'pct' : 'rub')"
      >
        <button type="button">Доходность, %</button>
        <button type="button">Капитал, ₽</button>
      </tui-segmented>
    </div>
    <div #container class="chart-host" aria-label="Наложение кривых доходности"></div>
  `,
  styles: `
    .chart-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
      padding-bottom: 0.5rem;
    }

    .chart-legend {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .legend-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.5rem;
      border: 1px solid var(--tui-border-normal);
      border-radius: var(--tui-radius-s);
      background: var(--tui-background-base);
      color: var(--tui-text-primary);
      cursor: pointer;
      font: inherit;
    }

    .legend-btn.legend-hidden {
      opacity: 0.45;
      text-decoration: line-through;
    }

    .swatch {
      display: inline-block;
      width: 1rem;
      height: 0;
      border-top: 2.5px solid currentColor;
    }

    .chart-host {
      width: 100%;
      height: 280px;
    }
  `,
})
export class WorkshopCompareChart {
  private readonly destroyRef = inject(DestroyRef);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');

  readonly series = input.required<readonly CompareChartSeries[]>();
  protected readonly mode = signal<CompareChartMode>('pct');
  protected readonly hiddenIds = signal<ReadonlySet<string>>(new Set());

  private chart: IChartApi | null = null;
  private lineSeries = new Map<string, ISeriesApi<'Line'>>();

  constructor() {
    afterNextRender(() => {
      this.initChart();
      this.syncData();
    });

    effect(() => {
      this.series();
      this.mode();
      this.hiddenIds();
      this.syncData();
    });

    this.destroyRef.onDestroy(() => {
      this.chart?.remove();
      this.chart = null;
      this.lineSeries.clear();
    });
  }

  protected isHidden(id: string): boolean {
    return this.hiddenIds().has(id);
  }

  protected toggleSeries(id: string): void {
    this.hiddenIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  protected setMode(next: CompareChartMode): void {
    this.mode.set(next);
  }

  private initChart(): void {
    const el = this.container().nativeElement;
    if (typeof HTMLCanvasElement === 'undefined') {
      return;
    }
    const textColor = resolveCssColor(el, 'var(--tui-text-secondary)');
    const borderColor = resolveCssColor(el, 'var(--tui-border-normal)');
    try {
      this.chart = createChart(el, {
        autoSize: true,
        layout: { background: { color: 'transparent' }, textColor },
        grid: { vertLines: { color: borderColor }, horzLines: { color: borderColor } },
        rightPriceScale: { borderColor },
        timeScale: {
          borderColor,
          tickMarkFormatter: (time: Time) => `Шаг ${Math.max(0, Number(time) - 1000)}`,
        },
        localization: {
          timeFormatter: (time: Time) => `Шаг ${Math.max(0, Number(time) - 1000)}`,
          priceFormatter: (price: number) =>
            this.mode() === 'pct'
              ? `${price > 0 ? '+' : ''}${price.toFixed(2).replace('.', ',')} %`
              : `${Math.round(price).toLocaleString('ru-RU')} ₽`,
        },
      });
    } catch {
      this.chart = null;
    }
  }

  private syncData(): void {
    const chart = this.chart;
    if (!chart) {
      return;
    }
    const el = this.container().nativeElement;
    const currentSeries = this.series();
    const activeIds = new Set(currentSeries.map((s) => s.id));
    for (const [id, api] of this.lineSeries) {
      if (!activeIds.has(id)) {
        chart.removeSeries(api);
        this.lineSeries.delete(id);
      }
    }

    const mode = this.mode();
    const hidden = this.hiddenIds();
    for (const item of currentSeries) {
      let api = this.lineSeries.get(item.id);
      const color = resolveCssColor(el, item.colorVar);
      if (!api) {
        api = chart.addSeries(LineSeries, {
          color,
          lineWidth: 2,
          lastValueVisible: false,
          priceLineVisible: false,
        });
        this.lineSeries.set(item.id, api);
      }
      api.applyOptions({ color, visible: !hidden.has(item.id) });
      const base = item.initialCapitalRub > 0 ? item.initialCapitalRub : 1;
      const data: LineData<Time>[] = item.points.map((p) => ({
        time: toChartTime(p.step),
        value: mode === 'pct' ? ((p.capitalRub - base) / base) * 100 : p.capitalRub,
      }));
      api.setData(data);
    }
    chart.timeScale().fitContent();
  }
}

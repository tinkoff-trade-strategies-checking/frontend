import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TuiButton, TuiNotification } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { HISTORY_API_IMPL, RUNS_API_IMPL, WORKSHOP_API_IMPL } from '../../api-impls';
import { HISTORY_API } from '../history/data/history.models';
import {
  formatPct,
  formatRatio,
  formatRub,
  REPORT_REGIME_LABELS,
  REPORT_TIMEFRAME_LABELS,
} from '../report/report.format';
import { RUNS_API, RunStatus } from '../runs/data/runs.models';
import { RUN_STATUS_LABELS } from '../runs/run-page';
import { WorkshopCompareChart } from './components/workshop-compare-chart';
import { WORKSHOP_API } from './data/workshop.models';
import {
  CompareMetricKey,
  ComparedWorkshopItem,
  normalizeCompareIds,
  WorkshopCompareStore,
} from './workshop-compare.store';

interface MetricRow {
  readonly key: CompareMetricKey | 'tradesCount';
  readonly label: string;
  readonly format: (item: Extract<ComparedWorkshopItem, { status: 'ready' }>) => string;
}

const METRIC_ROWS: readonly MetricRow[] = [
  {
    key: 'netReturnPct',
    label: 'Чистая доходность',
    format: (item) => formatPct(item.report.metrics?.netReturnPct ?? null, true),
  },
  {
    key: 'grossReturnPct',
    label: 'Валовая доходность',
    format: (item) => formatPct(item.report.metrics?.grossReturnPct ?? null, true),
  },
  {
    key: 'cagrPct',
    label: 'CAGR (годовая)',
    format: (item) => formatPct(item.report.metrics?.cagrPct ?? null, true),
  },
  {
    key: 'maxDrawdownPct',
    label: 'Макс. просадка',
    format: (item) =>
      item.report.metrics ? `−${formatPct(item.report.metrics.maxDrawdownPct)}` : '—',
  },
  {
    key: 'volatilityPct',
    label: 'Волатильность',
    format: (item) => formatPct(item.report.metrics?.volatilityPct ?? null),
  },
  {
    key: 'sharpe',
    label: 'Коэффициент Шарпа',
    format: (item) => formatRatio(item.report.metrics?.sharpe ?? null),
  },
  {
    key: 'sortino',
    label: 'Коэффициент Сортино',
    format: (item) => formatRatio(item.report.metrics?.sortino ?? null),
  },
  {
    key: 'tradesCount',
    label: 'Закрытых сделок',
    format: (item) => (item.report.metrics ? String(item.report.metrics.tradesCount) : '—'),
  },
  {
    key: 'winRatePct',
    label: 'Доля прибыльных',
    format: (item) => formatPct(item.report.metrics?.winRatePct ?? null),
  },
  {
    key: 'costsTotalRub',
    label: 'Издержки всего',
    format: (item) => formatRub(item.report.metrics?.costsRub.totalRub ?? null),
  },
  {
    key: 'finalCapitalRub',
    label: 'Итоговый капитал',
    format: (item) => formatRub(item.report.metrics?.finalCapitalRub ?? null),
  },
];

@Component({
  selector: 'app-workshop-compare-page',
  imports: [RouterLink, TuiButton, TuiBadge, TuiNotification, WorkshopCompareChart],
  providers: [
    { provide: WORKSHOP_API, useClass: WORKSHOP_API_IMPL },
    { provide: HISTORY_API, useClass: HISTORY_API_IMPL },
    { provide: RUNS_API, useClass: RUNS_API_IMPL },
    WorkshopCompareStore,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workshop-compare-page.html',
  styleUrl: './workshop-compare-page.less',
})
export class WorkshopComparePage implements OnInit {
  protected readonly store = inject(WorkshopCompareStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly metricRows = METRIC_ROWS;
  protected readonly regimeLabels = REPORT_REGIME_LABELS;
  protected readonly timeframeLabels = REPORT_TIMEFRAME_LABELS;
  protected readonly statusLabels = RUN_STATUS_LABELS;

  protected readonly backQueryParams = computed(() => {
    const ids = this.store.remainingIds();
    return ids.length > 0 ? { compare: ids.join(',') } : undefined;
  });

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const ids = normalizeCompareIds((params.get('ids') ?? '').split(','));
      const current = this.store.remainingIds();
      const sameAsLoaded =
        !this.store.error() &&
        !this.store.loading() &&
        ids.length === current.length &&
        ids.every((id, i) => id === current[i]);
      if (!sameAsLoaded) {
        void this.store.load(ids);
      }
    });
  }

  protected remove(id: string): void {
    const remaining = this.store.removeAlgorithm(id);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: remaining.length > 0 ? { ids: remaining.join(',') } : {},
      replaceUrl: true,
    });
  }

  protected isBest(key: CompareMetricKey | 'tradesCount', id: string): boolean {
    if (key === 'tradesCount') {
      return false;
    }
    return this.store.bestByMetric()[key] === id;
  }

  protected paperList(item: Extract<ComparedWorkshopItem, { status: 'ready' }>): string {
    const tickers = item.report.papers.map((p) => p.ticker);
    if (tickers.length === 0) {
      return '—';
    }
    if (tickers.length <= 5) {
      return tickers.join(', ');
    }
    return `${tickers.slice(0, 5).join(', ')} и ещё ${tickers.length - 5}`;
  }

  protected shortRunId(runId: string): string {
    const clean = runId.trim();
    if (!clean) {
      return '';
    }
    if (/^[0-9a-f]{8}-/i.test(clean)) {
      return clean.slice(0, 8);
    }
    return clean.length > 12 ? clean.slice(0, 8) : clean;
  }

  protected returnTone(
    key: CompareMetricKey | 'tradesCount',
    item: Extract<ComparedWorkshopItem, { status: 'ready' }>,
  ): 'positive' | 'negative' | null {
    const metrics = item.report.metrics;
    if (!metrics) {
      return null;
    }
    let val: number | null = null;
    if (key === 'netReturnPct') {
      val = metrics.netReturnPct;
    } else if (key === 'grossReturnPct') {
      val = metrics.grossReturnPct;
    } else if (key === 'cagrPct') {
      val = metrics.cagrPct;
    }
    if (val === null || !Number.isFinite(val) || Math.abs(val) < 1e-9) {
      return null;
    }
    return val > 0 ? 'positive' : 'negative';
  }

  protected statusAppearance(
    status: RunStatus,
  ): 'neutral' | 'info' | 'positive' | 'warning' | 'negative' {
    switch (status) {
      case 'completed':
        return 'positive';
      case 'bankrupt':
      case 'failed':
        return 'negative';
      case 'invalid':
        return 'warning';
      default:
        return 'neutral';
    }
  }
}

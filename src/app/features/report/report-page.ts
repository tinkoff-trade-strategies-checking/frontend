import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TuiButton, TuiNotification } from '@taiga-ui/core';
import { TuiBadge, TuiSegmented } from '@taiga-ui/kit';
import { ReportEquityChart } from './components/report-equity-chart';
import { ReportUnderwaterChart } from './components/report-underwater-chart';
import { DivergenceType, REPORT_API } from './data/report.models';
import { StubReportApi } from './data/stub-report.api';
import {
  DIVERGENCE_TYPE_LABELS,
  formatPct,
  formatRatio,
  formatRub,
  REPORT_ORDER_TYPE_LABELS,
  REPORT_REGIME_LABELS,
  REPORT_TIMEFRAME_LABELS,
  WINNER_LABELS,
} from './report.format';
import { DivergenceFilter, ReportStore, ReportTab } from './report.store';

const REPORT_TABS: readonly { readonly id: ReportTab; readonly label: string }[] = [
  { id: 'metrics', label: 'Метрики и издержки' },
  { id: 'divergences', label: 'Расхождения' },
  { id: 'fills', label: 'Сделки' },
];

const DIVERGENCE_FILTERS: readonly { readonly id: DivergenceFilter; readonly label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'extra', label: DIVERGENCE_TYPE_LABELS.extra },
  { id: 'missed', label: DIVERGENCE_TYPE_LABELS.missed },
  { id: 'size', label: DIVERGENCE_TYPE_LABELS.size },
  { id: 'timing', label: DIVERGENCE_TYPE_LABELS.timing },
];

@Component({
  selector: 'app-report-page',
  imports: [
    RouterLink,
    TuiButton,
    TuiBadge,
    TuiNotification,
    TuiSegmented,
    ReportEquityChart,
    ReportUnderwaterChart,
  ],
  providers: [{ provide: REPORT_API, useClass: StubReportApi }, ReportStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-page.html',
  styleUrl: './report-page.less',
})
export class ReportPage implements OnInit {
  protected readonly store = inject(ReportStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tabs = REPORT_TABS;
  protected readonly divergenceFilters = DIVERGENCE_FILTERS;
  protected readonly regimeLabels = REPORT_REGIME_LABELS;
  protected readonly timeframeLabels = REPORT_TIMEFRAME_LABELS;
  protected readonly divergenceLabels = DIVERGENCE_TYPE_LABELS;
  protected readonly orderTypeLabels = REPORT_ORDER_TYPE_LABELS;
  protected readonly winnerLabels = WINNER_LABELS;
  protected readonly formatRub = formatRub;
  protected readonly formatPct = formatPct;
  protected readonly formatRatio = formatRatio;

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id') ?? 'S-0104';
      void this.store.load(id);
    });
  }

  protected tabIndex(current: ReportTab): number {
    return Math.max(
      0,
      this.tabs.findIndex((t) => t.id === current),
    );
  }

  protected onTabIndexChange(index: number): void {
    const next = this.tabs[index];
    if (next) {
      this.store.setTab(next.id);
    }
  }

  protected divergenceTypeLabel(type: DivergenceType): string {
    return this.divergenceLabels[type];
  }
}

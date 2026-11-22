import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TuiButton, TuiNotification } from '@taiga-ui/core';
import { TuiBadge, TuiSegmented } from '@taiga-ui/kit';
import { RUNS_API_IMPL } from '../../api-impls';
import { OrderStatus } from '../../api/models/order-status';
import { errorMessage } from '../../core/api-problem';
import { ReportEquityChart } from '../report/components/report-equity-chart';
import { ReportUnderwaterChart } from '../report/components/report-underwater-chart';
import { ReportExportFormat, ReportExportService } from '../report/data/report-export.service';
import {
  formatDrawdownDuration,
  formatPct,
  formatRatio,
  formatRub,
  REPORT_ORDER_TYPE_LABELS,
  REPORT_REGIME_LABELS,
  REPORT_TIMEFRAME_LABELS,
} from '../report/report.format';
import { CheckLevel } from '../workshop/data/workshop.models';
import { RUNS_API, RunOrder, RunStatus } from './data/runs.models';
import { CHECK_LEVEL_LABELS, RUN_STATUS_LABELS } from './run-page';
import { RunReportStore, RunReportTab } from './run-report.store';

const RUN_REPORT_TABS: readonly { readonly id: RunReportTab; readonly label: string }[] = [
  { id: 'fills', label: 'Сделки' },
  { id: 'orders', label: 'Заявки алгоритма' },
];

const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  active: 'Активна',
  filled: 'Исполнена',
  partial: 'Частично',
  cancelled: 'Отменена',
  expired: 'Истекла',
  rejected: 'Отклонена',
};

@Component({
  selector: 'app-run-report-page',
  imports: [
    RouterLink,
    TuiButton,
    TuiBadge,
    TuiNotification,
    TuiSegmented,
    ReportEquityChart,
    ReportUnderwaterChart,
  ],
  providers: [{ provide: RUNS_API, useClass: RUNS_API_IMPL }, RunReportStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './run-report-page.html',
  styleUrl: './run-report-page.less',
})
export class RunReportPage implements OnInit {
  protected readonly store = inject(RunReportStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly exportService = inject(ReportExportService);

  protected readonly exporting = signal(false);
  protected readonly exportError = signal<string | null>(null);

  protected readonly tabs = RUN_REPORT_TABS;
  protected readonly statusLabels = RUN_STATUS_LABELS;
  protected readonly levelLabels = CHECK_LEVEL_LABELS;
  protected readonly regimeLabels = REPORT_REGIME_LABELS;
  protected readonly timeframeLabels = REPORT_TIMEFRAME_LABELS;
  protected readonly orderTypeLabels = REPORT_ORDER_TYPE_LABELS;
  protected readonly orderStatusLabels = ORDER_STATUS_LABELS;

  protected readonly formatRub = formatRub;
  protected readonly formatDrawdownDuration = formatDrawdownDuration;
  protected readonly formatPct = formatPct;
  protected readonly formatRatio = formatRatio;

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        void this.store.load(id);
      }
    });
  }

  protected statusAppearance(
    status: RunStatus,
  ): 'neutral' | 'info' | 'positive' | 'warning' | 'negative' {
    switch (status) {
      case 'queued':
        return 'neutral';
      case 'running':
        return 'info';
      case 'completed':
        return 'positive';
      case 'invalid':
        return 'warning';
      case 'bankrupt':
      case 'failed':
        return 'negative';
    }
  }

  protected levelAppearance(level: CheckLevel): 'positive' | 'warning' | 'negative' {
    switch (level) {
      case 'OK':
        return 'positive';
      case 'WARNING':
        return 'warning';
      case 'ERROR':
        return 'negative';
    }
  }

  protected tabIndex(current: RunReportTab): number {
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

  protected formatOrderCondition(order: RunOrder): string {
    if (order.limitPrice !== null && order.stopPrice !== null) {
      return `стоп ${formatRub(order.stopPrice)} / лим. ${formatRub(order.limitPrice)}`;
    }
    if (order.limitPrice !== null) {
      return `лим. ${formatRub(order.limitPrice)}`;
    }
    if (order.stopPrice !== null) {
      return `стоп ${formatRub(order.stopPrice)}`;
    }
    if (order.trailingPct !== null) {
      return `след ${formatPct(order.trailingPct)}`;
    }
    return 'По рынку';
  }

  protected async repeat(runId: string): Promise<void> {
    const newId = await this.store.repeat(runId);
    if (newId) {
      await this.router.navigate(['/runs', newId]);
    }
  }

  protected async download(runId: string, format: ReportExportFormat): Promise<void> {
    this.exporting.set(true);
    this.exportError.set(null);
    try {
      await this.exportService.downloadRun(runId, format);
    } catch (err) {
      this.exportError.set(errorMessage(err, 'Не удалось выгрузить отчёт прогона.'));
    } finally {
      this.exporting.set(false);
    }
  }
}

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
import { ReportEquityChart } from './components/report-equity-chart';
import { ReportUnderwaterChart } from './components/report-underwater-chart';
import { DivergenceType, EquityCurvePoint, REPORT_API, SessionReport } from './data/report.models';
import { STUB_MODE } from '../../core/api-mode';
import { errorMessage } from '../../core/api-problem';
import { ReportExportFormat, ReportExportService } from './data/report-export.service';
import { REPORT_API_IMPL } from '../../api-impls';
import {
  DIVERGENCE_TYPE_LABELS,
  formatDeltaBars,
  formatDrawdownDuration,
  formatPct,
  formatRatio,
  formatRub,
  formatRubExact,
  REPORT_ORDER_TYPE_LABELS,
  REPORT_REGIME_LABELS,
  REPORT_TIMEFRAME_LABELS,
  WINNER_LABELS,
} from './report.format';
import { DivergenceFilter, DivergenceSort, ReportStore, ReportTab } from './report.store';

const REPORT_TABS: readonly { readonly id: ReportTab; readonly label: string }[] = [
  { id: 'metrics', label: 'Метрики и издержки' },
  { id: 'divergences', label: 'Расхождения' },
  { id: 'reverse', label: 'Обратная проверка' },
  { id: 'fills', label: 'Сделки' },
];

const DIVERGENCE_FILTERS: readonly { readonly id: DivergenceFilter; readonly label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'extra', label: DIVERGENCE_TYPE_LABELS.extra },
  { id: 'missed', label: DIVERGENCE_TYPE_LABELS.missed },
  { id: 'size', label: DIVERGENCE_TYPE_LABELS.size },
  { id: 'timing', label: DIVERGENCE_TYPE_LABELS.timing },
];

const DIVERGENCE_SORTS: readonly { readonly id: DivergenceSort; readonly label: string }[] = [
  { id: 'time', label: 'По времени' },
  { id: 'errorCost', label: 'По цене ошибки' },
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
  providers: [{ provide: REPORT_API, useClass: REPORT_API_IMPL }, ReportStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-page.html',
  styleUrl: './report-page.less',
})
export class ReportPage implements OnInit {
  protected readonly store = inject(ReportStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly exportService = inject(ReportExportService);

  protected readonly stubMode = inject(STUB_MODE);
  protected readonly exporting = signal(false);
  protected readonly exportError = signal<string | null>(null);

  protected readonly tabs = REPORT_TABS;
  protected readonly divergenceFilters = DIVERGENCE_FILTERS;
  protected readonly divergenceSorts = DIVERGENCE_SORTS;
  protected readonly regimeLabels = REPORT_REGIME_LABELS;
  protected readonly timeframeLabels = REPORT_TIMEFRAME_LABELS;
  protected readonly divergenceLabels = DIVERGENCE_TYPE_LABELS;
  protected readonly orderTypeLabels = REPORT_ORDER_TYPE_LABELS;
  protected readonly winnerLabels = WINNER_LABELS;
  protected readonly formatRub = formatRub;
  protected readonly formatRubExact = formatRubExact;
  protected readonly formatDeltaBars = formatDeltaBars;
  protected readonly formatDrawdownDuration = formatDrawdownDuration;
  protected readonly formatPct = formatPct;
  protected readonly formatRatio = formatRatio;

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id') ?? 'S-0103';
      void this.store.load(id);
    });
  }

  protected async download(sessionId: string, format: ReportExportFormat): Promise<void> {
    if (this.exporting()) {
      return;
    }
    this.exporting.set(true);
    this.exportError.set(null);
    try {
      await this.exportService.download(sessionId, format);
    } catch (error) {
      this.exportError.set(errorMessage(error, 'Не удалось выгрузить отчёт.'));
    } finally {
      this.exporting.set(false);
    }
  }

  /** Заголовок как в истории: «бумаги · период»; идентификатор показывается рядом мелко. */
  protected reportTitle(rep: SessionReport): string {
    const tickers = rep.papers.map((p) => p.ticker).join(', ');
    return tickers ? `${tickers} · ${rep.period.label}` : rep.period.label;
  }

  protected equityCurveSubtitle(points: readonly EquityCurvePoint[]): string {
    const parts = ['Вы'];
    if (points.some((p) => p.algoCapitalRub !== null)) {
      parts.push('алгоритм');
    }
    if (points.some((p) => p.benchmarkCapitalRub !== null)) {
      parts.push('бенчмарк IMOEX');
    }
    return parts.join(', ');
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

  protected openWorkshop(): void {
    void this.router.navigate(['/workshop'], { queryParams: { create: '1' } });
  }
}

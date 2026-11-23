import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TuiButton, TuiNotification } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { HistoryFilters } from './components/history-filters';
import { errorMessage } from '../../core/api-problem';
import {
  HISTORY_API,
  HistoryItemStatus,
  HistoryKindFilter,
  HistoryRegimeFilter,
  HistoryStatusFilter,
} from './data/history.models';
import { HISTORY_API_IMPL, RUNS_API_IMPL } from '../../api-impls';
import { RUNS_API } from '../runs/data/runs.models';
import {
  formatHistoryTitle,
  formatMoscowDateTime,
  formatSignedPct,
  historyNetReturn,
  historyPapers,
  historyPeriod,
  HISTORY_KIND_LABELS,
  HISTORY_REGIME_LABELS,
  HISTORY_STATUS_LABELS,
} from './history.format';
import { HistoryStore } from './history.store';

const KIND_FILTERS: readonly { readonly id: HistoryKindFilter; readonly label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'session', label: 'Ручные сессии' },
  { id: 'algo_run', label: 'Прогоны алгоритмов' },
];

const STATUS_FILTERS: readonly { readonly id: HistoryStatusFilter; readonly label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'running', label: HISTORY_STATUS_LABELS.running },
  { id: 'completed', label: HISTORY_STATUS_LABELS.completed },
  { id: 'finished_early', label: HISTORY_STATUS_LABELS.finished_early },
  { id: 'bankrupt', label: HISTORY_STATUS_LABELS.bankrupt },
  { id: 'invalid', label: HISTORY_STATUS_LABELS.invalid },
  { id: 'failed', label: HISTORY_STATUS_LABELS.failed },
];

const REGIME_FILTERS: readonly { readonly id: HistoryRegimeFilter; readonly label: string }[] = [
  { id: 'all', label: 'Все периоды' },
  { id: 'calm', label: HISTORY_REGIME_LABELS.calm },
  { id: 'medium', label: HISTORY_REGIME_LABELS.medium },
  { id: 'stress', label: HISTORY_REGIME_LABELS.stress },
];

@Component({
  selector: 'app-history-page',
  imports: [RouterLink, TuiButton, TuiBadge, TuiNotification, HistoryFilters],
  providers: [
    { provide: HISTORY_API, useClass: HISTORY_API_IMPL },
    { provide: RUNS_API, useClass: RUNS_API_IMPL },
    HistoryStore,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history-page.html',
  styleUrl: './history-page.less',
})
export class HistoryPage implements OnInit {
  private readonly runsApi = inject(RUNS_API);
  private readonly router = inject(Router);
  protected readonly store = inject(HistoryStore);
  protected readonly repeatingId = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

  protected readonly kindFilters = KIND_FILTERS;
  protected readonly statusFilters = STATUS_FILTERS;
  protected readonly regimeFilters = REGIME_FILTERS;

  protected readonly kindLabels = HISTORY_KIND_LABELS;
  protected readonly statusLabels = HISTORY_STATUS_LABELS;
  protected readonly regimeLabels = HISTORY_REGIME_LABELS;

  protected readonly formatDateTime = formatMoscowDateTime;
  protected readonly formatSignedPct = formatSignedPct;
  protected readonly formatTitle = formatHistoryTitle;
  protected readonly papersOf = historyPapers;
  protected readonly periodOf = historyPeriod;
  protected readonly netReturnOf = historyNetReturn;

  protected readonly statusFilterIds = STATUS_FILTERS.map((f) => f.id);
  protected readonly regimeFilterIds = REGIME_FILTERS.map((f) => f.id);
  protected readonly statusStringify = (id: HistoryStatusFilter): string =>
    STATUS_FILTERS.find((f) => f.id === id)?.label ?? id;
  protected readonly regimeStringify = (id: HistoryRegimeFilter): string =>
    REGIME_FILTERS.find((f) => f.id === id)?.label ?? id;

  protected shortEntryId(id: string): string {
    return id.length <= 12 ? id : `#${id.slice(0, 8)}`;
  }

  ngOnInit(): void {
    void this.store.load();
  }

  protected filterIndex<T extends string>(
    options: readonly { readonly id: T }[],
    current: T,
  ): number {
    return Math.max(
      0,
      options.findIndex((item) => item.id === current),
    );
  }

  protected onKindIndexChange(index: number): void {
    const next = this.kindFilters[index];
    if (next) {
      this.store.setKind(next.id);
    }
  }

  protected onStatusIndexChange(index: number): void {
    const next = this.statusFilters[index];
    if (next) {
      this.store.setStatus(next.id);
    }
  }

  protected onRegimeIndexChange(index: number): void {
    const next = this.regimeFilters[index];
    if (next) {
      this.store.setRegime(next.id);
    }
  }

  protected statusAppearance(
    status: HistoryItemStatus,
  ): 'info' | 'positive' | 'warning' | 'negative' {
    switch (status) {
      case 'running':
        return 'info';
      case 'completed':
        return 'positive';
      case 'finished_early':
      case 'invalid':
        return 'warning';
      case 'bankrupt':
      case 'failed':
        return 'negative';
    }
  }

  protected async repeatRun(runId: string): Promise<void> {
    if (this.repeatingId() !== null) {
      return;
    }
    this.repeatingId.set(runId);
    this.actionError.set(null);
    try {
      const created = await this.runsApi.repeatRun(runId);
      await this.router.navigate(['/runs', created.runId]);
    } catch (error) {
      this.actionError.set(errorMessage(error, 'Не удалось повторить прогон.'));
    } finally {
      this.repeatingId.set(null);
    }
  }
}

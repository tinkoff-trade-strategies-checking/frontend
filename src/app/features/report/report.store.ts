import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { errorMessage } from '../../core/api-problem';
import { DivergenceType, REPORT_API, SessionReportResult } from './data/report.models';

export type ReportTab = 'metrics' | 'divergences' | 'reverse' | 'fills';
export type DivergenceFilter = 'all' | DivergenceType;
export type DivergenceSort = 'time' | 'errorCost';

@Injectable()
export class ReportStore {
  private readonly api = inject(REPORT_API);
  private readonly destroyRef = inject(DestroyRef);
  private loadSeq = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  /** Пока отчёт собирается (`BUILDING`), перечитываем его раз в `pollIntervalMs`. */
  pollIntervalMs = 2000;
  private static readonly MAX_POLLS = 90;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<SessionReportResult | null>(null);
  readonly activeTab = signal<ReportTab>('metrics');
  readonly divergenceFilter = signal<DivergenceFilter>('all');
  readonly divergenceSort = signal<DivergenceSort>('time');

  readonly readyReport = computed(() => {
    const res = this.result();
    return res?.status === 'READY' ? res.report : null;
  });

  readonly divergenceCounts = computed<Readonly<Record<DivergenceFilter, number>>>(() => {
    const rep = this.readyReport();
    const counts: Record<DivergenceFilter, number> = {
      all: 0,
      extra: 0,
      missed: 0,
      size: 0,
      timing: 0,
    };
    if (!rep) {
      return counts;
    }
    const divergences = rep.divergences ?? [];
    counts.all = divergences.length;
    for (const d of divergences) {
      counts[d.type] += 1;
    }
    return counts;
  });

  readonly filteredDivergences = computed(() => {
    const rep = this.readyReport();
    if (!rep) {
      return [];
    }
    const divergences = rep.divergences ?? [];
    const filter = this.divergenceFilter();
    const filtered =
      filter === 'all' ? [...divergences] : divergences.filter((d) => d.type === filter);
    const sort = this.divergenceSort();
    filtered.sort((a, b) => {
      if (sort === 'errorCost') {
        return b.errorCostRub - a.errorCostRub || a.step - b.step;
      }
      return a.step - b.step;
    });
    return filtered;
  });

  async load(sessionId: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);
    this.stopPolling();
    this.activeTab.set('metrics');
    this.divergenceFilter.set('all');
    this.divergenceSort.set('time');

    try {
      const res = await this.api.getReport(sessionId);
      if (seq !== this.loadSeq) {
        return;
      }
      this.result.set(res);
      if (res.status === 'BUILDING') {
        this.schedulePoll(sessionId, seq, 1);
      }
    } catch (err) {
      if (seq !== this.loadSeq) {
        return;
      }
      this.error.set(errorMessage(err, 'Не удалось загрузить отчёт.'));
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  private schedulePoll(sessionId: string, seq: number, attempt: number): void {
    if (attempt > ReportStore.MAX_POLLS) {
      this.error.set('Отчёт собирается дольше обычного. Обновите страницу позже.');
      return;
    }
    this.pollTimer = setTimeout(async () => {
      if (seq !== this.loadSeq) {
        return;
      }
      try {
        const res = await this.api.getReport(sessionId);
        if (seq !== this.loadSeq) {
          return;
        }
        this.result.set(res);
        if (res.status === 'BUILDING') {
          this.schedulePoll(sessionId, seq, attempt + 1);
        }
      } catch (err) {
        if (seq === this.loadSeq) {
          this.error.set(errorMessage(err, 'Не удалось загрузить отчёт.'));
        }
      }
    }, this.pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  setTab(tab: ReportTab): void {
    this.activeTab.set(tab);
  }

  setDivergenceFilter(filter: DivergenceFilter): void {
    this.divergenceFilter.set(filter);
  }

  setDivergenceSort(sort: DivergenceSort): void {
    this.divergenceSort.set(sort);
  }
}

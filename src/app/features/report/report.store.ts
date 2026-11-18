import { computed, inject, Injectable, signal } from '@angular/core';
import { DivergenceType, REPORT_API, SessionReportResult } from './data/report.models';

export type ReportTab = 'metrics' | 'divergences' | 'reverse' | 'fills';
export type DivergenceFilter = 'all' | DivergenceType;
export type DivergenceSort = 'time' | 'errorCost';

@Injectable()
export class ReportStore {
  private readonly api = inject(REPORT_API);
  private loadSeq = 0;

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
    counts.all = rep.divergences.length;
    for (const d of rep.divergences) {
      counts[d.type] += 1;
    }
    return counts;
  });

  readonly filteredDivergences = computed(() => {
    const rep = this.readyReport();
    if (!rep) {
      return [];
    }
    const filter = this.divergenceFilter();
    const filtered =
      filter === 'all' ? [...rep.divergences] : rep.divergences.filter((d) => d.type === filter);
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
    this.activeTab.set('metrics');
    this.divergenceFilter.set('all');
    this.divergenceSort.set('time');

    try {
      const res = await this.api.getReport(sessionId);
      if (seq !== this.loadSeq) {
        return;
      }
      this.result.set(res);
    } catch {
      if (seq !== this.loadSeq) {
        return;
      }
      this.error.set('Не удалось загрузить отчёт.');
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
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

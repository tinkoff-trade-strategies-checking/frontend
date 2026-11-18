import { computed, inject, Injectable, signal } from '@angular/core';
import { DivergenceType, REPORT_API, SessionReportResult } from './data/report.models';

export type ReportTab = 'metrics' | 'divergences' | 'fills';
export type DivergenceFilter = 'all' | DivergenceType;

@Injectable()
export class ReportStore {
  private readonly api = inject(REPORT_API);
  private loadSeq = 0;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<SessionReportResult | null>(null);
  readonly activeTab = signal<ReportTab>('metrics');
  readonly divergenceFilter = signal<DivergenceFilter>('all');

  readonly readyReport = computed(() => {
    const res = this.result();
    return res?.status === 'READY' ? res.report : null;
  });

  readonly filteredDivergences = computed(() => {
    const rep = this.readyReport();
    if (!rep) {
      return [];
    }
    const filter = this.divergenceFilter();
    if (filter === 'all') {
      return rep.divergences;
    }
    return rep.divergences.filter((d) => d.type === filter);
  });

  async load(sessionId: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);
    this.activeTab.set('metrics');
    this.divergenceFilter.set('all');

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
}

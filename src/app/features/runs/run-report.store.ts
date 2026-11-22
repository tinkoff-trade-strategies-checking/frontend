import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { errorMessage } from '../../core/api-problem';
import { EquityCurvePoint, UnderwaterPoint } from '../report/data/report.models';
import { RUNS_API, RunReportResult } from './data/runs.models';

export type RunReportTab = 'fills' | 'orders';

@Injectable()
export class RunReportStore {
  private readonly api = inject(RUNS_API);
  private readonly destroyRef = inject(DestroyRef);
  private loadSeq = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  pollIntervalMs = 2000;
  private static readonly MAX_POLLS = 90;
  private static readonly MAX_POLL_FAILURES = 3;

  readonly loading = signal(false);
  readonly repeating = signal(false);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly result = signal<RunReportResult | null>(null);
  readonly activeTab = signal<RunReportTab>('fills');

  readonly readyReport = computed(() => {
    const res = this.result();
    return res?.status === 'READY' ? res.report : null;
  });

  readonly equityPoints = computed<readonly EquityCurvePoint[]>(() => {
    const rep = this.readyReport();
    if (!rep) {
      return [];
    }
    return rep.equityCurve.map((p) => ({
      step: p.step,
      dateLabel: p.dateLabel,
      humanCapitalRub: p.capitalRub,
      algoCapitalRub: null,
      benchmarkCapitalRub: p.benchmarkCapitalRub,
    }));
  });

  readonly underwaterPoints = computed<readonly UnderwaterPoint[]>(() => {
    const rep = this.readyReport();
    if (!rep) {
      return [];
    }
    return rep.underwaterCurve.map((p) => ({
      step: p.step,
      dateLabel: p.dateLabel,
      humanDrawdownPct: p.drawdownPct,
      algoDrawdownPct: null,
    }));
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  async load(runId: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.error.set(null);
    this.actionError.set(null);
    this.result.set(null);
    this.activeTab.set('fills');
    this.stopPolling();

    try {
      const res = await this.api.getRunReport(runId);
      if (seq !== this.loadSeq) {
        return;
      }
      this.result.set(res);
      if (res.status === 'BUILDING') {
        this.schedulePoll(runId, seq, 1);
      }
    } catch (err) {
      if (seq !== this.loadSeq) {
        return;
      }
      this.error.set(errorMessage(err, 'Не удалось загрузить отчёт прогона.'));
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  async repeat(runId: string): Promise<string | null> {
    if (this.repeating()) {
      return null;
    }
    this.repeating.set(true);
    this.actionError.set(null);
    try {
      const created = await this.api.repeatRun(runId);
      return created.runId;
    } catch (err) {
      this.actionError.set(errorMessage(err, 'Не удалось повторить прогон.'));
      return null;
    } finally {
      this.repeating.set(false);
    }
  }

  setTab(tab: RunReportTab): void {
    this.activeTab.set(tab);
  }

  private schedulePoll(runId: string, seq: number, attempt: number, failures = 0): void {
    if (attempt > RunReportStore.MAX_POLLS) {
      this.error.set('Отчёт собирается дольше обычного. Обновите страницу позже.');
      return;
    }
    this.pollTimer = setTimeout(async () => {
      if (seq !== this.loadSeq) {
        return;
      }
      try {
        const res = await this.api.getRunReport(runId);
        if (seq !== this.loadSeq) {
          return;
        }
        this.result.set(res);
        if (res.status === 'BUILDING') {
          this.schedulePoll(runId, seq, attempt + 1);
        }
      } catch (err) {
        if (seq !== this.loadSeq) {
          return;
        }
        if (failures + 1 < RunReportStore.MAX_POLL_FAILURES) {
          this.schedulePoll(runId, seq, attempt + 1, failures + 1);
        } else {
          this.error.set(errorMessage(err, 'Не удалось загрузить отчёт прогона.'));
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
}

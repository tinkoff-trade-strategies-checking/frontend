import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { errorMessage } from '../../core/api-problem';
import { RUNS_API, RunInfo, RunStreamEvent } from './data/runs.models';

@Injectable()
export class RunStore {
  private readonly api = inject(RUNS_API);
  private readonly destroyRef = inject(DestroyRef);
  private loadSeq = 0;
  private destroyed = false;
  private eventsSub: Subscription | null = null;

  readonly loading = signal(false);
  readonly repeating = signal(false);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly streamError = signal<string | null>(null);
  readonly run = signal<RunInfo | null>(null);
  readonly reportReady = signal(false);

  readonly isActive = computed(() => {
    const status = this.run()?.status;
    return status === 'queued' || status === 'running';
  });

  readonly isTerminal = computed(() => {
    const status = this.run()?.status;
    return status !== undefined && status !== 'queued' && status !== 'running';
  });

  readonly progressPct = computed(() => {
    const current = this.run();
    if (!current || current.totalSteps === null || current.totalSteps <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((current.doneSteps / current.totalSteps) * 100));
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.loadSeq++;
      this.closeEvents();
    });
  }

  async load(runId: string): Promise<void> {
    if (this.destroyed) {
      return;
    }
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.error.set(null);
    this.actionError.set(null);
    this.streamError.set(null);
    this.reportReady.set(false);
    this.closeEvents();

    try {
      const info = await this.api.getRun(runId);
      if (this.destroyed || seq !== this.loadSeq) {
        return;
      }
      this.run.set(info);
      if (info.status === 'queued' || info.status === 'running') {
        this.openEvents(runId, info.lastEventId, seq);
      }
    } catch (err) {
      if (this.destroyed || seq !== this.loadSeq) {
        return;
      }
      this.run.set(null);
      this.error.set(errorMessage(err, 'Не удалось загрузить прогон.'));
    } finally {
      if (!this.destroyed && seq === this.loadSeq) {
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

  private openEvents(runId: string, lastEventId: string | null, seq: number): void {
    if (this.destroyed || seq !== this.loadSeq) {
      return;
    }
    this.closeEvents();
    this.eventsSub = this.api.events(runId, lastEventId).subscribe({
      next: (event) => this.handleEvent(runId, seq, event),
      error: (err) => {
        if (!this.destroyed && seq === this.loadSeq) {
          this.streamError.set(errorMessage(err, 'Соединение с потоком событий прервано.'));
        }
      },
    });
  }

  private handleEvent(runId: string, seq: number, event: RunStreamEvent): void {
    if (this.destroyed || seq !== this.loadSeq) {
      return;
    }
    switch (event.type) {
      case 'run_progress':
        this.run.update((current) =>
          current
            ? {
                ...current,
                status: 'running',
                doneSteps: event.doneSteps,
                totalSteps: event.totalSteps,
                lastEventId: event.eventId,
              }
            : current,
        );
        break;
      case 'run_finished':
        this.run.update((current) =>
          current
            ? {
                ...current,
                status: event.status,
                repeatMatch: event.repeatMatch,
                lastEventId: event.eventId,
              }
            : current,
        );
        void this.refreshRun(runId, seq);
        break;
      case 'run_failed':
        this.run.update((current) =>
          current
            ? {
                ...current,
                status: 'failed',
                errorCode: event.errorCode,
                lastEventId: event.eventId,
              }
            : current,
        );
        this.closeEvents();
        void this.refreshRun(runId, seq);
        break;
      case 'report_ready':
        this.reportReady.set(true);
        this.closeEvents();
        break;
      case 'stream_failed':
        this.closeEvents();
        this.streamError.set('Поток событий прогона закрыт сервером.');
        void this.refreshRun(runId, seq);
        break;
    }
  }

  private async refreshRun(runId: string, seq: number): Promise<void> {
    try {
      const fresh = await this.api.getRun(runId);
      if (!this.destroyed && seq === this.loadSeq) {
        this.run.set(fresh);
      }
    } catch (err) {
      if (!this.destroyed && seq === this.loadSeq) {
        this.streamError.set(errorMessage(err, 'Не удалось обновить данные прогона.'));
      }
    }
  }

  private closeEvents(): void {
    this.eventsSub?.unsubscribe();
    this.eventsSub = null;
  }
}

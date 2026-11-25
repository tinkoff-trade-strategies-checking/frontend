import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TuiButton, TuiNotification } from '@taiga-ui/core';
import { TuiBadge, TuiProgressBar } from '@taiga-ui/kit';
import { RUNS_API_IMPL } from '../../api-impls';
import { PapersReveal } from '../../shared/papers-reveal/papers-reveal';
import { CheckLevel } from '../workshop/data/workshop.models';
import { RUNS_API, RunStatus } from './data/runs.models';
import { RunStore } from './run.store';

export const RUN_STATUS_LABELS: Readonly<Record<RunStatus, string>> = {
  queued: 'В очереди',
  running: 'Идёт',
  completed: 'Завершён',
  bankrupt: 'Банкротство',
  invalid: 'Невалидный',
  failed: 'Ошибка',
};

export const CHECK_LEVEL_LABELS: Readonly<Record<CheckLevel, string>> = {
  OK: 'OK',
  WARNING: 'Предупреждение',
  ERROR: 'Ошибка',
};

@Component({
  selector: 'app-run-page',
  imports: [RouterLink, TuiButton, TuiBadge, TuiNotification, TuiProgressBar, PapersReveal],
  providers: [{ provide: RUNS_API, useClass: RUNS_API_IMPL }, RunStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './run-page.html',
  styleUrl: './run-page.less',
})
export class RunPage implements OnInit {
  protected readonly store = inject(RunStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusLabels = RUN_STATUS_LABELS;
  protected readonly levelLabels = CHECK_LEVEL_LABELS;

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

  protected openReport(runId: string): void {
    void this.router.navigate(['/runs', runId, 'report']);
  }

  protected async repeat(runId: string): Promise<void> {
    const newId = await this.store.repeat(runId);
    if (newId) {
      await this.router.navigate(['/runs', newId]);
    }
  }
}

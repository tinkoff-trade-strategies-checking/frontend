import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TuiButton, TuiNotification } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { combineLatest } from 'rxjs';
import { ArenaPage } from '../arena/arena-page';
import { REPLAY_API, ReplayRegime } from './data/replay.models';
import { REPLAY_API_IMPL } from '../../api-impls';
import { ReplayStore } from './replay.store';

const REGIME_LABELS: Readonly<Record<ReplayRegime, string>> = {
  calm: 'Спокойный',
  medium: 'Средний',
  stress: 'Стрессовый',
};

@Component({
  selector: 'app-replay-page',
  imports: [RouterLink, TuiButton, TuiBadge, TuiNotification, ArenaPage],
  providers: [{ provide: REPLAY_API, useClass: REPLAY_API_IMPL }, ReplayStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './replay-page.html',
  styleUrl: './replay-page.less',
})
export class ReplayPage implements OnInit {
  protected readonly store = inject(ReplayStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly regimeLabels = REGIME_LABELS;

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, queryParams]) => {
        const id = params.get('id') ?? 'S-0103';
        const rawStep = queryParams.get('step');
        const initialStep = rawStep !== null && /^\d+$/.test(rawStep) ? Number(rawStep) : undefined;
        void this.store.load(id, initialStep);
      });
  }
}

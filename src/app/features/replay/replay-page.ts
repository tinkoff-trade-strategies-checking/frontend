import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, convertToParamMap, RouterLink } from '@angular/router';
import { TuiButton, TuiNotification } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { combineLatest, of } from 'rxjs';
import { ArenaPage } from '../arena/arena-page';
import { REPLAY_API, ReplayRegime } from './data/replay.models';
import { StubReplayApi } from './data/stub-replay.api';
import { ReplayStore } from './replay.store';

const REGIME_LABELS: Readonly<Record<ReplayRegime, string>> = {
  calm: 'Спокойный',
  medium: 'Средний',
  stress: 'Стрессовый',
};

@Component({
  selector: 'app-replay-page',
  imports: [RouterLink, TuiButton, TuiBadge, TuiNotification, ArenaPage],
  providers: [{ provide: REPLAY_API, useClass: StubReplayApi }, ReplayStore],
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
    combineLatest([this.route.paramMap, this.route.queryParamMap ?? of(convertToParamMap({}))])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, queryParams]) => {
        const id = params.get('id') ?? 'S-0103';
        const rawStep = queryParams.get('step');
        const parsed = rawStep !== null ? Number(rawStep) : NaN;
        const initialStep = Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
        void this.store.load(id, initialStep);
      });
  }
}

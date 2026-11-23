import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { TuiProgressBar, TuiSegmented } from '@taiga-ui/kit';
import { ARENA_SPEEDS, ArenaSpeed } from '../data/arena.models';

@Component({
  selector: 'app-arena-player',
  imports: [TuiButton, TuiSegmented, TuiProgressBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="player-bar">
      <button
        tuiButton
        type="button"
        size="s"
        [appearance]="playing() ? 'secondary' : 'primary'"
        [disabled]="!canStep() && !playing()"
        (click)="togglePlay.emit()"
      >
        {{ playing() ? 'Пауза' : 'Пуск' }}
      </button>

      <button
        tuiButton
        type="button"
        size="s"
        appearance="outline"
        [disabled]="!canStep()"
        (click)="stepOnce.emit()"
      >
        Следующая свеча
      </button>

      <tui-segmented
        size="s"
        [activeItemIndex]="speedIndex()"
        (activeItemIndexChange)="onSpeedIndexChange($event)"
      >
        @for (item of speeds; track item) {
          <button type="button">×{{ item }}</button>
        }
      </tui-segmented>

      <div class="progress-wrap">
        <progress tuiProgressBar [max]="100" [value]="progressPct()"></progress>
      </div>

      <span class="day-counter tui-text_body-s"> День {{ day() }} из {{ totalDays() }} </span>
    </div>
  `,
  styles: `
    .player-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      padding: 0.75rem 1rem;
      background: var(--tui-background-base);
      border: 1px solid var(--tui-border-normal);
      border-radius: var(--tui-radius-l);
    }

    .progress-wrap {
      flex: 1;
      min-width: 10rem;
      --tui-background-accent-1: var(--ttsc-accent, var(--tui-text-action));
    }

    .day-counter {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
  `,
})
export class ArenaPlayer {
  readonly playing = input.required<boolean>();
  readonly canStep = input.required<boolean>();
  readonly speed = input.required<ArenaSpeed>();
  readonly day = input.required<number>();
  readonly totalDays = input.required<number>();
  readonly progressPct = input.required<number>();

  readonly togglePlay = output<void>();
  readonly stepOnce = output<void>();
  readonly speedChange = output<ArenaSpeed>();

  protected readonly speeds = ARENA_SPEEDS;
  protected readonly speedIndex = computed(() => Math.max(0, ARENA_SPEEDS.indexOf(this.speed())));

  protected onSpeedIndexChange(index: number): void {
    const next = ARENA_SPEEDS[index];
    if (next !== undefined) {
      this.speedChange.emit(next);
    }
  }
}

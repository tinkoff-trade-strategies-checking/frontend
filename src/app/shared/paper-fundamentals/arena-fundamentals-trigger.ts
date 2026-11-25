import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { ArenaPaper } from '../../features/arena/data/arena.models';
import { PaperFundamentalsModal } from './paper-fundamentals-modal';

@Component({
  selector: 'app-arena-fundamentals-trigger',
  imports: [TuiButton, PaperFundamentalsModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      tuiButton
      type="button"
      size="s"
      appearance="outline"
      data-testid="arena-fundamentals-btn"
      [attr.title]="buttonHint()"
      (click)="open.set(true)"
    >
      Фундаментал
    </button>

    @defer (when open()) {
      @if (open()) {
        <app-paper-fundamentals-modal
          [open]="true"
          [sessionId]="sessionId() || null"
          [paperId]="paper()?.id ?? null"
          [ticker]="effectiveTicker()"
          [paperName]="effectiveName()"
          [sector]="paper()?.sector ?? null"
          [blind]="blind()"
          [finished]="finished()"
          (closed)="open.set(false)"
        />
      }
    }
  `,
})
export class ArenaFundamentalsTrigger {
  readonly sessionId = input<string>('');
  readonly paper = input<ArenaPaper | null>(null);
  readonly blind = input(true);
  readonly finished = input(false);

  protected readonly open = signal(false);

  protected readonly isBlindLocked = computed(() => this.blind() && !this.finished());

  protected readonly buttonHint = computed(() =>
    this.isBlindLocked()
      ? 'В слепом режиме фундаментальные показатели скрыты до завершения сессии'
      : 'Открыть фундаментальные показатели выбранной бумаги',
  );

  protected readonly effectiveTicker = computed(() => {
    if (this.isBlindLocked()) {
      return null;
    }
    const p = this.paper();
    return p ? p.label : null;
  });

  protected readonly effectiveName = computed(() => {
    if (this.isBlindLocked()) {
      return null;
    }
    return null;
  });
}

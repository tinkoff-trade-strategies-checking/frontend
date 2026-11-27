import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { ArenaPaper } from '../../features/arena/data/arena.models';
import { TermHint } from '../term-hint/term-hint';
import { PaperFundamentalsModal } from './paper-fundamentals-modal';

@Component({
  selector: 'app-arena-fundamentals-trigger',
  imports: [TuiButton, TermHint, PaperFundamentalsModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="fundamentals-trigger">
      <button
        tuiButton
        type="button"
        size="s"
        appearance="outline"
        data-testid="arena-fundamentals-btn"
        [disabled]="isBlindLocked()"
        [attr.title]="buttonHint()"
        (click)="onTriggerClick()"
      >
        Фундаментал
      </button>
      @if (isBlindLocked()) {
        <app-term-hint term="Фундаментал" [text]="buttonHint()" />
      }
    </span>

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
  styles: `
    .fundamentals-trigger {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
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

  protected onTriggerClick(): void {
    if (this.isBlindLocked()) {
      return;
    }
    this.open.set(true);
  }

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

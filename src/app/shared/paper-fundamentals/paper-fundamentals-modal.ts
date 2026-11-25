import {
  ChangeDetectionStrategy,
  Component,
  effect,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { errorMessage } from '../../core/api-problem';
import { FUNDAMENTALS_API, PaperFundamentals } from '../../core/api/fundamentals.models';
import { PaperFundamentalsPanel } from './paper-fundamentals-panel';

@Component({
  selector: 'app-paper-fundamentals-modal',
  imports: [TuiButton, PaperFundamentalsPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="modal-backdrop" role="presentation" (click)="onBackdropClick($event)">
        <div
          class="modal-dialog panel"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="modalTitle()"
        >
          <div class="modal-header">
            <h2 class="tui-text_h6 modal-title">{{ modalTitle() }}</h2>
            <button
              tuiButton
              type="button"
              size="xs"
              appearance="flat"
              aria-label="Закрыть окно"
              (click)="closed.emit()"
            >
              ✕
            </button>
          </div>
          <div class="modal-body">
            <app-paper-fundamentals-panel
              [fundamentals]="fundamentals()"
              [ticker]="resolvedTicker()"
              [paperName]="resolvedName()"
              [sector]="resolvedSector()"
              [asOfDate]="asOfDate()"
              [loading]="loading()"
              [error]="error()"
              [hiddenByBlindMode]="effectiveHiddenByBlind()"
            />
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: var(--ttsc-backdrop, rgba(4, 7, 13, 0.65));
      backdrop-filter: blur(2px);
    }

    .modal-dialog {
      width: min(48rem, 100%);
      max-height: calc(100vh - 2rem);
      display: flex;
      flex-direction: column;
      background: var(--tui-background-elevation-1);
      border: 1px solid var(--tui-border-normal);
      border-radius: var(--tui-radius-l);
      overflow: hidden;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.85rem 1.1rem;
      border-bottom: 1px solid var(--tui-border-normal);
    }

    .modal-title {
      margin: 0;
    }

    .modal-body {
      padding: 1rem 1.1rem 1.15rem;
      overflow-y: auto;
    }
  `,
})
export class PaperFundamentalsModal {
  private readonly api = inject(FUNDAMENTALS_API, { optional: true });

  readonly open = input(false);
  readonly ticker = input<string | null>(null);
  readonly paperId = input<string | null>(null);
  readonly paperName = input<string | null>(null);
  readonly sector = input<string | null>(null);
  readonly sessionId = input<string | null>(null);
  readonly blind = input(false);
  readonly finished = input(false);

  readonly closed = output<void>();

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly fundamentals = signal<PaperFundamentals | null>(null);
  protected readonly asOfDate = signal<string | null>(null);
  protected readonly apiHiddenByBlind = signal(false);
  protected readonly resolvedTicker = signal<string | null>(null);
  protected readonly resolvedName = signal<string | null>(null);
  protected readonly resolvedSector = signal<string | null>(null);

  private loadSeq = 0;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const ticker = this.ticker();
      const paperId = this.paperId();
      const sessionId = this.sessionId();
      const blind = this.blind();
      const finished = this.finished();
      const name = this.paperName();
      const sector = this.sector();

      if (!isOpen) {
        return;
      }

      this.resolvedTicker.set(ticker);
      this.resolvedName.set(name);
      this.resolvedSector.set(sector);

      // INV-7: в активном слепом режиме никогда не запрашиваем и не показываем фундаментал.
      if (blind && !finished) {
        this.loadSeq += 1;
        this.loading.set(false);
        this.error.set(null);
        this.fundamentals.set(null);
        this.asOfDate.set(null);
        this.apiHiddenByBlind.set(true);
        return;
      }

      this.apiHiddenByBlind.set(false);
      void this.loadData(ticker, paperId, sessionId);
    });
  }

  protected effectiveHiddenByBlind(): boolean {
    return (this.blind() && !this.finished()) || this.apiHiddenByBlind();
  }

  protected modalTitle(): string {
    if (this.effectiveHiddenByBlind()) {
      return 'Фундаментальные показатели';
    }
    const t = this.resolvedTicker();
    return t ? `Фундаментальные показатели · ${t}` : 'Фундаментальные показатели';
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) {
      this.closed.emit();
    }
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }

  private async loadData(
    ticker: string | null,
    paperId: string | null,
    sessionId: string | null,
  ): Promise<void> {
    const seq = ++this.loadSeq;
    if (!this.api) {
      this.fundamentals.set(null);
      this.loading.set(false);
      this.error.set(null);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.fundamentals.set(null);
    this.asOfDate.set(null);

    try {
      if (sessionId) {
        const res = await this.api.getSessionFundamentals(sessionId);
        if (seq !== this.loadSeq) {
          return;
        }
        if (res.hiddenByBlindMode) {
          this.apiHiddenByBlind.set(true);
          this.fundamentals.set(null);
          return;
        }
        this.asOfDate.set(res.asOfDate);
        const match = res.items.find(
          (item) =>
            (paperId && item.paperId === paperId) ||
            (ticker && item.ticker.toUpperCase() === ticker.toUpperCase()),
        );
        if (match) {
          this.resolvedTicker.set(match.ticker);
          this.resolvedName.set(match.name || this.paperName());
          this.resolvedSector.set(match.sector || this.sector());
          this.fundamentals.set(match.available ? match.snapshot : null);
          return;
        }
      }

      if (ticker) {
        const snap = await this.api.getPaperFundamentals(ticker);
        if (seq !== this.loadSeq) {
          return;
        }
        this.fundamentals.set(snap);
      }
    } catch (err) {
      if (seq !== this.loadSeq) {
        return;
      }
      this.error.set(errorMessage(err, 'Не удалось загрузить фундаментальные показатели.'));
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}

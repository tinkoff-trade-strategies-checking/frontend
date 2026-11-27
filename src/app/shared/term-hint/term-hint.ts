import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-term-hint',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="term-hint" [class.position-top]="position() === 'top'">
      <button
        type="button"
        class="hint-btn"
        [class.active]="open()"
        [attr.title]="text()"
        [attr.aria-label]="term() ? 'Подсказка: ' + term() : 'Пояснение термина'"
        [attr.aria-expanded]="open()"
        (click)="toggle($event)"
      >
        ?
      </button>
      @if (open()) {
        <span class="term-hint-popover" role="tooltip">
          @if (term()) {
            <strong class="term-hint-title">{{ term() }}</strong>
          }
          <span class="term-hint-text">{{ text() }}</span>
        </span>
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      vertical-align: middle;
    }

    .term-hint {
      position: relative;
      display: inline-flex;
      align-items: center;
    }

    .hint-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.05rem;
      height: 1.05rem;
      padding: 0;
      border-radius: 999px;
      border: 1px solid var(--tui-border-normal);
      background: transparent;
      color: var(--tui-text-tertiary, var(--tui-text-secondary));
      font: inherit;
      font-size: 0.65rem;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      transition:
        border-color 0.15s ease,
        background-color 0.15s ease,
        color 0.15s ease;

      &:hover,
      &.active {
        border-color: var(--ttsc-accent, var(--tui-border-hover));
        color: var(--ttsc-accent-text, var(--tui-text-primary));
        background: var(--ttsc-accent-soft, var(--tui-background-neutral-1));
      }

      &:focus-visible {
        outline: 2px solid var(--ttsc-accent, var(--tui-border-focus));
        outline-offset: 1px;
      }
    }

    .term-hint-popover {
      position: absolute;
      left: 50%;
      top: calc(100% + 0.4rem);
      transform: translateX(-50%);
      z-index: 600;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      width: min(17rem, 72vw);
      padding: 0.55rem 0.7rem;
      border-radius: var(--tui-radius-m, 10px);
      border: 1px solid var(--ttsc-border, var(--tui-border-normal));
      background: var(--tui-background-elevation-2, var(--ttsc-surface-alt));
      color: var(--tui-text-primary);
      box-shadow: var(--ttsc-shadow);
      font-size: 0.78rem;
      font-weight: 400;
      line-height: 1.4;
      text-align: left;
      white-space: normal;
    }

    .term-hint.position-top .term-hint-popover {
      top: auto;
      bottom: calc(100% + 0.4rem);
    }

    .term-hint-title {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--ttsc-accent-text, var(--tui-text-primary));
    }

    .term-hint-text {
      color: var(--tui-text-secondary);
    }
  `,
})
export class TermHint {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly term = input<string>('');
  readonly text = input.required<string>();
  readonly position = input<'top' | 'bottom'>('bottom');

  protected readonly open = signal(false);

  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.open.update((prev) => !prev);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) {
      this.open.set(false);
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}

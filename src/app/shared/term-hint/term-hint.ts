import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

const VIEWPORT_MARGIN = 12;
const POPOVER_GAP = 6;
const MAX_POPOVER_WIDTH = 272;
const FALLBACK_POPOVER_HEIGHT = 96;

@Component({
  selector: 'app-term-hint',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="term-hint">
      <button
        #triggerBtn
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
        <span
          #popoverEl
          class="term-hint-popover"
          role="tooltip"
          [attr.data-placement]="popoverPlacement()"
          [style.left.px]="popoverLeft()"
          [style.top.px]="popoverTop()"
        >
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
      position: fixed;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      width: min(17rem, calc(100vw - 24px));
      max-width: calc(100vw - 24px);
      box-sizing: border-box;
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
  private readonly triggerBtn = viewChild<ElementRef<HTMLButtonElement>>('triggerBtn');
  private readonly popoverEl = viewChild<ElementRef<HTMLElement>>('popoverEl');

  readonly term = input<string>('');
  readonly text = input.required<string>();
  readonly position = input<'top' | 'bottom'>('bottom');

  protected readonly open = signal(false);
  protected readonly popoverLeft = signal(VIEWPORT_MARGIN);
  protected readonly popoverTop = signal(VIEWPORT_MARGIN);
  protected readonly popoverPlacement = signal<'top' | 'bottom'>('bottom');

  constructor() {
    effect((onCleanup) => {
      if (!this.open()) {
        return;
      }

      // Пересчитываем позицию после появления поповера в DOM, чтобы учесть его реальные размеры.
      const popover = this.popoverEl()?.nativeElement;
      if (popover) {
        this.updatePosition(popover);
      }

      const onScroll = (event: Event): void => {
        const currentPopover = this.popoverEl()?.nativeElement;
        if (
          currentPopover &&
          event.target instanceof Node &&
          currentPopover.contains(event.target)
        ) {
          return;
        }
        this.open.set(false);
      };

      window.addEventListener('scroll', onScroll, true);
      onCleanup(() => {
        window.removeEventListener('scroll', onScroll, true);
      });
    });
  }

  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    const nextOpen = !this.open();
    if (nextOpen) {
      this.updatePosition();
    }
    this.open.set(nextOpen);
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    if (this.open()) {
      this.updatePosition(this.popoverEl()?.nativeElement);
    }
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

  private updatePosition(popoverElement?: HTMLElement): void {
    const trigger = this.triggerBtn()?.nativeElement;
    if (!trigger) {
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth || 1024;
    const viewportHeight = window.innerHeight || 768;

    const popoverRect = popoverElement?.getBoundingClientRect();
    const popoverWidth =
      popoverRect && popoverRect.width > 0
        ? popoverRect.width
        : Math.min(MAX_POPOVER_WIDTH, Math.max(0, viewportWidth - VIEWPORT_MARGIN * 2));
    const popoverHeight =
      popoverRect && popoverRect.height > 0 ? popoverRect.height : FALLBACK_POPOVER_HEIGHT;

    const centeredLeft = triggerRect.left + triggerRect.width / 2 - popoverWidth / 2;
    const maxLeft = Math.max(VIEWPORT_MARGIN, viewportWidth - popoverWidth - VIEWPORT_MARGIN);
    const left = Math.round(Math.min(Math.max(centeredLeft, VIEWPORT_MARGIN), maxLeft));

    const preferred = this.position();
    const spaceBelow = viewportHeight - triggerRect.bottom - POPOVER_GAP - VIEWPORT_MARGIN;
    const spaceAbove = triggerRect.top - POPOVER_GAP - VIEWPORT_MARGIN;

    let placement: 'top' | 'bottom' = preferred;
    if (preferred === 'bottom' && spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
      placement = 'top';
    } else if (preferred === 'top' && spaceAbove < popoverHeight && spaceBelow > spaceAbove) {
      placement = 'bottom';
    }

    const rawTop =
      placement === 'bottom'
        ? triggerRect.bottom + POPOVER_GAP
        : triggerRect.top - POPOVER_GAP - popoverHeight;
    const maxTop = Math.max(VIEWPORT_MARGIN, viewportHeight - popoverHeight - VIEWPORT_MARGIN);
    const top = Math.round(Math.min(Math.max(rawTop, VIEWPORT_MARGIN), maxTop));

    this.popoverLeft.set(left);
    this.popoverTop.set(top);
    this.popoverPlacement.set(placement);
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiInput, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import {
  BEGINNER_GLOSSARY_TERMS,
  GLOSSARY_CATEGORY_LABELS,
  GlossaryCategory,
} from './glossary.terms';

type CategoryFilter = 'all' | GlossaryCategory;

const CATEGORY_FILTERS: readonly { readonly id: CategoryFilter; readonly label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'basics', label: GLOSSARY_CATEGORY_LABELS.basics },
  { id: 'orders', label: GLOSSARY_CATEGORY_LABELS.orders },
  { id: 'risk', label: GLOSSARY_CATEGORY_LABELS.risk },
  { id: 'metrics', label: GLOSSARY_CATEGORY_LABELS.metrics },
  { id: 'indicators', label: GLOSSARY_CATEGORY_LABELS.indicators },
];

@Component({
  selector: 'app-beginner-glossary',
  imports: [FormsModule, TuiButton, TuiBadge, TuiInput, TuiTextfield],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="modal-backdrop" role="presentation" (click)="onBackdropClick($event)">
        <div
          class="modal-dialog panel"
          role="dialog"
          aria-modal="true"
          aria-label="Словарь инвестора"
        >
          <div class="modal-header">
            <div>
              <h2 class="tui-text_h6 modal-title">Словарь инвестора</h2>
              <p class="tui-text_body-xs muted modal-subtitle">
                Основные термины биржи простыми словами — без сложной математики
              </p>
            </div>
            <button
              tuiButton
              type="button"
              size="xs"
              appearance="flat"
              aria-label="Закрыть словарь"
              (click)="closed.emit()"
            >
              ✕
            </button>
          </div>

          <div class="modal-toolbar">
            <div class="search-row">
              <tui-textfield tuiTextfieldSize="s" class="search-field">
                <input
                  id="glossary-search"
                  tuiInput
                  type="search"
                  placeholder="Найти термин: свеча, стоп-лосс, спред, RSI…"
                  aria-label="Поиск по словарю"
                  [ngModel]="query()"
                  (ngModelChange)="query.set($event ?? '')"
                />
              </tui-textfield>
              <span class="tui-text_body-xs muted count-badge num">
                {{ filteredTerms().length }} из {{ totalCount }}
              </span>
            </div>

            <div class="category-pills" role="group" aria-label="Разделы словаря">
              @for (cat of categories; track cat.id) {
                <button
                  type="button"
                  class="category-pill"
                  [class.active]="selectedCategory() === cat.id"
                  [attr.aria-pressed]="selectedCategory() === cat.id"
                  (click)="selectedCategory.set(cat.id)"
                >
                  {{ cat.label }}
                </button>
              }
            </div>
          </div>

          <div class="modal-body">
            @if (filteredTerms().length === 0) {
              <div class="empty-state">
                <p class="tui-text_body-m muted">По запросу «{{ query() }}» ничего не найдено.</p>
                <button
                  tuiButton
                  type="button"
                  size="s"
                  appearance="outline"
                  (click)="resetSearch()"
                >
                  Сбросить поиск
                </button>
              </div>
            } @else {
              <div class="terms-list">
                @for (item of filteredTerms(); track item.id) {
                  <article class="term-card" [attr.data-term-id]="item.id">
                    <div class="term-card-top">
                      <h3 class="term-name">{{ item.term }}</h3>
                      <span tuiBadge size="s" appearance="neutral">
                        {{ categoryLabels[item.category] }}
                      </span>
                    </div>
                    <p class="term-summary">{{ item.summary }}</p>
                    @if (item.example) {
                      <p class="term-example tui-text_body-xs muted">
                        <strong>Пример:</strong> {{ item.example }}
                      </p>
                    }
                  </article>
                }
              </div>
            }
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
      width: min(46rem, 100%);
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
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.95rem 1.15rem 0.8rem;
      border-bottom: 1px solid var(--tui-border-normal);
    }

    .modal-title {
      margin: 0;
    }

    .modal-subtitle {
      margin: 0.2rem 0 0;
    }

    .muted {
      color: var(--tui-text-secondary);
    }

    .modal-toolbar {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      padding: 0.85rem 1.15rem;
      border-bottom: 1px solid var(--tui-border-normal);
      background: var(--tui-background-elevation-2, var(--ttsc-surface-alt));
    }

    .search-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .search-field {
      flex: 1;
      min-width: 0;
    }

    .count-badge {
      white-space: nowrap;
    }

    .category-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .category-pill {
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      border: 1px solid var(--ttsc-border, var(--tui-border-normal));
      background: var(--tui-background-elevation-1);
      color: var(--tui-text-secondary);
      font: inherit;
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition:
        border-color 0.15s ease,
        background-color 0.15s ease,
        color 0.15s ease;

      &:hover {
        border-color: var(--tui-border-hover);
        color: var(--tui-text-primary);
      }

      &.active {
        border-color: var(--ttsc-accent, var(--tui-background-accent-1));
        background: var(--ttsc-accent-soft, var(--tui-background-neutral-1));
        color: var(--ttsc-accent-text, var(--tui-text-primary));
        font-weight: 600;
      }
    }

    .modal-body {
      padding: 1rem 1.15rem 1.15rem;
      overflow-y: auto;
    }

    .terms-list {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .term-card {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      padding: 0.8rem 0.9rem;
      border-radius: var(--tui-radius-m);
      border: 1px solid var(--tui-border-normal);
      background: var(--tui-background-elevation-2, var(--ttsc-surface-alt));
    }

    .term-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .term-name {
      margin: 0;
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--tui-text-primary);
    }

    .term-summary {
      margin: 0;
      font-size: 0.84rem;
      line-height: 1.45;
      color: var(--tui-text-primary);
    }

    .term-example {
      margin: 0;
      padding-top: 0.25rem;
      border-top: 1px dashed var(--tui-border-normal);
      line-height: 1.4;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 2rem 1rem;
      text-align: center;

      p {
        margin: 0;
      }
    }
  `,
})
export class BeginnerGlossary {
  readonly open = input(false);
  readonly initialQuery = input('');

  readonly closed = output<void>();

  protected readonly categories = CATEGORY_FILTERS;
  protected readonly categoryLabels = GLOSSARY_CATEGORY_LABELS;
  protected readonly totalCount = BEGINNER_GLOSSARY_TERMS.length;

  protected readonly query = signal('');
  protected readonly selectedCategory = signal<CategoryFilter>('all');

  protected readonly filteredTerms = computed(() => {
    const q = this.query().trim().toLowerCase();
    const category = this.selectedCategory();
    return BEGINNER_GLOSSARY_TERMS.filter((item) => {
      if (category !== 'all' && item.category !== category) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        item.term.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        (item.example?.toLowerCase().includes(q) ?? false)
      );
    });
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        const init = this.initialQuery();
        if (init) {
          this.query.set(init);
          this.selectedCategory.set('all');
        }
      }
    });
  }

  protected resetSearch(): void {
    this.query.set('');
    this.selectedCategory.set('all');
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
}

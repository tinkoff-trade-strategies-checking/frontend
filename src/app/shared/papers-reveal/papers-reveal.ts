import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiInput, TuiTextfield } from '@taiga-ui/core';
import { formatRub } from '../../features/report/report.format';
import {
  CATEGORY_ALL,
  CATEGORY_NO_SECTOR,
  normalizePaperSector,
  sectorDisplayLabel,
} from '../paper-categories';

export interface RevealablePaper {
  readonly id: string;
  readonly ticker: string;
  readonly name: string;
  readonly sector: string;
  readonly lotSize: number;
  readonly blindLabel?: string;
  readonly startPriceRub?: number;
}

export const REVEAL_COMPACT_THRESHOLD = 8;

interface RevealCategory {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

@Component({
  selector: 'app-papers-reveal',
  imports: [FormsModule, TuiInput, TuiTextfield],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!isCompact()) {
      <div class="reveal-grid">
        @if (periodLabel(); as label) {
          <div class="reveal-card">
            <span class="tui-text_body-xs muted">Период</span>
            <strong class="tui-text_body-l">{{ label }}</strong>
            @if (daysNote(); as note) {
              <span class="tui-text_body-xs muted">{{ note }}</span>
            }
          </div>
        }
        @for (paper of papers(); track paper.id) {
          <div class="reveal-card">
            <span class="tui-text_body-xs muted">{{ sectorLabel(paper.sector) }}</span>
            @if (blind() && paper.blindLabel) {
              <span class="tui-text_body-xs muted">{{ paper.blindLabel }}</span>
            }
            <strong class="tui-text_body-l">{{ paper.ticker }}</strong>
            <span class="tui-text_body-xs muted">
              {{ paper.name }}
              @if (paper.startPriceRub !== undefined) {
                · старт {{ formatRub(paper.startPriceRub) }}
              }
              · лот {{ paper.lotSize }}
            </span>
          </div>
        }
      </div>
    } @else {
      <div class="compact-reveal">
        <div class="compact-header-row">
          @if (periodLabel(); as label) {
            <div class="reveal-card period-card">
              <span class="tui-text_body-xs muted">Период</span>
              <strong class="tui-text_body-l">{{ label }}</strong>
              @if (daysNote(); as note) {
                <span class="tui-text_body-xs muted">{{ note }}</span>
              }
            </div>
          }

          <div class="compact-controls">
            <div class="compact-summary tui-text_body-xs muted">
              <span>Бумаг: {{ papers().length }}</span>
              <span>·</span>
              <span>Показано: {{ filteredPapers().length }}</span>
            </div>
            <tui-textfield tuiTextfieldSize="s" class="compact-search">
              <input
                tuiInput
                type="search"
                autocomplete="off"
                placeholder="Поиск по тикеру, названию или сектору…"
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
              />
            </tui-textfield>
          </div>
        </div>

        <div class="compact-categories" role="tablist" aria-label="Секторы бумаг">
          @for (cat of categories(); track cat.id) {
            @let active = effectiveCategory() === cat.id;
            <button
              type="button"
              role="tab"
              class="cat-chip"
              [class.active]="active"
              [attr.aria-selected]="active"
              (click)="activeCategory.set(cat.id)"
            >
              <span>{{ cat.label }}</span>
              <span class="cat-count num">{{ cat.count }}</span>
            </button>
          }
        </div>

        <div class="compact-grid-wrap">
          @if (filteredPapers().length === 0) {
            <div class="compact-empty tui-text_body-s muted">Бумаги по фильтру не найдены.</div>
          } @else {
            <div class="compact-grid">
              @for (paper of filteredPapers(); track paper.id) {
                <div class="reveal-card compact-card">
                  <div class="compact-card-top">
                    <strong class="tui-text_body-m">{{ paper.ticker }}</strong>
                    <span class="tui-text_body-xs muted">{{ sectorLabel(paper.sector) }}</span>
                  </div>
                  @if (blind() && paper.blindLabel) {
                    <span class="tui-text_body-xs muted">{{ paper.blindLabel }}</span>
                  }
                  <span class="tui-text_body-xs muted compact-card-meta">
                    {{ paper.name }}
                    @if (paper.startPriceRub !== undefined) {
                      · {{ formatRub(paper.startPriceRub) }}
                    }
                    · лот {{ paper.lotSize }}
                  </span>
                </div>
              }
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .muted {
      color: var(--tui-text-secondary);
    }

    .num {
      font-variant-numeric: tabular-nums;
    }

    .reveal-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: 0.75rem;
      padding: 0 1rem 1rem;
    }

    .reveal-card {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.75rem;
      background: var(--tui-background-neutral-1);
      border-radius: var(--tui-radius-m);
    }

    .compact-reveal {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      padding: 0 1rem 1rem;
    }

    .compact-header-row {
      display: flex;
      align-items: stretch;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .period-card {
      flex: 0 0 auto;
      min-width: 13rem;
    }

    .compact-controls {
      flex: 1 1 16rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.4rem;
      min-width: 0;
    }

    .compact-summary {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .compact-search {
      width: 100%;
    }

    .compact-categories {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-wrap: nowrap;
      overflow-x: auto;
      padding-bottom: 0.2rem;
      scrollbar-width: thin;
    }

    .cat-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.28rem;
      flex-shrink: 0;
      padding: 0.2rem 0.55rem;
      border-radius: 999px;
      border: 1px solid var(--tui-border-normal);
      background: var(--tui-background-base);
      color: inherit;
      font: inherit;
      font-size: 0.75rem;
      white-space: nowrap;
      cursor: pointer;
    }

    .cat-chip.active {
      border-color: var(--ttsc-accent, var(--tui-background-accent-1));
      background: var(--ttsc-accent-soft, var(--tui-background-neutral-1));
      color: var(--ttsc-accent-text, var(--tui-text-primary));
      font-weight: 600;
    }

    .cat-count {
      font-size: 0.7rem;
      opacity: 0.75;
    }

    .compact-grid-wrap {
      max-height: 16.5rem;
      overflow-y: auto;
      padding-right: 0.2rem;
      overscroll-behavior: contain;
    }

    .compact-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(12.5rem, 1fr));
      gap: 0.5rem;
    }

    .compact-card {
      padding: 0.55rem 0.65rem;
      gap: 0.15rem;
    }

    .compact-card-top {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.4rem;
    }

    .compact-card-meta {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .compact-empty {
      padding: 1rem;
      text-align: center;
      background: var(--tui-background-neutral-1);
      border-radius: var(--tui-radius-m);
    }
  `,
})
export class PapersReveal {
  readonly papers = input.required<readonly RevealablePaper[]>();
  readonly periodLabel = input<string | null>(null);
  readonly daysNote = input<string | null>(null);
  readonly blind = input(false);

  protected readonly searchQuery = signal('');
  protected readonly activeCategory = signal<string>(CATEGORY_ALL);
  protected readonly formatRub = formatRub;

  protected readonly isCompact = computed(() => this.papers().length > REVEAL_COMPACT_THRESHOLD);

  protected readonly categories = computed<readonly RevealCategory[]>(() => {
    const all = this.papers();
    const counts = new Map<string, number>();
    for (const paper of all) {
      const key = normalizePaperSector(paper.sector);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const sorted = Array.from(counts.entries()).sort((a, b) => {
      if (a[0] === CATEGORY_NO_SECTOR) {
        return 1;
      }
      if (b[0] === CATEGORY_NO_SECTOR) {
        return -1;
      }
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0], 'ru');
    });

    const result: RevealCategory[] = [{ id: CATEGORY_ALL, label: 'Все', count: all.length }];
    for (const [key, count] of sorted) {
      result.push({ id: key, label: sectorDisplayLabel(key), count });
    }
    return result;
  });

  protected readonly effectiveCategory = computed(() => {
    const current = this.activeCategory();
    if (current === CATEGORY_ALL) {
      return current;
    }
    return this.categories().some((c) => c.id === current) ? current : CATEGORY_ALL;
  });

  protected readonly filteredPapers = computed<readonly RevealablePaper[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const cat = this.effectiveCategory();
    let list = this.papers();

    if (cat !== CATEGORY_ALL) {
      list = list.filter((p) => normalizePaperSector(p.sector) === cat);
    }
    if (!query) {
      return list;
    }
    return list.filter(
      (p) =>
        p.ticker.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query) ||
        this.sectorLabel(p.sector).toLowerCase().includes(query),
    );
  });

  protected sectorLabel(sector: string): string {
    return sectorDisplayLabel(normalizePaperSector(sector));
  }
}

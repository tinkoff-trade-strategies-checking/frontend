import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiInput, TuiTextfield } from '@taiga-ui/core';
import {
  CATEGORY_ALL,
  CATEGORY_NO_SECTOR,
  normalizePaperSector,
  sectorDisplayLabel,
} from '../../../shared/paper-categories';
import { formatLots, formatPct, formatPrice } from '../arena.format';
import { ArenaPaper, ArenaPortfolio } from '../data/arena.models';

export const INLINE_TABS_LIMIT = 5;
const CATEGORY_HELD = '__held__';

interface SwitcherCategory {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

@Component({
  selector: 'app-arena-paper-switcher',
  imports: [FormsModule, TuiInput, TuiTextfield],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (useInlineTabs()) {
      <div class="papers-bar" role="tablist" aria-label="Бумаги сессии">
        @for (paper of papers(); track paper.id) {
          <button
            type="button"
            role="tab"
            class="paper-tab"
            [class.active]="paper.id === selectedPaperId()"
            [attr.aria-selected]="paper.id === selectedPaperId()"
            (click)="selectPaper.emit(paper.id)"
          >
            <div class="paper-top">
              <span class="paper-name">{{ paper.label }}</span>
              <span
                class="tui-text_body-xs num"
                [class.pos]="paper.changePct > 0"
                [class.neg]="paper.changePct < 0"
              >
                {{ formatPct(paper.changePct, true) }}
              </span>
            </div>
            <div class="paper-bottom">
              <span class="tui-text_body-xs muted">{{ sectorLabel(paper.sector) }}</span>
              <span class="paper-price num">{{ formatPrice(paper.lastPrice) }}</span>
            </div>
          </button>
        }
      </div>
    } @else {
      <div class="compact-switcher" aria-label="Выбор бумаги сессии">
        <div class="switcher-bar">
          <div class="switcher-nav">
            <button
              type="button"
              class="nav-btn"
              aria-label="Предыдущая бумага"
              [disabled]="papers().length <= 1"
              (click)="stepPaper(-1)"
            >
              ‹
            </button>
            <span class="nav-index tui-text_body-xs muted num">
              {{ selectedIndex() + 1 }} / {{ papers().length }}
            </span>
            <button
              type="button"
              class="nav-btn"
              aria-label="Следующая бумага"
              [disabled]="papers().length <= 1"
              (click)="stepPaper(1)"
            >
              ›
            </button>
          </div>

          @if (selectedPaper(); as active) {
            <button
              type="button"
              class="active-paper-trigger"
              [class.open]="dropdownOpen()"
              [attr.aria-expanded]="dropdownOpen()"
              aria-haspopup="listbox"
              (click)="toggleDropdown()"
            >
              <span class="trigger-main">
                <span class="paper-name">{{ active.label }}</span>
                <span class="tui-text_body-xs muted trigger-sector">
                  {{ sectorLabel(active.sector) }}
                </span>
                @let heldLots = positionLots(active.id);
                @if (heldLots > 0) {
                  <span class="held-pill num">{{ formatLots(heldLots) }}</span>
                }
              </span>
              <span class="trigger-stats">
                <span class="paper-price num">{{ formatPrice(active.lastPrice) }}</span>
                <span
                  class="tui-text_body-xs num"
                  [class.pos]="active.changePct > 0"
                  [class.neg]="active.changePct < 0"
                >
                  {{ formatPct(active.changePct, true) }}
                </span>
                <span class="trigger-chevron" aria-hidden="true">
                  {{ dropdownOpen() ? '▴' : '▾' }}
                </span>
              </span>
            </button>
          }

          <button
            type="button"
            class="catalog-toggle-btn"
            [class.open]="dropdownOpen()"
            (click)="toggleDropdown()"
          >
            Все бумаги ({{ papers().length }})
          </button>
        </div>

        @if (dropdownOpen()) {
          <div class="switcher-popover" role="region" aria-label="Каталог бумаг сессии">
            <div class="popover-search-row">
              <tui-textfield tuiTextfieldSize="s" class="popover-search-field">
                <input
                  id="arena-paper-search"
                  tuiInput
                  type="search"
                  autocomplete="off"
                  placeholder="Поиск по тикеру или сектору…"
                  [ngModel]="searchQuery()"
                  (ngModelChange)="searchQuery.set($event)"
                />
              </tui-textfield>
              @if (searchQuery()) {
                <button
                  type="button"
                  class="popover-search-clear"
                  aria-label="Очистить поиск"
                  (click)="searchQuery.set('')"
                >
                  ×
                </button>
              }
            </div>

            <div
              class="popover-categories"
              role="tablist"
              aria-label="Фильтр бумаг сессии по категориям"
            >
              @for (cat of categories(); track cat.id) {
                @let active = effectiveCategory() === cat.id;
                <button
                  type="button"
                  role="tab"
                  class="cat-chip"
                  [class.active]="active"
                  [attr.aria-selected]="active"
                  [attr.data-category]="cat.id"
                  (click)="activeCategory.set(cat.id)"
                >
                  <span>{{ cat.label }}</span>
                  <span class="cat-count num">{{ cat.count }}</span>
                </button>
              }
            </div>

            <div class="popover-list" role="listbox" aria-label="Список бумаг сессии">
              @if (filteredPapers().length === 0) {
                <div class="popover-empty tui-text_body-s muted">Подходящих бумаг не найдено.</div>
              } @else {
                @for (paper of filteredPapers(); track paper.id) {
                  @let selected = paper.id === selectedPaperId();
                  @let lots = positionLots(paper.id);
                  <button
                    type="button"
                    role="option"
                    class="popover-row"
                    [class.active]="selected"
                    [attr.aria-selected]="selected"
                    [attr.data-paper-id]="paper.id"
                    (click)="choosePaper(paper.id)"
                  >
                    <span class="row-left">
                      <span class="paper-name">{{ paper.label }}</span>
                      <span class="tui-text_body-xs muted row-sector">
                        {{ sectorLabel(paper.sector) }}
                      </span>
                      @if (lots > 0) {
                        <span class="held-pill num">{{ formatLots(lots) }}</span>
                      }
                    </span>
                    <span class="row-right">
                      <span class="num row-price">{{ formatPrice(paper.lastPrice) }}</span>
                      <span
                        class="tui-text_body-xs num row-change"
                        [class.pos]="paper.changePct > 0"
                        [class.neg]="paper.changePct < 0"
                      >
                        {{ formatPct(paper.changePct, true) }}
                      </span>
                    </span>
                  </button>
                }
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: `
    .papers-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
      border-bottom: 1px solid var(--tui-border-normal);
    }

    .paper-tab {
      appearance: none;
      border: 0;
      border-left: 1px solid var(--tui-border-normal);
      background: transparent;
      padding: 0.75rem 1rem;
      text-align: left;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      color: inherit;
      font: inherit;
      position: relative;
    }

    .paper-tab:first-child {
      border-left: 0;
    }

    .paper-tab.active {
      background: var(--tui-background-neutral-1);
      box-shadow: inset 0 -2px 0 var(--ttsc-accent, var(--tui-text-action));
    }

    .paper-top,
    .paper-bottom {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .paper-name {
      font-weight: 700;
      white-space: nowrap;
    }

    .paper-price {
      font-size: 1rem;
      font-weight: 700;
    }

    .muted {
      color: var(--tui-text-secondary);
    }

    .num {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .pos {
      color: var(--tui-text-positive);
    }

    .neg {
      color: var(--tui-text-negative);
    }

    .compact-switcher {
      position: relative;
      border-bottom: 1px solid var(--tui-border-normal);
    }

    .switcher-bar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      flex-wrap: nowrap;
    }

    .switcher-nav {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      flex-shrink: 0;
    }

    .nav-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: var(--tui-radius-s);
      border: 1px solid var(--tui-border-normal);
      background: var(--tui-background-base);
      color: inherit;
      font-size: 1rem;
      line-height: 1;
      cursor: pointer;
    }

    .nav-btn:hover:not(:disabled) {
      background: var(--tui-background-neutral-1-hover);
    }

    .nav-btn:disabled {
      opacity: 0.45;
      cursor: default;
    }

    .nav-index {
      min-width: 3.1rem;
      text-align: center;
    }

    .active-paper-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex: 1;
      min-width: 0;
      padding: 0.45rem 0.75rem;
      border-radius: var(--tui-radius-m);
      border: 1px solid var(--tui-border-normal);
      background: var(--tui-background-neutral-1);
      color: inherit;
      font: inherit;
      cursor: pointer;
      text-align: left;
    }

    .active-paper-trigger:hover,
    .active-paper-trigger.open {
      border-color: var(--ttsc-accent, var(--tui-border-hover));
    }

    .trigger-main {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
      overflow: hidden;
    }

    .trigger-sector {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .trigger-stats {
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
      flex-shrink: 0;
    }

    .trigger-chevron {
      color: var(--tui-text-secondary);
      font-size: 0.85rem;
    }

    .held-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.08rem 0.4rem;
      border-radius: 999px;
      background: var(--ttsc-accent-soft, var(--tui-background-neutral-2));
      color: var(--ttsc-accent-text, var(--tui-text-primary));
      font-size: 0.7rem;
      font-weight: 600;
      flex-shrink: 0;
    }

    .catalog-toggle-btn {
      flex-shrink: 0;
      padding: 0.45rem 0.7rem;
      border-radius: var(--tui-radius-m);
      border: 1px solid var(--tui-border-normal);
      background: transparent;
      color: var(--tui-text-secondary);
      font: inherit;
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
    }

    .catalog-toggle-btn:hover,
    .catalog-toggle-btn.open {
      border-color: var(--ttsc-accent, var(--tui-border-hover));
      color: var(--tui-text-primary);
      background: var(--tui-background-neutral-1);
    }

    .switcher-popover {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      padding: 0.6rem 0.75rem 0.75rem;
      border-top: 1px solid var(--tui-border-normal);
      background: var(--tui-background-base);
    }

    .popover-search-row {
      position: relative;
      display: flex;
      align-items: center;
    }

    .popover-search-field {
      width: 100%;
    }

    .popover-search-clear {
      position: absolute;
      right: 0.45rem;
      width: 1.35rem;
      height: 1.35rem;
      border: none;
      border-radius: 999px;
      background: transparent;
      color: var(--tui-text-secondary);
      cursor: pointer;
      font-size: 1rem;
      line-height: 1;
    }

    .popover-categories {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-wrap: nowrap;
      overflow-x: auto;
      padding-bottom: 0.15rem;
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

    .cat-chip:hover {
      border-color: var(--ttsc-accent, var(--tui-border-hover));
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

    .popover-list {
      display: flex;
      flex-direction: column;
      max-height: 15.5rem;
      overflow-y: auto;
      border: 1px solid var(--tui-border-normal);
      border-radius: var(--tui-radius-m);
      overscroll-behavior: contain;
    }

    .popover-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      width: 100%;
      padding: 0.45rem 0.7rem;
      border: 0;
      border-bottom: 1px solid var(--tui-border-normal);
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 0.8125rem;
      text-align: left;
      cursor: pointer;
    }

    .popover-row:last-child {
      border-bottom: 0;
    }

    .popover-row:hover {
      background: var(--tui-background-neutral-1-hover);
    }

    .popover-row.active {
      background: var(--ttsc-accent-soft, var(--tui-background-neutral-1));
    }

    .row-left {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
      overflow: hidden;
    }

    .row-sector {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .row-right {
      display: inline-flex;
      align-items: center;
      gap: 0.65rem;
      flex-shrink: 0;
    }

    .row-price {
      font-weight: 600;
    }

    .row-change {
      min-width: 3.6rem;
      text-align: right;
    }

    .popover-empty {
      padding: 1rem;
      text-align: center;
    }

    @media (max-width: 680px) {
      .catalog-toggle-btn,
      .trigger-sector {
        display: none;
      }
    }
  `,
})
export class ArenaPaperSwitcher {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly papers = input.required<readonly ArenaPaper[]>();
  readonly selectedPaperId = input.required<string>();
  readonly portfolio = input<ArenaPortfolio | null>(null);

  readonly selectPaper = output<string>();

  protected readonly dropdownOpen = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly activeCategory = signal<string>(CATEGORY_ALL);

  protected readonly formatPct = formatPct;
  protected readonly formatPrice = formatPrice;
  protected readonly formatLots = formatLots;

  protected readonly useInlineTabs = computed(() => this.papers().length <= INLINE_TABS_LIMIT);

  protected readonly selectedIndex = computed(() => {
    const idx = this.papers().findIndex((p) => p.id === this.selectedPaperId());
    return idx >= 0 ? idx : 0;
  });

  protected readonly selectedPaper = computed<ArenaPaper | null>(() => {
    const list = this.papers();
    return list[this.selectedIndex()] ?? null;
  });

  protected readonly heldPaperIds = computed(() => {
    const positions = this.portfolio()?.positions ?? {};
    const held = new Set<string>();
    for (const [id, pos] of Object.entries(positions)) {
      if (pos.lots > 0) {
        held.add(id);
      }
    }
    return held;
  });

  protected readonly categories = computed<readonly SwitcherCategory[]>(() => {
    const all = this.papers();
    const held = this.heldPaperIds();
    const sectorCounts = new Map<string, number>();

    for (const paper of all) {
      const key = normalizePaperSector(paper.sector);
      sectorCounts.set(key, (sectorCounts.get(key) ?? 0) + 1);
    }

    const sortedSectors = Array.from(sectorCounts.entries()).sort((a, b) => {
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

    const result: SwitcherCategory[] = [
      { id: CATEGORY_ALL, label: 'Все', count: all.length },
      { id: CATEGORY_HELD, label: 'В портфеле', count: held.size },
    ];
    for (const [key, count] of sortedSectors) {
      result.push({ id: key, label: sectorDisplayLabel(key), count });
    }
    return result;
  });

  protected readonly effectiveCategory = computed(() => {
    const current = this.activeCategory();
    if (current === CATEGORY_ALL || current === CATEGORY_HELD) {
      return current;
    }
    return this.categories().some((c) => c.id === current) ? current : CATEGORY_ALL;
  });

  protected readonly filteredPapers = computed<readonly ArenaPaper[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const cat = this.effectiveCategory();
    const held = this.heldPaperIds();
    let list = this.papers();

    if (cat === CATEGORY_HELD) {
      list = list.filter((p) => held.has(p.id));
    } else if (cat !== CATEGORY_ALL) {
      list = list.filter((p) => normalizePaperSector(p.sector) === cat);
    }

    if (!query) {
      return list;
    }
    return list.filter(
      (p) =>
        p.label.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query) ||
        this.sectorLabel(p.sector).toLowerCase().includes(query),
    );
  });

  protected positionLots(paperId: string): number {
    return this.portfolio()?.positions[paperId]?.lots ?? 0;
  }

  protected sectorLabel(sector: string): string {
    return sectorDisplayLabel(normalizePaperSector(sector));
  }

  protected toggleDropdown(): void {
    this.dropdownOpen.update((open) => !open);
  }

  protected choosePaper(paperId: string): void {
    this.selectPaper.emit(paperId);
    this.dropdownOpen.set(false);
  }

  protected stepPaper(delta: -1 | 1): void {
    const list = this.papers();
    if (list.length <= 1) {
      return;
    }
    const nextIdx = (this.selectedIndex() + delta + list.length) % list.length;
    this.selectPaper.emit(list[nextIdx].id);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.dropdownOpen()) {
      this.dropdownOpen.set(false);
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.dropdownOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.dropdownOpen.set(false);
    }
  }
}

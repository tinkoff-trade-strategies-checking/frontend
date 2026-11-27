import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiInput, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { PaperFundamentalsModal } from '../paper-fundamentals/paper-fundamentals-modal';
import {
  CATEGORY_ALL,
  CATEGORY_NO_SECTOR,
  CATEGORY_SELECTED,
  NO_SECTOR_LABEL,
  normalizePaperSector,
  sectorDisplayLabel,
} from '../paper-categories';

export {
  CATEGORY_ALL,
  CATEGORY_NO_SECTOR,
  CATEGORY_SELECTED,
  NO_SECTOR_LABEL,
  normalizePaperSector,
  sectorDisplayLabel,
};

export interface SelectablePaper {
  readonly id: string;
  readonly ticker: string;
  readonly name: string;
  readonly sector: string;
}

export const COLLAPSED_CHIPS_LIMIT = 24;

export interface PaperCategoryChip {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

export interface PaperSectorGroup {
  readonly key: string;
  readonly label: string;
  readonly papers: readonly SelectablePaper[];
  readonly selectedCount: number;
}

@Component({
  selector: 'app-paper-picker',
  imports: [FormsModule, TuiBadge, TuiButton, TuiInput, TuiTextfield, PaperFundamentalsModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './paper-picker.html',
  styleUrl: './paper-picker.less',
})
export class PaperPicker {
  readonly papers = input.required<readonly SelectablePaper[]>();
  readonly selectedIds = input.required<readonly string[]>();
  readonly loading = input(false);
  readonly compact = input(false);
  readonly minSelected = input(1);
  readonly inputId = input('paper-picker-search');
  readonly showFundamentals = input(true);

  readonly selectedIdsChange = output<readonly string[]>();

  protected readonly searchQuery = signal('');
  protected readonly chipsExpanded = signal(false);
  protected readonly activeCategory = signal<string>(CATEGORY_ALL);
  protected readonly groupBySector = signal(true);
  protected readonly collapsedGroups = signal<ReadonlySet<string>>(new Set());
  protected readonly inspectedPaper = signal<SelectablePaper | null>(null);
  protected readonly visibleLimit = signal(60);

  protected readonly sectorLabelsById = computed<ReadonlyMap<string, string>>(() => {
    const map = new Map<string, string>();
    for (const paper of this.papers()) {
      map.set(paper.id, sectorDisplayLabel(normalizePaperSector(paper.sector)));
    }
    return map;
  });

  protected readonly normalizedQuery = computed(() => this.searchQuery().trim().toLowerCase());

  protected readonly selectedSet = computed(() => new Set(this.selectedIds()));

  protected readonly categories = computed<readonly PaperCategoryChip[]>(() => {
    const all = this.papers();
    const sectorCounts = new Map<string, number>();
    for (const paper of all) {
      const key = normalizePaperSector(paper.sector);
      sectorCounts.set(key, (sectorCounts.get(key) ?? 0) + 1);
    }

    const sectorEntries = Array.from(sectorCounts.entries()).sort((a, b) => {
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

    const chips: PaperCategoryChip[] = [
      { id: CATEGORY_ALL, label: 'Все', count: all.length },
      { id: CATEGORY_SELECTED, label: 'Выбранные', count: this.selectedPapers().length },
    ];
    for (const [key, count] of sectorEntries) {
      chips.push({ id: key, label: sectorDisplayLabel(key), count });
    }
    return chips;
  });

  protected readonly effectiveCategory = computed(() => {
    const current = this.activeCategory();
    if (current === CATEGORY_ALL || current === CATEGORY_SELECTED) {
      return current;
    }
    const exists = this.categories().some((cat) => cat.id === current);
    return exists ? current : CATEGORY_ALL;
  });

  protected readonly hasMultipleSectors = computed(() => {
    const sectors = new Set<string>();
    for (const paper of this.papers()) {
      sectors.add(normalizePaperSector(paper.sector));
      if (sectors.size > 1) {
        return true;
      }
    }
    return false;
  });

  protected readonly isFiltered = computed(
    () => Boolean(this.normalizedQuery()) || this.effectiveCategory() !== CATEGORY_ALL,
  );

  protected readonly filteredPapers = computed<readonly SelectablePaper[]>(() => {
    const query = this.normalizedQuery();
    const category = this.effectiveCategory();
    const selected = this.selectedSet();
    let list = this.papers();

    if (category === CATEGORY_SELECTED) {
      list = list.filter((paper) => selected.has(paper.id));
    } else if (category !== CATEGORY_ALL) {
      list = list.filter((paper) => normalizePaperSector(paper.sector) === category);
    }

    if (!query) {
      return list;
    }
    return list.filter(
      (paper) =>
        paper.ticker.toLowerCase().includes(query) ||
        paper.name.toLowerCase().includes(query) ||
        sectorDisplayLabel(normalizePaperSector(paper.sector)).toLowerCase().includes(query),
    );
  });

  protected readonly showGroupedView = computed(
    () =>
      this.groupBySector() &&
      this.hasMultipleSectors() &&
      (this.effectiveCategory() === CATEGORY_ALL || this.effectiveCategory() === CATEGORY_SELECTED),
  );

  protected readonly groupedPapers = computed<readonly PaperSectorGroup[]>(() => {
    const filtered = this.filteredPapers();
    const selected = this.selectedSet();
    const map = new Map<string, SelectablePaper[]>();

    for (const paper of filtered) {
      const key = normalizePaperSector(paper.sector);
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(paper);
      } else {
        map.set(key, [paper]);
      }
    }

    return Array.from(map.entries())
      .sort((a, b) => {
        if (a[0] === CATEGORY_NO_SECTOR) {
          return 1;
        }
        if (b[0] === CATEGORY_NO_SECTOR) {
          return -1;
        }
        if (b[1].length !== a[1].length) {
          return b[1].length - a[1].length;
        }
        return a[0].localeCompare(b[0], 'ru');
      })
      .map(([key, papers]) => ({
        key,
        label: sectorDisplayLabel(key),
        papers,
        selectedCount: papers.reduce((acc, p) => acc + (selected.has(p.id) ? 1 : 0), 0),
      }));
  });

  protected readonly visibleFilteredPapers = computed<readonly SelectablePaper[]>(() =>
    this.filteredPapers().slice(0, this.visibleLimit()),
  );

  protected readonly visibleGroupedPapers = computed<readonly PaperSectorGroup[]>(() => {
    const limit = this.visibleLimit();
    const result: PaperSectorGroup[] = [];
    let remaining = limit;
    for (const group of this.groupedPapers()) {
      if (remaining <= 0) {
        break;
      }
      if (group.papers.length <= remaining) {
        result.push(group);
        remaining -= group.papers.length;
      } else {
        result.push({
          ...group,
          papers: group.papers.slice(0, remaining),
        });
        remaining = 0;
      }
    }
    return result;
  });

  protected readonly hiddenPapersCount = computed(() =>
    Math.max(0, this.filteredPapers().length - this.visibleLimit()),
  );

  protected readonly selectedPapers = computed<readonly SelectablePaper[]>(() => {
    const selected = this.selectedSet();
    if (selected.size === 0) {
      return [];
    }
    return this.papers().filter((paper) => selected.has(paper.id));
  });

  protected readonly visibleSelectedChips = computed<readonly SelectablePaper[]>(() => {
    const selected = this.selectedPapers();
    if (this.chipsExpanded() || selected.length <= COLLAPSED_CHIPS_LIMIT) {
      return selected;
    }
    return selected.slice(0, COLLAPSED_CHIPS_LIMIT);
  });

  protected readonly hiddenSelectedCount = computed(() =>
    Math.max(0, this.selectedPapers().length - this.visibleSelectedChips().length),
  );

  protected readonly canSelectAll = computed(() => {
    const all = this.papers();
    if (all.length === 0) {
      return false;
    }
    const selected = this.selectedSet();
    return all.some((paper) => !selected.has(paper.id));
  });

  protected readonly canSelectFiltered = computed(() => {
    if (!this.isFiltered()) {
      return false;
    }
    const filtered = this.filteredPapers();
    if (filtered.length === 0) {
      return false;
    }
    const selected = this.selectedSet();
    return filtered.some((paper) => !selected.has(paper.id));
  });

  protected readonly selectFilteredLabel = computed(() =>
    this.normalizedQuery() || this.effectiveCategory() === CATEGORY_ALL
      ? 'Выбрать найденные'
      : 'Выбрать в категории',
  );

  protected readonly canClear = computed(() => this.selectedIds().length > 0);

  protected onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.visibleLimit.set(60);
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
    this.visibleLimit.set(60);
  }

  protected resetFilters(): void {
    this.searchQuery.set('');
    this.activeCategory.set(CATEGORY_ALL);
    this.visibleLimit.set(60);
  }

  protected selectCategory(categoryId: string): void {
    this.activeCategory.set(categoryId);
    this.visibleLimit.set(60);
  }

  protected toggleGroupBySector(): void {
    this.groupBySector.update((v) => !v);
    this.visibleLimit.set(60);
  }

  protected showMorePapers(): void {
    this.visibleLimit.update((limit) => limit + 60);
  }

  protected isGroupCollapsed(groupKey: string): boolean {
    return this.collapsedGroups().has(groupKey);
  }

  protected toggleGroupCollapsed(groupKey: string): void {
    this.collapsedGroups.update((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }

  protected toggleGroupSelection(group: PaperSectorGroup, event: Event): void {
    event.stopPropagation();
    const next = new Set(this.selectedIds());
    const allSelected = group.selectedCount === group.papers.length;
    for (const paper of group.papers) {
      if (allSelected) {
        next.delete(paper.id);
      } else {
        next.add(paper.id);
      }
    }
    const ordered = this.papers()
      .filter((paper) => next.has(paper.id))
      .map((paper) => paper.id);
    this.selectedIdsChange.emit(ordered);
  }

  protected toggle(paperId: string): void {
    const current = this.selectedIds();
    if (this.selectedSet().has(paperId)) {
      this.selectedIdsChange.emit(current.filter((id) => id !== paperId));
    } else {
      this.selectedIdsChange.emit([...current, paperId]);
    }
  }

  protected remove(paperId: string): void {
    if (!this.selectedSet().has(paperId)) {
      return;
    }
    this.selectedIdsChange.emit(this.selectedIds().filter((id) => id !== paperId));
  }

  protected selectAll(): void {
    if (!this.canSelectAll()) {
      return;
    }
    this.selectedIdsChange.emit(this.papers().map((paper) => paper.id));
  }

  protected selectFiltered(): void {
    if (!this.canSelectFiltered()) {
      return;
    }
    const next = new Set(this.selectedIds());
    for (const paper of this.filteredPapers()) {
      next.add(paper.id);
    }
    const ordered = this.papers()
      .filter((paper) => next.has(paper.id))
      .map((paper) => paper.id);
    this.selectedIdsChange.emit(ordered);
  }

  protected clearAll(): void {
    if (!this.canClear()) {
      return;
    }
    this.chipsExpanded.set(false);
    this.selectedIdsChange.emit([]);
  }

  protected toggleChipsExpanded(): void {
    this.chipsExpanded.update((expanded) => !expanded);
  }

  protected paperSectorLabel(paper: SelectablePaper): string {
    return sectorDisplayLabel(normalizePaperSector(paper.sector));
  }

  protected openFundamentals(paper: SelectablePaper, event: Event): void {
    event.stopPropagation();
    this.inspectedPaper.set(paper);
  }

  protected closeFundamentals(): void {
    this.inspectedPaper.set(null);
  }
}

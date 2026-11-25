import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiInput, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';

export interface SelectablePaper {
  readonly id: string;
  readonly ticker: string;
  readonly name: string;
  readonly sector: string;
}

export const COLLAPSED_CHIPS_LIMIT = 24;

@Component({
  selector: 'app-paper-picker',
  imports: [FormsModule, TuiBadge, TuiButton, TuiInput, TuiTextfield],
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

  readonly selectedIdsChange = output<readonly string[]>();

  protected readonly searchQuery = signal('');
  protected readonly chipsExpanded = signal(false);

  protected readonly normalizedQuery = computed(() => this.searchQuery().trim().toLowerCase());

  protected readonly selectedSet = computed(() => new Set(this.selectedIds()));

  protected readonly filteredPapers = computed<readonly SelectablePaper[]>(() => {
    const query = this.normalizedQuery();
    const all = this.papers();
    if (!query) {
      return all;
    }
    return all.filter(
      (paper) =>
        paper.ticker.toLowerCase().includes(query) ||
        paper.name.toLowerCase().includes(query) ||
        paper.sector.toLowerCase().includes(query),
    );
  });

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
    if (!this.normalizedQuery()) {
      return false;
    }
    const filtered = this.filteredPapers();
    if (filtered.length === 0) {
      return false;
    }
    const selected = this.selectedSet();
    return filtered.some((paper) => !selected.has(paper.id));
  });

  protected readonly canClear = computed(() => this.selectedIds().length > 0);

  protected onSearchChange(value: string): void {
    this.searchQuery.set(value);
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
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
}

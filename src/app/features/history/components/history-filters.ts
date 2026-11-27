import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiTextfield } from '@taiga-ui/core';
import { TuiChevron, TuiSegmented, TuiSelect } from '@taiga-ui/kit';
import { TermHint } from '../../../shared/term-hint/term-hint';
import {
  HistoryKindFilter,
  HistoryRegimeFilter,
  HistoryStatusFilter,
} from '../data/history.models';

export interface FilterOption<T extends string> {
  readonly id: T;
  readonly label: string;
}

@Component({
  selector: 'app-history-filters',
  imports: [FormsModule, TermHint, TuiButton, TuiChevron, TuiSegmented, TuiSelect, TuiTextfield],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filters-bar">
      <div class="filter-group">
        <span class="tui-text_body-xs muted">Тип</span>
        <tui-segmented
          size="s"
          [activeItemIndex]="kindIndex()"
          (activeItemIndexChange)="onKindIndexChange($event)"
        >
          @for (opt of kindFilters(); track opt.id) {
            <button type="button">{{ opt.label }}</button>
          }
        </tui-segmented>
      </div>

      <div class="filter-group">
        <span class="tui-text_body-xs muted">Статус</span>
        <tui-textfield
          tuiChevron
          tuiTextfieldSize="s"
          class="filter-select"
          [tuiTextfieldCleaner]="false"
          [stringify]="statusStringify"
        >
          <select
            aria-label="Статус"
            tuiSelect
            [items]="statusIds()"
            [ngModel]="status()"
            (ngModelChange)="statusChange.emit($event)"
          ></select>
        </tui-textfield>
      </div>

      <div class="filter-group">
        <span class="tui-text_body-xs muted">Период</span>
        <tui-textfield
          tuiChevron
          tuiTextfieldSize="s"
          class="filter-select"
          [tuiTextfieldCleaner]="false"
          [stringify]="regimeStringify"
        >
          <select
            aria-label="Период"
            tuiSelect
            [items]="regimeIds()"
            [ngModel]="regime()"
            (ngModelChange)="regimeChange.emit($event)"
          ></select>
        </tui-textfield>
      </div>

      <div class="filter-actions">
        <div class="blind-filter-wrap">
          <button
            tuiButton
            type="button"
            size="s"
            [appearance]="blindOnly() ? 'primary' : 'outline'"
            [attr.aria-pressed]="blindOnly()"
            (click)="blindToggle.emit()"
          >
            Только слепые
          </button>
          <app-term-hint
            term="Слепой режим"
            text="В слепом режиме названия компаний и реальные даты скрыты до конца сессии — вы тренируете стратегию, а не память."
          />
        </div>
        <span class="tui-text_body-s muted count-label">Всего: {{ total() }}</span>
      </div>
    </div>
  `,
  styles: `
    .filters-bar {
      display: flex;
      align-items: flex-end;
      gap: 1rem;
      flex-wrap: wrap;
      padding: 1rem;
      border-bottom: 1px solid var(--tui-border-normal);
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .filter-select {
      min-width: 10.5rem;
    }

    .filter-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-left: auto;
    }

    .blind-filter-wrap {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .muted {
      color: var(--tui-text-secondary);
    }

    .count-label {
      white-space: nowrap;
    }
  `,
})
export class HistoryFilters {
  readonly kindFilters = input.required<readonly FilterOption<HistoryKindFilter>[]>();
  readonly statusFilters = input.required<readonly FilterOption<HistoryStatusFilter>[]>();
  readonly regimeFilters = input.required<readonly FilterOption<HistoryRegimeFilter>[]>();
  readonly kind = input.required<HistoryKindFilter>();
  readonly status = input.required<HistoryStatusFilter>();
  readonly regime = input.required<HistoryRegimeFilter>();
  readonly blindOnly = input.required<boolean>();
  readonly total = input.required<number>();

  readonly kindChange = output<HistoryKindFilter>();
  readonly statusChange = output<HistoryStatusFilter>();
  readonly regimeChange = output<HistoryRegimeFilter>();
  readonly blindToggle = output<void>();

  protected readonly statusIds = computed(() => this.statusFilters().map((f) => f.id));
  protected readonly regimeIds = computed(() => this.regimeFilters().map((f) => f.id));

  protected readonly statusStringify = (id: HistoryStatusFilter): string =>
    this.statusFilters().find((f) => f.id === id)?.label ?? id;

  protected readonly regimeStringify = (id: HistoryRegimeFilter): string =>
    this.regimeFilters().find((f) => f.id === id)?.label ?? id;

  protected kindIndex(): number {
    return Math.max(
      0,
      this.kindFilters().findIndex((item) => item.id === this.kind()),
    );
  }

  protected onKindIndexChange(index: number): void {
    const next = this.kindFilters()[index];
    if (next && next.id !== this.kind()) {
      this.kindChange.emit(next.id);
    }
  }
}

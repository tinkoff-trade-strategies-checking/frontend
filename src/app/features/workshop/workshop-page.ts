import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiInput, TuiNotification, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge, TuiSegmented, TuiSelect } from '@taiga-ui/kit';
import { StubWorkshopApi } from './data/stub-workshop.api';
import { WORKSHOP_API, WORKSHOP_COMPARE_LIMIT, WorkshopSortField } from './data/workshop.models';
import {
  formatLinterSummary,
  formatWorkshopDateTime,
  WORKSHOP_SORT_LABELS,
} from './workshop.format';
import { WorkshopStore } from './workshop.store';

const SORT_OPTIONS: readonly { readonly id: WorkshopSortField; readonly label: string }[] = [
  { id: 'published_desc', label: WORKSHOP_SORT_LABELS.published_desc },
  { id: 'name_asc', label: WORKSHOP_SORT_LABELS.name_asc },
  { id: 'author_asc', label: WORKSHOP_SORT_LABELS.author_asc },
];

@Component({
  selector: 'app-workshop-page',
  imports: [
    FormsModule,
    TuiButton,
    TuiBadge,
    TuiInput,
    TuiNotification,
    TuiSegmented,
    TuiSelect,
    TuiTextfield,
  ],
  providers: [{ provide: WORKSHOP_API, useClass: StubWorkshopApi }, WorkshopStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workshop-page.html',
  styleUrl: './workshop-page.less',
})
export class WorkshopPage implements OnInit {
  protected readonly store = inject(WorkshopStore);

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly compareLimit = WORKSHOP_COMPARE_LIMIT;
  protected readonly dslPendingHint = 'Пока недоступно';
  protected readonly authorOptions = computed<readonly (string | null)[]>(() => [
    null,
    ...this.store.authors().map((author) => author.id),
  ]);
  protected readonly authorStringify = (authorId: string | null): string => {
    if (authorId === null) {
      return 'Все авторы';
    }
    return this.store.authors().find((author) => author.id === authorId)?.name ?? authorId;
  };

  protected readonly formatDateTime = formatWorkshopDateTime;
  protected readonly formatLinter = formatLinterSummary;

  ngOnInit(): void {
    void this.store.load();
  }

  protected sortIndex(current: WorkshopSortField): number {
    return Math.max(
      0,
      this.sortOptions.findIndex((opt) => opt.id === current),
    );
  }

  protected onSortIndexChange(index: number): void {
    const next = this.sortOptions[index];
    if (next) {
      this.store.setSort(next.id);
    }
  }
}

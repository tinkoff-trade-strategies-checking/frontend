import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TuiButton, TuiInput, TuiNotification, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge, TuiSegmented, TuiSelect } from '@taiga-ui/kit';
import { LAUNCH_API_IMPL, RUNS_API_IMPL, WORKSHOP_API_IMPL } from '../../api-impls';
import { LAUNCH_API } from '../launch/data/launch.models';
import { RUNS_API } from '../runs/data/runs.models';
import { WorkshopDraftEditor } from './components/workshop-draft-editor';
import { WorkshopRunForm } from './components/workshop-run-form';
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
    WorkshopDraftEditor,
    WorkshopRunForm,
  ],
  providers: [
    { provide: WORKSHOP_API, useClass: WORKSHOP_API_IMPL },
    { provide: RUNS_API, useClass: RUNS_API_IMPL },
    { provide: LAUNCH_API, useClass: LAUNCH_API_IMPL },
    WorkshopStore,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workshop-page.html',
  styleUrl: './workshop-page.less',
})
export class WorkshopPage implements OnInit {
  protected readonly store = inject(WorkshopStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly compareLimit = WORKSHOP_COMPARE_LIMIT;
  protected readonly showSidePanel = computed(
    () =>
      this.store.selectedId() !== null ||
      this.store.editorMode() !== 'closed' ||
      this.store.runFormOpen(),
  );
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
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (params.get('create') === '1') {
        this.store.openCreateDraft();
      }
    });
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

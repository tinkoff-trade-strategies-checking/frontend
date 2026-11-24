import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TuiButton, TuiInput, TuiNotification, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge, TuiChevron, TuiSegmented, TuiSelect } from '@taiga-ui/kit';
import { LAUNCH_API_IMPL, RUNS_API_IMPL, WORKSHOP_API_IMPL } from '../../api-impls';
import { LAUNCH_API } from '../launch/data/launch.models';
import { RUNS_API } from '../runs/data/runs.models';
import { WorkshopCodeViewer } from './components/workshop-code-viewer';
import { WorkshopDraftEditor } from './components/workshop-draft-editor';
import { WorkshopDslGuide } from './components/workshop-dsl-guide';
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
    RouterLink,
    TuiButton,
    TuiBadge,
    TuiChevron,
    TuiInput,
    TuiNotification,
    TuiSegmented,
    TuiSelect,
    TuiTextfield,
    WorkshopCodeViewer,
    WorkshopDraftEditor,
    WorkshopDslGuide,
    WorkshopRunForm,
  ],
  providers: [
    { provide: WORKSHOP_API, useClass: WORKSHOP_API_IMPL },
    { provide: RUNS_API, useClass: RUNS_API_IMPL },
    { provide: LAUNCH_API, useClass: LAUNCH_API_IMPL },
    WorkshopStore,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscapeKey($event)',
  },
  templateUrl: './workshop-page.html',
  styleUrl: './workshop-page.less',
})
export class WorkshopPage implements OnInit {
  protected readonly store = inject(WorkshopStore);
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sortOptions = computed(() =>
    this.store.mineOnly() ? SORT_OPTIONS.filter((opt) => opt.id !== 'author_asc') : SORT_OPTIONS,
  );
  protected readonly compareLimit = WORKSHOP_COMPARE_LIMIT;
  protected readonly dslGuideOpen = signal(false);
  protected readonly showSidePanel = computed(
    () =>
      this.store.selectedId() !== null ||
      this.store.editorMode() !== 'closed' ||
      this.store.runFormOpen(),
  );
  protected readonly authorOptions = computed<readonly string[]>(() => [
    '',
    ...this.store.authors().map((author) => author.id),
  ]);
  protected readonly authorStringify = (authorId: string): string => {
    if (!authorId) {
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
      const compareParam = params.get('compare');
      if (compareParam) {
        void this.store.restoreCompare(compareParam.split(','));
      }
      const algoId = params.get('algo');
      if (algoId) {
        void this.openFromQuery(algoId, params.get('run') === '1');
      }
    });
  }

  private async openFromQuery(algoId: string, openRun: boolean): Promise<void> {
    await this.store.selectAlgorithm(algoId);
    if (openRun) {
      this.store.openRunForm();
    }
  }

  protected sortIndex(current: WorkshopSortField): number {
    return Math.max(
      0,
      this.sortOptions().findIndex((opt) => opt.id === current),
    );
  }

  protected onSortIndexChange(index: number): void {
    const next = this.sortOptions()[index];
    if (next) {
      this.store.setSort(next.id);
    }
  }

  protected openDslGuide(): void {
    this.dslGuideOpen.set(true);
  }

  protected closeDslGuide(): void {
    this.dslGuideOpen.set(false);
  }

  protected onInsertDslExample(code: string): void {
    this.store.setDraftSource(code);
    this.dslGuideOpen.set(false);
  }

  protected onBackdropClick(): void {
    this.dismissSidePanel();
  }

  protected onEscapeKey(event: Event): void {
    if (event.defaultPrevented || this.document.querySelector('tui-dropdown')) {
      return;
    }
    if (this.dslGuideOpen()) {
      this.closeDslGuide();
      return;
    }
    this.dismissSidePanel();
  }

  private dismissSidePanel(): void {
    if (!this.showSidePanel()) {
      return;
    }
    const mode = this.store.editorMode();
    if (mode !== 'closed') {
      const pristineCreate =
        mode === 'create' &&
        !this.store.draftName().trim() &&
        !this.store.draftDescription().trim() &&
        !this.store.draftSource().trim();
      if (pristineCreate) {
        this.store.closeEditor();
      }
      return;
    }
    this.store.closeDetail();
  }
}

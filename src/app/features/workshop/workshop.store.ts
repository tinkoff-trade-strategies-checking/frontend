import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { errorMessage } from '../../core/api-problem';
import { applyTextEdits } from './data/apply-text-edits';
import { formatStrategyInvalidMessage } from './workshop.format';
import {
  CheckStrategyResult,
  DiagnosticFix,
  WORKSHOP_API,
  WORKSHOP_COMPARE_LIMIT,
  WORKSHOP_DEFAULT_PAGE_SIZE,
  WorkshopAlgorithmDetail,
  WorkshopAlgorithmSummary,
  WorkshopDraft,
  WorkshopPage as WorkshopPageData,
  WorkshopSortField,
} from './data/workshop.models';

export const WORKSHOP_SEARCH_DEBOUNCE_MS = 300;

export type WorkshopEditorMode = 'closed' | 'create' | 'edit';

export interface CompareEntry {
  readonly id: string;
  readonly name: string;
  readonly latestVersion: number;
}

function hasErrorDiagnostics(result: CheckStrategyResult | null): boolean {
  if (!result) {
    return false;
  }
  return (
    result.lookaheadLevel === 'ERROR' || result.diagnostics.some((diag) => diag.level === 'ERROR')
  );
}

@Injectable()
export class WorkshopStore implements OnDestroy {
  private readonly api = inject(WORKSHOP_API);
  private loadSeq = 0;
  private detailSeq = 0;
  private draftSeq = 0;
  private compareRestoreSeq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pageData = signal<WorkshopPageData | null>(null);

  readonly sort = signal<WorkshopSortField>('published_desc');
  readonly authorId = signal<string | null>(null);
  readonly mineOnly = signal(false);
  readonly cleanOnly = signal(false);
  readonly search = signal('');
  readonly page = signal(1);

  readonly selectedId = signal<string | null>(null);
  readonly selectedDetail = signal<WorkshopAlgorithmDetail | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);

  readonly compareList = signal<readonly CompareEntry[]>([]);

  readonly editorMode = signal<WorkshopEditorMode>('closed');
  readonly draft = signal<WorkshopDraft | null>(null);
  readonly draftLoading = signal(false);
  readonly draftSaving = signal(false);
  readonly draftChecking = signal(false);
  readonly draftPublishing = signal(false);
  readonly draftError = signal<string | null>(null);
  readonly publishError = signal<string | null>(null);
  readonly draftSuccess = signal<string | null>(null);
  readonly draftName = signal('');
  readonly draftDescription = signal('');
  readonly draftSource = signal('');
  readonly publishSummary = signal('');
  readonly checkResult = signal<CheckStrategyResult | null>(null);

  readonly runFormOpen = signal(false);
  readonly forking = signal(false);
  readonly visibilityPending = signal(false);
  readonly deleting = signal(false);
  readonly deleteConfirmId = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly items = computed(() => this.pageData()?.items ?? []);
  readonly authors = computed(() => this.pageData()?.authors ?? []);
  readonly total = computed(() => this.pageData()?.total ?? 0);
  readonly currentPage = computed(() => this.pageData()?.page ?? this.page());
  readonly totalPages = computed(() => this.pageData()?.totalPages ?? 1);
  readonly hasPrevPage = computed(() => this.currentPage() > 1);
  readonly hasNextPage = computed(() => this.currentPage() < this.totalPages());
  readonly compareCount = computed(() => this.compareList().length);
  readonly canCompare = computed(() => this.compareList().length >= 2);
  readonly compareIdsParam = computed(() =>
    this.compareList()
      .map((item) => item.id)
      .join(','),
  );
  readonly compareLimitReached = computed(
    () => this.compareList().length >= WORKSHOP_COMPARE_LIMIT,
  );
  readonly hasCheckErrors = computed(() => hasErrorDiagnostics(this.checkResult()));
  readonly checkErrorReason = computed<string | null>(() => {
    const check = this.checkResult();
    if (!hasErrorDiagnostics(check) || !check) {
      return null;
    }
    return formatStrategyInvalidMessage(
      check.diagnostics,
      'Публикация невозможна: проверка завершилась с уровнем ERROR.',
    );
  });

  ngOnDestroy(): void {
    this.clearSearchTimer();
  }

  async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.error.set(null);

    try {
      const data = await this.api.list({
        sort: this.sort(),
        authorId: this.authorId(),
        mineOnly: this.mineOnly(),
        cleanOnly: this.cleanOnly(),
        search: this.search(),
        page: this.page(),
        pageSize: WORKSHOP_DEFAULT_PAGE_SIZE,
      });
      if (seq !== this.loadSeq) {
        return;
      }
      this.pageData.set(data);
      this.page.set(data.page);
    } catch {
      if (seq !== this.loadSeq) {
        return;
      }
      this.error.set('Не удалось загрузить каталог алгоритмов.');
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  async selectAlgorithm(id: string): Promise<void> {
    const seq = ++this.detailSeq;
    this.selectedId.set(id);
    this.detailLoading.set(true);
    this.detailError.set(null);
    this.actionError.set(null);
    this.deleteConfirmId.set(null);
    if (this.runFormOpen()) {
      this.runFormOpen.set(false);
    }
    if (this.editorMode() === 'create' || this.draft()?.strategyId !== id) {
      this.closeEditor();
    }

    try {
      const result = await this.api.getById(id);
      if (seq !== this.detailSeq) {
        return;
      }
      if (result.status === 'READY') {
        this.selectedDetail.set(result.algorithm);
      } else {
        this.selectedDetail.set(null);
        this.detailError.set('Алгоритм не найден или скрыт автором.');
      }
    } catch {
      if (seq !== this.detailSeq) {
        return;
      }
      this.selectedDetail.set(null);
      this.detailError.set('Не удалось загрузить карточку алгоритма.');
    } finally {
      if (seq === this.detailSeq) {
        this.detailLoading.set(false);
      }
    }
  }

  closeDetail(): void {
    this.detailSeq++;
    this.selectedId.set(null);
    this.selectedDetail.set(null);
    this.detailLoading.set(false);
    this.detailError.set(null);
    this.actionError.set(null);
    this.deleteConfirmId.set(null);
    this.runFormOpen.set(false);
    this.closeEditor();
  }

  setSort(sort: WorkshopSortField): void {
    if (this.sort() === sort) {
      return;
    }
    this.clearSearchTimer();
    this.sort.set(sort);
    this.page.set(1);
    void this.load();
  }

  setAuthor(authorId: string | null): void {
    if (this.authorId() === authorId) {
      return;
    }
    this.clearSearchTimer();
    this.authorId.set(authorId);
    this.page.set(1);
    void this.load();
  }

  setMineOnly(mineOnly: boolean): void {
    if (this.mineOnly() === mineOnly) {
      return;
    }
    this.clearSearchTimer();
    this.mineOnly.set(mineOnly);
    this.authorId.set(null);
    if (mineOnly) {
      if (this.sort() === 'author_asc') {
        this.sort.set('published_desc');
      }
      const detail = this.selectedDetail();
      if ((detail && !detail.isMine) || this.detailLoading() || this.detailError() !== null) {
        this.closeDetail();
      }
    }
    this.page.set(1);
    void this.load();
  }

  toggleMineOnly(): void {
    this.setMineOnly(!this.mineOnly());
  }

  toggleCleanOnly(): void {
    this.clearSearchTimer();
    this.cleanOnly.update((prev) => !prev);
    this.page.set(1);
    void this.load();
  }

  setSearch(search: string): void {
    if (this.search() === search) {
      return;
    }
    this.search.set(search);
    this.page.set(1);
    this.clearSearchTimer();
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      void this.load();
    }, WORKSHOP_SEARCH_DEBOUNCE_MS);
  }

  setPage(nextPage: number): void {
    const clamped = Math.min(this.totalPages(), Math.max(1, nextPage));
    if (clamped === this.currentPage()) {
      return;
    }
    this.clearSearchTimer();
    this.page.set(clamped);
    void this.load();
  }

  resetFilters(): void {
    this.clearSearchTimer();
    this.sort.set('published_desc');
    this.authorId.set(null);
    this.mineOnly.set(false);
    this.cleanOnly.set(false);
    this.search.set('');
    this.page.set(1);
    void this.load();
  }

  isInCompare(id: string): boolean {
    return this.compareList().some((item) => item.id === id);
  }

  canAddToCompare(id: string): boolean {
    return this.isInCompare(id) || !this.compareLimitReached();
  }

  toggleCompare(entry: CompareEntry): void {
    if (this.isInCompare(entry.id)) {
      this.compareList.update((list) => list.filter((item) => item.id !== entry.id));
      return;
    }
    if (entry.latestVersion <= 0 || this.compareLimitReached()) {
      return;
    }
    this.compareList.update((list) => [...list, entry]);
  }

  removeFromCompare(id: string): void {
    this.compareList.update((list) => list.filter((item) => item.id !== id));
  }

  clearCompare(): void {
    this.compareList.set([]);
  }

  async restoreCompare(ids: readonly string[]): Promise<void> {
    const seq = ++this.compareRestoreSeq;
    const unique = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).slice(
      0,
      WORKSHOP_COMPARE_LIMIT,
    );
    if (unique.length === 0) {
      return;
    }
    const resolved = await Promise.all(
      unique.map(async (id): Promise<CompareEntry | null> => {
        const fromList = this.items().find((item) => item.id === id);
        if (fromList) {
          return { id: fromList.id, name: fromList.name, latestVersion: fromList.latestVersion };
        }
        try {
          const res = await this.api.getById(id);
          if (res.status === 'READY') {
            return {
              id: res.algorithm.id,
              name: res.algorithm.name,
              latestVersion: res.algorithm.latestVersion,
            };
          }
        } catch {
          // Недоступный алгоритм просто пропускается при восстановлении выбора.
        }
        return null;
      }),
    );
    if (seq !== this.compareRestoreSeq) {
      return;
    }
    this.compareList.set(resolved.filter((item): item is CompareEntry => item !== null));
  }

  openRunForm(): void {
    const detail = this.selectedDetail();
    if (!detail || detail.latestVersion === 0) {
      return;
    }
    this.closeEditor();
    this.actionError.set(null);
    this.runFormOpen.set(true);
  }

  closeRunForm(): void {
    this.runFormOpen.set(false);
  }

  openCreateDraft(): void {
    this.draftSeq++;
    this.resetDraftPendingFlags();
    this.runFormOpen.set(false);
    this.actionError.set(null);
    this.draft.set(null);
    this.draftName.set('');
    this.draftDescription.set('');
    this.draftSource.set('');
    this.publishSummary.set('');
    this.checkResult.set(null);
    this.clearDraftNotices();
    this.editorMode.set('create');
  }

  closeEditor(): void {
    this.draftSeq++;
    this.resetDraftPendingFlags();
    this.editorMode.set('closed');
    this.draftLoading.set(false);
    this.clearDraftNotices();
  }

  setDraftName(value: string): void {
    this.draftName.set(value);
    this.draftSuccess.set(null);
  }

  setDraftDescription(value: string): void {
    this.draftDescription.set(value);
    this.draftSuccess.set(null);
  }

  setDraftSource(value: string): void {
    this.draftSource.set(value);
    this.checkResult.set(null);
    this.draftSuccess.set(null);
    this.publishError.set(null);
  }

  setPublishSummary(value: string): void {
    this.publishSummary.set(value);
    this.publishError.set(null);
  }

  async createDraft(): Promise<boolean> {
    const rawName = this.draftName();
    const name = rawName.trim();
    if (!name || this.draftSaving()) {
      return false;
    }
    const seq = this.draftSeq;
    const rawDescription = this.draftDescription();
    const source = this.draftSource();
    this.draftSaving.set(true);
    this.clearDraftNotices();

    try {
      const created = await this.api.createAlgorithm({
        name,
        description: rawDescription.trim(),
        source,
      });
      if (seq !== this.draftSeq) {
        return false;
      }
      this.applySavedDraftSnapshot(created, rawName, rawDescription, source);
      this.editorMode.set('edit');
      this.draftSuccess.set('Черновик создан.');
      await Promise.all([this.load(), this.selectAlgorithm(created.strategyId)]);
      return true;
    } catch (error) {
      if (seq === this.draftSeq) {
        this.draftError.set(errorMessage(error, 'Не удалось создать черновик алгоритма.'));
      }
      return false;
    } finally {
      if (seq === this.draftSeq) {
        this.draftSaving.set(false);
      }
    }
  }

  async openDraft(id: string): Promise<void> {
    const seq = ++this.draftSeq;
    this.resetDraftPendingFlags();
    this.runFormOpen.set(false);
    this.actionError.set(null);
    this.draftLoading.set(true);
    this.clearDraftNotices();
    this.editorMode.set('edit');

    try {
      const loaded = await this.api.getDraft(id);
      if (seq !== this.draftSeq) {
        return;
      }
      this.applyDraftSnapshot(loaded);
    } catch (error) {
      if (seq !== this.draftSeq) {
        return;
      }
      this.draftError.set(errorMessage(error, 'Не удалось загрузить черновик.'));
    } finally {
      if (seq === this.draftSeq) {
        this.draftLoading.set(false);
      }
    }
  }

  async saveDraft(): Promise<boolean> {
    const current = this.draft();
    const rawName = this.draftName();
    const name = rawName.trim();
    if (!current || !name || this.draftSaving()) {
      return false;
    }
    const seq = this.draftSeq;
    const rawDescription = this.draftDescription();
    const source = this.draftSource();
    this.draftSaving.set(true);
    this.clearDraftNotices();

    try {
      const saved = await this.api.saveDraft(current.strategyId, {
        name,
        description: rawDescription.trim(),
        source,
      });
      if (seq !== this.draftSeq) {
        return false;
      }
      this.applySavedDraftSnapshot(saved, rawName, rawDescription, source);
      this.draftSuccess.set('Черновик сохранён.');
      await Promise.all([this.load(), this.selectAlgorithm(saved.strategyId)]);
      return true;
    } catch (error) {
      if (seq === this.draftSeq) {
        this.draftError.set(errorMessage(error, 'Не удалось сохранить черновик.'));
      }
      return false;
    } finally {
      if (seq === this.draftSeq) {
        this.draftSaving.set(false);
      }
    }
  }

  async checkDraft(): Promise<void> {
    if (this.draftChecking()) {
      return;
    }
    const seq = this.draftSeq;
    const src = this.draftSource();
    this.draftChecking.set(true);
    this.draftError.set(null);
    this.publishError.set(null);

    try {
      const result = await this.api.check({ source: src });
      if (seq !== this.draftSeq || src !== this.draftSource()) {
        return;
      }
      this.checkResult.set(result);
    } catch (error) {
      if (seq === this.draftSeq && src === this.draftSource()) {
        this.draftError.set(errorMessage(error, 'Не удалось проверить стратегию DSL.'));
      }
    } finally {
      if (seq === this.draftSeq) {
        this.draftChecking.set(false);
      }
    }
  }

  async applyFix(fix: DiagnosticFix): Promise<void> {
    if (this.draftChecking()) {
      return;
    }
    this.draftError.set(null);
    this.publishError.set(null);
    this.draftSuccess.set(null);

    try {
      const updatedSource = applyTextEdits(this.draftSource(), fix.edits);
      this.draftSource.set(updatedSource);
      await this.checkDraft();
    } catch (error) {
      this.draftError.set(
        error instanceof Error ? error.message : 'Не удалось применить автоисправление.',
      );
    }
  }

  async publishDraft(): Promise<boolean> {
    const current = this.draft();
    if (!current || this.draftPublishing()) {
      return false;
    }
    if (this.hasCheckErrors()) {
      this.publishError.set(
        this.checkErrorReason() ?? 'Публикация невозможна при наличии ошибок DSL.',
      );
      return false;
    }

    const seq = this.draftSeq;
    const src = this.draftSource();
    this.draftPublishing.set(true);
    this.draftError.set(null);
    this.publishError.set(null);
    this.draftSuccess.set(null);

    try {
      const summary = this.publishSummary().trim();
      const result = await this.api.publish(current.strategyId, {
        summary: summary || undefined,
        source: src,
      });
      if (seq !== this.draftSeq) {
        return false;
      }
      if (!result.ok) {
        if (src === this.draftSource()) {
          this.checkResult.set({
            lookaheadLevel: result.lookaheadLevel,
            diagnostics: result.diagnostics,
            params: this.checkResult()?.params ?? [],
          });
        }
        this.publishError.set(formatStrategyInvalidMessage(result.diagnostics));
        return false;
      }

      this.publishSummary.set('');
      this.draftSuccess.set(`Опубликована версия v${result.version.version}.`);
      if (result.version.lookaheadLevel && src === this.draftSource()) {
        this.checkResult.set({
          lookaheadLevel: result.version.lookaheadLevel,
          diagnostics: result.version.diagnostics ?? [],
          params: result.version.params ?? [],
        });
      }
      await Promise.all([this.load(), this.selectAlgorithm(current.strategyId)]);
      return true;
    } catch (error) {
      if (seq === this.draftSeq) {
        this.publishError.set(errorMessage(error, 'Не удалось опубликовать версию алгоритма.'));
      }
      return false;
    } finally {
      if (seq === this.draftSeq) {
        this.draftPublishing.set(false);
      }
    }
  }

  async forkAlgorithm(id: string, version?: number): Promise<void> {
    if (this.forking()) {
      return;
    }
    const seq = ++this.draftSeq;
    this.resetDraftPendingFlags();
    this.forking.set(true);
    this.actionError.set(null);
    this.runFormOpen.set(false);
    this.clearDraftNotices();

    try {
      const forked = await this.api.fork(id, version === undefined ? {} : { version });
      if (seq !== this.draftSeq) {
        return;
      }
      this.applyDraftSnapshot(forked);
      this.editorMode.set('edit');
      this.draftSuccess.set('Создан форк — отредактируйте и опубликуйте версию.');
      await Promise.all([this.load(), this.selectAlgorithm(forked.strategyId)]);
    } catch (error) {
      if (seq === this.draftSeq) {
        this.actionError.set(errorMessage(error, 'Не удалось создать форк алгоритма.'));
      }
    } finally {
      this.forking.set(false);
    }
  }

  async toggleVisibility(algo: WorkshopAlgorithmSummary): Promise<void> {
    if (algo.latestVersion === 0 || !algo.isMine || algo.isSystem || this.visibilityPending()) {
      return;
    }
    const next = algo.visibility === 'public' ? 'hidden' : 'public';
    this.visibilityPending.set(true);
    this.actionError.set(null);

    try {
      const updated = await this.api.setVisibility(algo.id, next);
      this.selectedDetail.update((detail) =>
        detail && detail.id === algo.id ? { ...detail, visibility: updated.visibility } : detail,
      );
      this.pageData.update((page) =>
        page
          ? {
              ...page,
              items: page.items.map((item) => (item.id === algo.id ? updated : item)),
            }
          : null,
      );
    } catch (error) {
      this.actionError.set(errorMessage(error, 'Не удалось изменить видимость алгоритма.'));
    } finally {
      this.visibilityPending.set(false);
    }
  }

  requestDelete(id: string): void {
    this.actionError.set(null);
    this.deleteConfirmId.set(id);
  }

  cancelDelete(): void {
    this.deleteConfirmId.set(null);
  }

  async confirmDelete(id: string): Promise<boolean> {
    const detail = this.selectedDetail();
    if (!detail || detail.id !== id || !detail.isMine || detail.isSystem || this.deleting()) {
      return false;
    }
    const seq = this.detailSeq;
    this.deleting.set(true);
    this.actionError.set(null);

    try {
      await this.api.deleteAlgorithm(id);
      this.removeFromCompare(id);
      if (seq === this.detailSeq && this.selectedId() === id) {
        this.deleteConfirmId.set(null);
        this.closeDetail();
      }
      await this.load();
      return true;
    } catch (error) {
      if (seq === this.detailSeq && this.selectedId() === id) {
        this.actionError.set(errorMessage(error, 'Не удалось удалить алгоритм.'));
      }
      return false;
    } finally {
      this.deleting.set(false);
    }
  }

  private applyDraftSnapshot(draft: WorkshopDraft): void {
    this.draft.set(draft);
    this.draftName.set(draft.name);
    this.draftDescription.set(draft.description);
    this.draftSource.set(draft.source);
    this.checkResult.set(draft.check);
  }

  private applySavedDraftSnapshot(
    draft: WorkshopDraft,
    sentName: string,
    sentDescription: string,
    sentSource: string,
  ): void {
    this.draft.set(draft);
    if (this.draftName() === sentName) {
      this.draftName.set(draft.name);
    }
    if (this.draftDescription() === sentDescription) {
      this.draftDescription.set(draft.description);
    }
    if (this.draftSource() === sentSource) {
      this.draftSource.set(draft.source);
      this.checkResult.set(draft.check);
    }
  }

  private resetDraftPendingFlags(): void {
    this.draftSaving.set(false);
    this.draftChecking.set(false);
    this.draftPublishing.set(false);
  }

  private clearDraftNotices(): void {
    this.draftError.set(null);
    this.publishError.set(null);
    this.draftSuccess.set(null);
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }
}

import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { errorMessage } from '../../core/api-problem';
import { applyTextEdits } from './data/apply-text-edits';
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
  readonly actionError = signal<string | null>(null);

  readonly items = computed(() => this.pageData()?.items ?? []);
  readonly authors = computed(() => this.pageData()?.authors ?? []);
  readonly total = computed(() => this.pageData()?.total ?? 0);
  readonly currentPage = computed(() => this.pageData()?.page ?? this.page());
  readonly totalPages = computed(() => this.pageData()?.totalPages ?? 1);
  readonly hasPrevPage = computed(() => this.currentPage() > 1);
  readonly hasNextPage = computed(() => this.currentPage() < this.totalPages());
  readonly compareCount = computed(() => this.compareList().length);
  readonly compareLimitReached = computed(
    () => this.compareList().length >= WORKSHOP_COMPARE_LIMIT,
  );
  readonly hasCheckErrors = computed(() => hasErrorDiagnostics(this.checkResult()));
  readonly checkErrorReason = computed<string | null>(() => {
    const check = this.checkResult();
    if (!hasErrorDiagnostics(check) || !check) {
      return null;
    }
    const messages = check.diagnostics
      .filter((diag) => diag.level === 'ERROR')
      .map((diag) => `${diag.code}: ${diag.message}`);
    return messages.length > 0
      ? `Публикация невозможна — ошибки DSL: ${messages.join('; ')}`
      : 'Публикация невозможна: проверка завершилась с уровнем ERROR.';
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

  toggleMineOnly(): void {
    this.clearSearchTimer();
    this.mineOnly.update((prev) => !prev);
    this.page.set(1);
    void this.load();
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
    if (this.compareLimitReached()) {
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
    this.draftSuccess.set(null);
    this.publishError.set(null);
  }

  setPublishSummary(value: string): void {
    this.publishSummary.set(value);
    this.publishError.set(null);
  }

  async createDraft(): Promise<boolean> {
    const name = this.draftName().trim();
    if (!name || this.draftSaving()) {
      return false;
    }
    this.draftSaving.set(true);
    this.clearDraftNotices();

    try {
      const created = await this.api.createAlgorithm({
        name,
        description: this.draftDescription().trim(),
        source: this.draftSource(),
      });
      this.applyDraftSnapshot(created);
      this.editorMode.set('edit');
      this.draftSuccess.set('Черновик создан.');
      await Promise.all([this.load(), this.selectAlgorithm(created.strategyId)]);
      return true;
    } catch (error) {
      this.draftError.set(errorMessage(error, 'Не удалось создать черновик алгоритма.'));
      return false;
    } finally {
      this.draftSaving.set(false);
    }
  }

  async openDraft(id: string): Promise<void> {
    this.runFormOpen.set(false);
    this.actionError.set(null);
    this.draftLoading.set(true);
    this.clearDraftNotices();
    this.editorMode.set('edit');

    try {
      const loaded = await this.api.getDraft(id);
      this.applyDraftSnapshot(loaded);
    } catch (error) {
      this.draftError.set(errorMessage(error, 'Не удалось загрузить черновик.'));
    } finally {
      this.draftLoading.set(false);
    }
  }

  async saveDraft(): Promise<boolean> {
    const current = this.draft();
    const name = this.draftName().trim();
    if (!current || !name || this.draftSaving()) {
      return false;
    }
    this.draftSaving.set(true);
    this.clearDraftNotices();

    try {
      const saved = await this.api.saveDraft(current.strategyId, {
        name,
        description: this.draftDescription().trim(),
        source: this.draftSource(),
      });
      this.applyDraftSnapshot(saved);
      this.draftSuccess.set('Черновик сохранён.');
      await Promise.all([this.load(), this.selectAlgorithm(saved.strategyId)]);
      return true;
    } catch (error) {
      this.draftError.set(errorMessage(error, 'Не удалось сохранить черновик.'));
      return false;
    } finally {
      this.draftSaving.set(false);
    }
  }

  async checkDraft(): Promise<void> {
    if (this.draftChecking()) {
      return;
    }
    this.draftChecking.set(true);
    this.draftError.set(null);
    this.publishError.set(null);

    try {
      const result = await this.api.check({ source: this.draftSource() });
      this.checkResult.set(result);
    } catch (error) {
      this.draftError.set(errorMessage(error, 'Не удалось проверить стратегию DSL.'));
    } finally {
      this.draftChecking.set(false);
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

    this.draftPublishing.set(true);
    this.draftError.set(null);
    this.publishError.set(null);
    this.draftSuccess.set(null);

    try {
      const summary = this.publishSummary().trim();
      const result = await this.api.publish(current.strategyId, {
        summary: summary || undefined,
        source: this.draftSource(),
      });
      if (!result.ok) {
        this.publishError.set(
          result.detail?.trim() || 'Стратегия содержит ошибки DSL и не может быть опубликована.',
        );
        return false;
      }

      this.publishSummary.set('');
      this.draftSuccess.set(`Опубликована версия v${result.version.version}.`);
      if (result.version.lookaheadLevel) {
        this.checkResult.set({
          lookaheadLevel: result.version.lookaheadLevel,
          diagnostics: result.version.diagnostics ?? [],
          params: result.version.params ?? [],
        });
      }
      await Promise.all([this.load(), this.selectAlgorithm(current.strategyId)]);
      return true;
    } catch (error) {
      this.publishError.set(errorMessage(error, 'Не удалось опубликовать версию алгоритма.'));
      return false;
    } finally {
      this.draftPublishing.set(false);
    }
  }

  async forkAlgorithm(id: string, version?: number): Promise<void> {
    if (this.forking()) {
      return;
    }
    this.forking.set(true);
    this.actionError.set(null);
    this.runFormOpen.set(false);
    this.clearDraftNotices();

    try {
      const forked = await this.api.fork(id, version === undefined ? {} : { version });
      this.applyDraftSnapshot(forked);
      this.editorMode.set('edit');
      this.draftSuccess.set('Создан форк — отредактируйте и опубликуйте версию.');
      await Promise.all([this.load(), this.selectAlgorithm(forked.strategyId)]);
    } catch (error) {
      this.actionError.set(errorMessage(error, 'Не удалось создать форк алгоритма.'));
    } finally {
      this.forking.set(false);
    }
  }

  async toggleVisibility(algo: WorkshopAlgorithmSummary): Promise<void> {
    if (!algo.isMine || algo.isSystem || this.visibilityPending()) {
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

  private applyDraftSnapshot(draft: WorkshopDraft): void {
    this.draft.set(draft);
    this.draftName.set(draft.name);
    this.draftDescription.set(draft.description);
    this.draftSource.set(draft.source);
    this.checkResult.set(draft.check);
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

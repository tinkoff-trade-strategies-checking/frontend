import { computed, inject, Injectable, signal } from '@angular/core';
import {
  WORKSHOP_API,
  WORKSHOP_COMPARE_LIMIT,
  WORKSHOP_DEFAULT_PAGE_SIZE,
  WorkshopAlgorithmDetail,
  WorkshopPage as WorkshopPageData,
  WorkshopSortField,
} from './data/workshop.models';

export interface CompareEntry {
  readonly id: string;
  readonly name: string;
  readonly latestVersion: number;
}

@Injectable()
export class WorkshopStore {
  private readonly api = inject(WORKSHOP_API);
  private loadSeq = 0;
  private detailSeq = 0;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pageData = signal<WorkshopPageData | null>(null);

  readonly sort = signal<WorkshopSortField>('published_desc');
  readonly author = signal<string>('all');
  readonly mineOnly = signal(false);
  readonly cleanOnly = signal(false);
  readonly search = signal('');
  readonly page = signal(1);

  readonly selectedId = signal<string | null>(null);
  readonly selectedDetail = signal<WorkshopAlgorithmDetail | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);

  readonly compareList = signal<readonly CompareEntry[]>([]);

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

  async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.error.set(null);

    try {
      const data = await this.api.list({
        sort: this.sort(),
        author: this.author(),
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
      this.pageData.set(null);
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
  }

  setSort(sort: WorkshopSortField): void {
    if (this.sort() === sort) {
      return;
    }
    this.sort.set(sort);
    this.page.set(1);
    void this.load();
  }

  setAuthor(author: string): void {
    if (this.author() === author) {
      return;
    }
    this.author.set(author);
    this.page.set(1);
    void this.load();
  }

  toggleMineOnly(): void {
    this.mineOnly.update((prev) => !prev);
    this.page.set(1);
    void this.load();
  }

  toggleCleanOnly(): void {
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
    void this.load();
  }

  setPage(nextPage: number): void {
    const clamped = Math.min(this.totalPages(), Math.max(1, nextPage));
    if (clamped === this.currentPage()) {
      return;
    }
    this.page.set(clamped);
    void this.load();
  }

  resetFilters(): void {
    this.sort.set('published_desc');
    this.author.set('all');
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
}

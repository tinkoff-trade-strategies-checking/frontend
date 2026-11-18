import { computed, inject, Injectable, signal } from '@angular/core';
import {
  HISTORY_API,
  HISTORY_DEFAULT_PAGE_SIZE,
  HistoryKindFilter,
  HistoryPage as HistoryPageData,
  HistoryRegimeFilter,
  HistoryStatusFilter,
} from './data/history.models';

@Injectable()
export class HistoryStore {
  private readonly api = inject(HISTORY_API);
  private loadSeq = 0;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pageData = signal<HistoryPageData | null>(null);

  readonly kind = signal<HistoryKindFilter>('all');
  readonly blindOnly = signal(false);
  readonly status = signal<HistoryStatusFilter>('all');
  readonly regime = signal<HistoryRegimeFilter>('all');
  readonly page = signal(1);

  readonly items = computed(() => this.pageData()?.items ?? []);
  readonly total = computed(() => this.pageData()?.total ?? 0);
  readonly currentPage = computed(() => this.pageData()?.page ?? this.page());
  readonly totalPages = computed(() => this.pageData()?.totalPages ?? 1);
  readonly hasPrevPage = computed(() => this.currentPage() > 1);
  readonly hasNextPage = computed(() => this.currentPage() < this.totalPages());

  async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.error.set(null);

    try {
      const data = await this.api.list({
        kind: this.kind(),
        blindOnly: this.blindOnly(),
        status: this.status(),
        regime: this.regime(),
        page: this.page(),
        pageSize: HISTORY_DEFAULT_PAGE_SIZE,
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
      this.error.set('Не удалось загрузить историю сессий.');
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  setKind(kind: HistoryKindFilter): void {
    if (this.kind() === kind) {
      return;
    }
    this.kind.set(kind);
    this.page.set(1);
    void this.load();
  }

  toggleBlindOnly(): void {
    this.blindOnly.update((prev) => !prev);
    this.page.set(1);
    void this.load();
  }

  setStatus(status: HistoryStatusFilter): void {
    if (this.status() === status) {
      return;
    }
    this.status.set(status);
    this.page.set(1);
    void this.load();
  }

  setRegime(regime: HistoryRegimeFilter): void {
    if (this.regime() === regime) {
      return;
    }
    this.regime.set(regime);
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
    this.kind.set('all');
    this.blindOnly.set(false);
    this.status.set('all');
    this.regime.set('all');
    this.page.set(1);
    void this.load();
  }
}

import { InjectionToken } from '@angular/core';

export type HistoryItemKind = 'session' | 'algo_run';

export type HistoryItemOwner = 'USER' | 'PLATFORM';

export type HistoryItemStatus = 'running' | 'completed' | 'finished_early' | 'bankrupt';

export type HistoryRegime = 'calm' | 'medium' | 'stress';

export type HistoryKindFilter = 'all' | HistoryItemKind;

export type HistoryStatusFilter = 'all' | HistoryItemStatus;

export type HistoryRegimeFilter = 'all' | HistoryRegime;

export const HISTORY_DEFAULT_PAGE_SIZE = 20;
export const HISTORY_MAX_ITEMS = 100;

export interface HistoryEntry {
  readonly id: string;
  readonly kind: HistoryItemKind;
  readonly owner: HistoryItemOwner;
  readonly blind: boolean;
  readonly status: HistoryItemStatus;
  readonly createdAt: string;
  readonly regime: HistoryRegime;
  readonly title: string | null;
  readonly papers: readonly string[] | null;
  readonly periodLabel: string | null;
  readonly netReturnPct: number | null;
  readonly playedDays: number;
  readonly totalDays: number;
  readonly algoName: string | null;
}

export interface HistoryQuery {
  readonly kind?: HistoryKindFilter;
  readonly blindOnly?: boolean;
  readonly status?: HistoryStatusFilter;
  readonly regime?: HistoryRegimeFilter;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface HistoryPage {
  readonly items: readonly HistoryEntry[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface HistoryApi {
  list(query?: HistoryQuery): Promise<HistoryPage>;
}

export const HISTORY_API = new InjectionToken<HistoryApi>('HISTORY_API');

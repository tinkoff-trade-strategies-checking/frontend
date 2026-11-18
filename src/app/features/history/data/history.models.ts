import { InjectionToken } from '@angular/core';

export type HistoryItemKind = 'session' | 'algo_run';

export type HistoryItemOwner = 'USER' | 'PLATFORM';

export type HistoryItemStatus = 'running' | 'completed' | 'finished_early' | 'bankrupt';

export type HistoryRegime = 'calm' | 'medium' | 'stress';

export type HistoryKindFilter = 'all' | HistoryItemKind;

export type HistoryStatusFilter = 'all' | HistoryItemStatus;

export type HistoryRegimeFilter = 'all' | HistoryRegime;

export const HISTORY_DEFAULT_PAGE_SIZE = 20;
export const HISTORY_MAX_PAGE_SIZE = 100;

interface HistoryEntryBase {
  readonly id: string;
  readonly kind: HistoryItemKind;
  readonly owner: HistoryItemOwner;
  readonly createdAt: string;
  readonly regime: HistoryRegime;
  readonly playedDays: number;
  readonly totalDays: number;
  readonly algoName: string | null;
}

/** INV-7: у незавершённой слепой записи нет бумаг, периода, названия и итога. */
export interface HistoryEntryBlindUnfinished extends HistoryEntryBase {
  readonly blind: true;
  readonly status: 'running';
}

interface HistoryEntryRevealedFields extends HistoryEntryBase {
  readonly title: string;
  readonly papers: readonly string[];
  readonly periodLabel: string;
  readonly netReturnPct: number;
}

export type HistoryEntryRevealed = HistoryEntryRevealedFields &
  (
    | { readonly blind: false; readonly status: HistoryItemStatus }
    | { readonly blind: true; readonly status: Exclude<HistoryItemStatus, 'running'> }
  );

export type HistoryEntry = HistoryEntryBlindUnfinished | HistoryEntryRevealed;

export function isBlindUnfinished(entry: HistoryEntry): entry is HistoryEntryBlindUnfinished {
  return entry.blind && entry.status === 'running';
}

/** Защитная маскировка: оставляет у незавершённой слепой записи только разрешённые поля. */
export function maskHistoryEntry(entry: HistoryEntry): HistoryEntry {
  if (!isBlindUnfinished(entry)) {
    return entry;
  }
  return {
    id: entry.id,
    kind: entry.kind,
    owner: entry.owner,
    blind: true,
    status: 'running',
    createdAt: entry.createdAt,
    regime: entry.regime,
    playedDays: entry.playedDays,
    totalDays: entry.totalDays,
    algoName: entry.algoName,
  };
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

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

/** INV-1: у незавершённой неслепой записи нет итоговой доходности до конца сессии. */
export interface HistoryEntryOpenUnfinished extends HistoryEntryBase {
  readonly blind: false;
  readonly status: 'running';
  readonly title: string;
  readonly papers: readonly string[];
  readonly periodLabel: string;
}

export interface HistoryEntryFinished extends HistoryEntryBase {
  readonly blind: boolean;
  readonly status: Exclude<HistoryItemStatus, 'running'>;
  readonly title: string;
  readonly papers: readonly string[];
  readonly periodLabel: string;
  /** `null` — сервер не отдал итог (поле контракта необязательное). */
  readonly netReturnPct: number | null;
}

export type HistoryEntry =
  HistoryEntryBlindUnfinished | HistoryEntryOpenUnfinished | HistoryEntryFinished;

export function isBlindUnfinished(entry: HistoryEntry): entry is HistoryEntryBlindUnfinished {
  return entry.blind && entry.status === 'running';
}

/** Защитная маскировка: убирает запрещённые поля у незавершённых записей (INV-1, INV-7). */
export function maskHistoryEntry(entry: HistoryEntry): HistoryEntry {
  if (entry.status !== 'running') {
    return entry;
  }
  const base: HistoryEntryBase = {
    id: entry.id,
    kind: entry.kind,
    owner: entry.owner,
    createdAt: entry.createdAt,
    regime: entry.regime,
    playedDays: entry.playedDays,
    totalDays: entry.totalDays,
    algoName: entry.algoName,
  };
  if (entry.blind) {
    return { ...base, blind: true, status: 'running' };
  }
  return {
    ...base,
    blind: false,
    status: 'running',
    title: entry.title,
    papers: entry.papers,
    periodLabel: entry.periodLabel,
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

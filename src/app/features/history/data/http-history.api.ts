import { inject, Injectable } from '@angular/core';
import { Api } from '../../../api/api';
import { listHistory } from '../../../api/fn/analysis/list-history';
import { HistoryEntry as ApiHistoryEntry } from '../../../api/models/history-entry';
import { HistoryPage as ApiHistoryPage } from '../../../api/models/history-page';
import { Period } from '../../../api/models/period';
import {
  HISTORY_DEFAULT_PAGE_SIZE,
  HistoryApi,
  HistoryEntry,
  HistoryPage,
  HistoryQuery,
} from './history.models';

/** `2020-02-26` → `26.02.2020`: даты периода — календарные, без часового пояса и без `Date`. */
export function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

export function formatPeriod(period: Period): string {
  return `${formatIsoDate(period.startDate)} — ${formatIsoDate(period.endDate)}`;
}

/** Процент приходит строкой с сервера (INV-6); число нужно только для отображения знака и цвета. */
function pctToNumber(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapHistoryEntry(entry: ApiHistoryEntry): HistoryEntry {
  const base = {
    id: entry.id,
    kind: entry.kind,
    owner: entry.owner,
    createdAt: entry.createdAt,
    regime: entry.regime,
    playedDays: entry.playedDays,
    totalDays: entry.totalDays,
    algoName: entry.algoName,
  };
  // INV-7: незавершённая слепая запись — только общие поля, что бы ни пришло в ответе.
  if (entry.view === 'BLIND_UNFINISHED' || (entry.blind && entry.status === 'running')) {
    return { ...base, blind: true, status: 'running' };
  }
  const revealed = {
    title: entry.title,
    papers: entry.papers,
    periodLabel: formatPeriod(entry.period),
  };
  // INV-1: у идущей неслепой сессии итоговой доходности нет.
  if (entry.status === 'running') {
    return { ...base, ...revealed, blind: false, status: 'running' };
  }
  return {
    ...base,
    ...revealed,
    blind: entry.blind,
    status: entry.status,
    netReturnPct: pctToNumber(entry.netReturnPct),
  };
}

export function mapHistoryPage(page: ApiHistoryPage): HistoryPage {
  return {
    items: page.items.map(mapHistoryEntry),
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    totalPages: page.totalPages,
  };
}

@Injectable()
export class HttpHistoryApi implements HistoryApi {
  private readonly api = inject(Api);

  async list(query: HistoryQuery = {}): Promise<HistoryPage> {
    const page = await this.api.invoke(listHistory, {
      kind: query.kind === undefined || query.kind === 'all' ? undefined : query.kind,
      blindOnly: query.blindOnly ? true : undefined,
      status: query.status === undefined || query.status === 'all' ? undefined : query.status,
      regime: query.regime === undefined || query.regime === 'all' ? undefined : query.regime,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? HISTORY_DEFAULT_PAGE_SIZE,
    });
    return mapHistoryPage(page);
  }
}

import {
  HistoryEntry,
  HistoryItemKind,
  HistoryItemStatus,
  HistoryRegime,
  isBlindUnfinished,
} from './data/history.models';

export const HISTORY_KIND_LABELS: Readonly<Record<HistoryItemKind, string>> = {
  session: 'Ручная сессия',
  algo_run: 'Прогон алгоритма',
};

export const HISTORY_STATUS_LABELS: Readonly<Record<HistoryItemStatus, string>> = {
  running: 'Идёт',
  completed: 'Завершена',
  finished_early: 'Досрочно',
  bankrupt: 'Банкротство',
  invalid: 'С ошибкой DSL',
  failed: 'Ошибка',
};

export const HISTORY_REGIME_LABELS: Readonly<Record<HistoryRegime, string>> = {
  calm: 'Спокойный',
  medium: 'Средний',
  stress: 'Стрессовый',
};

const MOSCOW_DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const MOSCOW_DATETIME_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatMoscowDate(iso: string): string {
  return MOSCOW_DATE_FORMATTER.format(new Date(iso));
}

export function formatMoscowDateTime(iso: string): string {
  return MOSCOW_DATETIME_FORMATTER.format(new Date(iso)).replace(',', '');
}

export function signedPctSign(value: number | null): -1 | 0 | 1 {
  if (value === null || Math.abs(value) < 0.005) {
    return 0;
  }
  return value > 0 ? 1 : -1;
}

export function formatSignedPct(value: number | null): string {
  if (value === null) {
    return '—';
  }
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  const formatted = Math.abs(normalized).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (normalized > 0) {
    return `+${formatted} %`;
  }
  if (normalized < 0) {
    return `−${formatted} %`;
  }
  return `${formatted} %`;
}

export function formatHistoryTitle(entry: HistoryEntry): string {
  if (isBlindUnfinished(entry)) {
    const prefix = entry.kind === 'session' ? 'Слепая сессия' : 'Слепой прогон';
    return `${prefix} от ${formatMoscowDate(entry.createdAt)}`;
  }
  return entry.title;
}

export function historyPapers(entry: HistoryEntry): readonly string[] | null {
  return isBlindUnfinished(entry) ? null : entry.papers;
}

export function historyPeriod(entry: HistoryEntry): string | null {
  return isBlindUnfinished(entry) ? null : entry.periodLabel;
}

export function historyNetReturn(entry: HistoryEntry): number | null {
  return entry.status === 'running' ? null : entry.netReturnPct;
}

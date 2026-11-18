import {
  HistoryEntry,
  HistoryItemKind,
  HistoryItemStatus,
  HistoryRegime,
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

export function formatSignedPct(value: number | null): string {
  if (value === null) {
    return '—';
  }
  const formatted = Math.abs(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (value > 0) {
    return `+${formatted} %`;
  }
  if (value < 0) {
    return `−${formatted} %`;
  }
  return `${formatted} %`;
}

export function formatHistoryTitle(entry: HistoryEntry): string {
  if (entry.blind && entry.status === 'running') {
    return entry.title ?? `Слепая сессия от ${formatMoscowDate(entry.createdAt)}`;
  }
  return entry.title ?? entry.algoName ?? entry.id;
}

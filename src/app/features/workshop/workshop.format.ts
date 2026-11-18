import { WorkshopLinterWarning, WorkshopSortField } from './data/workshop.models';

export const WORKSHOP_SORT_LABELS: Readonly<Record<WorkshopSortField, string>> = {
  published_desc: 'Сначала новые',
  name_asc: 'По названию',
  author_asc: 'По автору',
};

const MOSCOW_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatWorkshopDateTime(iso: string): string {
  return MOSCOW_DATE_TIME_FORMATTER.format(new Date(iso)).replace(',', '');
}

export function formatLinterSummary(warnings: readonly WorkshopLinterWarning[]): string {
  if (warnings.length === 0) {
    return 'Чисто';
  }
  const codes = Array.from(new Set(warnings.map((w) => w.code))).join(', ');
  return `${warnings.length} пред. (${codes})`;
}

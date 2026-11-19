import { LaunchRejectReason } from './data/launch.models';

export interface LaunchRejectMessage {
  readonly title: string;
  readonly suggestion: string;
}

const FIELD_LABELS: Readonly<Record<string, string>> = {
  paperCount: 'количество бумаг',
  paperIds: 'набор бумаг',
  customStartDate: 'дата начала периода',
  initialCapital: 'начальный капитал',
};

export function formatLaunchRejection(
  reason: LaunchRejectReason,
  options?: {
    readonly field: string | null;
    readonly barsCount: number | null;
    readonly maxBars: number | null;
  },
): LaunchRejectMessage {
  switch (reason) {
    case 'NO_MATCHING_PERIOD':
      return {
        title: 'Подходящий исторический период не найден',
        suggestion:
          'Попробуйте сменить тип периода (спокойный, средний, стрессовый), уменьшить длительность или выбрать меньше бумаг.',
      };
    case 'TOO_MANY_BARS': {
      const countText =
        options?.barsCount !== null && options?.barsCount !== undefined
          ? `${options.barsCount.toLocaleString('ru-RU')} свечей`
          : 'превышен лимит свечей';
      const maxText = (options?.maxBars ?? 5000).toLocaleString('ru-RU');
      return {
        title: `Слишком много свечей: ${countText} при лимите ${maxText}`,
        suggestion: 'Уменьшите длительность сессии или выберите более крупный шаг свечей.',
      };
    }
    case 'CORPORATE_ACTION_ON_PERIOD':
      return {
        title: 'На выбранном отрезке есть сплит или консолидация',
        suggestion: 'Выберите другую дату начала или переключитесь на случайную закрытую дату.',
      };
    case 'INVALID_PARAMS': {
      const fieldLabel = options?.field ? (FIELD_LABELS[options.field] ?? options.field) : '';
      return {
        title: fieldLabel ? `Проверьте параметр: ${fieldLabel}` : 'Некорректные параметры запуска',
        suggestion: 'Исправьте настройки и попробуйте запустить снова.',
      };
    }
  }
}

export function formatRub(value: number): string {
  return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`;
}

export function formatExecutionPct(value: number): string {
  return `${value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

export function formatDecimalRu(value: number): string {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

export function formatDisplayDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) {
    return isoDate;
  }
  return `${match[3]}.${match[2]}.${match[1]}`;
}

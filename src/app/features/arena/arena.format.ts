import { ArenaRejectReason } from './data/arena.models';

const REJECT_REASON_LABELS: Readonly<Record<ArenaRejectReason, string>> = {
  INVALID_PARAMS: 'Некорректные параметры заявки',
  INSUFFICIENT_CASH: 'Недостаточно свободных средств',
  INSUFFICIENT_POSITION: 'Недостаточно лотов в позиции',
  SESSION_NOT_ACTIVE: 'Сессия завершена',
  ORDER_NOT_ACTIVE: 'Заявка уже неактивна',
  LIQUIDITY_LIMIT: 'Остаток снят по лимиту ликвидности',
  REPLACED: 'Заменена пользователем',
  DAY_EXPIRED: 'Истёк срок заявки (день)',
  OCO_SIBLING_FILLED: 'Снята при исполнении второй ноги OCO',
  SESSION_END: 'Снята при завершении сессии',
  CANCELLED_BY_USER: 'Отменена пользователем',
};

const FIELD_LABELS: Readonly<Record<string, string>> = {
  seenStep: 'номер свечи',
  lots: 'количество лотов',
  paperId: 'бумага',
  limitPrice: 'цена лимита',
  stopPrice: 'цена стопа',
  takeProfitPrice: 'цена тейк-профита (должна быть выше текущей)',
  trailingPct: 'отступ трейлинг-стопа',
  side: 'сторона заявки',
};

export function formatRejectReason(reason?: ArenaRejectReason, field?: string): string {
  if (!reason) {
    return 'Команда отклонена.';
  }
  const base = REJECT_REASON_LABELS[reason];
  if (reason === 'INVALID_PARAMS' && field) {
    const fieldLabel = FIELD_LABELS[field] ?? field;
    return `${base}: ${fieldLabel}.`;
  }
  return `${base}.`;
}

export function formatPrice(value: number): string {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatRub(value: number, signed = false): string {
  const formatted = Math.abs(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  if (signed) {
    if (value > 0) {
      return `+${formatted} ₽`;
    }
    if (value < 0) {
      return `−${formatted} ₽`;
    }
    return `${formatted} ₽`;
  }
  return `${value < 0 ? '−' : ''}${formatted} ₽`;
}

export function formatPct(value: number, signed = false): string {
  const formatted = Math.abs(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (signed) {
    if (value > 0) {
      return `+${formatted} %`;
    }
    if (value < 0) {
      return `−${formatted} %`;
    }
    return `${formatted} %`;
  }
  return `${value < 0 ? '−' : ''}${formatted} %`;
}

export function formatLots(lots: number): string {
  return `${lots.toLocaleString('ru-RU')} лот.`;
}

export function formatBlindCandleLabel(day: number, candleInDay: number): string {
  if (day <= 0) {
    return `прогрев, свеча ${candleInDay}`;
  }
  return `день ${day}, свеча ${candleInDay}`;
}

export function formatBlindAxisTick(step: number, day: number): string {
  if (day <= 0) {
    return `п−${Math.abs(step)}`;
  }
  return `д${day}`;
}

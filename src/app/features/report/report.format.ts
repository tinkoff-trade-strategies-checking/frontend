import {
  ComparisonWinner,
  DivergenceType,
  ReportFill,
  ReportRegime,
  ReportTimeframe,
} from './data/report.models';

export const REPORT_REGIME_LABELS: Readonly<Record<ReportRegime, string>> = {
  calm: 'Спокойный',
  medium: 'Средний',
  stress: 'Стрессовый',
};

export const REPORT_TIMEFRAME_LABELS: Readonly<Record<ReportTimeframe, string>> = {
  '1m': '1 мин',
  '5m': '5 мин',
  '10m': '10 мин',
  '15m': '15 мин',
  '1h': '1 ч',
  '1d': '1 д',
};

export const DIVERGENCE_TYPE_LABELS: Readonly<Record<DivergenceType, string>> = {
  extra: 'Лишнее действие',
  missed: 'Упущенное действие',
  size: 'Размер',
  timing: 'Момент',
};

export const REPORT_ORDER_TYPE_LABELS: Readonly<Record<ReportFill['orderType'], string>> = {
  market: 'Рыночная',
  limit: 'Лимитная',
  stop: 'Стоп-рыночная',
  stop_limit: 'Стоп-лимитная',
  take_profit: 'Тейк-профит',
  trailing: 'Трейлинг-стоп',
  oco: 'OCO: стоп + тейк',
};

export const WINNER_LABELS: Readonly<Record<ComparisonWinner, string>> = {
  human: 'Вы впереди',
  algo: 'Алгоритм впереди',
  tie: 'Равно',
};

export function formatRub(value: number | null, signed = false, fractionDigits = 0): string {
  if (value === null) {
    return '—';
  }
  const formatted = Math.abs(value).toLocaleString('ru-RU', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: Math.max(fractionDigits, 2),
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

export function formatRubExact(value: number | null, signed = false): string {
  return formatRub(value, signed, 2);
}

export function formatDeltaBars(delta: number): string {
  if (delta > 0) {
    return `Δt = +${delta} бар.`;
  }
  if (delta < 0) {
    return `Δt = −${Math.abs(delta)} бар.`;
  }
  return 'Δt = 0 бар.';
}

export function formatDrawdownDuration(days: number | null, steps: number): string {
  return days === null ? '—' : `${days} дн. (${steps} шаг.)`;
}

export function formatPct(value: number | null, signed = false): string {
  if (value === null) {
    return '—';
  }
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

export function formatRatio(value: number | null): string {
  if (value === null) {
    return '—';
  }
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

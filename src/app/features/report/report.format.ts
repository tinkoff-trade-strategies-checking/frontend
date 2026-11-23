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

/** Рубли — всегда два знака (`decisions.md`, «Деньги и округление»). */
export function formatRub(value: number | null, signed = false, fractionDigits = 2): string {
  if (value === null) {
    return '—';
  }
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  const formatted = Math.abs(normalized).toLocaleString('ru-RU', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: Math.max(fractionDigits, 2),
  });
  if (signed) {
    if (normalized > 0) {
      return `+${formatted} ₽`;
    }
    if (normalized < 0) {
      return `−${formatted} ₽`;
    }
    return `${formatted} ₽`;
  }
  return `${normalized < 0 ? '−' : ''}${formatted} ₽`;
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
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  const formatted = Math.abs(normalized).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (signed) {
    if (normalized > 0) {
      return `+${formatted} %`;
    }
    if (normalized < 0) {
      return `−${formatted} %`;
    }
    return `${formatted} %`;
  }
  return `${normalized < 0 ? '−' : ''}${formatted} %`;
}

export function formatComparisonBadge(
  winner: ComparisonWinner,
  diffLabel: string,
  diffValue: number,
): string {
  if (winner === 'tie' || Math.abs(diffValue) < 0.005) {
    return 'На уровне алгоритма';
  }
  if (diffLabel.startsWith('Вы лучше на ')) {
    return `Вы впереди на +${diffLabel.slice('Вы лучше на '.length)}`;
  }
  if (diffLabel.startsWith('Алгоритм лучше на ')) {
    return `Алгоритм впереди на +${diffLabel.slice('Алгоритм лучше на '.length)}`;
  }
  return diffLabel;
}

export function formatDrawdown(value: number | null): string {
  if (value === null) {
    return '—';
  }
  if (Math.abs(value) < 0.005) {
    return formatPct(0);
  }
  return `−${formatPct(Math.abs(value))}`;
}

export function formatRatio(value: number | null): string {
  if (value === null) {
    return '—';
  }
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  const formatted = Math.abs(normalized).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  // Минус — «−» (U+2212), как у процентов и рублей, а не дефис.
  return `${normalized < 0 ? '−' : ''}${formatted}`;
}

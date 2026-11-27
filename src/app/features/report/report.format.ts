import { LaunchRejectReason } from '../launch/data/launch.models';
import {
  ComparisonWinner,
  DivergenceType,
  ReportFill,
  ReportMetrics,
  ReportRegime,
  ReportTimeframe,
} from './data/report.models';

export interface ExecutiveSummary {
  readonly headline: string;
  readonly tone: 'positive' | 'negative' | 'neutral';
  readonly sentences: readonly string[];
  readonly grossBarWidthPct: number;
  readonly netBarWidthPct: number;
}

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
  const formatted = Math.abs(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  // Минус — «−» (U+2212), как у процентов и рублей, а не дефис.
  return `${value < 0 ? '−' : ''}${formatted}`;
}

/**
 * Человекочитаемый итог сессии строго по уже пришедшим с сервера метрикам (INV-6).
 * Никаких финансовых пересчётов на клиенте — только словесная интерпретация и визуальные доли.
 */
export function buildExecutiveSummary(metrics: ReportMetrics): ExecutiveSummary {
  const netStr = formatPct(metrics.netReturnPct, true);
  let headline: string;
  let tone: ExecutiveSummary['tone'];
  let firstSentence: string;

  if (metrics.bankrupt) {
    headline = `Счёт обнулился (банкротство): ${netStr} чистыми`;
    tone = 'negative';
    firstSentence = `К концу периода на счёте осталось ${formatRub(metrics.finalCapitalRub)} из стартовых ${formatRub(metrics.initialCapitalRub)}.`;
  } else if (metrics.netReturnPct > 0) {
    headline = `Вы в плюсе на ${netStr} чистыми`;
    tone = 'positive';
    firstSentence = `Счёт вырос с ${formatRub(metrics.initialCapitalRub)} до ${formatRub(metrics.finalCapitalRub)} после всех комиссий и проскальзывания.`;
  } else if (metrics.netReturnPct < 0) {
    headline = `Вы в минусе на ${netStr} чистыми`;
    tone = 'negative';
    firstSentence = `Счёт снизился с ${formatRub(metrics.initialCapitalRub)} до ${formatRub(metrics.finalCapitalRub)} после всех комиссий и проскальзывания.`;
  } else {
    headline = `Итог периода — в нуле (${netStr} чистыми)`;
    tone = 'neutral';
    firstSentence = `Итоговый капитал составил ${formatRub(metrics.finalCapitalRub)} (старт ${formatRub(metrics.initialCapitalRub)}).`;
  }

  const sentences: string[] = [firstSentence];

  if (metrics.benchmarkImoexPct !== null) {
    const benchStr = formatPct(metrics.benchmarkImoexPct, true);
    if (metrics.netReturnPct > metrics.benchmarkImoexPct) {
      sentences.push(`Вы обогнали рынок в среднем (индекс IMOEX за этот период: ${benchStr}).`);
    } else if (metrics.netReturnPct < metrics.benchmarkImoexPct) {
      sentences.push(
        `Рынок в среднем оказался сильнее (индекс IMOEX за этот период: ${benchStr}).`,
      );
    } else {
      sentences.push(`Результат совпал со средним по рынку (индекс IMOEX: ${benchStr}).`);
    }
  }

  const ddStr = `−${formatPct(metrics.maxDrawdownPct)}`;
  let riskSentence: string;
  if (metrics.maxDrawdownPct <= 5) {
    riskSentence = `Счёт почти не трясло: максимальное падение от пика составило ${ddStr}.`;
  } else if (metrics.maxDrawdownPct <= 15) {
    riskSentence = `Колебания счёта были умеренными: максимальное падение от пика — ${ddStr}.`;
  } else {
    riskSentence = `Счёт заметно трясло: максимальное падение от пика доходило до ${ddStr}.`;
  }

  if (metrics.costsRub.totalRub !== null) {
    riskSentence += ` На комиссии и прочие издержки ушло ${formatRub(metrics.costsRub.totalRub)}.`;
  }
  sentences.push(riskSentence);

  const maxAbs = Math.max(Math.abs(metrics.grossReturnPct), Math.abs(metrics.netReturnPct));
  const grossBarWidthPct =
    maxAbs === 0 ? 0 : Math.max(8, Math.round((Math.abs(metrics.grossReturnPct) / maxAbs) * 100));
  const netBarWidthPct =
    maxAbs === 0 ? 0 : Math.max(8, Math.round((Math.abs(metrics.netReturnPct) / maxAbs) * 100));

  return {
    headline,
    tone,
    sentences,
    grossBarWidthPct,
    netBarWidthPct,
  };
}

export function formatLaunchRejectReason(
  reason: LaunchRejectReason,
  barsCount: number | null,
  maxBars: number | null,
): string {
  switch (reason) {
    case 'NO_MATCHING_PERIOD':
      return 'Не удалось подобрать данные для повторения этого периода.';
    case 'TOO_MANY_BARS':
      return barsCount !== null && maxBars !== null
        ? `Слишком много свечей для ручной сессии (${barsCount} при лимите ${maxBars}).`
        : 'Слишком много свечей для повторного запуска этой сессии.';
    case 'CORPORATE_ACTION_ON_PERIOD':
      return 'На выбранный период попадает корпоративное событие (сплит или реорганизация).';
    case 'INVALID_PARAMS':
      return 'Параметры этой сессии не подходят для повторного запуска.';
  }
}

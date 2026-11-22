import { formatLaunchRejection, LaunchRejectMessage } from '../launch/launch.format';
import { CreateRunResult } from '../runs/data/runs.models';
import {
  CheckLevel,
  StrategyDiagnostic,
  StrategyParamDecl,
  WorkshopLinterWarning,
  WorkshopSortField,
} from './data/workshop.models';

export const WORKSHOP_SORT_LABELS: Readonly<Record<WorkshopSortField, string>> = {
  published_desc: 'Сначала новые',
  name_asc: 'По названию',
  author_asc: 'По автору',
};

export const CHECK_LEVEL_LABELS: Readonly<Record<CheckLevel, string>> = {
  OK: 'Без ошибок',
  WARNING: 'Предупреждения',
  ERROR: 'Ошибки',
};

const MOSCOW_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatWorkshopDateTime(iso: string | null): string {
  if (iso === null) {
    return '—';
  }
  return MOSCOW_DATE_TIME_FORMATTER.format(new Date(iso)).replace(',', '');
}

export function formatLinterSummary(warnings: readonly WorkshopLinterWarning[]): string {
  if (warnings.length === 0) {
    return 'Чисто';
  }
  const codes = Array.from(new Set(warnings.map((w) => w.code))).join(', ');
  return `${warnings.length} пред. (${codes})`;
}

export function formatCheckLevelAppearance(level: CheckLevel): 'positive' | 'warning' | 'negative' {
  switch (level) {
    case 'OK':
      return 'positive';
    case 'WARNING':
      return 'warning';
    case 'ERROR':
      return 'negative';
  }
}

export function formatDiagnosticLocation(
  diagnostic: Pick<StrategyDiagnostic, 'startLine' | 'startColumn'>,
): string {
  if (diagnostic.startLine <= 0) {
    return 'весь файл';
  }
  return `${diagnostic.startLine}:${diagnostic.startColumn}`;
}

export function validateStrategyParam(
  param: StrategyParamDecl,
  value: number | null,
): string | null {
  if (value === null || !Number.isFinite(value)) {
    return 'Введите числовое значение.';
  }
  if (param.integer && !Number.isInteger(value)) {
    return 'Значение должно быть целым числом.';
  }
  if (param.rangeMin !== null && value < param.rangeMin) {
    return `Минимальное значение: ${param.rangeMin}.`;
  }
  if (param.rangeMax !== null && value > param.rangeMax) {
    return `Максимальное значение: ${param.rangeMax}.`;
  }
  if (param.step !== null) {
    const stepNum = Number(param.step);
    if (Number.isFinite(stepNum) && stepNum > 0) {
      const base = param.rangeMin ?? param.defaultValue;
      const steps = (value - base) / stepNum;
      if (Math.abs(steps - Math.round(steps)) > 1e-6) {
        return `Значение должно соответствовать шагу ${param.step}.`;
      }
    }
  }
  return null;
}

export function formatRunRejection(
  result: Extract<CreateRunResult, { readonly accepted: false }>,
): LaunchRejectMessage {
  if (result.reason === 'STRATEGY_INVALID') {
    return {
      title: 'Стратегия не прошла проверку (STRATEGY_INVALID)',
      suggestion:
        result.detail?.trim() || 'Исправьте ошибки DSL в черновике и опубликуйте новую версию.',
    };
  }
  const base = formatLaunchRejection(result.reason, {
    field: result.field,
    barsCount: result.barsCount,
    maxBars: result.maxBars,
  });
  if (result.reason === 'INVALID_PARAMS' && result.detail?.trim()) {
    return { title: base.title, suggestion: result.detail.trim() };
  }
  return base;
}

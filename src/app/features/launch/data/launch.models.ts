import { InjectionToken } from '@angular/core';

export type TraderKind = 'human';

// Границы своего значения начального капитала (decisions.md, 19.11.2026), до 2 знаков.
export const MIN_INITIAL_CAPITAL_RUB = 10_000;
export const MAX_INITIAL_CAPITAL_RUB = 100_000_000;

export type SessionDurationDays = 20 | 60 | 120 | 250;

export type CandleTimeframe = '1m' | '5m' | '10m' | '15m' | '1h' | '1d';

export type MarketRegime = 'calm' | 'medium' | 'stress';

export type StartMode = 'random' | 'custom';

export type LaunchPresetId = 'quick' | 'quarter' | 'stress';

export interface LaunchPreset {
  readonly id: LaunchPresetId;
  readonly title: string;
  readonly badge?: string;
  readonly specs: string;
  readonly description: string;
  readonly durationDays: SessionDurationDays;
  readonly timeframe: CandleTimeframe;
  readonly regime: MarketRegime;
  readonly paperCount: number;
  readonly initialCapitalRub: number;
}

export const LAUNCH_PRESETS: readonly LaunchPreset[] = [
  {
    id: 'quick',
    title: 'Быстрая тренировка',
    badge: 'Рекомендуем',
    specs: '20 дн. · 1 свеча = 1 день · 3 случайные бумаги · средний рынок',
    description: 'Короткий слепой заход, чтобы быстро освоить арену и увидеть разбор ошибок',
    durationDays: 20,
    timeframe: '1d',
    regime: 'medium',
    paperCount: 3,
    initialCapitalRub: 1_000_000,
  },
  {
    id: 'quarter',
    title: 'Полноценный квартал',
    specs: '60 дн. · 1 свеча = 1 день · 3 случайные бумаги · средний рынок',
    description: 'Основной учебный горизонт: проверка дисциплины на разных фазах рынка',
    durationDays: 60,
    timeframe: '1d',
    regime: 'medium',
    paperCount: 3,
    initialCapitalRub: 1_000_000,
  },
  {
    id: 'stress',
    title: 'Стресс-тест рынка',
    specs: '60 дн. · 1 свеча = 1 день · 3 случайные бумаги · стрессовый период',
    description: 'Период повышенной волатильности: испытание на просадку и стопы',
    durationDays: 60,
    timeframe: '1d',
    regime: 'stress',
    paperCount: 3,
    initialCapitalRub: 1_000_000,
  },
];

export type LaunchRejectReason =
  'NO_MATCHING_PERIOD' | 'TOO_MANY_BARS' | 'INVALID_PARAMS' | 'CORPORATE_ACTION_ON_PERIOD';

export interface LaunchCustomPaper {
  readonly id: string;
  readonly sector: string;
  readonly ticker: string;
  readonly name: string;
}

export interface ExecutionRulesSummary {
  readonly commissionPct: number;
  readonly exchangeFeePct: number;
  readonly spreadPct: number;
  readonly slippageKappa: number;
  readonly liquidityLimitPct: number;
  readonly maxBars: number;
  readonly runMaxBars?: number;
}

export interface LaunchOptions {
  readonly durations: readonly SessionDurationDays[];
  readonly defaultDuration: SessionDurationDays;
  readonly availableTimeframes: readonly CandleTimeframe[];
  readonly maxDurationDaysByTimeframe: Readonly<Record<CandleTimeframe, number>>;
  readonly runMaxDurationDaysByTimeframe?: Readonly<Record<CandleTimeframe, number>>;
  readonly defaultTimeframe: CandleTimeframe;
  readonly regimes: readonly MarketRegime[];
  readonly defaultRegime: MarketRegime;
  readonly capitalPresetsRub: readonly number[];
  readonly defaultCapitalRub: number;
  readonly backgroundAlgorithmName: string;
  readonly minPapers: number;
  readonly maxPapers: number;
  readonly defaultPaperCount: number;
  readonly executionRules: ExecutionRulesSummary;
  readonly archiveFrom?: string | null;
  readonly archiveTo?: string | null;
}

export interface StartSessionCommand {
  readonly traderKind: TraderKind;
  readonly durationDays: SessionDurationDays;
  readonly timeframe: CandleTimeframe;
  readonly regime: MarketRegime;
  readonly startMode: StartMode;
  readonly customStartDate: string | null;
  readonly paperCount: number | null;
  readonly paperIds: readonly string[] | null;
  /** Money из контракта (INV-6): десятичная строка рублей, до 2 знаков. */
  readonly initialCapital: string;
  readonly backgroundAlgorithmId: string | null;
}

export type LaunchCommandResult =
  | {
      readonly accepted: true;
      readonly sessionId: string;
    }
  | {
      readonly accepted: false;
      readonly reason: LaunchRejectReason;
      readonly field: string | null;
      readonly barsCount: number | null;
      readonly maxBars: number | null;
    };

export interface LaunchApi {
  getLaunchOptions(): Promise<LaunchOptions>;
  getAvailablePapers(): Promise<readonly LaunchCustomPaper[]>;
  startSession(command: StartSessionCommand): Promise<LaunchCommandResult>;
}

export const LAUNCH_API = new InjectionToken<LaunchApi>('LAUNCH_API');

export const TIMEFRAME_LABELS: Readonly<Record<CandleTimeframe, string>> = {
  '1m': '1 мин',
  '5m': '5 мин',
  '10m': '10 мин',
  '15m': '15 мин',
  '1h': '1 ч',
  '1d': '1 д',
};

export const TIMEFRAME_HUMAN_HINTS: Readonly<Record<CandleTimeframe, string>> = {
  '1m': '1 свеча = 1 минута',
  '5m': '1 свеча = 5 минут',
  '10m': '1 свеча = 10 минут',
  '15m': '1 свеча = 15 минут',
  '1h': '1 свеча = 1 час',
  '1d': '1 свеча = 1 день',
};

export const REGIME_LABELS: Readonly<Record<MarketRegime, string>> = {
  calm: 'Спокойный',
  medium: 'Средний',
  stress: 'Стрессовый',
};

export const REGIME_HINTS_BASIC: Readonly<Record<MarketRegime, string>> = {
  calm: 'Спокойный рынок без резких скачков и глубоких падений',
  medium: 'Умеренные колебания рынка между спокойным и стрессовым',
  stress: 'Резкие колебания и сильные падения — испытание на выдержку',
};

export const REGIME_HINTS: Readonly<Record<MarketRegime, string>> = {
  calm: 'Низкая волатильность IMOEX (≤ P33) и просадка < 10 %',
  medium: 'Умеренные колебания рынка между спокойным и стрессовым',
  stress: 'Высокая волатильность (≥ P80) или просадка IMOEX ≥ 20 %',
};

const PAPER_COUNT_CANDIDATES = [1, 2, 3, 5, 10, 20, 50] as const;

/** Быстрые пресеты количества случайных бумаг без раздувания segmented-контрола при сотнях бумаг в каталоге. */
export function buildPaperCountPresets(minPapers: number, maxPapers: number): readonly number[] {
  const min = Math.max(1, Math.floor(minPapers));
  const max = Math.max(min, Math.floor(maxPapers));
  if (max <= 5) {
    const counts: number[] = [];
    for (let n = min; n <= max; n++) {
      counts.push(n);
    }
    return counts;
  }
  const presets = PAPER_COUNT_CANDIDATES.filter((n) => n >= min && n <= max);
  return presets.length > 0 ? presets : [min];
}

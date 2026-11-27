import { InjectionToken } from '@angular/core';

export type TraderKind = 'human';

// Границы своего значения начального капитала (decisions.md, 19.11.2026), до 2 знаков.
export const MIN_INITIAL_CAPITAL_RUB = 10_000;
export const MAX_INITIAL_CAPITAL_RUB = 100_000_000;

export type SessionDurationDays = 20 | 60 | 120 | 250;

export type CandleTimeframe = '1m' | '5m' | '10m' | '15m' | '1h' | '1d';

export type MarketRegime = 'calm' | 'medium' | 'stress';

export type StartMode = 'random' | 'custom';

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
}

export interface LaunchOptions {
  readonly durations: readonly SessionDurationDays[];
  readonly defaultDuration: SessionDurationDays;
  readonly availableTimeframes: readonly CandleTimeframe[];
  readonly maxDurationDaysByTimeframe: Readonly<Record<CandleTimeframe, number>>;
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

export const DURATION_LABELS: Readonly<Record<SessionDurationDays, string>> = {
  20: '1 месяц',
  60: '3 месяца',
  120: 'полгода',
  250: '1 год',
};

export const TIMEFRAME_LABELS: Readonly<Record<CandleTimeframe, string>> = {
  '1m': '1 мин',
  '5m': '5 мин',
  '10m': '10 мин',
  '15m': '15 мин',
  '1h': '1 ч',
  '1d': '1 д',
};

export const REGIME_LABELS: Readonly<Record<MarketRegime, string>> = {
  calm: 'Спокойный',
  medium: 'Средний',
  stress: 'Стрессовый',
};

export const REGIME_HINTS: Readonly<Record<MarketRegime, string>> = {
  calm: 'Спокойный рынок без резких скачков и глубоких падений',
  medium: 'Обычный рынок с умеренными взлётами и падениями',
  stress: 'Период сильных колебаний или кризисного падения рынка',
};

export interface LaunchScenarioPreset {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly badge: string;
  readonly durationDays: SessionDurationDays;
  readonly timeframe: CandleTimeframe;
  readonly regime: MarketRegime;
  readonly paperCount: number;
  readonly initialCapitalRub: number;
}

export const QUICK_START_PRESET: LaunchScenarioPreset = {
  id: 'calm-start',
  title: 'Спокойный старт',
  description:
    'Одна бумага, спокойный рынок и понятный дневной график — идеально для первого раза.',
  badge: 'Для первого раза',
  durationDays: 20,
  timeframe: '1d',
  regime: 'calm',
  paperCount: 1,
  initialCapitalRub: 100_000,
};

export const BEGINNER_SCENARIOS: readonly LaunchScenarioPreset[] = [
  QUICK_START_PRESET,
  {
    id: 'portfolio',
    title: 'Собери портфель',
    description: 'Три бумаги на три месяца — попробуйте распределить виртуальный капитал.',
    badge: '3 бумаги',
    durationDays: 60,
    timeframe: '1d',
    regime: 'medium',
    paperCount: 3,
    initialCapitalRub: 100_000,
  },
  {
    id: 'crisis',
    title: 'Испытание кризисом',
    description: 'Стрессовый отрезок рынка: проверьте, как вы держите удар при сильных колебаниях.',
    badge: 'Повышенный риск',
    durationDays: 60,
    timeframe: '1d',
    regime: 'stress',
    paperCount: 1,
    initialCapitalRub: 100_000,
  },
];

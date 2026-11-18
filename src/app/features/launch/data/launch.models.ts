import { InjectionToken } from '@angular/core';

export type TraderKind = 'human';

export type SessionDurationDays = 20 | 60 | 120 | 250;

export type CandleTimeframe = '1m' | '5m' | '10m' | '15m' | '1h' | '1d';

export type MarketRegime = 'calm' | 'medium' | 'stress';

export type StartMode = 'random' | 'custom';

export type LaunchRejectReason =
  'NO_MATCHING_PERIOD' | 'TOO_MANY_BARS' | 'INVALID_PARAMS' | 'CORPORATE_ACTION_ON_PERIOD';

export interface LaunchPaperOption {
  readonly id: string;
  readonly blindLabel: string;
  readonly sector: string;
  readonly ticker: string;
  readonly name: string;
}

export interface ExecutionRulesSummary {
  readonly commissionPct: number;
  readonly exchangeFeePct: number;
  readonly spreadPct: number;
  readonly slippagePct: number;
  readonly liquidityLimitPct: number;
  readonly maxBars: number;
}

export interface LaunchOptions {
  readonly durations: readonly SessionDurationDays[];
  readonly defaultDuration: SessionDurationDays;
  readonly availableTimeframes: readonly CandleTimeframe[];
  readonly defaultTimeframe: CandleTimeframe;
  readonly regimes: readonly MarketRegime[];
  readonly defaultRegime: MarketRegime;
  readonly capitalPresetsRub: readonly number[];
  readonly defaultCapitalRub: number;
  readonly backgroundAlgorithmName: string;
  readonly papers: readonly LaunchPaperOption[];
  readonly minPapers: number;
  readonly maxPapers: number;
  readonly executionRules: ExecutionRulesSummary;
}

export interface StartSessionCommand {
  readonly traderKind: TraderKind;
  readonly durationDays: SessionDurationDays;
  readonly timeframe: CandleTimeframe;
  readonly regime: MarketRegime;
  readonly startMode: StartMode;
  readonly customStartDate?: string;
  readonly paperIds: readonly string[];
  readonly initialCapitalRub: number;
}

export type LaunchCommandResult =
  | {
      readonly accepted: true;
      readonly sessionId: string;
    }
  | {
      readonly accepted: false;
      readonly reason: LaunchRejectReason;
      readonly field?: string;
      readonly barsCount?: number;
      readonly maxBars?: number;
    };

export interface LaunchApi {
  getLaunchOptions(): Promise<LaunchOptions>;
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

export const REGIME_LABELS: Readonly<Record<MarketRegime, string>> = {
  calm: 'Спокойный',
  medium: 'Средний',
  stress: 'Стрессовый',
};

export const REGIME_HINTS: Readonly<Record<MarketRegime, string>> = {
  calm: 'Низкая волатильность IMOEX (≤ P33) и просадка < 10 %',
  medium: 'Умеренные колебания рынка между спокойным и стрессовым',
  stress: 'Высокая волатильность (≥ P80) или просадка IMOEX ≥ 20 %',
};

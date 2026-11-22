import { Injectable } from '@angular/core';
import { injectSessionRegistry } from '../../../shared/stub-session-registry';
import {
  CandleTimeframe,
  LaunchApi,
  LaunchCommandResult,
  LaunchCustomPaper,
  LaunchOptions,
  MAX_INITIAL_CAPITAL_RUB,
  MIN_INITIAL_CAPITAL_RUB,
  StartSessionCommand,
} from './launch.models';

const MAX_MANUAL_BARS = 5000;
const MIN_PAPERS = 1;
const MAX_PAPERS = 5;

const BARS_PER_DAY: Readonly<Record<CandleTimeframe, number>> = {
  '1m': 520,
  '5m': 108,
  '10m': 54,
  '15m': 36,
  '1h': 9,
  '1d': 1,
};

const CUSTOM_PAPERS: readonly LaunchCustomPaper[] = [
  { id: 'SBER', sector: 'Финансы', ticker: 'SBER', name: 'Сбербанк' },
  { id: 'GAZP', sector: 'Нефть и газ', ticker: 'GAZP', name: 'Газпром' },
  { id: 'YDEX', sector: 'IT', ticker: 'YDEX', name: 'Яндекс' },
  { id: 'GMKN', sector: 'Металлы и добыча', ticker: 'GMKN', name: 'Норникель' },
  { id: 'MGNT', sector: 'Потребсектор', ticker: 'MGNT', name: 'Магнит' },
];

const VALID_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class StubLaunchApi implements LaunchApi {
  private readonly registry = injectSessionRegistry();
  private nextSessionSeq = 106;

  async getLaunchOptions(): Promise<LaunchOptions> {
    // INV-7: в параметрах слепого запуска нет списка тикеров и названий бумаг.
    return {
      durations: [20, 60, 120, 250],
      defaultDuration: 60,
      availableTimeframes: ['1m', '5m', '10m', '15m', '1h', '1d'],
      maxDurationDaysByTimeframe: {
        '1m': 6,
        '5m': 30,
        '10m': 60,
        '15m': 90,
        '1h': 357,
        '1d': 5000,
      },
      defaultTimeframe: '1d',
      regimes: ['calm', 'medium', 'stress'],
      defaultRegime: 'medium',
      capitalPresetsRub: [100_000, 500_000, 1_000_000, 5_000_000],
      defaultCapitalRub: 1_000_000,
      backgroundAlgorithmName: 'Эталон платформы',
      minPapers: MIN_PAPERS,
      maxPapers: MAX_PAPERS,
      defaultPaperCount: 3,
      executionRules: {
        commissionPct: 0.3,
        exchangeFeePct: 0.01,
        spreadPct: 0.1,
        slippageKappa: 0.1,
        liquidityLimitPct: 10,
        maxBars: MAX_MANUAL_BARS,
      },
    };
  }

  async getAvailablePapers(): Promise<readonly LaunchCustomPaper[]> {
    return CUSTOM_PAPERS;
  }

  async startSession(command: StartSessionCommand): Promise<LaunchCommandResult> {
    const capital = /^\d+(\.\d{1,2})?$/.test(command.initialCapital)
      ? Number(command.initialCapital)
      : Number.NaN;
    if (
      !Number.isFinite(capital) ||
      capital < MIN_INITIAL_CAPITAL_RUB ||
      capital > MAX_INITIAL_CAPITAL_RUB ||
      Math.abs(capital * 100 - Math.round(capital * 100)) > 1e-6
    ) {
      return {
        accepted: false,
        reason: 'INVALID_PARAMS',
        field: 'initialCapital',
        barsCount: null,
        maxBars: null,
      };
    }

    let papersCount: number;
    if (command.startMode === 'random') {
      const count = command.paperCount ?? 0;
      if (!Number.isInteger(count) || count < MIN_PAPERS || count > MAX_PAPERS) {
        return {
          accepted: false,
          reason: 'INVALID_PARAMS',
          field: 'paperCount',
          barsCount: null,
          maxBars: null,
        };
      }
      papersCount = count;
    } else {
      const ids = command.paperIds ?? [];
      const validIds = new Set(CUSTOM_PAPERS.map((p) => p.id));
      if (
        ids.length < MIN_PAPERS ||
        ids.length > MAX_PAPERS ||
        ids.some((id) => !validIds.has(id))
      ) {
        return {
          accepted: false,
          reason: 'INVALID_PARAMS',
          field: 'paperIds',
          barsCount: null,
          maxBars: null,
        };
      }
      const date = command.customStartDate?.trim() ?? '';
      if (!VALID_DATE_PATTERN.test(date)) {
        return {
          accepted: false,
          reason: 'INVALID_PARAMS',
          field: 'customStartDate',
          barsCount: null,
          maxBars: null,
        };
      }
      if (date === '2020-07-10') {
        return {
          accepted: false,
          reason: 'CORPORATE_ACTION_ON_PERIOD',
          field: 'customStartDate',
          barsCount: null,
          maxBars: null,
        };
      }
      papersCount = ids.length;
    }

    const barsCount = command.durationDays * BARS_PER_DAY[command.timeframe];
    if (barsCount > MAX_MANUAL_BARS) {
      return {
        accepted: false,
        reason: 'TOO_MANY_BARS',
        field: null,
        barsCount,
        maxBars: MAX_MANUAL_BARS,
      };
    }

    if (
      command.durationDays === 250 &&
      papersCount >= 4 &&
      (command.regime === 'stress' || command.regime === 'calm')
    ) {
      return {
        accepted: false,
        reason: 'NO_MATCHING_PERIOD',
        field: null,
        barsCount: null,
        maxBars: null,
      };
    }

    const sessionId =
      this.registry?.allocateSessionId() ?? `S-${String(this.nextSessionSeq++).padStart(4, '0')}`;
    const blind = command.startMode === 'random';
    this.registry?.register({
      sessionId,
      blind,
      regime: command.regime,
      timeframe: command.timeframe,
      totalDays: command.durationDays,
      playedDays: 1,
      finished: false,
      finishedEarly: false,
      createdAt: new Date().toISOString(),
      initialCapitalRub: capital,
      paperIds: blind ? null : (command.paperIds ?? null),
      paperCount: papersCount,
      customStartDate: blind ? null : (command.customStartDate ?? null),
      netReturnPct: null,
      backgroundAlgorithmId: command.backgroundAlgorithmId,
    });
    return { accepted: true, sessionId };
  }
}

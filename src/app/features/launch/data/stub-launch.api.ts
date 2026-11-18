import { Injectable } from '@angular/core';
import {
  CandleTimeframe,
  LaunchApi,
  LaunchCommandResult,
  LaunchOptions,
  LaunchPaperOption,
  StartSessionCommand,
} from './launch.models';

const MAX_MANUAL_BARS = 5000;

const BARS_PER_DAY: Readonly<Record<CandleTimeframe, number>> = {
  '1m': 520,
  '5m': 108,
  '10m': 54,
  '15m': 36,
  '1h': 9,
  '1d': 1,
};

const LAUNCH_PAPERS: readonly LaunchPaperOption[] = [
  { id: 'A', blindLabel: 'Бумага A', sector: 'Финансы', ticker: 'SBER', name: 'Сбербанк' },
  { id: 'B', blindLabel: 'Бумага B', sector: 'Нефть и газ', ticker: 'GAZP', name: 'Газпром' },
  { id: 'C', blindLabel: 'Бумага C', sector: 'IT', ticker: 'YDEX', name: 'Яндекс' },
  {
    id: 'D',
    blindLabel: 'Бумага D',
    sector: 'Металлы и добыча',
    ticker: 'GMKN',
    name: 'Норникель',
  },
  { id: 'E', blindLabel: 'Бумага E', sector: 'Потребсектор', ticker: 'MGNT', name: 'Магнит' },
];

const VALID_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class StubLaunchApi implements LaunchApi {
  private nextSessionSeq = 105;

  async getLaunchOptions(): Promise<LaunchOptions> {
    return {
      durations: [20, 60, 120, 250],
      defaultDuration: 60,
      availableTimeframes: ['1m', '5m', '10m', '15m', '1h', '1d'],
      defaultTimeframe: '1d',
      regimes: ['calm', 'medium', 'stress'],
      defaultRegime: 'medium',
      capitalPresetsRub: [100_000, 500_000, 1_000_000, 5_000_000],
      defaultCapitalRub: 1_000_000,
      backgroundAlgorithmName: 'Эталон платформы',
      papers: LAUNCH_PAPERS,
      minPapers: 1,
      maxPapers: 5,
      executionRules: {
        commissionPct: 0.3,
        exchangeFeePct: 0.01,
        spreadPct: 0.1,
        slippagePct: 0.1,
        liquidityLimitPct: 10,
        maxBars: MAX_MANUAL_BARS,
      },
    };
  }

  async startSession(command: StartSessionCommand): Promise<LaunchCommandResult> {
    if (command.paperIds.length < 1 || command.paperIds.length > 5) {
      return { accepted: false, reason: 'INVALID_PARAMS', field: 'paperIds' };
    }

    const validIds = new Set(LAUNCH_PAPERS.map((p) => p.id));
    if (command.paperIds.some((id) => !validIds.has(id))) {
      return { accepted: false, reason: 'INVALID_PARAMS', field: 'paperIds' };
    }

    if (command.initialCapitalRub <= 0) {
      return { accepted: false, reason: 'INVALID_PARAMS', field: 'initialCapitalRub' };
    }

    if (command.startMode === 'custom') {
      const date = command.customStartDate?.trim() ?? '';
      if (!VALID_DATE_PATTERN.test(date)) {
        return { accepted: false, reason: 'INVALID_PARAMS', field: 'customStartDate' };
      }
      if (date === '2020-07-10') {
        return { accepted: false, reason: 'CORPORATE_ACTION_ON_PERIOD', field: 'customStartDate' };
      }
    }

    const barsCount = command.durationDays * BARS_PER_DAY[command.timeframe];
    if (barsCount > MAX_MANUAL_BARS) {
      return {
        accepted: false,
        reason: 'TOO_MANY_BARS',
        barsCount,
        maxBars: MAX_MANUAL_BARS,
      };
    }

    // Длинный стрессовый или спокойный период на большом наборе бумаг в архиве не найден (заглушка).
    if (
      command.durationDays === 250 &&
      command.paperIds.length >= 4 &&
      (command.regime === 'stress' || command.regime === 'calm')
    ) {
      return { accepted: false, reason: 'NO_MATCHING_PERIOD' };
    }

    const sessionId = `S-${String(this.nextSessionSeq++).padStart(4, '0')}`;
    return { accepted: true, sessionId };
  }
}

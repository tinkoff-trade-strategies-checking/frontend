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

const MAX_MANUAL_BARS = 25_000;
const MAX_RUN_BARS = 250_000;
const MIN_PAPERS = 1;

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
  { id: 'LKOH', sector: 'Нефть и газ', ticker: 'LKOH', name: 'ЛУКОЙЛ' },
  { id: 'ROSN', sector: 'Нефть и газ', ticker: 'ROSN', name: 'Роснефть' },
  { id: 'NVTK', sector: 'Нефть и газ', ticker: 'NVTK', name: 'НОВАТЭК' },
  { id: 'TATN', sector: 'Нефть и газ', ticker: 'TATN', name: 'Татнефть' },
  { id: 'SNGS', sector: 'Нефть и газ', ticker: 'SNGS', name: 'Сургутнефтегаз' },
  { id: 'SNGSP', sector: 'Нефть и газ', ticker: 'SNGSP', name: 'Сургутнефтегаз-п' },
  { id: 'SIBN', sector: 'Нефть и газ', ticker: 'SIBN', name: 'Газпром нефть' },
  { id: 'TRNFP', sector: 'Нефть и газ', ticker: 'TRNFP', name: 'Транснефть-п' },
  { id: 'BANE', sector: 'Нефть и газ', ticker: 'BANE', name: 'Башнефть' },
  { id: 'T', sector: 'Финансы', ticker: 'T', name: 'Т-Технологии' },
  { id: 'VTBR', sector: 'Финансы', ticker: 'VTBR', name: 'ВТБ' },
  { id: 'MOEX', sector: 'Финансы', ticker: 'MOEX', name: 'Московская Биржа' },
  { id: 'BSPB', sector: 'Финансы', ticker: 'BSPB', name: 'Банк Санкт-Петербург' },
  { id: 'CBOM', sector: 'Финансы', ticker: 'CBOM', name: 'МКБ' },
  { id: 'SVCB', sector: 'Финансы', ticker: 'SVCB', name: 'Совкомбанк' },
  { id: 'SBERP', sector: 'Финансы', ticker: 'SBERP', name: 'Сбербанк-п' },
  { id: 'RENI', sector: 'Финансы', ticker: 'RENI', name: 'Ренессанс Страхование' },
  { id: 'LEAS', sector: 'Финансы', ticker: 'LEAS', name: 'Европлан' },
  { id: 'AFKS', sector: 'Финансы', ticker: 'AFKS', name: 'АФК Система' },
  { id: 'PLZL', sector: 'Металлы и добыча', ticker: 'PLZL', name: 'Полюс' },
  { id: 'CHMF', sector: 'Металлы и добыча', ticker: 'CHMF', name: 'Северсталь' },
  { id: 'NLMK', sector: 'Металлы и добыча', ticker: 'NLMK', name: 'НЛМК' },
  { id: 'MAGN', sector: 'Металлы и добыча', ticker: 'MAGN', name: 'ММК' },
  { id: 'RUAL', sector: 'Металлы и добыча', ticker: 'RUAL', name: 'РУСАЛ' },
  { id: 'ALRS', sector: 'Металлы и добыча', ticker: 'ALRS', name: 'АЛРОСА' },
  { id: 'SELG', sector: 'Металлы и добыча', ticker: 'SELG', name: 'Селигдар' },
  { id: 'UGLD', sector: 'Металлы и добыча', ticker: 'UGLD', name: 'ЮГК' },
  { id: 'MTLR', sector: 'Металлы и добыча', ticker: 'MTLR', name: 'Мечел' },
  { id: 'RASP', sector: 'Металлы и добыча', ticker: 'RASP', name: 'Распадская' },
  { id: 'ENPG', sector: 'Металлы и добыча', ticker: 'ENPG', name: 'ЭН+ ГРУП' },
  { id: 'VKCO', sector: 'IT', ticker: 'VKCO', name: 'ВК' },
  { id: 'POSI', sector: 'IT', ticker: 'POSI', name: 'Группа Позитив' },
  { id: 'ASTR', sector: 'IT', ticker: 'ASTR', name: 'Группа Астра' },
  { id: 'HEAD', sector: 'IT', ticker: 'HEAD', name: 'Хэдхантер' },
  { id: 'SOFL', sector: 'IT', ticker: 'SOFL', name: 'Софтлайн' },
  { id: 'DIAS', sector: 'IT', ticker: 'DIAS', name: 'Диасофт' },
  { id: 'IVAT', sector: 'IT', ticker: 'IVAT', name: 'ИВА' },
  { id: 'X5', sector: 'Потребсектор', ticker: 'X5', name: 'ИКС 5' },
  { id: 'LENT', sector: 'Потребсектор', ticker: 'LENT', name: 'Лента' },
  { id: 'BELU', sector: 'Потребсектор', ticker: 'BELU', name: 'НоваБев Групп' },
  { id: 'MVID', sector: 'Потребсектор', ticker: 'MVID', name: 'М.Видео' },
  { id: 'AQUA', sector: 'Потребсектор', ticker: 'AQUA', name: 'Инарктика' },
  { id: 'MDMG', sector: 'Потребсектор', ticker: 'MDMG', name: 'Мать и дитя' },
  { id: 'PHOR', sector: 'Химия', ticker: 'PHOR', name: 'ФосАгро' },
  { id: 'AKRN', sector: 'Химия', ticker: 'AKRN', name: 'Акрон' },
  { id: 'NKNC', sector: 'Химия', ticker: 'NKNC', name: 'Нижнекамскнефтехим' },
  { id: 'MTSS', sector: 'Телеком', ticker: 'MTSS', name: 'МТС' },
  { id: 'RTKM', sector: 'Телеком', ticker: 'RTKM', name: 'Ростелеком' },
  { id: 'IRAO', sector: 'Электроэнергетика', ticker: 'IRAO', name: 'Интер РАО' },
  { id: 'HYDR', sector: 'Электроэнергетика', ticker: 'HYDR', name: 'РусГидро' },
  { id: 'FEES', sector: 'Электроэнергетика', ticker: 'FEES', name: 'Россети' },
  { id: 'UPRO', sector: 'Электроэнергетика', ticker: 'UPRO', name: 'Юнипро' },
  { id: 'AFLT', sector: 'Транспорт', ticker: 'AFLT', name: 'Аэрофлот' },
  { id: 'FLOT', sector: 'Транспорт', ticker: 'FLOT', name: 'Совкомфлот' },
  { id: 'PIKK', sector: 'Недвижимость', ticker: 'PIKK', name: 'ПИК СЗ' },
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
        '1m': 30,
        '5m': 150,
        '10m': 300,
        '15m': 450,
        '1h': 1785,
        '1d': 25000,
      },
      runMaxDurationDaysByTimeframe: {
        '1m': 300,
        '5m': 1500,
        '10m': 3000,
        '15m': 4500,
        '1h': 17857,
        '1d': 250000,
      },
      defaultTimeframe: '1d',
      regimes: ['calm', 'medium', 'stress'],
      defaultRegime: 'medium',
      capitalPresetsRub: [100_000, 500_000, 1_000_000, 5_000_000],
      defaultCapitalRub: 1_000_000,
      backgroundAlgorithmName: 'Эталон платформы',
      minPapers: MIN_PAPERS,
      maxPapers: CUSTOM_PAPERS.length,
      defaultPaperCount: 3,
      executionRules: {
        commissionPct: 0.3,
        exchangeFeePct: 0.01,
        spreadPct: 0.1,
        slippageKappa: 0.1,
        liquidityLimitPct: 10,
        maxBars: MAX_MANUAL_BARS,
        runMaxBars: MAX_RUN_BARS,
      },
      archiveFrom: '2020-01-03',
      archiveTo: '2025-12-31',
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
      if (!Number.isInteger(count) || count < MIN_PAPERS || count > CUSTOM_PAPERS.length) {
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
      if (ids.length < MIN_PAPERS || ids.some((id) => !validIds.has(id))) {
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

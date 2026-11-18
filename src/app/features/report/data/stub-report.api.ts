import { Injectable } from '@angular/core';
import {
  EquityCurvePoint,
  ReportApi,
  SessionReport,
  SessionReportResult,
  UnderwaterPoint,
} from './report.models';

interface DrawdownStats {
  readonly maxDrawdownPct: number;
  readonly durationSteps: number;
}

function computeDrawdownFromSeries(values: readonly number[]): DrawdownStats {
  if (values.length === 0) {
    return { maxDrawdownPct: 0, durationSteps: 0 };
  }
  let peak = values[0];
  let maxDd = 0;
  let currentStreak = 0;
  let maxStreak = 0;

  for (const val of values) {
    if (val >= peak) {
      peak = val;
      currentStreak = 0;
    } else {
      currentStreak += 1;
      maxStreak = Math.max(maxStreak, currentStreak);
      const dd = ((peak - val) / peak) * 100;
      if (dd > maxDd) {
        maxDd = dd;
      }
    }
  }

  return {
    maxDrawdownPct: Math.round(maxDd * 100) / 100,
    durationSteps: maxStreak,
  };
}

function buildMaxDrawdownComparison(
  humanPct: number,
  algoPct: number,
): SessionReport['comparison']['maxDrawdown'] {
  const diffPctPoints = Math.round(Math.abs(humanPct - algoPct) * 100) / 100;
  const formatted = diffPctPoints.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (humanPct < algoPct) {
    return {
      humanPct,
      algoPct,
      winner: 'human',
      diffPctPoints,
      diffLabel: `У вас просадка меньше на ${formatted} п.п.`,
    };
  }
  if (algoPct < humanPct) {
    return {
      humanPct,
      algoPct,
      winner: 'algo',
      diffPctPoints,
      diffLabel: `У алгоритма просадка меньше на ${formatted} п.п.`,
    };
  }
  return {
    humanPct,
    algoPct,
    winner: 'tie',
    diffPctPoints: 0,
    diffLabel: 'Просадки равны',
  };
}

function buildEquityAndUnderwater(
  days: number,
  initialRub: number,
  humanFinalRub: number,
  algoFinalRub: number,
  benchPct: number,
  humanAmp = 28_000,
  algoAmp = 21_000,
): {
  equityCurve: EquityCurvePoint[];
  underwaterCurve: UnderwaterPoint[];
  humanDrawdown: DrawdownStats;
  algoDrawdown: DrawdownStats;
} {
  const equityCurve: EquityCurvePoint[] = [];
  const underwaterCurve: UnderwaterPoint[] = [];
  const start = new Date(Date.UTC(2020, 1, 26));

  let humanPeak = initialRub;
  let algoPeak = initialRub;

  for (let i = 0; i <= days; i++) {
    const progress = days === 0 ? 1 : i / days;
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dateLabel = `${dd}.${mm}`;

    const humanWave = Math.sin(i * 0.27) * humanAmp - Math.sin(i * 0.11) * (humanAmp * 0.64);
    const algoWave = Math.sin(i * 0.21 + 0.8) * algoAmp - Math.cos(i * 0.09) * (algoAmp * 0.67);
    const benchWave = Math.sin(i * 0.18 + 0.3) * 24_000;

    const humanCapitalRub =
      i === 0
        ? initialRub
        : i === days
          ? humanFinalRub
          : Math.round(initialRub + (humanFinalRub - initialRub) * progress + humanWave);
    const algoCapitalRub =
      i === 0
        ? initialRub
        : i === days
          ? algoFinalRub
          : Math.round(initialRub + (algoFinalRub - initialRub) * progress + algoWave);
    const benchmarkCapitalRub = Math.round(
      initialRub +
        initialRub * (benchPct / 100) * progress +
        (i === 0 || i === days ? 0 : benchWave),
    );

    humanPeak = Math.max(humanPeak, humanCapitalRub);
    algoPeak = Math.max(algoPeak, algoCapitalRub);

    const humanDrawdownPct = Math.round(((humanCapitalRub - humanPeak) / humanPeak) * 10000) / 100;
    const algoDrawdownPct = Math.round(((algoCapitalRub - algoPeak) / algoPeak) * 10000) / 100;

    equityCurve.push({
      step: i,
      dateLabel,
      humanCapitalRub,
      algoCapitalRub,
      benchmarkCapitalRub,
    });

    underwaterCurve.push({
      step: i,
      dateLabel,
      humanDrawdownPct,
      algoDrawdownPct,
    });
  }

  return {
    equityCurve,
    underwaterCurve,
    humanDrawdown: computeDrawdownFromSeries(equityCurve.map((p) => p.humanCapitalRub)),
    algoDrawdown: computeDrawdownFromSeries(equityCurve.map((p) => p.algoCapitalRub)),
  };
}

const REPORT_S0103_CURVES = buildEquityAndUnderwater(
  60,
  1_000_000,
  1_064_250,
  1_091_800,
  3.15,
  55_000,
  21_000,
);

const REPORT_S0103: SessionReport = {
  sessionId: 'S-0103',
  blind: true,
  finishedEarly: false,
  playedDays: 60,
  totalDays: 60,
  timeframe: '1d',
  regime: 'stress',
  createdAt: '18.11.2026 10:15',
  backgroundAlgorithmName: 'Эталон платформы',
  noDividendsNote: 'без дивидендов',
  period: {
    startDate: '26.02.2020',
    endDate: '21.05.2020',
    label: 'Весна 2020: обвал и отскок',
  },
  papers: [
    {
      id: 'A',
      blindLabel: 'Бумага A',
      ticker: 'SBER',
      name: 'Сбербанк',
      sector: 'Финансы',
      startPriceRub: 241.5,
      lotSize: 10,
    },
    {
      id: 'B',
      blindLabel: 'Бумага B',
      ticker: 'GAZP',
      name: 'Газпром',
      sector: 'Нефть и газ',
      startPriceRub: 214.2,
      lotSize: 10,
    },
    {
      id: 'C',
      blindLabel: 'Бумага C',
      ticker: 'YDEX',
      name: 'Яндекс',
      sector: 'IT',
      startPriceRub: 3120,
      lotSize: 1,
    },
  ],
  humanMetrics: {
    initialCapitalRub: 1_000_000,
    finalCapitalRub: 1_064_250,
    totalReturnPct: 6.43,
    cagrPct: 29.85,
    // decisions.md: gross = total + (комиссия + сбор) / E_0 = 6.425 + (4920 + 164) / 1_000_000 = 6.93 %.
    grossReturnPct: 6.93,
    netReturnPct: 6.43,
    maxDrawdownPct: REPORT_S0103_CURVES.humanDrawdown.maxDrawdownPct,
    maxDrawdownDurationDays: REPORT_S0103_CURVES.humanDrawdown.durationSteps,
    maxDrawdownDurationSteps: REPORT_S0103_CURVES.humanDrawdown.durationSteps,
    volatilityPct: 22.15,
    sharpe: 1.12,
    sortino: 1.54,
    turnover: 1.64,
    tradesCount: 4,
    winRatePct: 75.0,
    rejectedOrdersCount: 1,
    partialFillsCount: 1,
    hhi: 0.41,
    largestPositionPct: 48.5,
    bankrupt: false,
    costsRub: {
      totalRub: 7_800,
      commissionRub: 4_920,
      exchangeFeeRub: 164,
      spreadRub: 1_640,
      slippageRub: 1_076,
    },
    benchmarkImoexPct: 3.15,
  },
  algoMetrics: {
    initialCapitalRub: 1_000_000,
    finalCapitalRub: 1_091_800,
    totalReturnPct: 9.18,
    cagrPct: 44.52,
    // decisions.md: gross = total + (комиссия + сбор) / E_0 = 9.18 + (4180 + 139) / 1_000_000 = 9.61 %.
    grossReturnPct: 9.61,
    netReturnPct: 9.18,
    maxDrawdownPct: REPORT_S0103_CURVES.algoDrawdown.maxDrawdownPct,
    maxDrawdownDurationDays: REPORT_S0103_CURVES.algoDrawdown.durationSteps,
    maxDrawdownDurationSteps: REPORT_S0103_CURVES.algoDrawdown.durationSteps,
    volatilityPct: 18.4,
    sharpe: 1.61,
    sortino: 2.18,
    turnover: 1.39,
    tradesCount: 5,
    winRatePct: 80.0,
    rejectedOrdersCount: 0,
    partialFillsCount: 1,
    hhi: 0.36,
    largestPositionPct: 41.2,
    bankrupt: false,
    costsRub: {
      totalRub: 6_600,
      commissionRub: 4_180,
      exchangeFeeRub: 139,
      spreadRub: 1_390,
      slippageRub: 891,
    },
    benchmarkImoexPct: 3.15,
  },
  comparison: {
    finalCapital: {
      humanRub: 1_064_250,
      algoRub: 1_091_800,
      winner: 'algo',
      diffRub: 27_550,
      diffLabel: 'Алгоритм лучше на 27 550 ₽',
    },
    netReturn: {
      humanPct: 6.43,
      algoPct: 9.18,
      winner: 'algo',
      diffPctPoints: 2.75,
      diffLabel: 'Алгоритм лучше на 2,75 п.п.',
    },
    maxDrawdown: buildMaxDrawdownComparison(
      REPORT_S0103_CURVES.humanDrawdown.maxDrawdownPct,
      REPORT_S0103_CURVES.algoDrawdown.maxDrawdownPct,
    ),
  },
  equityCurve: REPORT_S0103_CURVES.equityCurve,
  underwaterCurve: REPORT_S0103_CURVES.underwaterCurve,
  divergenceSummary: {
    totalErrorCostRub: 27_875,
    totalErrorCostPct: 2.79,
    worstDivergenceId: 'DIV-1',
    worstType: 'size',
    worstDay: 4,
    worstErrorCostRub: 21_180,
  },
  divergences: [
    {
      id: 'DIV-1',
      step: 3,
      day: 4,
      dateLabel: '02.03',
      paperTicker: 'SBER',
      sector: 'Финансы',
      type: 'size',
      deltaBars: null,
      horizonStep: 59,
      horizonDay: 60,
      humanAction: 'Покупка 80 лот. по рынку',
      algoAction: 'Покупка 120 лот. по рынку',
      errorCostRub: 21_180,
      errorCostPct: 2.12,
      because: 'усиление позиции при пробое скользящей средней вверх',
    },
    {
      id: 'DIV-2',
      step: 18,
      day: 19,
      dateLabel: '23.03',
      paperTicker: 'GAZP',
      sector: 'Нефть и газ',
      type: 'extra',
      deltaBars: null,
      horizonStep: 30,
      horizonDay: 31,
      humanAction: 'Покупка 90 лот. лимитной заявкой',
      algoAction: 'Нет заявки',
      errorCostRub: -10_440,
      errorCostPct: -1.1,
      because: 'алгоритм здесь не действовал бы',
    },
    {
      id: 'DIV-3',
      step: 19,
      day: 20,
      dateLabel: '24.03',
      paperTicker: 'YDEX',
      sector: 'IT',
      type: 'missed',
      deltaBars: null,
      horizonStep: 43,
      horizonDay: 44,
      humanAction: 'Нет заявки',
      algoAction: 'Покупка 45 лот. лимитной заявкой',
      errorCostRub: 14_175,
      errorCostPct: 1.47,
      because: 'перепроданность: RSI(14) = 24,5 и объём ×1,8 выше среднего',
    },
    {
      id: 'DIV-4',
      step: 30,
      day: 31,
      dateLabel: '09.04',
      paperTicker: 'GAZP',
      sector: 'Нефть и газ',
      type: 'timing',
      deltaBars: 2,
      horizonStep: 59,
      horizonDay: 60,
      humanAction: 'Продажа 80 лот. на дне 31',
      algoAction: 'Продажа 80 лот. на дне 33',
      errorCostRub: 2_960,
      errorCostPct: 0.29,
      because: 'подтверждение разворота по закрытию свечи',
    },
  ],
  reverseCheckTrades: [
    {
      id: 'REV-1',
      paperTicker: 'GAZP',
      entryStep: 18,
      entryDay: 19,
      entryDateLabel: '23.03',
      exitStep: 30,
      exitDay: 31,
      exitDateLabel: '09.04',
      lots: 80,
      entryPriceRub: 186.1,
      exitPriceRub: 199.8,
      // 80 * 10 * (199.8 - 186.1) - 1890 * (80 / 90) - 1810 = 10 960 - 1 680 - 1 810 = 7 470 ₽
      netProfitRub: 7_470,
      entryDivergenceId: 'DIV-2',
    },
  ],
  fills: [
    {
      id: 'F-1',
      day: 4,
      dateLabel: '02.03',
      paperTicker: 'SBER',
      side: 'buy',
      orderType: 'market',
      lots: 80,
      priceRub: 234.4,
      costRub: 2_120,
      partial: false,
      note: null,
    },
    {
      id: 'F-2',
      day: 19,
      dateLabel: '23.03',
      paperTicker: 'GAZP',
      side: 'buy',
      orderType: 'limit',
      lots: 90,
      priceRub: 186.1,
      costRub: 1_890,
      partial: true,
      note: 'частично: лимит ликвидности 10 % объёма свечи',
    },
    {
      id: 'F-3',
      day: 31,
      dateLabel: '09.04',
      paperTicker: 'GAZP',
      side: 'sell',
      orderType: 'market',
      lots: 80,
      priceRub: 199.8,
      costRub: 1_810,
      partial: false,
      note: null,
    },
    {
      id: 'F-4',
      day: 44,
      dateLabel: '28.04',
      paperTicker: 'YDEX',
      side: 'buy',
      orderType: 'market',
      lots: 40,
      priceRub: 3015,
      costRub: 1_980,
      partial: false,
      note: null,
    },
  ],
};

const REPORT_S0105_CURVES = buildEquityAndUnderwater(
  28,
  500_000,
  524_100,
  515_400,
  2.4,
  12_000,
  24_000,
);

const REPORT_S0105: SessionReport = {
  sessionId: 'S-0105',
  blind: false,
  finishedEarly: true,
  playedDays: 28,
  totalDays: 60,
  timeframe: '1d',
  regime: 'medium',
  createdAt: '18.11.2026 12:40',
  backgroundAlgorithmName: 'Эталон платформы',
  noDividendsNote: 'без дивидендов',
  period: {
    startDate: '26.02.2020',
    endDate: '03.04.2020',
    label: 'Март 2020: острая фаза (досрочно)',
  },
  papers: REPORT_S0103.papers.slice(0, 2),
  humanMetrics: {
    initialCapitalRub: 500_000,
    finalCapitalRub: 524_100,
    totalReturnPct: 4.82,
    cagrPct: 52.8,
    grossReturnPct: 5.15,
    netReturnPct: 4.82,
    maxDrawdownPct: REPORT_S0105_CURVES.humanDrawdown.maxDrawdownPct,
    maxDrawdownDurationDays: REPORT_S0105_CURVES.humanDrawdown.durationSteps,
    maxDrawdownDurationSteps: REPORT_S0105_CURVES.humanDrawdown.durationSteps,
    volatilityPct: 19.2,
    sharpe: 1.48,
    sortino: 2.05,
    turnover: 1.12,
    tradesCount: 3,
    winRatePct: 100.0,
    rejectedOrdersCount: 0,
    partialFillsCount: 0,
    hhi: 0.45,
    largestPositionPct: 51.0,
    bankrupt: false,
    costsRub: {
      totalRub: 2_620,
      commissionRub: 1_610,
      exchangeFeeRub: 54,
      spreadRub: 560,
      slippageRub: 396,
    },
    benchmarkImoexPct: 2.4,
  },
  algoMetrics: {
    initialCapitalRub: 500_000,
    finalCapitalRub: 515_400,
    totalReturnPct: 3.08,
    cagrPct: 31.4,
    grossReturnPct: 3.36,
    netReturnPct: 3.08,
    maxDrawdownPct: REPORT_S0105_CURVES.algoDrawdown.maxDrawdownPct,
    maxDrawdownDurationDays: REPORT_S0105_CURVES.algoDrawdown.durationSteps,
    maxDrawdownDurationSteps: REPORT_S0105_CURVES.algoDrawdown.durationSteps,
    volatilityPct: 20.1,
    sharpe: 0.98,
    sortino: 1.32,
    turnover: 0.94,
    tradesCount: 3,
    winRatePct: 100.0,
    rejectedOrdersCount: 0,
    partialFillsCount: 0,
    hhi: 0.39,
    largestPositionPct: 44.0,
    bankrupt: false,
    costsRub: {
      totalRub: 2_210,
      commissionRub: 1_360,
      exchangeFeeRub: 45,
      spreadRub: 480,
      slippageRub: 325,
    },
    benchmarkImoexPct: 2.4,
  },
  comparison: {
    finalCapital: {
      humanRub: 524_100,
      algoRub: 515_400,
      winner: 'human',
      diffRub: 8_700,
      diffLabel: 'Вы лучше на 8 700 ₽',
    },
    netReturn: {
      humanPct: 4.82,
      algoPct: 3.08,
      winner: 'human',
      diffPctPoints: 1.74,
      diffLabel: 'Вы лучше на 1,74 п.п.',
    },
    maxDrawdown: buildMaxDrawdownComparison(
      REPORT_S0105_CURVES.humanDrawdown.maxDrawdownPct,
      REPORT_S0105_CURVES.algoDrawdown.maxDrawdownPct,
    ),
  },
  equityCurve: REPORT_S0105_CURVES.equityCurve,
  underwaterCurve: REPORT_S0105_CURVES.underwaterCurve,
  divergenceSummary: {
    totalErrorCostRub: 1_650,
    totalErrorCostPct: 0.33,
    worstDivergenceId: 'DIV-105-1',
    worstType: 'extra',
    worstDay: 8,
    worstErrorCostRub: 3_100,
  },
  divergences: [
    {
      id: 'DIV-105-1',
      step: 7,
      day: 8,
      dateLabel: '06.03',
      paperTicker: 'SBER',
      sector: 'Финансы',
      type: 'extra',
      deltaBars: null,
      horizonStep: 23,
      horizonDay: 24,
      humanAction: 'Покупка 40 лот. по рынку',
      algoAction: 'Нет заявки',
      errorCostRub: 3_100,
      errorCostPct: 0.62,
      because: 'алгоритм здесь не действовал бы',
    },
    {
      id: 'DIV-105-2',
      step: 13,
      day: 14,
      dateLabel: '16.03',
      paperTicker: 'GAZP',
      sector: 'Нефть и газ',
      type: 'size',
      deltaBars: null,
      horizonStep: 27,
      horizonDay: 28,
      humanAction: 'Покупка 50 лот. лимитной заявкой',
      algoAction: 'Покупка 25 лот. лимитной заявкой',
      errorCostRub: -1_450,
      errorCostPct: -0.29,
      because: 'ограничение риска на сектор 20 %',
    },
  ],
  reverseCheckTrades: [],
  fills: [
    {
      id: 'F-105-1',
      day: 4,
      dateLabel: '02.03',
      paperTicker: 'SBER',
      side: 'buy',
      orderType: 'market',
      lots: 40,
      priceRub: 234.4,
      costRub: 920,
      partial: false,
      note: null,
    },
    {
      id: 'F-105-2',
      day: 14,
      dateLabel: '16.03',
      paperTicker: 'GAZP',
      side: 'buy',
      orderType: 'limit',
      lots: 50,
      priceRub: 192.0,
      costRub: 880,
      partial: false,
      note: null,
    },
    {
      id: 'F-105-3',
      day: 24,
      dateLabel: '30.03',
      paperTicker: 'SBER',
      side: 'sell',
      orderType: 'market',
      lots: 40,
      priceRub: 248.5,
      costRub: 820,
      partial: false,
      note: null,
    },
  ],
};

@Injectable()
export class StubReportApi implements ReportApi {
  async getReport(sessionId: string): Promise<SessionReportResult> {
    if (sessionId === 'S-0104' || sessionId === 'S-BLIND-ACTIVE') {
      // INV-7: активная слепая сессия арены (S-0104) не раскрывает тикеры, названия и реальный период.
      return {
        status: 'BLIND_UNFINISHED',
        sessionId,
        title: 'Слепая сессия от 18.11.2026',
        createdAt: '18.11.2026 14:20',
        playedDays: 14,
        totalDays: 60,
        regime: 'stress',
      };
    }

    if (sessionId === 'S-BUILDING') {
      return {
        status: 'BUILDING',
        sessionId,
        message:
          'Отчёт строится в фоне после завершения сессии. Обновите страницу через несколько секунд.',
      };
    }

    if (sessionId === 'S-0103') {
      return { status: 'READY', report: REPORT_S0103 };
    }

    if (sessionId === 'S-0105') {
      return { status: 'READY', report: REPORT_S0105 };
    }

    return { status: 'NOT_FOUND', sessionId };
  }
}

import { Injectable } from '@angular/core';
import {
  EquityCurvePoint,
  ReportApi,
  SessionReport,
  SessionReportResult,
  UnderwaterPoint,
} from './report.models';

function buildEquityAndUnderwater(
  days: number,
  initialRub: number,
  humanFinalRub: number,
  algoFinalRub: number,
  benchPct: number,
): { equityCurve: EquityCurvePoint[]; underwaterCurve: UnderwaterPoint[] } {
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

    const humanWave = Math.sin(i * 0.27) * 28_000 - Math.sin(i * 0.11) * 18_000;
    const algoWave = Math.sin(i * 0.21 + 0.8) * 21_000 - Math.cos(i * 0.09) * 14_000;
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

  return { equityCurve, underwaterCurve };
}

const REPORT_S0104_CURVES = buildEquityAndUnderwater(60, 1_000_000, 1_064_250, 1_091_800, 3.15);

const REPORT_S0104: SessionReport = {
  sessionId: 'S-0104',
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
    grossReturnPct: 7.21,
    netReturnPct: 6.43,
    maxDrawdownPct: -11.4,
    maxDrawdownDurationDays: 18,
    maxDrawdownDurationSteps: 18,
    volatilityPct: 22.15,
    sharpe: 1.12,
    sortino: 1.54,
    turnover: 3.42,
    tradesCount: 14,
    winRatePct: 64.29,
    rejectedOrdersCount: 1,
    partialFillsCount: 2,
    hhi: 0.41,
    largestPositionPct: 48.5,
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
    grossReturnPct: 9.84,
    netReturnPct: 9.18,
    maxDrawdownPct: -8.25,
    maxDrawdownDurationDays: 12,
    maxDrawdownDurationSteps: 12,
    volatilityPct: 18.4,
    sharpe: 1.61,
    sortino: 2.18,
    turnover: 2.85,
    tradesCount: 11,
    winRatePct: 72.73,
    rejectedOrdersCount: 0,
    partialFillsCount: 1,
    hhi: 0.36,
    largestPositionPct: 41.2,
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
    maxDrawdown: {
      humanPct: -11.4,
      algoPct: -8.25,
      winner: 'algo',
      diffPctPoints: 3.15,
      diffLabel: 'У алгоритма просадка меньше на 3,15 п.п.',
    },
  },
  equityCurve: REPORT_S0104_CURVES.equityCurve,
  underwaterCurve: REPORT_S0104_CURVES.underwaterCurve,
  divergences: [
    {
      id: 'DIV-1',
      day: 8,
      dateLabel: '06.03',
      paperTicker: 'SBER',
      sector: 'Финансы',
      type: 'extra',
      humanAction: 'Покупка 120 лот. по рынку',
      algoAction: 'Нет заявки',
      errorCostRub: 14_200,
      errorCostPct: 1.42,
      because: 'тренд вниз: цена ниже SMA(20), вход преждевременный',
    },
    {
      id: 'DIV-2',
      day: 19,
      dateLabel: '23.03',
      paperTicker: 'YDEX',
      sector: 'IT',
      type: 'missed',
      humanAction: 'Нет заявки',
      algoAction: 'Покупка 45 лот. лимитной заявкой',
      errorCostRub: 18_400,
      errorCostPct: 1.84,
      because: 'перепроданность: RSI(14) = 24,5 и объём ×1,8 выше среднего',
    },
    {
      id: 'DIV-3',
      day: 31,
      dateLabel: '09.04',
      paperTicker: 'GAZP',
      sector: 'Нефть и газ',
      type: 'timing',
      humanAction: 'Продажа 80 лот. на дне 31',
      algoAction: 'Продажа 80 лот. на дне 33 (Δt = +2)',
      errorCostRub: -5_050,
      errorCostPct: -0.51,
      because: 'подтверждение разворота по закрытию свечи',
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
      costRub: 750,
      partial: false,
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
      costRub: 670,
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
      costRub: 640,
      partial: false,
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
      costRub: 482,
      partial: false,
    },
  ],
};

const REPORT_S0105_CURVES = buildEquityAndUnderwater(28, 500_000, 524_100, 515_400, 2.4);

const REPORT_S0105: SessionReport = {
  ...REPORT_S0104,
  sessionId: 'S-0105',
  blind: false,
  finishedEarly: true,
  playedDays: 28,
  totalDays: 60,
  regime: 'medium',
  humanMetrics: {
    ...REPORT_S0104.humanMetrics,
    initialCapitalRub: 500_000,
    finalCapitalRub: 524_100,
    totalReturnPct: 4.82,
    netReturnPct: 4.82,
    grossReturnPct: 5.31,
    maxDrawdownPct: -4.15,
    benchmarkImoexPct: 2.4,
  },
  algoMetrics: {
    ...REPORT_S0104.algoMetrics,
    initialCapitalRub: 500_000,
    finalCapitalRub: 515_400,
    totalReturnPct: 3.08,
    netReturnPct: 3.08,
    grossReturnPct: 3.55,
    maxDrawdownPct: -5.6,
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
    maxDrawdown: {
      humanPct: -4.15,
      algoPct: -5.6,
      winner: 'human',
      diffPctPoints: 1.45,
      diffLabel: 'У вас просадка меньше на 1,45 п.п.',
    },
  },
  equityCurve: REPORT_S0105_CURVES.equityCurve,
  underwaterCurve: REPORT_S0105_CURVES.underwaterCurve,
};

@Injectable()
export class StubReportApi implements ReportApi {
  async getReport(sessionId: string): Promise<SessionReportResult> {
    if (sessionId === 'S-BLIND-ACTIVE') {
      // INV-7: незавершённая слепая сессия не раскрывает тикеры, названия и реальный период.
      return {
        status: 'BLIND_UNFINISHED',
        sessionId: 'S-BLIND-ACTIVE',
        title: 'Слепая сессия от 18.11.2026',
        createdAt: '18.11.2026 14:20',
        playedDays: 14,
        totalDays: 60,
        regime: 'stress',
      };
    }

    if (sessionId === 'S-0104') {
      return { status: 'READY', report: REPORT_S0104 };
    }

    if (sessionId === 'S-0105') {
      return { status: 'READY', report: REPORT_S0105 };
    }

    return { status: 'NOT_FOUND', sessionId };
  }
}

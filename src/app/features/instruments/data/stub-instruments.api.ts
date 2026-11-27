import { Injectable } from '@angular/core';
import {
  BondCalculation,
  BondSummary,
  DcaCalcParams,
  DcaCalculation,
  DividendEventSummary,
  DividendPayoutCalculation,
  DividendPayoutParams,
  EtfSummary,
  FuturesCalcParams,
  FuturesCalculation,
  FuturesSummary,
  InstrumentsApi,
  OptionCalcParams,
  OptionGreeksCalculation,
  OptionSummary,
  TaxCalcParams,
  TaxCalculation,
} from './instruments.models';

const STUB_BONDS: readonly BondSummary[] = [
  {
    ticker: 'SU26238RMFS4',
    name: 'ОФЗ-ПД 26238',
    issuer: 'Минфин РФ',
    bondType: 'OFZ',
    faceValueRub: 1000,
    couponRatePct: 7.1,
    couponValueRub: 35.4,
    couponPeriodDays: 182,
    nextCouponDate: '2026-12-02',
    maturityDate: '2041-05-15',
    offerDate: null,
    accruedInterestRub: 21.85,
    ytmPct: 14.85,
    durationYears: 7.62,
    amortized: false,
    pricePct: 56.4,
    currency: 'RUB',
  },
  {
    ticker: 'SU26243RMFS4',
    name: 'ОФЗ-ПД 26243',
    issuer: 'Минфин РФ',
    bondType: 'OFZ',
    faceValueRub: 1000,
    couponRatePct: 9.8,
    couponValueRub: 48.87,
    couponPeriodDays: 182,
    nextCouponDate: '2026-12-02',
    maturityDate: '2038-05-19',
    offerDate: null,
    accruedInterestRub: 34.12,
    ytmPct: 15.12,
    durationYears: 6.18,
    amortized: false,
    pricePct: 72.8,
    currency: 'RUB',
  },
  {
    ticker: 'SU26244RMFS2',
    name: 'ОФЗ-ПД 26244',
    issuer: 'Минфин РФ',
    bondType: 'OFZ',
    faceValueRub: 1000,
    couponRatePct: 11.25,
    couponValueRub: 56.1,
    couponPeriodDays: 182,
    nextCouponDate: '2027-03-24',
    maturityDate: '2034-03-15',
    offerDate: null,
    accruedInterestRub: 18.6,
    ytmPct: 15.38,
    durationYears: 4.95,
    amortized: false,
    pricePct: 83.2,
    currency: 'RUB',
  },
  {
    ticker: 'RU000A107EC7',
    name: 'Сбербанк 001P-SBER45',
    issuer: 'ПАО Сбербанк',
    bondType: 'CORPORATE',
    faceValueRub: 1000,
    couponRatePct: 15.0,
    couponValueRub: 74.8,
    couponPeriodDays: 182,
    nextCouponDate: '2027-05-22',
    maturityDate: '2028-11-20',
    offerDate: null,
    accruedInterestRub: 29.4,
    ytmPct: 17.24,
    durationYears: 1.82,
    amortized: false,
    pricePct: 96.5,
    currency: 'RUB',
  },
  {
    ticker: 'RU000A106679',
    name: 'Газпром Капитал БО-002Р',
    issuer: 'Газпром Капитал',
    bondType: 'CORPORATE',
    faceValueRub: 1000,
    couponRatePct: 14.5,
    couponValueRub: 36.15,
    couponPeriodDays: 91,
    nextCouponDate: '2027-01-18',
    maturityDate: '2029-04-18',
    offerDate: '2027-10-18',
    accruedInterestRub: 14.25,
    ytmPct: 17.65,
    durationYears: 2.15,
    amortized: false,
    pricePct: 94.1,
    currency: 'RUB',
  },
  {
    ticker: 'RU000A106K43',
    name: 'РЖД 001P-28R (аморт.)',
    issuer: 'ОАО РЖД',
    bondType: 'CORPORATE',
    faceValueRub: 800,
    couponRatePct: 15.0,
    couponValueRub: 29.92,
    couponPeriodDays: 91,
    nextCouponDate: '2027-01-10',
    maturityDate: '2029-07-10',
    offerDate: null,
    accruedInterestRub: 11.4,
    ytmPct: 18.05,
    durationYears: 1.65,
    amortized: true,
    pricePct: 95.0,
    currency: 'RUB',
  },
  {
    ticker: 'RU000A105L27',
    name: 'АФК Система 001P-26 (аморт.)',
    issuer: 'ПАО АФК Система',
    bondType: 'CORPORATE',
    faceValueRub: 750,
    couponRatePct: 15.75,
    couponValueRub: 29.45,
    couponPeriodDays: 91,
    nextCouponDate: '2026-12-12',
    maturityDate: '2028-09-12',
    offerDate: null,
    accruedInterestRub: 16.9,
    ytmPct: 19.85,
    durationYears: 1.38,
    amortized: true,
    pricePct: 91.2,
    currency: 'RUB',
  },
];

const STUB_ETFS: readonly EtfSummary[] = [
  {
    ticker: 'LQDT',
    name: 'ВИМ — Ликвидность',
    assetClass: 'ETF',
    category: 'LIQUIDITY',
    underlyingIndex: 'RUSFAR / RUONIA',
    tracksRuonia: true,
    expenseRatioPct: 0.29,
    navPriceRub: 1.72,
    currency: 'RUB',
    description:
      'Фонд денежного рынка для временного размещения свободных рублей. Стоимость пая плавно растёт каждый день близко к ставке RUONIA.',
  },
  {
    ticker: 'SBMM',
    name: 'Первая — Сберегательный',
    assetClass: 'ETF',
    category: 'LIQUIDITY',
    underlyingIndex: 'RUSFAR / RUONIA',
    tracksRuonia: true,
    expenseRatioPct: 0.3,
    navPriceRub: 15.84,
    currency: 'RUB',
    description:
      'Консервативный фонд ликвидности с ежедневным начислением доходности по ставкам межбанковского рынка (RUONIA) и минимальной волатильностью.',
  },
  {
    ticker: 'TMON',
    name: 'Т-Капитал Денежный рынок',
    assetClass: 'ETF',
    category: 'LIQUIDITY',
    underlyingIndex: 'RUONIA',
    tracksRuonia: true,
    expenseRatioPct: 0.35,
    navPriceRub: 138.4,
    currency: 'RUB',
    description:
      'Биржевой фонд ликвидности в рублях. Подходит как альтернатива накопительному счёту внутри брокерского портфеля.',
  },
  {
    ticker: 'SBMX',
    name: 'Первая — Топ Российских акций',
    assetClass: 'ETF',
    category: 'EQUITY_INDEX',
    underlyingIndex: 'Индекс МосБиржи полной доходности (MCFTR)',
    tracksRuonia: false,
    expenseRatioPct: 0.9,
    navPriceRub: 21.65,
    currency: 'RUB',
    description:
      'Покупка одного пая сразу даёт долю в крупнейших компаниях России из индекса МосБиржи с автоматическим реинвестированием дивидендов.',
  },
  {
    ticker: 'TMOS',
    name: 'Т-Капитал Индекс МосБиржи',
    assetClass: 'ETF',
    category: 'EQUITY_INDEX',
    underlyingIndex: 'Индекс МосБиржи (IMOEX)',
    tracksRuonia: false,
    expenseRatioPct: 0.79,
    navPriceRub: 6.42,
    currency: 'RUB',
    description:
      'Доступный по цене пая индексный фонд на широкий рынок российских акций. Удобен для регулярных пополнений и базовой диверсификации.',
  },
  {
    ticker: 'SBGB',
    name: 'Первая — Доступные ОФЗ',
    assetClass: 'ETF',
    category: 'BOND_INDEX',
    underlyingIndex: 'Индекс государственных облигаций RGBITR',
    tracksRuonia: false,
    expenseRatioPct: 0.65,
    navPriceRub: 12.15,
    currency: 'RUB',
    description:
      'Готовая корзина государственных облигаций ОФЗ с разными сроками погашения. Купоны автоматически реинвестируются внутри фонда.',
  },
  {
    ticker: 'TBRU',
    name: 'Т-Капитал Российские облигации',
    assetClass: 'ETF',
    category: 'BOND_INDEX',
    underlyingIndex: 'Индекс корпоративных облигаций MOEX',
    tracksRuonia: false,
    expenseRatioPct: 0.75,
    navPriceRub: 7.38,
    currency: 'RUB',
    description:
      'Диверсифицированный портфель рублёвых облигаций крупных российских компаний. Снижает риск отдельного эмитента.',
  },
  {
    ticker: 'GOLD',
    name: 'ВИМ — Золото',
    assetClass: 'METAL',
    category: 'GOLD',
    underlyingIndex: 'GLDRUB_TOM (Золото в рублях)',
    tracksRuonia: false,
    expenseRatioPct: 0.66,
    navPriceRub: 2.38,
    currency: 'RUB',
    description:
      'Биржевой фонд на физическое золото в хранилище. Используется как защитный актив от инфляции и ослабления рубля.',
  },
  {
    ticker: 'CNYM',
    name: 'Т-Капитал Юань (денежный рынок)',
    assetClass: 'CURRENCY',
    category: 'CURRENCY',
    underlyingIndex: 'RUSFARCNY (Юань)',
    tracksRuonia: false,
    expenseRatioPct: 0.45,
    navPriceRub: 14.12,
    currency: 'CNY',
    description:
      'Валютный фонд денежного рынка в китайских юанях. Позволяет диверсифицировать портфель по валюте без покупки отдельных акций.',
  },
];

@Injectable({ providedIn: 'root' })
export class StubInstrumentsApi implements InstrumentsApi {
  async listBonds(): Promise<readonly BondSummary[]> {
    return STUB_BONDS;
  }

  async calculateBond(ticker: string, pricePct: number): Promise<BondCalculation> {
    const normalized = ticker.trim().toUpperCase();
    const bond =
      STUB_BONDS.find((item) => item.ticker.toUpperCase() === normalized) ?? STUB_BONDS[0];
    const safePricePct = Math.min(
      200,
      Math.max(10, Number.isFinite(pricePct) ? pricePct : bond.pricePct),
    );
    const cleanPriceRub = Number(((bond.faceValueRub * safePricePct) / 100).toFixed(2));
    const dirtyPriceRub = Number((cleanPriceRub + bond.accruedInterestRub).toFixed(2));
    const couponsPerYear = Math.max(1, Math.round(365 / Math.max(1, bond.couponPeriodDays)));
    const annualCouponRub = bond.couponValueRub * couponsPerYear;
    const currentYieldPct = Number(((annualCouponRub / cleanPriceRub) * 100).toFixed(2));
    const yearsToMaturity = Math.max(0.5, Number((bond.durationYears * 1.15).toFixed(2)));
    const remainingCouponsCount = Math.max(1, Math.round(yearsToMaturity * couponsPerYear));
    const ytmPct = Number(
      (
        ((annualCouponRub + (bond.faceValueRub - cleanPriceRub) / yearsToMaturity) /
          ((bond.faceValueRub + cleanPriceRub) / 2)) *
        100
      ).toFixed(2),
    );

    return {
      ticker: bond.ticker,
      pricePct: Number(safePricePct.toFixed(2)),
      asOfDate: '2026-11-27',
      cleanPriceRub,
      accruedInterestRub: bond.accruedInterestRub,
      dirtyPriceRub,
      currentYieldPct,
      ytmPct,
      remainingCouponsCount,
      yearsToMaturity,
      nextCouponDate: bond.nextCouponDate,
      couponValueRub: bond.couponValueRub,
      amortized: bond.amortized,
    };
  }

  async listEtfs(): Promise<readonly EtfSummary[]> {
    return STUB_ETFS;
  }

  async listFutures(): Promise<readonly FuturesSummary[]> {
    return STUB_FUTURES;
  }

  async calculateFutures(ticker: string, params: FuturesCalcParams): Promise<FuturesCalculation> {
    const normalized = ticker.trim().toUpperCase();
    const spec =
      STUB_FUTURES.find((item) => item.ticker.toUpperCase() === normalized) ?? STUB_FUTURES[0];
    const contracts = params.contracts === 0 ? 1 : Math.trunc(params.contracts);
    const absContracts = Math.abs(contracts);
    const steps = (params.currentPrice - params.entryPrice) / spec.priceStep;
    const variationMarginRub = Number((steps * spec.stepPriceRub * contracts).toFixed(2));
    const initialMarginTotalRub = Number((spec.initialMarginRub * absContracts).toFixed(2));
    const notionalRub = Number(
      ((params.currentPrice / spec.priceStep) * spec.stepPriceRub * absContracts).toFixed(2),
    );
    const roeOnMarginPct =
      initialMarginTotalRub > 0
        ? Number(((variationMarginRub / initialMarginTotalRub) * 100).toFixed(2))
        : 0;
    const effectiveLeverage =
      initialMarginTotalRub > 0 ? Number((notionalRub / initialMarginTotalRub).toFixed(2)) : 0;

    return {
      ticker: spec.ticker,
      entryPrice: params.entryPrice,
      currentPrice: params.currentPrice,
      contracts,
      asOfDate: '2026-11-27',
      expirationDate: spec.expirationDate,
      daysToExpiration: 111,
      expired: false,
      variationMarginRub,
      initialMarginTotalRub,
      notionalRub,
      roeOnMarginPct,
      effectiveLeverage,
    };
  }

  async listOptions(): Promise<readonly OptionSummary[]> {
    return STUB_OPTIONS;
  }

  async calculateOptionGreeks(
    ticker: string,
    params: OptionCalcParams,
  ): Promise<OptionGreeksCalculation> {
    const normalized = ticker.trim().toUpperCase();
    const spec =
      STUB_OPTIONS.find((item) => item.ticker.toUpperCase() === normalized) ?? STUB_OPTIONS[0];
    const spot = Math.max(0.01, params.spot);
    const strike = spec.strike;
    const sigma = Math.max(0.0001, params.volatilityPct / 100);
    const rate = Math.max(0, params.riskFreeRatePct / 100);
    const daysToExpiration = 111;
    const t = daysToExpiration / 365;
    const sqrtT = Math.sqrt(t);

    const d1 = (Math.log(spot / strike) + (rate + 0.5 * sigma * sigma) * t) / (sigma * sqrtT);
    const d2 = d1 - sigma * sqrtT;
    const nd1 = normalCdf(d1);
    const nd2 = normalCdf(d2);
    const pdfD1 = normalPdf(d1);
    const discount = Math.exp(-rate * t);

    const isCall = spec.optionType === 'CALL';
    const premium = isCall
      ? spot * nd1 - strike * discount * nd2
      : strike * discount * normalCdf(-d2) - spot * normalCdf(-d1);
    const intrinsicValue = isCall ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
    const timeValue = Math.max(0, premium - intrinsicValue);
    const delta = isCall ? nd1 : nd1 - 1;
    const gamma = pdfD1 / (spot * sigma * sqrtT);
    const thetaAnnual = isCall
      ? (-spot * pdfD1 * sigma) / (2 * sqrtT) - rate * strike * discount * nd2
      : (-spot * pdfD1 * sigma) / (2 * sqrtT) + rate * strike * discount * normalCdf(-d2);
    const theta = thetaAnnual / 365;
    const vega = (spot * pdfD1 * sqrtT) / 100;
    const rho = isCall
      ? (strike * t * discount * nd2) / 100
      : (-strike * t * discount * normalCdf(-d2)) / 100;

    return {
      ticker: spec.ticker,
      optionType: spec.optionType,
      spot: Number(spot.toFixed(2)),
      strike,
      impliedVolPct: Number(params.volatilityPct.toFixed(2)),
      riskFreeRatePct: Number(params.riskFreeRatePct.toFixed(2)),
      asOfDate: '2026-11-27',
      expirationDate: spec.expirationDate,
      daysToExpiration,
      expired: false,
      premium: Number(premium.toFixed(2)),
      intrinsicValue: Number(intrinsicValue.toFixed(2)),
      timeValue: Number(timeValue.toFixed(2)),
      delta: Number(delta.toFixed(4)),
      gamma: Number(gamma.toFixed(6)),
      theta: Number(theta.toFixed(4)),
      vega: Number(vega.toFixed(4)),
      rho: Number(rho.toFixed(4)),
    };
  }

  async listDividends(ticker?: string): Promise<readonly DividendEventSummary[]> {
    const trimmed = ticker?.trim().toUpperCase();
    if (!trimmed) {
      return STUB_DIVIDENDS;
    }
    return STUB_DIVIDENDS.filter((d) => d.ticker.toUpperCase() === trimmed);
  }

  async calculateDividendPayout(
    ticker: string,
    params: DividendPayoutParams,
  ): Promise<DividendPayoutCalculation> {
    const normalized = ticker.trim().toUpperCase();
    const ev =
      STUB_DIVIDENDS.find((item) => item.ticker.toUpperCase() === normalized) ?? STUB_DIVIDENDS[0];
    const shares = Math.max(1, Math.trunc(params.shares));
    const taxRatePct = params.taxRatePct === 15 ? 15 : 13;
    const grossPayoutRub = Number((ev.dividendPerShareRub * shares).toFixed(2));
    const taxWithheldRub = Number(((grossPayoutRub * taxRatePct) / 100).toFixed(2));
    const netPayoutRub = Number((grossPayoutRub - taxWithheldRub).toFixed(2));

    return {
      ticker: ev.ticker,
      issuerName: ev.issuerName,
      shares,
      taxRatePct,
      dividendPerShareRub: ev.dividendPerShareRub,
      grossPayoutRub,
      taxWithheldRub,
      netPayoutRub,
      lastBuyDate: ev.lastBuyDate,
      exDividendDate: ev.exDividendDate,
      recordDate: ev.recordDate,
      paymentDate: ev.paymentDate,
      yieldPct: ev.yieldPct,
      estimatedGapPct: ev.estimatedGapPct,
      currency: ev.currency,
    };
  }

  async calculateTax(params: TaxCalcParams): Promise<TaxCalculation> {
    const grossProfit = Math.max(0, params.grossProfitRub);
    const priorLosses = Math.max(0, params.priorLossesRub);
    const dividends = Math.max(0, params.dividendsRub);
    const contributions = Math.max(0, params.annualContributionsRub);

    const lossOffsetUsedRub = Number(Math.min(grossProfit, priorLosses).toFixed(2));
    const taxableProfitRub = Number(Math.max(0, grossProfit - lossOffsetUsedRub).toFixed(2));

    const computeProgressiveNdfl = (base: number): number => {
      const threshold = 2_400_000;
      if (base <= threshold) {
        return Number((base * 0.13).toFixed(2));
      }
      return Number((threshold * 0.13 + (base - threshold) * 0.15).toFixed(2));
    };

    const tradingExempt = params.accountType === 'IIS_B' || params.accountType === 'IIS_3';
    const tradingTaxRub = tradingExempt ? 0 : computeProgressiveNdfl(taxableProfitRub);
    const dividendTaxRub = computeProgressiveNdfl(dividends);
    const totalTaxRub = Number((tradingTaxRub + dividendTaxRub).toFixed(2));

    const hasContributionDeduction =
      params.accountType === 'IIS_A' || params.accountType === 'IIS_3';
    const iisDeductionRefundRub = hasContributionDeduction
      ? Number((Math.min(contributions, 400_000) * 0.13).toFixed(2))
      : 0;

    const totalIncome = grossProfit + dividends;
    const netAfterTaxRub = Number((totalIncome - totalTaxRub + iisDeductionRefundRub).toFixed(2));
    const effectiveTaxRatePct =
      totalIncome > 0
        ? Number((((totalTaxRub - iisDeductionRefundRub) / totalIncome) * 100).toFixed(2))
        : 0;

    return {
      accountType: params.accountType,
      taxableProfitRub,
      lossOffsetUsedRub,
      tradingTaxRub,
      dividendTaxRub,
      totalTaxRub,
      iisDeductionRefundRub,
      netAfterTaxRub,
      effectiveTaxRatePct,
    };
  }

  async calculateDca(params: DcaCalcParams): Promise<DcaCalculation> {
    const flows = [...params.cashflows].sort((a, b) => a.date.localeCompare(b.date));
    let totalContributed = 0;
    let totalWithdrawn = 0;
    for (const cf of flows) {
      if (cf.amountRub >= 0) {
        totalContributed += cf.amountRub;
      } else {
        totalWithdrawn += Math.abs(cf.amountRub);
      }
    }
    const netInvested = totalContributed - totalWithdrawn;
    const finalValue = Math.max(0, params.finalValueRub);
    const netProfit = finalValue - netInvested;
    const simpleReturnPct =
      totalContributed > 0 ? Number(((netProfit / totalContributed) * 100).toFixed(2)) : 0;

    const firstMs = flows.length > 0 ? Date.parse(flows[0].date) : Date.parse(params.finalDate);
    const finalMs = Date.parse(params.finalDate);
    const holdingDays = Math.max(1, Math.round((finalMs - firstMs) / 86_400_000));

    // Newton-Raphson XIRR approximation for stub mode
    const cashEvents: { readonly t: number; readonly cf: number }[] = [
      ...flows.map((f) => ({
        t: (Date.parse(f.date) - firstMs) / (365 * 86_400_000),
        cf: -f.amountRub,
      })),
      { t: holdingDays / 365, cf: finalValue },
    ];
    let rate = 0.15;
    for (let i = 0; i < 40; i++) {
      let npv = 0;
      let dnpv = 0;
      for (const e of cashEvents) {
        const base = Math.max(0.01, 1 + rate);
        const factor = Math.pow(base, -e.t);
        npv += e.cf * factor;
        dnpv -= (e.t * e.cf * factor) / base;
      }
      if (Math.abs(dnpv) < 1e-10) {
        break;
      }
      const nextRate = rate - npv / dnpv;
      if (!Number.isFinite(nextRate) || nextRate <= -0.99 || nextRate > 10) {
        break;
      }
      if (Math.abs(nextRate - rate) < 1e-6) {
        rate = nextRate;
        break;
      }
      rate = nextRate;
    }

    const xirrPct = Number((rate * 100).toFixed(2));
    const twrPct = Number((simpleReturnPct * 1.05).toFixed(2));

    return {
      totalContributedRub: Number(totalContributed.toFixed(2)),
      totalWithdrawnRub: Number(totalWithdrawn.toFixed(2)),
      netInvestedRub: Number(netInvested.toFixed(2)),
      finalValueRub: Number(finalValue.toFixed(2)),
      netProfitRub: Number(netProfit.toFixed(2)),
      simpleReturnPct,
      xirrPct,
      twrPct,
      holdingDays,
      cashflowsCount: flows.length,
    };
  }
}

function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = normalPdf(x);
  const poly =
    t *
    (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const prob = 1 - d * poly;
  return x >= 0 ? prob : 1 - prob;
}

const STUB_FUTURES: readonly FuturesSummary[] = [
  {
    ticker: 'SiH7',
    name: 'Фьючерс USD/RUB (март 2027)',
    underlying: 'USD/RUB',
    contractSize: 1000,
    priceStep: 1,
    stepPriceRub: 1,
    initialMarginRub: 14500,
    lastPrice: 95400,
    expirationDate: '2027-03-18',
    settlementType: 'CASH',
    currency: 'RUB',
  },
  {
    ticker: 'RIH7',
    name: 'Фьючерс на индекс РТС (март 2027)',
    underlying: 'RTSI',
    contractSize: 1,
    priceStep: 10,
    stepPriceRub: 19.08,
    initialMarginRub: 29500,
    lastPrice: 102500,
    expirationDate: '2027-03-18',
    settlementType: 'CASH',
    currency: 'RUB',
  },
  {
    ticker: 'MXH7',
    name: 'Фьючерс на индекс МосБиржи (март 2027)',
    underlying: 'IMOEX',
    contractSize: 100,
    priceStep: 25,
    stepPriceRub: 25,
    initialMarginRub: 42000,
    lastPrice: 288500,
    expirationDate: '2027-03-18',
    settlementType: 'CASH',
    currency: 'RUB',
  },
  {
    ticker: 'BRF7',
    name: 'Фьючерс на нефть Brent (январь 2027)',
    underlying: 'Brent',
    contractSize: 10,
    priceStep: 0.01,
    stepPriceRub: 9.54,
    initialMarginRub: 13200,
    lastPrice: 76.8,
    expirationDate: '2027-01-04',
    settlementType: 'CASH',
    currency: 'USD',
  },
  {
    ticker: 'GDH7',
    name: 'Фьючерс на золото (март 2027)',
    underlying: 'GOLD',
    contractSize: 1,
    priceStep: 0.1,
    stepPriceRub: 9.54,
    initialMarginRub: 24800,
    lastPrice: 2685,
    expirationDate: '2027-03-19',
    settlementType: 'CASH',
    currency: 'USD',
  },
  {
    ticker: 'SRH7',
    name: 'Фьючерс на акции Сбербанка (март 2027)',
    underlying: 'SBER',
    contractSize: 100,
    priceStep: 1,
    stepPriceRub: 1,
    initialMarginRub: 5400,
    lastPrice: 28650,
    expirationDate: '2027-03-18',
    settlementType: 'DELIVERY',
    currency: 'RUB',
  },
  {
    ticker: 'GZH7',
    name: 'Фьючерс на акции Газпрома (март 2027)',
    underlying: 'GAZP',
    contractSize: 100,
    priceStep: 1,
    stepPriceRub: 1,
    initialMarginRub: 3100,
    lastPrice: 13450,
    expirationDate: '2027-03-18',
    settlementType: 'DELIVERY',
    currency: 'RUB',
  },
  {
    ticker: 'LKH7',
    name: 'Фьючерс на акции Лукойла (март 2027)',
    underlying: 'LKOH',
    contractSize: 10,
    priceStep: 1,
    stepPriceRub: 1,
    initialMarginRub: 13600,
    lastPrice: 71200,
    expirationDate: '2027-03-18',
    settlementType: 'DELIVERY',
    currency: 'RUB',
  },
];

const STUB_OPTIONS: readonly OptionSummary[] = [
  {
    ticker: 'Si96000BC7',
    name: 'Si Call 96 000 (март 2027)',
    underlying: 'SiH7',
    optionType: 'CALL',
    strike: 96000,
    expirationDate: '2027-03-18',
    underlyingPrice: 95400,
    impliedVolPct: 22.5,
    riskFreeRatePct: 16.0,
    contractSize: 1,
    initialMarginRub: 7200,
  },
  {
    ticker: 'Si95000BO7',
    name: 'Si Put 95 000 (март 2027)',
    underlying: 'SiH7',
    optionType: 'PUT',
    strike: 95000,
    expirationDate: '2027-03-18',
    underlyingPrice: 95400,
    impliedVolPct: 23.0,
    riskFreeRatePct: 16.0,
    contractSize: 1,
    initialMarginRub: 6900,
  },
  {
    ticker: 'RI105000BC7',
    name: 'RTS Call 105 000 (март 2027)',
    underlying: 'RIH7',
    optionType: 'CALL',
    strike: 105000,
    expirationDate: '2027-03-18',
    underlyingPrice: 102500,
    impliedVolPct: 31.0,
    riskFreeRatePct: 16.0,
    contractSize: 1,
    initialMarginRub: 14800,
  },
  {
    ticker: 'RI100000BO7',
    name: 'RTS Put 100 000 (март 2027)',
    underlying: 'RIH7',
    optionType: 'PUT',
    strike: 100000,
    expirationDate: '2027-03-18',
    underlyingPrice: 102500,
    impliedVolPct: 33.5,
    riskFreeRatePct: 16.0,
    contractSize: 1,
    initialMarginRub: 14100,
  },
  {
    ticker: 'BR78BA7',
    name: 'Brent Call 78 (январь 2027)',
    underlying: 'BRF7',
    optionType: 'CALL',
    strike: 78,
    expirationDate: '2027-01-04',
    underlyingPrice: 76.8,
    impliedVolPct: 34.0,
    riskFreeRatePct: 16.0,
    contractSize: 10,
    initialMarginRub: 6400,
  },
  {
    ticker: 'BR75BM7',
    name: 'Brent Put 75 (январь 2027)',
    underlying: 'BRF7',
    optionType: 'PUT',
    strike: 75,
    expirationDate: '2027-01-04',
    underlyingPrice: 76.8,
    impliedVolPct: 36.0,
    riskFreeRatePct: 16.0,
    contractSize: 10,
    initialMarginRub: 6100,
  },
  {
    ticker: 'SR29000BC7',
    name: 'SBER Call 29 000 (март 2027)',
    underlying: 'SRH7',
    optionType: 'CALL',
    strike: 29000,
    expirationDate: '2027-03-18',
    underlyingPrice: 28650,
    impliedVolPct: 28.0,
    riskFreeRatePct: 16.0,
    contractSize: 1,
    initialMarginRub: 2900,
  },
  {
    ticker: 'SR28000BO7',
    name: 'SBER Put 28 000 (март 2027)',
    underlying: 'SRH7',
    optionType: 'PUT',
    strike: 28000,
    expirationDate: '2027-03-18',
    underlyingPrice: 28650,
    impliedVolPct: 29.5,
    riskFreeRatePct: 16.0,
    contractSize: 1,
    initialMarginRub: 2700,
  },
];

const STUB_DIVIDENDS: readonly DividendEventSummary[] = [
  {
    id: 1,
    ticker: 'SBER',
    issuerName: 'ПАО Сбербанк',
    lastBuyDate: '2026-07-16',
    exDividendDate: '2026-07-17',
    recordDate: '2026-07-17',
    paymentDate: '2026-08-05',
    dividendPerShareRub: 34.84,
    yieldPct: 11.45,
    estimatedGapPct: 9.96,
    currency: 'RUB',
  },
  {
    id: 2,
    ticker: 'LKOH',
    issuerName: 'ПАО ЛУКОЙЛ',
    lastBuyDate: '2026-06-02',
    exDividendDate: '2026-06-03',
    recordDate: '2026-06-03',
    paymentDate: '2026-06-24',
    dividendPerShareRub: 541.0,
    yieldPct: 7.62,
    estimatedGapPct: 6.63,
    currency: 'RUB',
  },
  {
    id: 3,
    ticker: 'TATN',
    issuerName: 'ПАО Татнефть',
    lastBuyDate: '2026-06-29',
    exDividendDate: '2026-06-30',
    recordDate: '2026-06-30',
    paymentDate: '2026-07-17',
    dividendPerShareRub: 43.11,
    yieldPct: 6.85,
    estimatedGapPct: 5.96,
    currency: 'RUB',
  },
  {
    id: 4,
    ticker: 'ROSN',
    issuerName: 'ПАО НК Роснефть',
    lastBuyDate: '2026-07-08',
    exDividendDate: '2026-07-09',
    recordDate: '2026-07-09',
    paymentDate: '2026-07-28',
    dividendPerShareRub: 36.47,
    yieldPct: 6.9,
    estimatedGapPct: 6.0,
    currency: 'RUB',
  },
  {
    id: 5,
    ticker: 'SNGSP',
    issuerName: 'Сургутнефтегаз (прив.)',
    lastBuyDate: '2026-07-17',
    exDividendDate: '2026-07-20',
    recordDate: '2026-07-20',
    paymentDate: '2026-08-07',
    dividendPerShareRub: 8.5,
    yieldPct: 14.9,
    estimatedGapPct: 12.96,
    currency: 'RUB',
  },
  {
    id: 6,
    ticker: 'MTSS',
    issuerName: 'ПАО МТС',
    lastBuyDate: '2026-07-13',
    exDividendDate: '2026-07-14',
    recordDate: '2026-07-14',
    paymentDate: '2026-08-03',
    dividendPerShareRub: 35.0,
    yieldPct: 14.2,
    estimatedGapPct: 12.35,
    currency: 'RUB',
  },
  {
    id: 7,
    ticker: 'PHOR',
    issuerName: 'ПАО ФосАгро',
    lastBuyDate: '2026-09-29',
    exDividendDate: '2026-09-30',
    recordDate: '2026-09-30',
    paymentDate: '2026-10-16',
    dividendPerShareRub: 249.0,
    yieldPct: 4.15,
    estimatedGapPct: 3.61,
    currency: 'RUB',
  },
  {
    id: 8,
    ticker: 'MOEX',
    issuerName: 'ПАО Московская Биржа',
    lastBuyDate: '2026-06-11',
    exDividendDate: '2026-06-12',
    recordDate: '2026-06-12',
    paymentDate: '2026-07-01',
    dividendPerShareRub: 26.11,
    yieldPct: 11.8,
    estimatedGapPct: 10.27,
    currency: 'RUB',
  },
  {
    id: 9,
    ticker: 'X5',
    issuerName: 'ПАО Корпоративный центр ИКС 5',
    lastBuyDate: '2026-07-07',
    exDividendDate: '2026-07-08',
    recordDate: '2026-07-08',
    paymentDate: '2026-07-24',
    dividendPerShareRub: 368.0,
    yieldPct: 11.2,
    estimatedGapPct: 9.74,
    currency: 'RUB',
  },
  {
    id: 10,
    ticker: 'T',
    issuerName: 'МКПАО Т-Технологии',
    lastBuyDate: '2026-08-20',
    exDividendDate: '2026-08-21',
    recordDate: '2026-08-21',
    paymentDate: '2026-09-07',
    dividendPerShareRub: 35.0,
    yieldPct: 1.12,
    estimatedGapPct: 0.97,
    currency: 'RUB',
  },
];

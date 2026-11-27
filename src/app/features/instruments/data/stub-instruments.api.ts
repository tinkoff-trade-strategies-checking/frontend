import { Injectable } from '@angular/core';
import { BondCalculation, BondSummary, EtfSummary, InstrumentsApi } from './instruments.models';

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
}

import { InjectionToken } from '@angular/core';

export type BondKind = 'OFZ' | 'CORPORATE';

export type EtfAssetClass = 'ETF' | 'CURRENCY' | 'METAL';

export type EtfCategory = 'LIQUIDITY' | 'EQUITY_INDEX' | 'BOND_INDEX' | 'GOLD' | 'CURRENCY';

export type EtfFilterGroup = 'all' | 'liquidity' | 'equity' | 'bond' | 'gold_currency';

export type FuturesSettlementType = 'CASH' | 'DELIVERY';

export type FuturesDirection = 'LONG' | 'SHORT';

export type OptionType = 'CALL' | 'PUT';

export type DividendTaxRate = 13 | 15;

export type TaxAccountType = 'BROKERAGE' | 'IIS_A' | 'IIS_B' | 'IIS_3';

export type ScreenerPreset =
  | 'all'
  | 'dividend_gt_10'
  | 'undervalued_pe_lt_6'
  | 'high_roe_gt_20'
  | 'low_debt_lt_0_5'
  | 'with_fundamentals';

export type ScreenerSortField =
  | 'ticker'
  | 'name'
  | 'sector'
  | 'marketCapRub'
  | 'peRatio'
  | 'pbRatio'
  | 'roe'
  | 'dividendYield'
  | 'debtToEquity'
  | 'beta';

export type SortDirection = 'asc' | 'desc';

export interface ScreenerPaper {
  readonly ticker: string;
  readonly name: string;
  readonly sector: string;
  readonly marketCapRub: number | null;
  readonly peRatio: number | null;
  readonly pbRatio: number | null;
  readonly psRatio: number | null;
  readonly evEbitda: number | null;
  readonly roe: number | null;
  readonly netMargin: number | null;
  readonly debtToEquity: number | null;
  readonly dividendYield: number | null;
  readonly beta: number | null;
  readonly hasFundamentals: boolean;
}

export type MarketEventType = 'CBR_RATE' | 'EARNINGS' | 'DIVIDEND' | 'MACRO';

export type MarketEventFilter = 'all' | MarketEventType;

export type MarketEventImportance = 'HIGH' | 'MEDIUM' | 'LOW';

export interface MarketEventSummary {
  readonly id: number;
  readonly eventDate: string;
  readonly eventType: MarketEventType;
  readonly ticker: string | null;
  readonly title: string;
  readonly importance: MarketEventImportance;
  readonly description: string;
}

export type PriceAlertConditionType = 'PRICE_ABOVE' | 'PRICE_BELOW' | 'RSI_BELOW' | 'RSI_ABOVE';

export interface CreatePriceAlertParams {
  readonly ticker: string;
  readonly conditionType: PriceAlertConditionType;
  readonly thresholdValue: number;
  readonly note?: string | null;
}

export interface PriceAlert {
  readonly id: string;
  readonly ticker: string;
  readonly conditionType: PriceAlertConditionType;
  readonly thresholdValue: number;
  readonly active: boolean;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface DividendEventSummary {
  readonly id: number;
  readonly ticker: string;
  readonly issuerName: string;
  readonly recordDate: string;
  readonly exDividendDate: string;
  readonly lastBuyDate: string;
  readonly paymentDate: string;
  readonly dividendPerShareRub: number;
  readonly yieldPct: number;
  readonly estimatedGapPct: number;
  readonly currency: string;
}

export interface DividendPayoutParams {
  readonly shares: number;
  readonly taxRatePct: DividendTaxRate;
}

export interface DividendPayoutCalculation {
  readonly ticker: string;
  readonly issuerName: string;
  readonly shares: number;
  readonly taxRatePct: number;
  readonly dividendPerShareRub: number;
  readonly grossPayoutRub: number;
  readonly taxWithheldRub: number;
  readonly netPayoutRub: number;
  readonly lastBuyDate: string;
  readonly exDividendDate: string;
  readonly recordDate: string;
  readonly paymentDate: string;
  readonly yieldPct: number;
  readonly estimatedGapPct: number;
  readonly currency: string;
}

export interface TaxCalcParams {
  readonly accountType: TaxAccountType;
  readonly grossProfitRub: number;
  readonly priorLossesRub: number;
  readonly dividendsRub: number;
  readonly annualContributionsRub: number;
}

export interface TaxCalculation {
  readonly accountType: TaxAccountType;
  readonly taxableProfitRub: number;
  readonly lossOffsetUsedRub: number;
  readonly tradingTaxRub: number;
  readonly dividendTaxRub: number;
  readonly totalTaxRub: number;
  readonly iisDeductionRefundRub: number;
  readonly netAfterTaxRub: number;
  readonly effectiveTaxRatePct: number;
}

export interface DcaCashflowItem {
  readonly date: string;
  readonly amountRub: number;
  readonly portfolioValueBeforeRub?: number | null;
}

export interface DcaCalcParams {
  readonly cashflows: readonly DcaCashflowItem[];
  readonly finalValueRub: number;
  readonly finalDate: string;
}

export interface DcaCalculation {
  readonly totalContributedRub: number;
  readonly totalWithdrawnRub: number;
  readonly netInvestedRub: number;
  readonly finalValueRub: number;
  readonly netProfitRub: number;
  readonly simpleReturnPct: number;
  readonly xirrPct: number;
  readonly twrPct: number;
  readonly holdingDays: number;
  readonly cashflowsCount: number;
}

export interface BondSummary {
  readonly ticker: string;
  readonly name: string;
  readonly issuer: string;
  readonly bondType: BondKind;
  readonly faceValueRub: number;
  readonly couponRatePct: number;
  readonly couponValueRub: number;
  readonly couponPeriodDays: number;
  readonly nextCouponDate: string | null;
  readonly maturityDate: string;
  readonly offerDate: string | null;
  readonly accruedInterestRub: number;
  readonly ytmPct: number;
  readonly durationYears: number;
  readonly amortized: boolean;
  readonly pricePct: number;
  readonly currency: string;
}

export interface BondCalculation {
  readonly ticker: string;
  readonly pricePct: number;
  readonly asOfDate: string | null;
  readonly cleanPriceRub: number;
  readonly accruedInterestRub: number;
  readonly dirtyPriceRub: number;
  readonly currentYieldPct: number;
  readonly ytmPct: number;
  readonly remainingCouponsCount: number;
  readonly yearsToMaturity: number;
  readonly nextCouponDate: string | null;
  readonly couponValueRub: number;
  readonly amortized: boolean;
}

export interface EtfSummary {
  readonly ticker: string;
  readonly name: string;
  readonly assetClass: EtfAssetClass;
  readonly category: EtfCategory;
  readonly underlyingIndex: string;
  readonly tracksRuonia: boolean;
  readonly expenseRatioPct: number;
  readonly navPriceRub: number;
  readonly currency: string;
  readonly description: string;
}

export interface FuturesSummary {
  readonly ticker: string;
  readonly name: string;
  readonly underlying: string;
  readonly contractSize: number;
  readonly priceStep: number;
  readonly stepPriceRub: number;
  readonly initialMarginRub: number;
  readonly lastPrice: number;
  readonly expirationDate: string;
  readonly settlementType: FuturesSettlementType;
  readonly currency: string;
}

export interface FuturesCalcParams {
  readonly entryPrice: number;
  readonly currentPrice: number;
  readonly contracts: number;
}

export interface FuturesCalculation {
  readonly ticker: string;
  readonly entryPrice: number;
  readonly currentPrice: number;
  readonly contracts: number;
  readonly asOfDate: string | null;
  readonly expirationDate: string;
  readonly daysToExpiration: number;
  readonly expired: boolean;
  readonly variationMarginRub: number;
  readonly initialMarginTotalRub: number;
  readonly notionalRub: number;
  readonly roeOnMarginPct: number;
  readonly effectiveLeverage: number;
}

export interface OptionSummary {
  readonly ticker: string;
  readonly name: string;
  readonly underlying: string;
  readonly optionType: OptionType;
  readonly strike: number;
  readonly expirationDate: string;
  readonly underlyingPrice: number;
  readonly impliedVolPct: number;
  readonly riskFreeRatePct: number;
  readonly contractSize: number;
  readonly initialMarginRub: number;
}

export interface OptionCalcParams {
  readonly spot: number;
  readonly volatilityPct: number;
  readonly riskFreeRatePct: number;
}

export interface OptionGreeksCalculation {
  readonly ticker: string;
  readonly optionType: OptionType;
  readonly spot: number;
  readonly strike: number;
  readonly impliedVolPct: number;
  readonly riskFreeRatePct: number;
  readonly asOfDate: string | null;
  readonly expirationDate: string;
  readonly daysToExpiration: number;
  readonly expired: boolean;
  readonly premium: number;
  readonly intrinsicValue: number;
  readonly timeValue: number;
  readonly delta: number;
  readonly gamma: number;
  readonly theta: number;
  readonly vega: number;
  readonly rho: number;
}

export interface InstrumentsApi {
  listBonds(): Promise<readonly BondSummary[]>;
  calculateBond(ticker: string, pricePct: number): Promise<BondCalculation>;
  listEtfs(): Promise<readonly EtfSummary[]>;
  listFutures(): Promise<readonly FuturesSummary[]>;
  calculateFutures(ticker: string, params: FuturesCalcParams): Promise<FuturesCalculation>;
  listOptions(): Promise<readonly OptionSummary[]>;
  calculateOptionGreeks(ticker: string, params: OptionCalcParams): Promise<OptionGreeksCalculation>;
  listDividends(ticker?: string): Promise<readonly DividendEventSummary[]>;
  calculateDividendPayout(
    ticker: string,
    params: DividendPayoutParams,
  ): Promise<DividendPayoutCalculation>;
  calculateTax(params: TaxCalcParams): Promise<TaxCalculation>;
  calculateDca(params: DcaCalcParams): Promise<DcaCalculation>;
  listScreenerPapers(): Promise<readonly ScreenerPaper[]>;
  listMarketEvents(type?: MarketEventType, ticker?: string): Promise<readonly MarketEventSummary[]>;
  listAlerts(): Promise<readonly PriceAlert[]>;
  createAlert(params: CreatePriceAlertParams): Promise<PriceAlert>;
  deleteAlert(id: string): Promise<void>;
}

export const INSTRUMENTS_API = new InjectionToken<InstrumentsApi>('INSTRUMENTS_API');

export const SCREENER_PRESET_LABELS: Readonly<Record<ScreenerPreset, string>> = {
  all: 'Все бумаги',
  dividend_gt_10: 'Дивидендные >10%',
  undervalued_pe_lt_6: 'Недооценённые P/E < 6',
  high_roe_gt_20: 'Высокий ROE > 20%',
  low_debt_lt_0_5: 'Низкий долг D/E < 0.5',
  with_fundamentals: 'С фундаменталом',
};

export const MARKET_EVENT_TYPE_LABELS: Readonly<Record<MarketEventType, string>> = {
  CBR_RATE: 'ЦБ РФ',
  EARNINGS: 'Отчёты',
  DIVIDEND: 'Дивиденды',
  MACRO: 'Макро',
};

export const MARKET_EVENT_FILTER_LABELS: Readonly<Record<MarketEventFilter, string>> = {
  all: 'Все',
  CBR_RATE: 'ЦБ РФ',
  EARNINGS: 'Отчёты',
  DIVIDEND: 'Дивиденды',
  MACRO: 'Макро',
};

export const MARKET_EVENT_IMPORTANCE_LABELS: Readonly<Record<MarketEventImportance, string>> = {
  HIGH: 'Высокая',
  MEDIUM: 'Средняя',
  LOW: 'Низкая',
};

export const ALERT_CONDITION_LABELS: Readonly<Record<PriceAlertConditionType, string>> = {
  PRICE_ABOVE: 'Цена выше',
  PRICE_BELOW: 'Цена ниже',
  RSI_BELOW: 'RSI ниже',
  RSI_ABOVE: 'RSI выше',
};

export const TAX_ACCOUNT_TYPE_LABELS: Readonly<Record<TaxAccountType, string>> = {
  BROKERAGE: 'Брокерский счёт',
  IIS_A: 'ИИС тип А',
  IIS_B: 'ИИС тип Б',
  IIS_3: 'ИИС-3',
};

export const ETF_CATEGORY_LABELS: Readonly<Record<EtfCategory, string>> = {
  LIQUIDITY: 'Фонд ликвидности',
  EQUITY_INDEX: 'Индекс акций',
  BOND_INDEX: 'Облигации',
  GOLD: 'Золото',
  CURRENCY: 'Валюта',
};

export const ETF_FILTER_LABELS: Readonly<Record<EtfFilterGroup, string>> = {
  all: 'Все',
  liquidity: 'Фонды ликвидности (RUONIA)',
  equity: 'Индексы акций',
  bond: 'Облигации',
  gold_currency: 'Золото и валюта',
};

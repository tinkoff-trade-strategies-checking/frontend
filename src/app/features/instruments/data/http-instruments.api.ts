import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  BondCalculation,
  BondKind,
  BondSummary,
  CreatePriceAlertParams,
  DcaCalcParams,
  DcaCalculation,
  DividendEventSummary,
  DividendPayoutCalculation,
  DividendPayoutParams,
  EtfAssetClass,
  EtfCategory,
  EtfSummary,
  FuturesCalcParams,
  FuturesCalculation,
  FuturesSettlementType,
  FuturesSummary,
  InstrumentsApi,
  MarketEventImportance,
  MarketEventSummary,
  MarketEventType,
  OptionCalcParams,
  OptionGreeksCalculation,
  OptionSummary,
  OptionType,
  PriceAlert,
  PriceAlertConditionType,
  ScreenerPaper,
  TaxAccountType,
  TaxCalcParams,
  TaxCalculation,
} from './instruments.models';

type DecimalWire = string | number | null | undefined;

export interface BondSummaryDto {
  readonly ticker: string;
  readonly name: string;
  readonly issuer?: string | null;
  readonly bondType?: string | null;
  readonly faceValueRub?: DecimalWire;
  readonly couponRatePct?: DecimalWire;
  readonly couponValueRub?: DecimalWire;
  readonly couponPeriodDays?: number | null;
  readonly nextCouponDate?: string | null;
  readonly maturityDate?: string | null;
  readonly offerDate?: string | null;
  readonly accruedInterestRub?: DecimalWire;
  readonly ytmPct?: DecimalWire;
  readonly durationYears?: DecimalWire;
  readonly amortized?: boolean | null;
  readonly pricePct?: DecimalWire;
  readonly currency?: string | null;
}

export interface BondCalculationDto {
  readonly ticker?: string | null;
  readonly pricePct?: DecimalWire;
  readonly asOfDate?: string | null;
  readonly cleanPriceRub?: DecimalWire;
  readonly accruedInterestRub?: DecimalWire;
  readonly dirtyPriceRub?: DecimalWire;
  readonly currentYieldPct?: DecimalWire;
  readonly ytmPct?: DecimalWire;
  readonly remainingCouponsCount?: number | null;
  readonly yearsToMaturity?: DecimalWire;
  readonly nextCouponDate?: string | null;
  readonly couponValueRub?: DecimalWire;
  readonly amortized?: boolean | null;
}

export interface EtfSummaryDto {
  readonly ticker: string;
  readonly name: string;
  readonly assetClass?: string | null;
  readonly category?: string | null;
  readonly underlyingIndex?: string | null;
  readonly tracksRuonia?: boolean | null;
  readonly expenseRatioPct?: DecimalWire;
  readonly navPriceRub?: DecimalWire;
  readonly currency?: string | null;
  readonly description?: string | null;
}

export interface FuturesSummaryDto {
  readonly ticker: string;
  readonly name: string;
  readonly underlying?: string | null;
  readonly contractSize?: number | null;
  readonly priceStep?: DecimalWire;
  readonly stepPriceRub?: DecimalWire;
  readonly initialMarginRub?: DecimalWire;
  readonly lastPrice?: DecimalWire;
  readonly expirationDate?: string | null;
  readonly settlementType?: string | null;
  readonly currency?: string | null;
}

export interface FuturesCalculationDto {
  readonly ticker?: string | null;
  readonly entryPrice?: DecimalWire;
  readonly currentPrice?: DecimalWire;
  readonly contracts?: number | null;
  readonly asOfDate?: string | null;
  readonly expirationDate?: string | null;
  readonly daysToExpiration?: number | null;
  readonly expired?: boolean | null;
  readonly variationMarginRub?: DecimalWire;
  readonly initialMarginTotalRub?: DecimalWire;
  readonly notionalRub?: DecimalWire;
  readonly roeOnMarginPct?: DecimalWire;
  readonly effectiveLeverage?: DecimalWire;
}

export interface OptionSummaryDto {
  readonly ticker: string;
  readonly name: string;
  readonly underlying?: string | null;
  readonly optionType?: string | null;
  readonly strike?: DecimalWire;
  readonly expirationDate?: string | null;
  readonly underlyingPrice?: DecimalWire;
  readonly impliedVolPct?: DecimalWire;
  readonly riskFreeRatePct?: DecimalWire;
  readonly contractSize?: number | null;
  readonly initialMarginRub?: DecimalWire;
}

export interface OptionGreeksDto {
  readonly ticker?: string | null;
  readonly optionType?: string | null;
  readonly spot?: DecimalWire;
  readonly strike?: DecimalWire;
  readonly impliedVolPct?: DecimalWire;
  readonly riskFreeRatePct?: DecimalWire;
  readonly asOfDate?: string | null;
  readonly expirationDate?: string | null;
  readonly daysToExpiration?: number | null;
  readonly expired?: boolean | null;
  readonly premium?: DecimalWire;
  readonly intrinsicValue?: DecimalWire;
  readonly timeValue?: DecimalWire;
  readonly delta?: DecimalWire;
  readonly gamma?: DecimalWire;
  readonly theta?: DecimalWire;
  readonly vega?: DecimalWire;
  readonly rho?: DecimalWire;
}

export interface DividendEventSummaryDto {
  readonly id?: number | null;
  readonly ticker: string;
  readonly issuerName?: string | null;
  readonly recordDate?: string | null;
  readonly exDividendDate?: string | null;
  readonly lastBuyDate?: string | null;
  readonly paymentDate?: string | null;
  readonly dividendPerShareRub?: DecimalWire;
  readonly yieldPct?: DecimalWire;
  readonly estimatedGapPct?: DecimalWire;
  readonly currency?: string | null;
}

export interface DividendPayoutDto {
  readonly ticker?: string | null;
  readonly issuerName?: string | null;
  readonly shares?: number | null;
  readonly taxRatePct?: DecimalWire;
  readonly dividendPerShareRub?: DecimalWire;
  readonly grossPayoutRub?: DecimalWire;
  readonly taxWithheldRub?: DecimalWire;
  readonly netPayoutRub?: DecimalWire;
  readonly lastBuyDate?: string | null;
  readonly exDividendDate?: string | null;
  readonly recordDate?: string | null;
  readonly paymentDate?: string | null;
  readonly yieldPct?: DecimalWire;
  readonly estimatedGapPct?: DecimalWire;
  readonly currency?: string | null;
}

export interface TaxCalculationDto {
  readonly accountType?: string | null;
  readonly taxableProfitRub?: DecimalWire;
  readonly lossOffsetUsedRub?: DecimalWire;
  readonly tradingTaxRub?: DecimalWire;
  readonly dividendTaxRub?: DecimalWire;
  readonly totalTaxRub?: DecimalWire;
  readonly iisDeductionRefundRub?: DecimalWire;
  readonly netAfterTaxRub?: DecimalWire;
  readonly effectiveTaxRatePct?: DecimalWire;
}

export interface DcaCalculationDto {
  readonly totalContributedRub?: DecimalWire;
  readonly totalWithdrawnRub?: DecimalWire;
  readonly netInvestedRub?: DecimalWire;
  readonly finalValueRub?: DecimalWire;
  readonly netProfitRub?: DecimalWire;
  readonly simpleReturnPct?: DecimalWire;
  readonly xirrPct?: DecimalWire;
  readonly twrPct?: DecimalWire;
  readonly holdingDays?: number | null;
  readonly cashflowsCount?: number | null;
}

export interface ScreenerPaperDto {
  readonly ticker: string;
  readonly name?: string | null;
  readonly sector?: string | null;
  readonly marketCapRub?: DecimalWire;
  readonly peRatio?: DecimalWire;
  readonly pbRatio?: DecimalWire;
  readonly psRatio?: DecimalWire;
  readonly evEbitda?: DecimalWire;
  readonly roe?: DecimalWire;
  readonly netMargin?: DecimalWire;
  readonly debtToEquity?: DecimalWire;
  readonly dividendYield?: DecimalWire;
  readonly beta?: DecimalWire;
  readonly hasFundamentals?: boolean | null;
}

export interface MarketEventSummaryDto {
  readonly id?: number | null;
  readonly eventDate?: string | null;
  readonly eventType?: string | null;
  readonly ticker?: string | null;
  readonly title?: string | null;
  readonly importance?: string | null;
  readonly description?: string | null;
}

export interface PriceAlertDto {
  readonly id: string;
  readonly ticker: string;
  readonly conditionType?: string | null;
  readonly thresholdValue?: DecimalWire;
  readonly active?: boolean | null;
  readonly note?: string | null;
  readonly createdAt?: string | null;
}

function parseDecimal(value: DecimalWire, fallback = 0): number {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseNullableDecimal(value: DecimalWire): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatThresholdDecimal(value: number): string {
  const fixed4 = value.toFixed(4);
  if (fixed4.endsWith('00')) {
    return value.toFixed(2);
  }
  return fixed4.replace(/0+$/, '');
}

function normalizeBondKind(dto: BondSummaryDto): BondKind {
  return (dto.bondType ?? '').toUpperCase() === 'OFZ' ? 'OFZ' : 'CORPORATE';
}

function normalizeAssetClass(raw: string | null | undefined): EtfAssetClass {
  const upper = (raw ?? '').toUpperCase();
  if (upper === 'CURRENCY') {
    return 'CURRENCY';
  }
  if (upper === 'METAL') {
    return 'METAL';
  }
  return 'ETF';
}

function normalizeEtfCategory(dto: EtfSummaryDto): EtfCategory {
  const upper = (dto.category ?? '').toUpperCase();
  if (upper === 'LIQUIDITY' || dto.tracksRuonia) {
    return 'LIQUIDITY';
  }
  if (upper === 'BOND_INDEX') {
    return 'BOND_INDEX';
  }
  if (upper === 'GOLD') {
    return 'GOLD';
  }
  if (upper === 'CURRENCY') {
    return 'CURRENCY';
  }
  return 'EQUITY_INDEX';
}

export function mapBondDto(dto: BondSummaryDto): BondSummary {
  return {
    ticker: dto.ticker,
    name: dto.name,
    issuer: dto.issuer ?? 'Эмитент MOEX',
    bondType: normalizeBondKind(dto),
    faceValueRub: parseDecimal(dto.faceValueRub, 1000),
    couponRatePct: parseDecimal(dto.couponRatePct, 0),
    couponValueRub: parseDecimal(dto.couponValueRub, 0),
    couponPeriodDays: dto.couponPeriodDays ?? 182,
    nextCouponDate: dto.nextCouponDate ?? null,
    maturityDate: dto.maturityDate ?? '',
    offerDate: dto.offerDate ?? null,
    accruedInterestRub: parseDecimal(dto.accruedInterestRub, 0),
    ytmPct: parseDecimal(dto.ytmPct, 0),
    durationYears: parseDecimal(dto.durationYears, 0),
    amortized: Boolean(dto.amortized),
    pricePct: parseDecimal(dto.pricePct, 100),
    currency: dto.currency ?? 'RUB',
  };
}

export function mapBondCalculationDto(
  ticker: string,
  pricePct: number,
  dto: BondCalculationDto,
): BondCalculation {
  return {
    ticker: dto.ticker ?? ticker,
    pricePct: parseDecimal(dto.pricePct, pricePct),
    asOfDate: dto.asOfDate ?? null,
    cleanPriceRub: parseDecimal(dto.cleanPriceRub, 0),
    accruedInterestRub: parseDecimal(dto.accruedInterestRub, 0),
    dirtyPriceRub: parseDecimal(dto.dirtyPriceRub, 0),
    currentYieldPct: parseDecimal(dto.currentYieldPct, 0),
    ytmPct: parseDecimal(dto.ytmPct, 0),
    remainingCouponsCount: dto.remainingCouponsCount ?? 0,
    yearsToMaturity: parseDecimal(dto.yearsToMaturity, 0),
    nextCouponDate: dto.nextCouponDate ?? null,
    couponValueRub: parseDecimal(dto.couponValueRub, 0),
    amortized: Boolean(dto.amortized),
  };
}

export function mapEtfDto(dto: EtfSummaryDto): EtfSummary {
  return {
    ticker: dto.ticker,
    name: dto.name,
    assetClass: normalizeAssetClass(dto.assetClass),
    category: normalizeEtfCategory(dto),
    underlyingIndex: dto.underlyingIndex ?? 'Индекс MOEX',
    tracksRuonia: Boolean(dto.tracksRuonia),
    expenseRatioPct: parseDecimal(dto.expenseRatioPct, 0),
    navPriceRub: parseDecimal(dto.navPriceRub, 0),
    currency: dto.currency ?? 'RUB',
    description: dto.description ?? '',
  };
}

function normalizeSettlementType(raw: string | null | undefined): FuturesSettlementType {
  return (raw ?? '').toUpperCase() === 'DELIVERY' ? 'DELIVERY' : 'CASH';
}

function normalizeOptionType(raw: string | null | undefined): OptionType {
  return (raw ?? '').toUpperCase() === 'PUT' ? 'PUT' : 'CALL';
}

export function mapFuturesDto(dto: FuturesSummaryDto): FuturesSummary {
  return {
    ticker: dto.ticker,
    name: dto.name,
    underlying: dto.underlying ?? '',
    contractSize: dto.contractSize ?? 1,
    priceStep: parseDecimal(dto.priceStep, 1),
    stepPriceRub: parseDecimal(dto.stepPriceRub, 1),
    initialMarginRub: parseDecimal(dto.initialMarginRub, 0),
    lastPrice: parseDecimal(dto.lastPrice, 0),
    expirationDate: dto.expirationDate ?? '',
    settlementType: normalizeSettlementType(dto.settlementType),
    currency: dto.currency ?? 'RUB',
  };
}

export function mapFuturesCalculationDto(
  ticker: string,
  params: FuturesCalcParams,
  dto: FuturesCalculationDto,
): FuturesCalculation {
  return {
    ticker: dto.ticker ?? ticker,
    entryPrice: parseDecimal(dto.entryPrice, params.entryPrice),
    currentPrice: parseDecimal(dto.currentPrice, params.currentPrice),
    contracts: dto.contracts ?? params.contracts,
    asOfDate: dto.asOfDate ?? null,
    expirationDate: dto.expirationDate ?? '',
    daysToExpiration: dto.daysToExpiration ?? 0,
    expired: Boolean(dto.expired),
    variationMarginRub: parseDecimal(dto.variationMarginRub, 0),
    initialMarginTotalRub: parseDecimal(dto.initialMarginTotalRub, 0),
    notionalRub: parseDecimal(dto.notionalRub, 0),
    roeOnMarginPct: parseDecimal(dto.roeOnMarginPct, 0),
    effectiveLeverage: parseDecimal(dto.effectiveLeverage, 0),
  };
}

export function mapOptionDto(dto: OptionSummaryDto): OptionSummary {
  return {
    ticker: dto.ticker,
    name: dto.name,
    underlying: dto.underlying ?? '',
    optionType: normalizeOptionType(dto.optionType),
    strike: parseDecimal(dto.strike, 0),
    expirationDate: dto.expirationDate ?? '',
    underlyingPrice: parseDecimal(dto.underlyingPrice, 0),
    impliedVolPct: parseDecimal(dto.impliedVolPct, 30),
    riskFreeRatePct: parseDecimal(dto.riskFreeRatePct, 16),
    contractSize: dto.contractSize ?? 1,
    initialMarginRub: parseDecimal(dto.initialMarginRub, 0),
  };
}

export function mapOptionGreeksDto(
  ticker: string,
  params: OptionCalcParams,
  dto: OptionGreeksDto,
): OptionGreeksCalculation {
  return {
    ticker: dto.ticker ?? ticker,
    optionType: normalizeOptionType(dto.optionType),
    spot: parseDecimal(dto.spot, params.spot),
    strike: parseDecimal(dto.strike, 0),
    impliedVolPct: parseDecimal(dto.impliedVolPct, params.volatilityPct),
    riskFreeRatePct: parseDecimal(dto.riskFreeRatePct, params.riskFreeRatePct),
    asOfDate: dto.asOfDate ?? null,
    expirationDate: dto.expirationDate ?? '',
    daysToExpiration: dto.daysToExpiration ?? 0,
    expired: Boolean(dto.expired),
    premium: parseDecimal(dto.premium, 0),
    intrinsicValue: parseDecimal(dto.intrinsicValue, 0),
    timeValue: parseDecimal(dto.timeValue, 0),
    delta: parseDecimal(dto.delta, 0),
    gamma: parseDecimal(dto.gamma, 0),
    theta: parseDecimal(dto.theta, 0),
    vega: parseDecimal(dto.vega, 0),
    rho: parseDecimal(dto.rho, 0),
  };
}

function normalizeTaxAccountType(raw: string | null | undefined): TaxAccountType {
  const upper = (raw ?? '').toUpperCase();
  if (upper === 'IIS_A' || upper === 'IIS_B' || upper === 'IIS_3') {
    return upper;
  }
  return 'BROKERAGE';
}

export function mapDividendDto(dto: DividendEventSummaryDto): DividendEventSummary {
  return {
    id: dto.id ?? 0,
    ticker: dto.ticker,
    issuerName: dto.issuerName ?? dto.ticker,
    recordDate: dto.recordDate ?? '',
    exDividendDate: dto.exDividendDate ?? '',
    lastBuyDate: dto.lastBuyDate ?? '',
    paymentDate: dto.paymentDate ?? '',
    dividendPerShareRub: parseDecimal(dto.dividendPerShareRub, 0),
    yieldPct: parseDecimal(dto.yieldPct, 0),
    estimatedGapPct: parseDecimal(dto.estimatedGapPct, 0),
    currency: dto.currency ?? 'RUB',
  };
}

export function mapDividendPayoutDto(
  ticker: string,
  params: DividendPayoutParams,
  dto: DividendPayoutDto,
): DividendPayoutCalculation {
  return {
    ticker: dto.ticker ?? ticker,
    issuerName: dto.issuerName ?? ticker,
    shares: dto.shares ?? params.shares,
    taxRatePct: parseDecimal(dto.taxRatePct, params.taxRatePct),
    dividendPerShareRub: parseDecimal(dto.dividendPerShareRub, 0),
    grossPayoutRub: parseDecimal(dto.grossPayoutRub, 0),
    taxWithheldRub: parseDecimal(dto.taxWithheldRub, 0),
    netPayoutRub: parseDecimal(dto.netPayoutRub, 0),
    lastBuyDate: dto.lastBuyDate ?? '',
    exDividendDate: dto.exDividendDate ?? '',
    recordDate: dto.recordDate ?? '',
    paymentDate: dto.paymentDate ?? '',
    yieldPct: parseDecimal(dto.yieldPct, 0),
    estimatedGapPct: parseDecimal(dto.estimatedGapPct, 0),
    currency: dto.currency ?? 'RUB',
  };
}

export function mapTaxCalculationDto(
  fallbackAccountType: TaxAccountType,
  dto: TaxCalculationDto,
): TaxCalculation {
  return {
    accountType: dto.accountType ? normalizeTaxAccountType(dto.accountType) : fallbackAccountType,
    taxableProfitRub: parseDecimal(dto.taxableProfitRub, 0),
    lossOffsetUsedRub: parseDecimal(dto.lossOffsetUsedRub, 0),
    tradingTaxRub: parseDecimal(dto.tradingTaxRub, 0),
    dividendTaxRub: parseDecimal(dto.dividendTaxRub, 0),
    totalTaxRub: parseDecimal(dto.totalTaxRub, 0),
    iisDeductionRefundRub: parseDecimal(dto.iisDeductionRefundRub, 0),
    netAfterTaxRub: parseDecimal(dto.netAfterTaxRub, 0),
    effectiveTaxRatePct: parseDecimal(dto.effectiveTaxRatePct, 0),
  };
}

export function mapDcaCalculationDto(dto: DcaCalculationDto): DcaCalculation {
  return {
    totalContributedRub: parseDecimal(dto.totalContributedRub, 0),
    totalWithdrawnRub: parseDecimal(dto.totalWithdrawnRub, 0),
    netInvestedRub: parseDecimal(dto.netInvestedRub, 0),
    finalValueRub: parseDecimal(dto.finalValueRub, 0),
    netProfitRub: parseDecimal(dto.netProfitRub, 0),
    simpleReturnPct: parseDecimal(dto.simpleReturnPct, 0),
    xirrPct: parseDecimal(dto.xirrPct, 0),
    twrPct: parseDecimal(dto.twrPct, 0),
    holdingDays: dto.holdingDays ?? 0,
    cashflowsCount: dto.cashflowsCount ?? 0,
  };
}

function normalizeMarketEventType(raw: string | null | undefined): MarketEventType {
  const upper = (raw ?? '').toUpperCase();
  if (upper === 'CBR_RATE' || upper === 'EARNINGS' || upper === 'DIVIDEND' || upper === 'MACRO') {
    return upper;
  }
  return 'MACRO';
}

function normalizeMarketEventImportance(raw: string | null | undefined): MarketEventImportance {
  const upper = (raw ?? '').toUpperCase();
  if (upper === 'HIGH' || upper === 'MEDIUM' || upper === 'LOW') {
    return upper;
  }
  return 'MEDIUM';
}

function normalizeAlertConditionType(raw: string | null | undefined): PriceAlertConditionType {
  const upper = (raw ?? '').toUpperCase();
  if (
    upper === 'PRICE_ABOVE' ||
    upper === 'PRICE_BELOW' ||
    upper === 'RSI_BELOW' ||
    upper === 'RSI_ABOVE'
  ) {
    return upper;
  }
  return 'PRICE_ABOVE';
}

export function mapScreenerPaperDto(dto: ScreenerPaperDto): ScreenerPaper {
  return {
    ticker: dto.ticker,
    name: dto.name ?? dto.ticker,
    sector: dto.sector ?? 'Прочее',
    marketCapRub: parseNullableDecimal(dto.marketCapRub),
    peRatio: parseNullableDecimal(dto.peRatio),
    pbRatio: parseNullableDecimal(dto.pbRatio),
    psRatio: parseNullableDecimal(dto.psRatio),
    evEbitda: parseNullableDecimal(dto.evEbitda),
    roe: parseNullableDecimal(dto.roe),
    netMargin: parseNullableDecimal(dto.netMargin),
    debtToEquity: parseNullableDecimal(dto.debtToEquity),
    dividendYield: parseNullableDecimal(dto.dividendYield),
    beta: parseNullableDecimal(dto.beta),
    hasFundamentals: Boolean(dto.hasFundamentals),
  };
}

export function mapMarketEventDto(dto: MarketEventSummaryDto): MarketEventSummary {
  return {
    id: dto.id ?? 0,
    eventDate: dto.eventDate ?? '',
    eventType: normalizeMarketEventType(dto.eventType),
    ticker: dto.ticker ? dto.ticker.trim().toUpperCase() : null,
    title: dto.title ?? '',
    importance: normalizeMarketEventImportance(dto.importance),
    description: dto.description ?? '',
  };
}

export function mapPriceAlertDto(dto: PriceAlertDto): PriceAlert {
  return {
    id: dto.id,
    ticker: dto.ticker,
    conditionType: normalizeAlertConditionType(dto.conditionType),
    thresholdValue: parseDecimal(dto.thresholdValue, 0),
    active: dto.active ?? true,
    note: dto.note ?? null,
    createdAt: dto.createdAt ?? '',
  };
}

@Injectable({ providedIn: 'root' })
export class HttpInstrumentsApi implements InstrumentsApi {
  private readonly http = inject(HttpClient);

  async listBonds(): Promise<readonly BondSummary[]> {
    const res = await firstValueFrom(
      this.http.get<readonly BondSummaryDto[]>('/api/v1/instruments/bonds'),
    );
    return (res ?? []).map(mapBondDto);
  }

  async calculateBond(ticker: string, pricePct: number): Promise<BondCalculation> {
    const encoded = encodeURIComponent(ticker.trim().toUpperCase());
    const params = new HttpParams().set('pricePct', pricePct.toFixed(2));
    const res = await firstValueFrom(
      this.http.get<BondCalculationDto>(`/api/v1/instruments/bonds/${encoded}/calc`, { params }),
    );
    return mapBondCalculationDto(ticker, pricePct, res);
  }

  async listEtfs(): Promise<readonly EtfSummary[]> {
    const res = await firstValueFrom(
      this.http.get<readonly EtfSummaryDto[]>('/api/v1/instruments/etfs'),
    );
    return (res ?? []).map(mapEtfDto);
  }

  async listFutures(): Promise<readonly FuturesSummary[]> {
    const res = await firstValueFrom(
      this.http.get<readonly FuturesSummaryDto[]>('/api/v1/instruments/futures'),
    );
    return (res ?? []).map(mapFuturesDto);
  }

  async calculateFutures(ticker: string, params: FuturesCalcParams): Promise<FuturesCalculation> {
    const encoded = encodeURIComponent(ticker.trim());
    const httpParams = new HttpParams()
      .set('entryPrice', String(params.entryPrice))
      .set('currentPrice', String(params.currentPrice))
      .set('contracts', String(Math.trunc(params.contracts)));
    const res = await firstValueFrom(
      this.http.get<FuturesCalculationDto>(`/api/v1/instruments/futures/${encoded}/calc`, {
        params: httpParams,
      }),
    );
    return mapFuturesCalculationDto(ticker, params, res);
  }

  async listOptions(): Promise<readonly OptionSummary[]> {
    const res = await firstValueFrom(
      this.http.get<readonly OptionSummaryDto[]>('/api/v1/instruments/options'),
    );
    return (res ?? []).map(mapOptionDto);
  }

  async calculateOptionGreeks(
    ticker: string,
    params: OptionCalcParams,
  ): Promise<OptionGreeksCalculation> {
    const encoded = encodeURIComponent(ticker.trim());
    const httpParams = new HttpParams()
      .set('spot', String(params.spot))
      .set('volatilityPct', String(params.volatilityPct))
      .set('riskFreeRatePct', String(params.riskFreeRatePct));
    const res = await firstValueFrom(
      this.http.get<OptionGreeksDto>(`/api/v1/instruments/options/${encoded}/calc`, {
        params: httpParams,
      }),
    );
    return mapOptionGreeksDto(ticker, params, res);
  }

  async listDividends(ticker?: string): Promise<readonly DividendEventSummary[]> {
    const trimmed = ticker?.trim().toUpperCase();
    const params = trimmed ? new HttpParams().set('ticker', trimmed) : undefined;
    const res = await firstValueFrom(
      this.http.get<readonly DividendEventSummaryDto[]>('/api/v1/instruments/dividends', {
        params,
      }),
    );
    return (res ?? []).map(mapDividendDto);
  }

  async calculateDividendPayout(
    ticker: string,
    params: DividendPayoutParams,
  ): Promise<DividendPayoutCalculation> {
    const encoded = encodeURIComponent(ticker.trim().toUpperCase());
    const httpParams = new HttpParams()
      .set('shares', String(Math.max(1, Math.trunc(params.shares))))
      .set('taxRatePct', String(params.taxRatePct));
    const res = await firstValueFrom(
      this.http.get<DividendPayoutDto>(`/api/v1/instruments/dividends/${encoded}/calc`, {
        params: httpParams,
      }),
    );
    return mapDividendPayoutDto(ticker, params, res);
  }

  async calculateTax(params: TaxCalcParams): Promise<TaxCalculation> {
    const body = {
      accountType: params.accountType,
      grossProfitRub: params.grossProfitRub.toFixed(2),
      priorLossesRub: params.priorLossesRub.toFixed(2),
      dividendsRub: params.dividendsRub.toFixed(2),
      annualContributionsRub: params.annualContributionsRub.toFixed(2),
    };
    const res = await firstValueFrom(
      this.http.post<TaxCalculationDto>('/api/v1/instruments/tax/calc', body),
    );
    return mapTaxCalculationDto(params.accountType, res);
  }

  async calculateDca(params: DcaCalcParams): Promise<DcaCalculation> {
    const body = {
      cashflows: params.cashflows.map((cf) => ({
        date: cf.date,
        amountRub: cf.amountRub.toFixed(2),
        ...(cf.portfolioValueBeforeRub !== undefined && cf.portfolioValueBeforeRub !== null
          ? { portfolioValueBeforeRub: cf.portfolioValueBeforeRub.toFixed(2) }
          : {}),
      })),
      finalValueRub: params.finalValueRub.toFixed(2),
      finalDate: params.finalDate,
    };
    const res = await firstValueFrom(
      this.http.post<DcaCalculationDto>('/api/v1/instruments/dca/calc', body),
    );
    return mapDcaCalculationDto(res);
  }

  async listScreenerPapers(): Promise<readonly ScreenerPaper[]> {
    const res = await firstValueFrom(
      this.http.get<readonly ScreenerPaperDto[]>('/api/v1/instruments/screener'),
    );
    return (res ?? []).map(mapScreenerPaperDto);
  }

  async listMarketEvents(
    type?: MarketEventType,
    ticker?: string,
  ): Promise<readonly MarketEventSummary[]> {
    let params = new HttpParams();
    if (type) {
      params = params.set('type', type);
    }
    const trimmed = ticker?.trim().toUpperCase();
    if (trimmed) {
      params = params.set('ticker', trimmed);
    }
    const res = await firstValueFrom(
      this.http.get<readonly MarketEventSummaryDto[]>('/api/v1/instruments/events', { params }),
    );
    return (res ?? []).map(mapMarketEventDto);
  }

  async listAlerts(): Promise<readonly PriceAlert[]> {
    const res = await firstValueFrom(this.http.get<readonly PriceAlertDto[]>('/api/v1/alerts'));
    return (res ?? []).map(mapPriceAlertDto);
  }

  async createAlert(params: CreatePriceAlertParams): Promise<PriceAlert> {
    const trimmedNote = params.note?.trim();
    const body = {
      ticker: params.ticker.trim().toUpperCase(),
      conditionType: params.conditionType,
      thresholdValue: formatThresholdDecimal(params.thresholdValue),
      ...(trimmedNote ? { note: trimmedNote } : {}),
    };
    const res = await firstValueFrom(this.http.post<PriceAlertDto>('/api/v1/alerts', body));
    return mapPriceAlertDto(res);
  }

  async deleteAlert(id: string): Promise<void> {
    const encoded = encodeURIComponent(id);
    await firstValueFrom(this.http.delete<void>(`/api/v1/alerts/${encoded}`));
  }
}

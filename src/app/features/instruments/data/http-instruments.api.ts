import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  BondCalculation,
  BondKind,
  BondSummary,
  EtfAssetClass,
  EtfCategory,
  EtfSummary,
  FuturesCalcParams,
  FuturesCalculation,
  FuturesSettlementType,
  FuturesSummary,
  InstrumentsApi,
  OptionCalcParams,
  OptionGreeksCalculation,
  OptionSummary,
  OptionType,
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

function parseDecimal(value: DecimalWire, fallback = 0): number {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
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
}

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
  InstrumentsApi,
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
}

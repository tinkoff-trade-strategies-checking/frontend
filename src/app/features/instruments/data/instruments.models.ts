import { InjectionToken } from '@angular/core';

export type BondKind = 'OFZ' | 'CORPORATE';

export type EtfAssetClass = 'ETF' | 'CURRENCY' | 'METAL';

export type EtfCategory = 'LIQUIDITY' | 'EQUITY_INDEX' | 'BOND_INDEX' | 'GOLD' | 'CURRENCY';

export type EtfFilterGroup = 'all' | 'liquidity' | 'equity' | 'bond' | 'gold_currency';

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

export interface InstrumentsApi {
  listBonds(): Promise<readonly BondSummary[]>;
  calculateBond(ticker: string, pricePct: number): Promise<BondCalculation>;
  listEtfs(): Promise<readonly EtfSummary[]>;
}

export const INSTRUMENTS_API = new InjectionToken<InstrumentsApi>('INSTRUMENTS_API');

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

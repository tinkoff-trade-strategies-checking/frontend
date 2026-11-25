import { InjectionToken } from '@angular/core';

export interface PaperFundamentals {
  readonly ticker: string;
  readonly reportDate: string | null;
  readonly availableAt?: string | null;
  readonly periodType?: string | null;
  readonly currency?: string | null;
  // Оценка (Valuation)
  readonly marketCapRub: number | null;
  readonly peRatio: number | null;
  readonly pbRatio: number | null;
  readonly psRatio: number | null;
  readonly evEbitda: number | null;
  // Рентабельность и рост (Profitability & Growth)
  readonly roe: number | null;
  readonly roa: number | null;
  readonly grossMargin: number | null;
  readonly operatingMargin: number | null;
  readonly netMargin: number | null;
  readonly revenueGrowthYoy: number | null;
  readonly epsGrowthYoy: number | null;
  // Устойчивость (Financial Strength)
  readonly debtToEquity: number | null;
  readonly currentRatio: number | null;
  readonly beta: number | null;
  readonly freeFloat: number | null;
  // На акцию и дивиденды (Per-Share & Dividends)
  readonly eps: number | null;
  readonly bookValuePerShare: number | null;
  readonly dividendYield: number | null;
  readonly payoutRatio: number | null;
}

export interface SessionPaperFundamentalsItem {
  readonly paperId: string;
  readonly ticker: string;
  readonly name: string;
  readonly sector: string;
  readonly available: boolean;
  readonly snapshot: PaperFundamentals | null;
}

export interface SessionFundamentalsResponse {
  readonly hiddenByBlindMode: boolean;
  readonly asOfDate: string | null;
  readonly items: readonly SessionPaperFundamentalsItem[];
}

export interface FundamentalsApi {
  getPaperFundamentals(ticker: string): Promise<PaperFundamentals | null>;
  getSessionFundamentals(sessionId: string): Promise<SessionFundamentalsResponse>;
}

export const FUNDAMENTALS_API = new InjectionToken<FundamentalsApi>('FUNDAMENTALS_API');

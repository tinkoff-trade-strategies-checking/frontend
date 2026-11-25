import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  FundamentalsApi,
  PaperFundamentals,
  SessionFundamentalsResponse,
  SessionPaperFundamentalsItem,
} from './fundamentals.models';

type DecimalWire = string | number | null | undefined;

export interface FundamentalSnapshotDto {
  readonly ticker: string;
  readonly reportDate?: string | null;
  readonly availableAt?: string | null;
  readonly periodType?: string | null;
  readonly currency?: string | null;
  readonly marketCapRub?: DecimalWire;
  readonly peRatio?: DecimalWire;
  readonly pbRatio?: DecimalWire;
  readonly psRatio?: DecimalWire;
  readonly evEbitda?: DecimalWire;
  readonly roe?: DecimalWire;
  readonly roa?: DecimalWire;
  readonly grossMargin?: DecimalWire;
  readonly operatingMargin?: DecimalWire;
  readonly netMargin?: DecimalWire;
  readonly revenueGrowthYoy?: DecimalWire;
  readonly epsGrowthYoy?: DecimalWire;
  readonly debtToEquity?: DecimalWire;
  readonly currentRatio?: DecimalWire;
  readonly beta?: DecimalWire;
  readonly freeFloat?: DecimalWire;
  readonly eps?: DecimalWire;
  readonly bookValuePerShare?: DecimalWire;
  readonly dividendYield?: DecimalWire;
  readonly payoutRatio?: DecimalWire;
}

export interface PaperFundamentalsResponseDto {
  readonly ticker: string;
  readonly available: boolean;
  readonly snapshot: FundamentalSnapshotDto | null;
}

export interface SessionPaperFundamentalsDto {
  readonly paperId: string;
  readonly ticker: string;
  readonly name: string;
  readonly sector: string;
  readonly available: boolean;
  readonly snapshot: FundamentalSnapshotDto | null;
}

export interface SessionFundamentalsResponseDto {
  readonly hiddenByBlindMode: boolean;
  readonly asOfDate?: string | null;
  readonly items?: readonly SessionPaperFundamentalsDto[] | null;
}

function parseDecimal(value: DecimalWire): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

export function mapSnapshotDto(dto: FundamentalSnapshotDto): PaperFundamentals {
  return {
    ticker: dto.ticker,
    reportDate: dto.reportDate ?? null,
    availableAt: dto.availableAt ?? null,
    periodType: dto.periodType ?? null,
    currency: dto.currency ?? 'RUB',
    marketCapRub: parseDecimal(dto.marketCapRub),
    peRatio: parseDecimal(dto.peRatio),
    pbRatio: parseDecimal(dto.pbRatio),
    psRatio: parseDecimal(dto.psRatio),
    evEbitda: parseDecimal(dto.evEbitda),
    roe: parseDecimal(dto.roe),
    roa: parseDecimal(dto.roa),
    grossMargin: parseDecimal(dto.grossMargin),
    operatingMargin: parseDecimal(dto.operatingMargin),
    netMargin: parseDecimal(dto.netMargin),
    revenueGrowthYoy: parseDecimal(dto.revenueGrowthYoy),
    epsGrowthYoy: parseDecimal(dto.epsGrowthYoy),
    debtToEquity: parseDecimal(dto.debtToEquity),
    currentRatio: parseDecimal(dto.currentRatio),
    beta: parseDecimal(dto.beta),
    freeFloat: parseDecimal(dto.freeFloat),
    eps: parseDecimal(dto.eps),
    bookValuePerShare: parseDecimal(dto.bookValuePerShare),
    dividendYield: parseDecimal(dto.dividendYield),
    payoutRatio: parseDecimal(dto.payoutRatio),
  };
}

@Injectable({ providedIn: 'root' })
export class HttpFundamentalsApi implements FundamentalsApi {
  private readonly http = inject(HttpClient);

  async getPaperFundamentals(ticker: string): Promise<PaperFundamentals | null> {
    const encoded = encodeURIComponent(ticker.trim().toUpperCase());
    try {
      const res = await firstValueFrom(
        this.http.get<PaperFundamentalsResponseDto>(`/api/v1/papers/${encoded}/fundamentals`),
      );
      if (!res || !res.available || !res.snapshot) {
        return null;
      }
      return mapSnapshotDto(res.snapshot);
    } catch (err) {
      if (err instanceof HttpErrorResponse && (err.status === 404 || err.status === 204)) {
        return null;
      }
      throw err;
    }
  }

  async getSessionFundamentals(sessionId: string): Promise<SessionFundamentalsResponse> {
    const encoded = encodeURIComponent(sessionId);
    const res = await firstValueFrom(
      this.http.get<SessionFundamentalsResponseDto>(`/api/v1/sessions/${encoded}/fundamentals`),
    );
    if (res?.hiddenByBlindMode) {
      return {
        hiddenByBlindMode: true,
        asOfDate: null,
        items: [],
      };
    }

    const items: SessionPaperFundamentalsItem[] = (res?.items ?? []).map((item) => ({
      paperId: item.paperId,
      ticker: item.ticker,
      name: item.name,
      sector: item.sector,
      available: Boolean(item.available && item.snapshot),
      snapshot: item.available && item.snapshot ? mapSnapshotDto(item.snapshot) : null,
    }));

    return {
      hiddenByBlindMode: false,
      asOfDate: res?.asOfDate ?? null,
      items,
    };
  }
}

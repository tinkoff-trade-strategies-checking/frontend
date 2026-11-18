import { InjectionToken } from '@angular/core';

export const WORKSHOP_DEFAULT_PAGE_SIZE = 20;
export const WORKSHOP_MAX_PAGE_SIZE = 100;
export const WORKSHOP_COMPARE_LIMIT = 5;
export const WORKSHOP_SYSTEM_AUTHOR = 'Эталон платформы';

export type WorkshopSortField = 'published_desc' | 'name_asc' | 'author_asc';

export type WorkshopLicense = 'MIT';

export type WorkshopVisibility = 'public' | 'hidden';

export interface WorkshopLinterWarning {
  readonly code: string;
  readonly line: number;
  readonly message: string;
}

/** INV-5: опубликованные версии алгоритма неизменяемы. */
export interface WorkshopAlgorithmVersion {
  readonly version: number;
  readonly publishedAt: string;
  readonly summary: string;
  readonly immutable: true;
}

export interface WorkshopAlgorithmSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly author: string;
  readonly isMine: boolean;
  readonly isSystem: boolean;
  readonly visibility: WorkshopVisibility;
  readonly latestVersion: number;
  readonly publishedAt: string;
  readonly license: WorkshopLicense;
  readonly linterWarnings: readonly WorkshopLinterWarning[];
}

export interface WorkshopAlgorithmDetail extends WorkshopAlgorithmSummary {
  readonly versions: readonly WorkshopAlgorithmVersion[];
}

export type WorkshopDetailResult =
  | { readonly status: 'READY'; readonly algorithm: WorkshopAlgorithmDetail }
  | { readonly status: 'NOT_FOUND' };

export interface WorkshopQuery {
  readonly sort?: WorkshopSortField;
  readonly author?: string;
  readonly mineOnly?: boolean;
  readonly cleanOnly?: boolean;
  readonly search?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface WorkshopPage {
  readonly items: readonly WorkshopAlgorithmSummary[];
  readonly authors: readonly string[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface WorkshopApi {
  list(query?: WorkshopQuery): Promise<WorkshopPage>;
  getById(id: string): Promise<WorkshopDetailResult>;
}

export const WORKSHOP_API = new InjectionToken<WorkshopApi>('WORKSHOP_API');

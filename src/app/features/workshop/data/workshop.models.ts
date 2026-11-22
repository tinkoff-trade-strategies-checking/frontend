import { InjectionToken } from '@angular/core';

export const WORKSHOP_DEFAULT_PAGE_SIZE = 20;
export const WORKSHOP_MAX_PAGE_SIZE = 100;
export const WORKSHOP_COMPARE_LIMIT = 5;
export const WORKSHOP_SYSTEM_AUTHOR = 'Эталон платформы';

export type WorkshopSortField = 'published_desc' | 'name_asc' | 'author_asc';

export type WorkshopLicense = 'MIT';

export type WorkshopVisibility = 'public' | 'hidden';

export type DslStaticErrorCode = 'E-SYN' | 'E-TYPE' | 'E-BEC' | 'E-LA01' | 'E-LA02';
export type DslStaticWarningCode = 'L001' | 'W-LA01';
export type DslRuntimeDiagnosticCode = 'E-RT01' | 'W-RT01' | 'W-RT02';
export type DslDiagnosticCode =
  DslStaticErrorCode | DslStaticWarningCode | DslRuntimeDiagnosticCode;

export interface WorkshopLinterWarning {
  readonly code: DslStaticWarningCode | (string & {});
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

export interface WorkshopAuthorOption {
  readonly id: string;
  readonly name: string;
}

export interface WorkshopAlgorithmSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly authorId: string;
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
  readonly authorId?: string | null;
  readonly mineOnly?: boolean;
  readonly cleanOnly?: boolean;
  readonly search?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface WorkshopPage {
  readonly items: readonly WorkshopAlgorithmSummary[];
  readonly authors: readonly WorkshopAuthorOption[];
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

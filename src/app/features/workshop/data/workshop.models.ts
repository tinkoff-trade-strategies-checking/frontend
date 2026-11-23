import { InjectionToken } from '@angular/core';
import { TextEdit } from './apply-text-edits';

export const WORKSHOP_DEFAULT_PAGE_SIZE = 20;
export const WORKSHOP_MAX_PAGE_SIZE = 100;
export const WORKSHOP_COMPARE_LIMIT = 5;
export const WORKSHOP_SYSTEM_AUTHOR = 'Эталон платформы';

export type WorkshopSortField = 'published_desc' | 'name_asc' | 'author_asc';

export type WorkshopLicense = 'MIT';

export type WorkshopVisibility = 'public' | 'hidden';

export type CheckLevel = 'OK' | 'WARNING' | 'ERROR';

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

export interface DiagnosticFix {
  readonly description: string;
  readonly edits: readonly TextEdit[];
}

export interface StrategyDiagnostic {
  readonly code: string;
  readonly level: CheckLevel;
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
  readonly message: string;
  readonly fixes: readonly DiagnosticFix[];
}

export interface StrategyParamDecl {
  readonly name: string;
  readonly defaultValue: number;
  readonly rangeMin: number | null;
  readonly rangeMax: number | null;
  readonly step: string | null;
  readonly integer: boolean;
}

export interface CheckStrategyResult {
  readonly lookaheadLevel: CheckLevel;
  readonly diagnostics: readonly StrategyDiagnostic[];
  readonly params: readonly StrategyParamDecl[];
}

/** INV-5: опубликованные версии алгоритма неизменяемы. */
export interface WorkshopAlgorithmVersion {
  readonly id?: string;
  readonly version: number;
  readonly publishedAt: string;
  readonly summary: string;
  readonly immutable: true;
  readonly source?: string;
  readonly lookaheadLevel?: CheckLevel;
  readonly diagnostics?: readonly StrategyDiagnostic[];
  readonly params?: readonly StrategyParamDecl[];
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
  readonly latestVersionId?: string | null;
  readonly publishedAt: string | null;
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

export interface WorkshopDraft {
  readonly strategyId: string;
  readonly name: string;
  readonly description: string;
  readonly source: string;
  readonly updatedAt: string;
  readonly check: CheckStrategyResult | null;
}

export interface CreateWorkshopAlgorithmCommand {
  readonly name: string;
  readonly description?: string;
  readonly source: string;
}

export interface SaveWorkshopDraftCommand {
  readonly name?: string | null;
  readonly description?: string | null;
  readonly source?: string | null;
}

export interface CheckWorkshopStrategyCommand {
  readonly source: string;
  readonly paramOverrides?: Readonly<Record<string, number>>;
}

export interface PublishWorkshopAlgorithmCommand {
  readonly summary?: string;
  readonly source?: string | null;
}

export type PublishWorkshopResult =
  | { readonly ok: true; readonly version: WorkshopAlgorithmVersion }
  | {
      readonly ok: false;
      readonly code: 'STRATEGY_INVALID';
      readonly lookaheadLevel: CheckLevel;
      readonly diagnostics: readonly StrategyDiagnostic[];
    };

export interface ForkWorkshopAlgorithmCommand {
  readonly version?: number | null;
  readonly name?: string | null;
  readonly description?: string | null;
}

export interface WorkshopApi {
  list(query?: WorkshopQuery): Promise<WorkshopPage>;
  getById(id: string): Promise<WorkshopDetailResult>;
  createAlgorithm(command: CreateWorkshopAlgorithmCommand): Promise<WorkshopDraft>;
  getDraft(id: string): Promise<WorkshopDraft>;
  saveDraft(id: string, command: SaveWorkshopDraftCommand): Promise<WorkshopDraft>;
  check(command: CheckWorkshopStrategyCommand): Promise<CheckStrategyResult>;
  publish(id: string, command?: PublishWorkshopAlgorithmCommand): Promise<PublishWorkshopResult>;
  fork(id: string, command?: ForkWorkshopAlgorithmCommand): Promise<WorkshopDraft>;
  setVisibility(id: string, visibility: WorkshopVisibility): Promise<WorkshopAlgorithmSummary>;
  deleteAlgorithm(id: string): Promise<void>;
}

export const WORKSHOP_API = new InjectionToken<WorkshopApi>('WORKSHOP_API');

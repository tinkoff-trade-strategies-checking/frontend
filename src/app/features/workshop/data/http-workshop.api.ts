import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Api } from '../../../api/api';
import { checkWorkshopStrategy } from '../../../api/fn/workshop/check-workshop-strategy';
import { createWorkshopAlgorithm } from '../../../api/fn/workshop/create-workshop-algorithm';
import { forkWorkshopAlgorithm } from '../../../api/fn/workshop/fork-workshop-algorithm';
import { getWorkshopAlgorithm } from '../../../api/fn/workshop/get-workshop-algorithm';
import { getWorkshopDraft } from '../../../api/fn/workshop/get-workshop-draft';
import { listWorkshopAlgorithms } from '../../../api/fn/workshop/list-workshop-algorithms';
import { publishWorkshopAlgorithm } from '../../../api/fn/workshop/publish-workshop-algorithm';
import { saveWorkshopDraft } from '../../../api/fn/workshop/save-workshop-draft';
import { updateWorkshopVisibility } from '../../../api/fn/workshop/update-workshop-visibility';
import { WorkshopAlgorithmDetail as ApiWorkshopDetail } from '../../../api/models/workshop-algorithm-detail';
import { WorkshopAlgorithmSummary as ApiWorkshopSummary } from '../../../api/models/workshop-algorithm-summary';
import { WorkshopAlgorithmVersion as ApiWorkshopVersion } from '../../../api/models/workshop-algorithm-version';
import { WorkshopDetailResult as ApiWorkshopDetailResult } from '../../../api/models/workshop-detail-result';
import { WorkshopDraft as ApiWorkshopDraft } from '../../../api/models/workshop-draft';
import { toProblem } from '../../../core/api-problem';
import {
  CheckLevel,
  CheckStrategyResult,
  CheckWorkshopStrategyCommand,
  CreateWorkshopAlgorithmCommand,
  ForkWorkshopAlgorithmCommand,
  PublishWorkshopAlgorithmCommand,
  PublishWorkshopResult,
  SaveWorkshopDraftCommand,
  StrategyDiagnostic,
  WORKSHOP_DEFAULT_PAGE_SIZE,
  WorkshopAlgorithmDetail,
  WorkshopAlgorithmSummary,
  WorkshopAlgorithmVersion,
  WorkshopApi,
  WorkshopDetailResult,
  WorkshopDraft,
  WorkshopPage,
  WorkshopQuery,
  WorkshopVisibility,
} from './workshop.models';

function parseProblemObject(error: unknown): Record<string, unknown> {
  if (!(error instanceof HttpErrorResponse)) {
    return {};
  }
  let raw: unknown = error.error;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
}

function parseCheckLevel(raw: unknown): CheckLevel {
  return raw === 'OK' || raw === 'WARNING' || raw === 'ERROR' ? raw : 'ERROR';
}

function parseDiagnostics(raw: unknown): readonly StrategyDiagnostic[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (item): item is StrategyDiagnostic =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as { code?: unknown }).code === 'string' &&
      typeof (item as { message?: unknown }).message === 'string',
  );
}

function mapVersion(v: ApiWorkshopVersion): WorkshopAlgorithmVersion {
  return {
    id: v.id,
    version: v.version,
    publishedAt: v.publishedAt,
    summary: v.summary,
    immutable: v.immutable,
    source: v.source,
    lookaheadLevel: v.lookaheadLevel,
    diagnostics: v.diagnostics,
    params: v.params,
  };
}

function mapSummary(s: ApiWorkshopSummary): WorkshopAlgorithmSummary {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    authorId: s.authorId,
    author: s.author,
    isMine: s.isMine,
    isSystem: s.isSystem,
    visibility: s.visibility,
    latestVersion: s.latestVersion,
    latestVersionId: s.latestVersionId ?? null,
    publishedAt: s.publishedAt,
    license: s.license,
    linterWarnings: s.linterWarnings,
  };
}

function mapDetail(d: ApiWorkshopDetail): WorkshopAlgorithmDetail {
  return {
    ...mapSummary(d),
    versions: d.versions.map(mapVersion),
  };
}

function mapDraft(d: ApiWorkshopDraft): WorkshopDraft {
  return {
    strategyId: d.strategyId,
    name: d.name,
    description: d.description,
    source: d.source,
    updatedAt: d.updatedAt,
    check: d.check,
  };
}

function mapDetailResult(res: ApiWorkshopDetailResult): WorkshopDetailResult {
  return res.status === 'READY'
    ? { status: 'READY', algorithm: mapDetail(res.algorithm) }
    : { status: 'NOT_FOUND' };
}

@Injectable()
export class HttpWorkshopApi implements WorkshopApi {
  private readonly api = inject(Api);

  async list(query: WorkshopQuery = {}): Promise<WorkshopPage> {
    const search = query.search?.trim();
    const page = await this.api.invoke(listWorkshopAlgorithms, {
      sort: query.sort,
      authorId: query.authorId ?? undefined,
      mineOnly: query.mineOnly || undefined,
      cleanOnly: query.cleanOnly || undefined,
      search: search ? search.slice(0, 100) : undefined,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? WORKSHOP_DEFAULT_PAGE_SIZE,
    });
    return {
      items: page.items.map(mapSummary),
      authors: page.authors,
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      totalPages: page.totalPages,
    };
  }

  async getById(id: string): Promise<WorkshopDetailResult> {
    return mapDetailResult(await this.api.invoke(getWorkshopAlgorithm, { id }));
  }

  async createAlgorithm(command: CreateWorkshopAlgorithmCommand): Promise<WorkshopDraft> {
    return mapDraft(await this.api.invoke(createWorkshopAlgorithm, { body: command }));
  }

  async getDraft(id: string): Promise<WorkshopDraft> {
    return mapDraft(await this.api.invoke(getWorkshopDraft, { id }));
  }

  async saveDraft(id: string, command: SaveWorkshopDraftCommand): Promise<WorkshopDraft> {
    return mapDraft(await this.api.invoke(saveWorkshopDraft, { id, body: command }));
  }

  async check(command: CheckWorkshopStrategyCommand): Promise<CheckStrategyResult> {
    return this.api.invoke(checkWorkshopStrategy, {
      body: {
        source: command.source,
        paramOverrides: command.paramOverrides ? { ...command.paramOverrides } : undefined,
      },
    });
  }

  async publish(
    id: string,
    command: PublishWorkshopAlgorithmCommand = {},
  ): Promise<PublishWorkshopResult> {
    try {
      const version = await this.api.invoke(publishWorkshopAlgorithm, { id, body: command });
      return { ok: true, version: mapVersion(version) };
    } catch (error) {
      const problem = toProblem(error);
      if (problem.status === 422 && problem.code === 'STRATEGY_INVALID') {
        const body = parseProblemObject(error);
        return {
          ok: false,
          code: 'STRATEGY_INVALID',
          lookaheadLevel: parseCheckLevel(body['lookaheadLevel']),
          diagnostics: parseDiagnostics(body['diagnostics']),
        };
      }
      throw error;
    }
  }

  async fork(id: string, command: ForkWorkshopAlgorithmCommand = {}): Promise<WorkshopDraft> {
    return mapDraft(await this.api.invoke(forkWorkshopAlgorithm, { id, body: command }));
  }

  async setVisibility(
    id: string,
    visibility: WorkshopVisibility,
  ): Promise<WorkshopAlgorithmSummary> {
    return mapSummary(
      await this.api.invoke(updateWorkshopVisibility, { id, body: { visibility } }),
    );
  }
}

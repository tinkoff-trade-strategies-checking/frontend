import { computed, DestroyRef, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { errorMessage } from '../../core/api-problem';
import { HISTORY_API, HistoryEntryFinished } from '../history/data/history.models';
import { LaunchRejectMessage } from '../launch/launch.format';
import { ReportMetrics, ReportRegime, ReportTimeframe } from '../report/data/report.models';
import {
  AlgoRunReport,
  CreateCompareRunsCommand,
  RUNS_API,
  RunEquityPoint,
  RunStatus,
} from '../runs/data/runs.models';
import { WORKSHOP_API, WORKSHOP_COMPARE_LIMIT } from './data/workshop.models';
import { formatRunRejection } from './workshop.format';

export const COMPARE_POLL_INTERVAL_MS = new InjectionToken<number>('COMPARE_POLL_INTERVAL_MS', {
  providedIn: 'root',
  factory: () => 800,
});

export const COMPARE_SERIES_COLORS: readonly string[] = [
  'var(--tui-chart-categorical-21, var(--tui-text-action))',
  'var(--tui-chart-categorical-22, var(--tui-text-positive))',
  'var(--tui-chart-categorical-08, var(--tui-text-negative))',
  'var(--tui-chart-categorical-10, var(--tui-text-secondary))',
  'var(--tui-chart-categorical-06, var(--tui-text-tertiary))',
];

export interface CompareChartSeries {
  readonly id: string;
  readonly name: string;
  readonly colorVar: string;
  readonly initialCapitalRub: number;
  readonly points: readonly RunEquityPoint[];
}

export type ComparedWorkshopItem =
  | {
      readonly status: 'ready';
      readonly id: string;
      readonly name: string;
      readonly author: string;
      readonly latestVersion: number;
      readonly runId: string;
      readonly report: AlgoRunReport;
    }
  | {
      readonly status: 'no_run';
      readonly id: string;
      readonly name: string;
      readonly author: string;
      readonly latestVersion: number;
    }
  | {
      readonly status: 'not_found';
      readonly id: string;
    };

export interface BatchRunProgress {
  readonly algorithmId: string;
  readonly algorithmName: string;
  readonly runId: string;
  readonly status: RunStatus;
  readonly doneSteps: number;
  readonly totalSteps: number | null;
  readonly errorCode: string | null;
}

export interface SharedCompareContext {
  readonly periodLabel: string;
  readonly timeframe: ReportTimeframe;
  readonly regime: ReportRegime;
  readonly totalDays: number;
  readonly papers: readonly string[];
}

export type CompareMetricKey =
  | 'netReturnPct'
  | 'grossReturnPct'
  | 'cagrPct'
  | 'maxDrawdownPct'
  | 'volatilityPct'
  | 'sharpe'
  | 'sortino'
  | 'winRatePct'
  | 'costsTotalRub'
  | 'finalCapitalRub';

const FINISHED_STATUSES = new Set(['completed', 'finished_early', 'bankrupt']);
const TERMINAL_RUN_STATUSES = new Set<RunStatus>(['completed', 'bankrupt', 'invalid', 'failed']);
const MAX_HISTORY_PAGES = 3;
const MAX_REPORT_RETRIES = 10;

export function normalizeCompareIds(rawIds: readonly string[]): readonly string[] {
  return Array.from(new Set(rawIds.map((id) => id.trim()).filter(Boolean))).slice(
    0,
    WORKSHOP_COMPARE_LIMIT,
  );
}

export function normalizeRunIds(rawIds: readonly string[]): readonly string[] {
  return rawIds
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, WORKSHOP_COMPARE_LIMIT);
}

function normalizeName(name: string): string {
  return name
    .replace(/\s*\(черновик\)$/i, '')
    .replace(/\s+v\d+$/i, '')
    .trim()
    .toLowerCase();
}

function isFinishedRun(entry: { kind: string; status: string }): entry is HistoryEntryFinished {
  return entry.kind === 'algo_run' && FINISHED_STATUSES.has(entry.status);
}

function pickBestId(
  items: readonly Extract<ComparedWorkshopItem, { status: 'ready' }>[],
  pick: (m: ReportMetrics) => number | null,
  mode: 'max' | 'min',
): string | null {
  const candidates: { id: string; value: number }[] = [];
  for (const item of items) {
    const val = item.report.metrics ? pick(item.report.metrics) : null;
    if (val !== null && Number.isFinite(val)) {
      candidates.push({ id: item.id, value: val });
    }
  }
  if (candidates.length < 2) {
    return null;
  }
  let best = candidates[0];
  let tie = false;
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i];
    if (Math.abs(c.value - best.value) < 1e-9) {
      tie = true;
    } else if (mode === 'max' ? c.value > best.value : c.value < best.value) {
      best = c;
      tie = false;
    }
  }
  return tie ? null : best.id;
}

@Injectable()
export class WorkshopCompareStore {
  private readonly workshopApi = inject(WORKSHOP_API);
  private readonly historyApi = inject(HISTORY_API);
  private readonly runsApi = inject(RUNS_API);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pollIntervalMs = inject(COMPARE_POLL_INTERVAL_MS);
  private loadSeq = 0;
  private batchSeq = 0;
  private destroyed = false;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly entries = signal<readonly ComparedWorkshopItem[]>([]);
  readonly activeRunIds = signal<readonly string[]>([]);

  readonly batchRunning = signal(false);
  readonly batchProgress = signal<readonly BatchRunProgress[]>([]);
  readonly batchRejection = signal<LaunchRejectMessage | null>(null);
  readonly batchError = signal<string | null>(null);

  readonly readyEntries = computed(() =>
    this.entries().filter(
      (item): item is Extract<ComparedWorkshopItem, { status: 'ready' }> => item.status === 'ready',
    ),
  );

  readonly remainingIds = computed(() => this.entries().map((item) => item.id));

  readonly launchableEntries = computed(() =>
    this.entries().filter(
      (item): item is Exclude<ComparedWorkshopItem, { status: 'not_found' }> =>
        item.status !== 'not_found' && item.latestVersion > 0,
    ),
  );

  readonly launchableIds = computed(() => this.launchableEntries().map((item) => item.id));

  readonly skippedDraftNames = computed(() =>
    this.entries()
      .filter(
        (item): item is Exclude<ComparedWorkshopItem, { status: 'not_found' }> =>
          item.status !== 'not_found' && item.latestVersion === 0,
      )
      .map((item) => item.name),
  );

  readonly hasFailedBatchRuns = computed(() =>
    this.batchProgress().some((p) => p.status === 'failed' || p.status === 'invalid'),
  );

  readonly hasDifferentContexts = computed(() => {
    const ready = this.readyEntries();
    if (ready.length < 2) {
      return false;
    }
    const periods = new Set(ready.map((r) => r.report.period.label));
    const timeframes = new Set(ready.map((r) => r.report.timeframe));
    const papers = new Set(
      ready.map((r) =>
        r.report.papers
          .map((p) => p.ticker)
          .slice()
          .sort()
          .join(','),
      ),
    );
    return periods.size > 1 || timeframes.size > 1 || papers.size > 1;
  });

  readonly sharedContext = computed<SharedCompareContext | null>(() => {
    const ready = this.readyEntries();
    if (ready.length < 2 || this.hasDifferentContexts()) {
      return null;
    }
    const first = ready[0].report;
    return {
      periodLabel: first.period.label,
      timeframe: first.timeframe,
      regime: first.regime,
      totalDays: first.totalDays,
      papers: first.papers.map((p) => p.ticker),
    };
  });

  readonly chartSeries = computed<readonly CompareChartSeries[]>(() =>
    this.readyEntries()
      .filter((item) => item.report.equityCurve.length > 0)
      .map((item, idx) => ({
        id: item.id,
        name: item.name,
        colorVar: COMPARE_SERIES_COLORS[idx % COMPARE_SERIES_COLORS.length],
        initialCapitalRub:
          item.report.metrics?.initialCapitalRub ?? item.report.equityCurve[0].capitalRub,
        points: item.report.equityCurve,
      })),
  );

  readonly bestByMetric = computed<Readonly<Record<CompareMetricKey, string | null>>>(() => {
    const ready = this.readyEntries();
    return {
      netReturnPct: pickBestId(ready, (m) => m.netReturnPct, 'max'),
      grossReturnPct: pickBestId(ready, (m) => m.grossReturnPct, 'max'),
      cagrPct: pickBestId(ready, (m) => m.cagrPct, 'max'),
      maxDrawdownPct: pickBestId(ready, (m) => m.maxDrawdownPct, 'min'),
      volatilityPct: pickBestId(ready, (m) => m.volatilityPct, 'min'),
      sharpe: pickBestId(ready, (m) => m.sharpe, 'max'),
      sortino: pickBestId(ready, (m) => m.sortino, 'max'),
      winRatePct: pickBestId(ready, (m) => m.winRatePct, 'max'),
      costsTotalRub: pickBestId(ready, (m) => m.costsRub.totalRub, 'min'),
      finalCapitalRub: pickBestId(ready, (m) => m.finalCapitalRub, 'max'),
    };
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.loadSeq++;
      this.batchSeq++;
    });
  }

  async load(rawIds: readonly string[], rawRunIds: readonly string[] = []): Promise<void> {
    if (this.destroyed) {
      return;
    }
    const ids = normalizeCompareIds(rawIds);
    const runIds = normalizeRunIds(rawRunIds);
    const seq = ++this.loadSeq;
    this.batchSeq++;
    this.error.set(null);
    this.batchError.set(null);
    this.batchRejection.set(null);
    this.batchProgress.set([]);
    this.batchRunning.set(false);

    if (ids.length === 0) {
      this.entries.set([]);
      this.activeRunIds.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    try {
      if (runIds.length > 0) {
        await this.loadWithExplicitRunIds(seq, ids, runIds);
        return;
      }

      const [details, historyRuns] = await Promise.all([
        Promise.all(ids.map((id) => this.workshopApi.getById(id))),
        this.loadFinishedRuns(),
      ]);
      if (this.destroyed || seq !== this.loadSeq) {
        return;
      }

      const items = await Promise.all(
        details.map(async (detail, index): Promise<ComparedWorkshopItem> => {
          const id = ids[index];
          if (detail.status !== 'READY') {
            return { status: 'not_found', id };
          }
          const algo = detail.algorithm;
          const targetName = normalizeName(algo.name);
          const matchedRun = historyRuns.find(
            (entry) => entry.algoName !== null && normalizeName(entry.algoName) === targetName,
          );
          if (!matchedRun) {
            return {
              status: 'no_run',
              id: algo.id,
              name: algo.name,
              author: algo.author,
              latestVersion: algo.latestVersion,
            };
          }
          const reportRes = await this.runsApi.getRunReport(matchedRun.id);
          if (reportRes.status !== 'READY') {
            return {
              status: 'no_run',
              id: algo.id,
              name: algo.name,
              author: algo.author,
              latestVersion: algo.latestVersion,
            };
          }
          return {
            status: 'ready',
            id: algo.id,
            name: algo.name,
            author: algo.author,
            latestVersion: algo.latestVersion,
            runId: matchedRun.id,
            report: reportRes.report,
          };
        }),
      );

      if (this.destroyed || seq !== this.loadSeq) {
        return;
      }
      this.entries.set(items);
      this.activeRunIds.set([]);
    } catch (err) {
      if (!this.destroyed && seq === this.loadSeq) {
        this.entries.set([]);
        this.activeRunIds.set([]);
        this.error.set(errorMessage(err, 'Не удалось загрузить данные для сравнения.'));
      }
    } finally {
      if (!this.destroyed && seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  async launchBatch(
    payload: Omit<CreateCompareRunsCommand, 'algorithmIds'>,
  ): Promise<readonly string[] | null> {
    if (this.destroyed) {
      return null;
    }
    const launchable = this.launchableEntries();
    if (launchable.length < 2) {
      return null;
    }

    const bSeq = ++this.batchSeq;
    this.batchError.set(null);
    this.batchRejection.set(null);
    this.batchRunning.set(true);

    try {
      const result = await this.runsApi.createCompareRuns({
        ...payload,
        algorithmIds: launchable.map((item) => item.id),
      });
      if (this.destroyed || bSeq !== this.batchSeq) {
        return null;
      }

      if (!result.accepted) {
        this.batchRunning.set(false);
        this.batchRejection.set(formatRunRejection(result));
        return null;
      }

      const nameById = new Map(launchable.map((item) => [item.id, item.name]));
      const initialProgress: BatchRunProgress[] = result.runs.map((run) => ({
        algorithmId: run.algorithmId,
        algorithmName: nameById.get(run.algorithmId) ?? run.algorithmName,
        runId: run.runId,
        status: run.status,
        doneSteps: 0,
        totalSteps: result.window.durationDays,
        errorCode: null,
      }));
      this.batchProgress.set(initialProgress);

      const finalProgress = await this.pollBatchUntilTerminal(bSeq, initialProgress);
      if (this.destroyed || bSeq !== this.batchSeq) {
        return null;
      }

      await this.applyBatchReports(bSeq, finalProgress);
      if (this.destroyed || bSeq !== this.batchSeq) {
        return null;
      }

      const runIds = result.runs.map((r) => r.runId);
      this.activeRunIds.set(runIds);
      this.batchRunning.set(false);
      return runIds;
    } catch (err) {
      if (!this.destroyed && bSeq === this.batchSeq) {
        this.batchRunning.set(false);
        this.batchError.set(
          errorMessage(err, 'Не удалось запустить совместный прогон алгоритмов.'),
        );
      }
      return null;
    }
  }

  removeAlgorithm(id: string): readonly string[] {
    const next = this.entries().filter((item) => item.id !== id);
    this.entries.set(next);
    if (this.activeRunIds().length > 0) {
      const nextRunIds = next
        .filter(
          (item): item is Extract<ComparedWorkshopItem, { status: 'ready' }> =>
            item.status === 'ready',
        )
        .map((item) => item.runId);
      this.activeRunIds.set(nextRunIds);
    }
    return next.map((item) => item.id);
  }

  private async loadWithExplicitRunIds(
    seq: number,
    ids: readonly string[],
    runIds: readonly string[],
  ): Promise<void> {
    const details = await Promise.all(ids.map((id) => this.workshopApi.getById(id)));
    if (this.destroyed || seq !== this.loadSeq) {
      return;
    }

    const baseItems: ComparedWorkshopItem[] = details.map((detail, index) => {
      const id = ids[index];
      if (detail.status !== 'READY') {
        return { status: 'not_found', id };
      }
      const algo = detail.algorithm;
      return {
        status: 'no_run',
        id: algo.id,
        name: algo.name,
        author: algo.author,
        latestVersion: algo.latestVersion,
      };
    });

    const pairTargets =
      runIds.length === ids.length
        ? baseItems.map((item, index) => ({ item, runId: runIds[index] ?? null }))
        : (() => {
            let runIdx = 0;
            return baseItems.map((item) => {
              if (item.status !== 'not_found' && item.latestVersion > 0 && runIdx < runIds.length) {
                return { item, runId: runIds[runIdx++] };
              }
              return { item, runId: null };
            });
          })();

    const paired = pairTargets.filter(
      (p): p is { item: Exclude<ComparedWorkshopItem, { status: 'not_found' }>; runId: string } =>
        p.item.status !== 'not_found' && p.runId !== null,
    );

    const infos = await Promise.all(
      paired.map(async ({ item, runId }): Promise<BatchRunProgress> => {
        try {
          const info = await this.runsApi.getRun(runId);
          return {
            algorithmId: item.id,
            algorithmName: item.name,
            runId,
            status: info.status,
            doneSteps: info.doneSteps,
            totalSteps: info.totalSteps,
            errorCode: info.errorCode,
          };
        } catch {
          return {
            algorithmId: item.id,
            algorithmName: item.name,
            runId,
            status: 'failed',
            doneSteps: 0,
            totalSteps: null,
            errorCode: 'NOT_FOUND',
          };
        }
      }),
    );

    if (this.destroyed || seq !== this.loadSeq) {
      return;
    }

    this.entries.set(baseItems);
    this.activeRunIds.set(runIds);

    const anyPending = infos.some((info) => !TERMINAL_RUN_STATUSES.has(info.status));
    if (anyPending) {
      const bSeq = ++this.batchSeq;
      this.batchProgress.set(infos);
      this.batchRunning.set(true);
      this.loading.set(false);

      const finalProgress = await this.pollBatchUntilTerminal(bSeq, infos);
      if (this.destroyed || bSeq !== this.batchSeq || seq !== this.loadSeq) {
        return;
      }
      await this.applyBatchReports(bSeq, finalProgress);
      if (!this.destroyed && bSeq === this.batchSeq) {
        this.batchRunning.set(false);
      }
      return;
    }

    const bSeq = ++this.batchSeq;
    if (infos.some((i) => i.status === 'failed' || i.status === 'invalid')) {
      this.batchProgress.set(infos);
    }
    await this.applyBatchReports(bSeq, infos);
  }

  private async pollBatchUntilTerminal(
    bSeq: number,
    initial: readonly BatchRunProgress[],
  ): Promise<readonly BatchRunProgress[]> {
    let current = [...initial];
    while (!this.destroyed && bSeq === this.batchSeq) {
      const allDone = current.every((item) => TERMINAL_RUN_STATUSES.has(item.status));
      if (allDone) {
        return current;
      }
      await this.delay(this.pollIntervalMs);
      if (this.destroyed || bSeq !== this.batchSeq) {
        return current;
      }

      current = await Promise.all(
        current.map(async (item): Promise<BatchRunProgress> => {
          if (TERMINAL_RUN_STATUSES.has(item.status)) {
            return item;
          }
          try {
            const info = await this.runsApi.getRun(item.runId);
            return {
              ...item,
              status: info.status,
              doneSteps: info.doneSteps,
              totalSteps: info.totalSteps,
              errorCode: info.errorCode,
            };
          } catch {
            return {
              ...item,
              status: 'failed',
              errorCode: 'POLL_ERROR',
            };
          }
        }),
      );

      if (!this.destroyed && bSeq === this.batchSeq) {
        this.batchProgress.set(current);
      }
    }
    return current;
  }

  private async applyBatchReports(
    bSeq: number,
    progress: readonly BatchRunProgress[],
  ): Promise<void> {
    const reportsByAlgo = new Map<string, { runId: string; report: AlgoRunReport }>();

    await Promise.all(
      progress.map(async (item) => {
        if (item.status !== 'completed' && item.status !== 'bankrupt') {
          return;
        }
        const report = await this.fetchReportWithRetry(bSeq, item.runId);
        if (report) {
          reportsByAlgo.set(item.algorithmId, { runId: item.runId, report });
        }
      }),
    );

    if (this.destroyed || bSeq !== this.batchSeq) {
      return;
    }

    this.entries.update((prev) =>
      prev.map((entry): ComparedWorkshopItem => {
        if (entry.status === 'not_found') {
          return entry;
        }
        const matched = reportsByAlgo.get(entry.id);
        if (!matched) {
          return entry;
        }
        return {
          status: 'ready',
          id: entry.id,
          name: entry.name,
          author: entry.author,
          latestVersion: entry.latestVersion,
          runId: matched.runId,
          report: matched.report,
        };
      }),
    );
  }

  private async fetchReportWithRetry(bSeq: number, runId: string): Promise<AlgoRunReport | null> {
    for (let attempt = 0; attempt < MAX_REPORT_RETRIES; attempt++) {
      if (this.destroyed || bSeq !== this.batchSeq) {
        return null;
      }
      const res = await this.runsApi.getRunReport(runId);
      if (res.status === 'READY') {
        return res.report;
      }
      if (res.status !== 'BUILDING') {
        return null;
      }
      await this.delay(Math.min(this.pollIntervalMs, 500));
    }
    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async loadFinishedRuns(): Promise<HistoryEntryFinished[]> {
    const runs: HistoryEntryFinished[] = [];
    for (let page = 1; page <= MAX_HISTORY_PAGES; page++) {
      const res = await this.historyApi.list({ kind: 'algo_run', page, pageSize: 100 });
      for (const item of res.items) {
        if (isFinishedRun(item)) {
          runs.push(item);
        }
      }
      if (page >= res.totalPages) {
        break;
      }
    }
    return runs;
  }
}

import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { errorMessage } from '../../core/api-problem';
import { HISTORY_API, HistoryEntryFinished } from '../history/data/history.models';
import { ReportMetrics } from '../report/data/report.models';
import { AlgoRunReport, RUNS_API, RunEquityPoint } from '../runs/data/runs.models';
import { WORKSHOP_API, WORKSHOP_COMPARE_LIMIT } from './data/workshop.models';

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
const MAX_HISTORY_PAGES = 3;

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
  private loadSeq = 0;
  private destroyed = false;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly entries = signal<readonly ComparedWorkshopItem[]>([]);

  readonly readyEntries = computed(() =>
    this.entries().filter(
      (item): item is Extract<ComparedWorkshopItem, { status: 'ready' }> => item.status === 'ready',
    ),
  );

  readonly remainingIds = computed(() => this.entries().map((item) => item.id));

  readonly hasDifferentContexts = computed(() => {
    const ready = this.readyEntries();
    if (ready.length < 2) {
      return false;
    }
    const periods = new Set(ready.map((r) => r.report.period.label));
    const papers = new Set(
      ready.map((r) =>
        r.report.papers
          .map((p) => p.ticker)
          .slice()
          .sort()
          .join(','),
      ),
    );
    return periods.size > 1 || papers.size > 1;
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
    });
  }

  async load(rawIds: readonly string[]): Promise<void> {
    if (this.destroyed) {
      return;
    }
    const ids = Array.from(new Set(rawIds.map((id) => id.trim()).filter(Boolean))).slice(
      0,
      WORKSHOP_COMPARE_LIMIT,
    );
    const seq = ++this.loadSeq;
    this.error.set(null);

    if (ids.length === 0) {
      this.entries.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    try {
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
    } catch (err) {
      if (!this.destroyed && seq === this.loadSeq) {
        this.error.set(errorMessage(err, 'Не удалось загрузить данные для сравнения.'));
      }
    } finally {
      if (!this.destroyed && seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  removeAlgorithm(id: string): readonly string[] {
    const next = this.entries().filter((item) => item.id !== id);
    this.entries.set(next);
    return next.map((item) => item.id);
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

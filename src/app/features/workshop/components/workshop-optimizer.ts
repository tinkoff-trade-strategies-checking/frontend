import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  OnInit,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiDay } from '@taiga-ui/cdk';
import { TuiButton, TuiNotification, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge, TuiInputDate, TuiSegmented } from '@taiga-ui/kit';
import { Subscription } from 'rxjs';
import { errorMessage } from '../../../core/api-problem';
import { PaperPicker } from '../../../shared/paper-picker/paper-picker';
import {
  CandleTimeframe,
  LAUNCH_API,
  LaunchCustomPaper,
  LaunchOptions,
  MarketRegime,
  REGIME_LABELS,
  SessionDurationDays,
  TIMEFRAME_LABELS,
} from '../../launch/data/launch.models';
import { formatDrawdown, formatPct, formatRatio } from '../../report/report.format';
import { RUNS_API, RunStatus } from '../../runs/data/runs.models';
import {
  StrategyParamDecl,
  WorkshopAlgorithmDetail,
  WorkshopAlgorithmVersion,
} from '../data/workshop.models';
import { formatRunRejection } from '../workshop.format';

export const MAX_OPTIMIZER_COMBINATIONS = 12;
export const OPTIMIZER_BATCH_SIZE = 2;
const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set([
  'completed',
  'bankrupt',
  'invalid',
  'failed',
]);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type OptimizerSortKey = 'netReturnPct' | 'maxDrawdownPct' | 'sharpe' | 'tradesCount';
export type OptimizerSortDir = 'asc' | 'desc';

export interface OptimizerResultRow {
  readonly id: string;
  readonly params: Readonly<Record<string, number>>;
  readonly status: 'completed' | 'failed';
  readonly runId: string | null;
  readonly netReturnPct: number | null;
  readonly maxDrawdownPct: number | null;
  readonly sharpe: number | null;
  readonly tradesCount: number | null;
  readonly error: string | null;
}

function parseStep(param: StrategyParamDecl): number | null {
  if (param.step !== null) {
    const parsed = Number(param.step);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return param.integer ? 1 : null;
}

function roundToPrecision(value: number, step: number | null, integer: boolean): number {
  if (integer) {
    return Math.round(value);
  }
  if (step !== null && step > 0) {
    const decimals = Math.max(0, Math.min(6, Math.ceil(-Math.log10(step))));
    return Number(value.toFixed(decimals));
  }
  return Math.round(value * 1000) / 1000;
}

/**
 * Генерирует от 1 до count равномерно распределённых значений параметра в допустимом диапазоне,
 * с учётом шага, целочисленности и дедупликации.
 */
export function generateParamValues(param: StrategyParamDecl, count: number): readonly number[] {
  const targetCount = Math.max(1, Math.min(5, Math.round(count)));
  const step = parseStep(param);
  const fallbackSpan =
    param.defaultValue !== 0 ? Math.abs(param.defaultValue) * 0.5 : (step ?? 1) * 4;

  let lo = param.rangeMin ?? param.defaultValue - fallbackSpan;
  let hi = param.rangeMax ?? param.defaultValue + fallbackSpan;
  if (param.rangeMin !== null && param.rangeMax === null) {
    hi = Math.max(lo + (step ?? 1) * (targetCount - 1), param.defaultValue * 2 || lo + 10);
  } else if (param.rangeMax !== null && param.rangeMin === null) {
    lo = Math.min(hi - (step ?? 1) * (targetCount - 1), param.defaultValue * 0.5);
  }
  if (hi < lo) {
    [lo, hi] = [hi, lo];
  }
  if (hi === lo) {
    return [roundToPrecision(lo, step, param.integer)];
  }

  const raw: number[] = [];
  for (let i = 0; i < targetCount; i++) {
    const t = targetCount === 1 ? 0.5 : i / (targetCount - 1);
    let val = lo + (hi - lo) * t;
    if (step !== null && step > 0) {
      const origin = param.rangeMin ?? lo;
      val = origin + Math.round((val - origin) / step) * step;
    }
    if (param.rangeMin !== null) {
      val = Math.max(param.rangeMin, val);
    }
    if (param.rangeMax !== null) {
      val = Math.min(param.rangeMax, val);
    }
    raw.push(roundToPrecision(val, step, param.integer));
  }

  return Array.from(new Set(raw)).sort((a, b) => a - b);
}

/**
 * Строит сетку комбинаций для 1 или 2 выбранных параметров.
 * Остальные параметры фиксируются на defaultValue.
 * Строго ограничивает итоговое число комбинаций до MAX_OPTIMIZER_COMBINATIONS (12).
 */
export function buildParamGrid(
  params: readonly StrategyParamDecl[],
  selectedNames: readonly string[],
  pointsPerParam = 3,
): readonly Readonly<Record<string, number>>[] {
  const chosen = selectedNames
    .slice(0, 2)
    .map((name) => params.find((p) => p.name === name))
    .filter((p): p is StrategyParamDecl => p !== undefined);

  if (chosen.length === 0) {
    return [];
  }

  const base: Record<string, number> = {};
  for (const param of params) {
    base[param.name] = param.defaultValue;
  }

  if (chosen.length === 1) {
    const vals = generateParamValues(chosen[0], Math.min(5, Math.max(3, pointsPerParam)));
    return vals.slice(0, MAX_OPTIMIZER_COMBINATIONS).map((v) => ({
      ...base,
      [chosen[0].name]: v,
    }));
  }

  const clampedPoints = Math.min(5, Math.max(3, pointsPerParam));
  const countA = Math.min(4, clampedPoints);
  const countB = Math.max(
    1,
    Math.min(clampedPoints, Math.floor(MAX_OPTIMIZER_COMBINATIONS / countA)),
  );
  const valsA = generateParamValues(chosen[0], countA);
  const valsB = generateParamValues(chosen[1], countB);

  const grid: Readonly<Record<string, number>>[] = [];
  for (const a of valsA) {
    for (const b of valsB) {
      if (grid.length >= MAX_OPTIMIZER_COMBINATIONS) {
        return grid;
      }
      grid.push({
        ...base,
        [chosen[0].name]: a,
        [chosen[1].name]: b,
      });
    }
  }
  return grid;
}

export function sortOptimizerResults(
  rows: readonly OptimizerResultRow[],
  key: OptimizerSortKey,
  dir: OptimizerSortDir,
): readonly OptimizerResultRow[] {
  const mult = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (va === null && vb === null) {
      return a.id.localeCompare(b.id);
    }
    if (va === null) {
      return 1;
    }
    if (vb === null) {
      return -1;
    }
    if (va === vb) {
      return a.id.localeCompare(b.id);
    }
    return (va - vb) * mult;
  });
}

export function findBestOptimizerResult(
  rows: readonly OptimizerResultRow[],
): OptimizerResultRow | null {
  const completed = rows.filter((r) => r.status === 'completed' && r.netReturnPct !== null);
  if (completed.length === 0) {
    return null;
  }
  return completed.reduce((best, cur) => {
    if ((cur.netReturnPct ?? -Infinity) > (best.netReturnPct ?? -Infinity)) {
      return cur;
    }
    if (cur.netReturnPct === best.netReturnPct) {
      const curSharpe = cur.sharpe ?? -Infinity;
      const bestSharpe = best.sharpe ?? -Infinity;
      if (curSharpe > bestSharpe) {
        return cur;
      }
      if (
        curSharpe === bestSharpe &&
        (cur.maxDrawdownPct ?? Infinity) < (best.maxDrawdownPct ?? Infinity)
      ) {
        return cur;
      }
    }
    return best;
  });
}

export function formatParamsSummary(
  params: Readonly<Record<string, number>>,
  selectedNames: readonly string[],
): string {
  const keys = selectedNames.length > 0 ? selectedNames : Object.keys(params);
  return keys.map((k) => `${k} = ${params[k]}`).join(', ');
}

function parseIsoDay(isoDate: string): TuiDay | null {
  if (!ISO_DATE_RE.test(isoDate)) {
    return null;
  }
  try {
    return TuiDay.jsonParse(isoDate);
  } catch {
    return null;
  }
}

@Component({
  selector: 'app-workshop-optimizer',
  imports: [
    FormsModule,
    PaperPicker,
    TuiBadge,
    TuiButton,
    TuiInputDate,
    TuiNotification,
    TuiSegmented,
    TuiTextfield,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workshop-optimizer.html',
  styleUrl: './workshop-optimizer.less',
})
export class WorkshopOptimizer implements OnInit {
  private readonly launchApi = inject(LAUNCH_API);
  private readonly runsApi = inject(RUNS_API);
  private readonly destroyRef = inject(DestroyRef);

  private runSeq = 0;
  private activeSubs = new Set<Subscription>();
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  readonly algorithm = input.required<WorkshopAlgorithmDetail>();
  readonly closed = output<void>();
  readonly applyParams = output<Readonly<Record<string, number>>>();

  protected readonly maxCombinations = MAX_OPTIMIZER_COMBINATIONS;
  protected readonly pointsOptions: readonly number[] = [3, 4, 5];
  protected readonly timeframeLabels = TIMEFRAME_LABELS;
  protected readonly regimeLabels = REGIME_LABELS;
  protected readonly formatPct = formatPct;
  protected readonly formatDrawdown = formatDrawdown;
  protected readonly formatRatio = formatRatio;

  protected readonly loading = signal(false);
  protected readonly loadingPapers = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly options = signal<LaunchOptions | null>(null);
  protected readonly availablePapers = signal<readonly LaunchCustomPaper[]>([]);

  protected readonly selectedParamNames = signal<readonly string[]>([]);
  protected readonly pointsPerParam = signal<number>(3);
  protected readonly durationDays = signal<SessionDurationDays>(60);
  protected readonly timeframe = signal<CandleTimeframe>('1d');
  protected readonly regime = signal<MarketRegime>('medium');
  protected readonly customStartDate = signal('2020-02-26');
  protected readonly selectedPaperIds = signal<readonly string[]>([]);
  protected readonly initialCapitalRub = signal<number>(1_000_000);

  protected readonly running = signal(false);
  protected readonly cancelled = signal(false);
  protected readonly completedCount = signal(0);
  protected readonly totalCount = signal(0);
  protected readonly results = signal<readonly OptimizerResultRow[]>([]);
  protected readonly sortKey = signal<OptimizerSortKey>('netReturnPct');
  protected readonly sortDir = signal<OptimizerSortDir>('desc');
  protected readonly copiedRowId = signal<string | null>(null);

  protected readonly latestVersion = computed<WorkshopAlgorithmVersion | null>(() => {
    const algo = this.algorithm();
    const published = algo.versions.filter((v) => v.version > 0);
    return published.find((v) => v.version === algo.latestVersion) ?? published[0] ?? null;
  });

  protected readonly availableParams = computed<readonly StrategyParamDecl[]>(
    () => this.latestVersion()?.params ?? [],
  );

  protected readonly previewGrid = computed<readonly Readonly<Record<string, number>>[]>(() =>
    buildParamGrid(this.availableParams(), this.selectedParamNames(), this.pointsPerParam()),
  );

  protected readonly customStartDay = computed<TuiDay | null>(() =>
    parseIsoDay(this.customStartDate()),
  );

  protected readonly sortedResults = computed<readonly OptimizerResultRow[]>(() =>
    sortOptimizerResults(this.results(), this.sortKey(), this.sortDir()),
  );

  protected readonly bestResult = computed<OptimizerResultRow | null>(() =>
    findBestOptimizerResult(this.results()),
  );

  protected readonly progressPct = computed<number>(() => {
    const total = this.totalCount();
    if (total <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((this.completedCount() / total) * 100));
  });

  protected readonly canStart = computed(() => {
    const opts = this.options();
    if (!opts || !this.latestVersion() || this.running()) {
      return false;
    }
    if (this.previewGrid().length === 0) {
      return false;
    }
    return (
      Boolean(this.customStartDate().trim()) && this.selectedPaperIds().length >= opts.minPapers
    );
  });

  constructor() {
    effect(() => {
      const params = this.availableParams();
      untracked(() => {
        if (params.length > 0 && this.selectedParamNames().length === 0) {
          this.selectedParamNames.set([params[0].name]);
        }
      });
    });

    this.destroyRef.onDestroy(() => {
      this.cancelRun();
      if (this.copyTimer !== null) {
        clearTimeout(this.copyTimer);
        this.copyTimer = null;
      }
    });
  }

  ngOnInit(): void {
    void this.loadSetup();
  }

  protected async loadSetup(): Promise<void> {
    this.loading.set(true);
    this.loadingPapers.set(true);
    this.error.set(null);
    try {
      const [opts, papers] = await Promise.all([
        this.launchApi.getLaunchOptions(),
        this.launchApi.getAvailablePapers(),
      ]);
      this.options.set(opts);
      this.durationDays.set(opts.defaultDuration);
      this.timeframe.set(opts.defaultTimeframe);
      this.regime.set(opts.defaultRegime);
      this.initialCapitalRub.set(opts.defaultCapitalRub);
      this.availablePapers.set(papers);
      const count = Math.max(opts.minPapers, Math.min(opts.defaultPaperCount, papers.length));
      this.selectedPaperIds.set(papers.slice(0, count).map((p) => p.id));
    } catch (err) {
      this.error.set(errorMessage(err, 'Не удалось загрузить параметры подбора.'));
    } finally {
      this.loading.set(false);
      this.loadingPapers.set(false);
    }
  }

  protected isParamSelected(name: string): boolean {
    return this.selectedParamNames().includes(name);
  }

  protected toggleParam(name: string): void {
    if (this.running()) {
      return;
    }
    const current = this.selectedParamNames();
    if (current.includes(name)) {
      this.selectedParamNames.set(current.filter((n) => n !== name));
      return;
    }
    if (current.length >= 2) {
      return;
    }
    this.selectedParamNames.set([...current, name]);
  }

  protected paramPreviewText(param: StrategyParamDecl): string {
    const selected = this.selectedParamNames();
    const count =
      selected.length === 2
        ? selected[0] === param.name
          ? Math.min(4, this.pointsPerParam())
          : Math.min(
              this.pointsPerParam(),
              Math.floor(MAX_OPTIMIZER_COMBINATIONS / Math.min(4, this.pointsPerParam())),
            )
        : this.pointsPerParam();
    return generateParamValues(param, count).join(', ');
  }

  protected optionIndex<T>(items: readonly T[], current: T): number {
    return Math.max(0, items.indexOf(current));
  }

  protected onPointsIndexChange(index: number): void {
    const next = this.pointsOptions[index];
    if (next !== undefined) {
      this.pointsPerParam.set(next);
    }
  }

  protected onDurationIndexChange(durations: readonly SessionDurationDays[], index: number): void {
    const next = durations[index];
    if (next !== undefined) {
      this.durationDays.set(next);
    }
  }

  protected onTimeframeIndexChange(timeframes: readonly CandleTimeframe[], index: number): void {
    const next = timeframes[index];
    if (next !== undefined) {
      this.timeframe.set(next);
    }
  }

  protected onRegimeIndexChange(regimes: readonly MarketRegime[], index: number): void {
    const next = regimes[index];
    if (next !== undefined) {
      this.regime.set(next);
    }
  }

  protected onCustomStartDayChange(day: TuiDay | null): void {
    this.customStartDate.set(day ? day.toJSON() : '');
  }

  protected onSelectedPaperIdsChange(ids: readonly string[]): void {
    this.selectedPaperIds.set(Array.from(new Set(ids)));
  }

  protected setSort(key: OptimizerSortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'maxDrawdownPct' ? 'asc' : 'desc');
    }
  }

  protected formatRowParams(row: OptimizerResultRow): string {
    return formatParamsSummary(row.params, this.selectedParamNames());
  }

  protected async startOptimization(): Promise<void> {
    const version = this.latestVersion();
    const grid = this.previewGrid();
    if (!version || grid.length === 0 || !this.canStart()) {
      return;
    }

    const seq = ++this.runSeq;
    this.running.set(true);
    this.cancelled.set(false);
    this.error.set(null);
    this.results.set([]);
    this.completedCount.set(0);
    this.totalCount.set(grid.length);

    const strategyVersionId = version.id ?? `${this.algorithm().id}-v${version.version}`;
    const capitalStr = this.initialCapitalRub().toFixed(2);
    const startDate = this.customStartDate().trim();
    const paperIds = [...this.selectedPaperIds()];
    const durationDays = this.durationDays();
    const timeframe = this.timeframe();
    const regime = this.regime();

    try {
      for (let i = 0; i < grid.length; i += OPTIMIZER_BATCH_SIZE) {
        if (seq !== this.runSeq) {
          return;
        }
        const batch = grid.slice(i, i + OPTIMIZER_BATCH_SIZE);
        const batchRows = await Promise.all(
          batch.map((combo, offset) =>
            this.executeCombination(
              `combo-${i + offset + 1}`,
              strategyVersionId,
              combo,
              {
                durationDays,
                timeframe,
                regime,
                customStartDate: startDate,
                paperIds,
                initialCapital: capitalStr,
              },
              seq,
            ),
          ),
        );
        if (seq !== this.runSeq) {
          return;
        }
        const validRows = batchRows.filter((row): row is OptimizerResultRow => row !== null);
        this.results.update((prev) => [...prev, ...validRows]);
        this.completedCount.update((c) => c + validRows.length);
      }
    } finally {
      if (seq === this.runSeq) {
        this.running.set(false);
      }
    }
  }

  protected cancelRun(): void {
    if (!this.running()) {
      return;
    }
    this.runSeq++;
    for (const sub of this.activeSubs) {
      sub.unsubscribe();
    }
    this.activeSubs.clear();
    this.cancelled.set(true);
    this.running.set(false);
  }

  protected close(): void {
    this.cancelRun();
    this.closed.emit();
  }

  protected onApply(row: OptimizerResultRow): void {
    this.applyParams.emit(row.params);
  }

  protected async copyParams(row: OptimizerResultRow): Promise<void> {
    if (!navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(row.params, null, 2));
      this.copiedRowId.set(row.id);
      if (this.copyTimer !== null) {
        clearTimeout(this.copyTimer);
      }
      this.copyTimer = setTimeout(() => {
        this.copiedRowId.set(null);
        this.copyTimer = null;
      }, 2000);
    } catch {
      this.copiedRowId.set(null);
    }
  }

  private async executeCombination(
    id: string,
    strategyVersionId: string,
    paramOverrides: Readonly<Record<string, number>>,
    windowConfig: {
      readonly durationDays: SessionDurationDays;
      readonly timeframe: CandleTimeframe;
      readonly regime: MarketRegime;
      readonly customStartDate: string;
      readonly paperIds: readonly string[];
      readonly initialCapital: string;
    },
    seq: number,
  ): Promise<OptimizerResultRow | null> {
    try {
      const created = await this.runsApi.createRun({
        strategyVersionId,
        paramOverrides,
        blind: false,
        durationDays: windowConfig.durationDays,
        timeframe: windowConfig.timeframe,
        regime: windowConfig.regime,
        startMode: 'custom',
        customStartDate: windowConfig.customStartDate,
        paperCount: null,
        paperIds: windowConfig.paperIds,
        initialCapital: windowConfig.initialCapital,
      });
      if (seq !== this.runSeq) {
        return null;
      }
      if (!created.accepted) {
        const rej = formatRunRejection(created);
        return this.failedRow(id, paramOverrides, null, rej.title);
      }

      const runId = created.runId;
      const finalStatus = await this.waitForRunCompletion(runId, seq);
      if (seq !== this.runSeq) {
        return null;
      }
      if (finalStatus === 'invalid' || finalStatus === 'failed') {
        return this.failedRow(
          id,
          paramOverrides,
          runId,
          `Прогон завершился со статусом ${finalStatus}.`,
        );
      }

      const reportRes = await this.runsApi.getRunReport(runId);
      if (seq !== this.runSeq) {
        return null;
      }
      if (reportRes.status !== 'READY' || !reportRes.report.metrics) {
        return this.failedRow(id, paramOverrides, runId, 'Отчёт прогона недоступен.');
      }

      const m = reportRes.report.metrics;
      return {
        id,
        params: paramOverrides,
        status: 'completed',
        runId,
        netReturnPct: m.netReturnPct,
        maxDrawdownPct: m.maxDrawdownPct,
        sharpe: m.sharpe,
        tradesCount: m.tradesCount,
        error: null,
      };
    } catch (err) {
      if (seq !== this.runSeq) {
        return null;
      }
      return this.failedRow(
        id,
        paramOverrides,
        null,
        errorMessage(err, 'Ошибка выполнения комбинации.'),
      );
    }
  }

  private async waitForRunCompletion(runId: string, seq: number): Promise<RunStatus> {
    const initial = await this.runsApi.getRun(runId);
    if (TERMINAL_STATUSES.has(initial.status) || seq !== this.runSeq) {
      return initial.status;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          clearInterval(pollTimer);
          sub?.unsubscribe();
          if (sub) {
            this.activeSubs.delete(sub);
          }
          resolve();
        }
      };

      let sub: Subscription | null = null;
      try {
        const stream = this.runsApi.events(runId, null);
        sub = stream.subscribe({
          next: (ev) => {
            if (
              ev.type === 'report_ready' ||
              ev.type === 'run_finished' ||
              ev.type === 'stream_failed'
            ) {
              finish();
            }
          },
          error: () => finish(),
          complete: () => finish(),
        });
        this.activeSubs.add(sub);
      } catch {
        // Fallback to getRun polling below.
      }

      const pollTimer = setInterval(() => {
        if (seq !== this.runSeq) {
          finish();
          return;
        }
        void this.runsApi
          .getRun(runId)
          .then((info) => {
            if (TERMINAL_STATUSES.has(info.status)) {
              finish();
            }
          })
          .catch(() => finish());
      }, 400);
    });

    if (seq !== this.runSeq) {
      return 'failed';
    }
    const finalInfo = await this.runsApi.getRun(runId);
    return finalInfo.status;
  }

  private failedRow(
    id: string,
    params: Readonly<Record<string, number>>,
    runId: string | null,
    err: string,
  ): OptimizerResultRow {
    return {
      id,
      params,
      status: 'failed',
      runId,
      netReturnPct: null,
      maxDrawdownPct: null,
      sharpe: null,
      tradesCount: null,
      error: err,
    };
  }
}

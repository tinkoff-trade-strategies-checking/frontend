import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TuiDay } from '@taiga-ui/cdk';
import { TuiButton, TuiCheckbox, TuiInput, TuiNotification, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge, TuiInputDate, TuiInputNumber, TuiSegmented, TuiSelect } from '@taiga-ui/kit';
import { errorMessage } from '../../../core/api-problem';
import { PaperPicker } from '../../../shared/paper-picker/paper-picker';
import {
  buildPaperCountPresets,
  CandleTimeframe,
  LAUNCH_API,
  LaunchCustomPaper,
  LaunchOptions,
  MarketRegime,
  MAX_INITIAL_CAPITAL_RUB,
  MIN_INITIAL_CAPITAL_RUB,
  REGIME_LABELS,
  SessionDurationDays,
  StartMode,
  TIMEFRAME_LABELS,
} from '../../launch/data/launch.models';
import { formatRub, LaunchRejectMessage } from '../../launch/launch.format';
import { RUNS_API } from '../../runs/data/runs.models';
import {
  StrategyParamDecl,
  WorkshopAlgorithmDetail,
  WorkshopAlgorithmVersion,
} from '../data/workshop.models';
import { formatRunRejection, validateStrategyParam } from '../workshop.format';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  selector: 'app-workshop-run-form',
  imports: [
    FormsModule,
    PaperPicker,
    TuiBadge,
    TuiButton,
    TuiCheckbox,
    TuiInput,
    TuiInputDate,
    TuiInputNumber,
    TuiNotification,
    TuiSegmented,
    TuiSelect,
    TuiTextfield,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workshop-run-form.html',
  styleUrl: './workshop-run-form.less',
})
export class WorkshopRunForm implements OnInit {
  private readonly launchApi = inject(LAUNCH_API);
  private readonly runsApi = inject(RUNS_API);
  private readonly router = inject(Router);
  private papersLoadSeq = 0;

  readonly algorithm = input.required<WorkshopAlgorithmDetail>();
  readonly initialParams = input<Readonly<Record<string, number>> | null>(null);
  readonly closed = output<void>();

  protected readonly loading = signal(false);
  protected readonly loadingPapers = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly rejection = signal<LaunchRejectMessage | null>(null);
  protected readonly options = signal<LaunchOptions | null>(null);
  protected readonly availablePapers = signal<readonly LaunchCustomPaper[]>([]);

  protected readonly selectedVersionNumber = signal<number>(1);
  protected readonly paramValues = signal<Readonly<Record<string, number | null>>>({});
  protected readonly durationDays = signal<SessionDurationDays>(60);
  protected readonly timeframe = signal<CandleTimeframe>('1d');
  protected readonly regime = signal<MarketRegime>('medium');
  protected readonly startMode = signal<StartMode>('random');
  protected readonly customStartDate = signal('2020-02-26');
  protected readonly paperCount = signal(3);
  protected readonly selectedPaperIds = signal<readonly string[]>([]);
  protected readonly initialCapitalRub = signal<number | null>(1_000_000);
  protected readonly blind = signal(false);

  protected readonly minCapital = MIN_INITIAL_CAPITAL_RUB;
  protected readonly maxCapital = MAX_INITIAL_CAPITAL_RUB;
  protected readonly timeframeLabels = TIMEFRAME_LABELS;
  protected readonly regimeLabels = REGIME_LABELS;
  protected readonly formatRub = formatRub;
  protected readonly versionStringify = (version: number): string => `v${version}`;

  protected readonly publishedVersions = computed<readonly WorkshopAlgorithmVersion[]>(() =>
    this.algorithm().versions.filter((v) => v.version > 0),
  );

  protected readonly versionNumbers = computed<readonly number[]>(() =>
    this.publishedVersions().map((v) => v.version),
  );

  protected readonly selectedVersion = computed<WorkshopAlgorithmVersion | null>(() => {
    const versions = this.publishedVersions();
    const num = this.selectedVersionNumber();
    return versions.find((v) => v.version === num) ?? versions[0] ?? null;
  });

  protected readonly selectedParams = computed<readonly StrategyParamDecl[]>(
    () => this.selectedVersion()?.params ?? [],
  );

  protected readonly paramErrors = computed<Readonly<Record<string, string | null>>>(() => {
    const values = this.paramValues();
    const errors: Record<string, string | null> = {};
    for (const param of this.selectedParams()) {
      errors[param.name] = validateStrategyParam(param, values[param.name] ?? null);
    }
    return errors;
  });

  protected readonly hasParamErrors = computed(() =>
    Object.values(this.paramErrors()).some((err) => err !== null),
  );

  protected readonly customStartDay = computed<TuiDay | null>(() =>
    parseIsoDay(this.customStartDate()),
  );

  protected readonly paperCountOptions = computed<readonly number[]>(() => {
    const opts = this.options();
    if (!opts) {
      return [];
    }
    return buildPaperCountPresets(opts.minPapers, opts.maxPapers);
  });

  protected readonly capitalError = computed<string | null>(() => {
    const value = this.initialCapitalRub();
    if (value === null || !Number.isFinite(value)) {
      return 'Введите начальный капитал.';
    }
    if (value < MIN_INITIAL_CAPITAL_RUB || value > MAX_INITIAL_CAPITAL_RUB) {
      return 'Начальный капитал — от 10 000 до 100 000 000 ₽.';
    }
    if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
      return 'Начальный капитал — не более двух знаков после запятой.';
    }
    return null;
  });

  protected readonly pairExceedsLimit = computed(() =>
    this.isPairDisabled(this.durationDays(), this.timeframe()),
  );

  protected readonly canSubmit = computed(() => {
    const opts = this.options();
    const version = this.selectedVersion();
    if (!opts || !version || this.capitalError() !== null || this.hasParamErrors()) {
      return false;
    }
    if (this.pairExceedsLimit()) {
      return false;
    }
    if (this.startMode() === 'random') {
      return this.paperCount() >= opts.minPapers && this.paperCount() <= opts.maxPapers;
    }
    return (
      Boolean(this.customStartDate().trim()) && this.selectedPaperIds().length >= opts.minPapers
    );
  });

  constructor() {
    effect(() => {
      const algo = this.algorithm();
      const preset = this.initialParams();
      untracked(() => {
        const versions = algo.versions.filter((v) => v.version > 0);
        const defaultNum =
          versions.find((v) => v.version === algo.latestVersion)?.version ??
          versions[0]?.version ??
          1;
        this.selectedVersionNumber.set(defaultNum);
        this.syncParamsFromVersion(
          versions.find((v) => v.version === defaultNum) ?? versions[0] ?? null,
          preset,
        );
      });
    });
  }

  ngOnInit(): void {
    void this.loadOptions();
  }

  protected async loadOptions(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const opts = await this.launchApi.getLaunchOptions();
      this.options.set(opts);
      this.durationDays.set(opts.defaultDuration);
      this.timeframe.set(opts.defaultTimeframe);
      this.regime.set(opts.defaultRegime);
      this.initialCapitalRub.set(opts.defaultCapitalRub);
      this.paperCount.set(opts.defaultPaperCount);
    } catch (error) {
      this.error.set(errorMessage(error, 'Не удалось загрузить параметры запуска.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected isPairDisabled(days: SessionDurationDays, tf: CandleTimeframe): boolean {
    const opts = this.options();
    if (!opts) {
      return false;
    }
    const limits = opts.runMaxDurationDaysByTimeframe ?? opts.maxDurationDaysByTimeframe;
    const maxDays = limits[tf];
    return maxDays !== undefined && days > maxDays;
  }

  protected runLimitHint(opts: LaunchOptions): string {
    const maxBars = opts.executionRules.runMaxBars ?? opts.executionRules.maxBars;
    return `больше ${maxBars.toLocaleString('ru-RU')} свечей`;
  }

  protected optionIndex<T>(items: readonly T[], current: T): number {
    return Math.max(0, items.indexOf(current));
  }

  protected onVersionChange(versionNum: number | null): void {
    if (versionNum === null) {
      return;
    }
    this.selectedVersionNumber.set(versionNum);
    this.rejection.set(null);
    this.syncParamsFromVersion(this.selectedVersion());
  }

  protected onParamValueChange(name: string, raw: number | string | null): void {
    const numeric = raw === null || raw === '' ? null : typeof raw === 'number' ? raw : Number(raw);
    this.paramValues.update((prev) => ({
      ...prev,
      [name]: numeric !== null && Number.isFinite(numeric) ? numeric : null,
    }));
    this.rejection.set(null);
  }

  protected onDurationIndexChange(durations: readonly SessionDurationDays[], index: number): void {
    const next = durations[index];
    if (next !== undefined) {
      this.durationDays.set(next);
      this.rejection.set(null);
    }
  }

  protected onTimeframeIndexChange(timeframes: readonly CandleTimeframe[], index: number): void {
    const next = timeframes[index];
    if (next !== undefined) {
      this.timeframe.set(next);
      this.rejection.set(null);
    }
  }

  protected onRegimeIndexChange(regimes: readonly MarketRegime[], index: number): void {
    const next = regimes[index];
    if (next !== undefined) {
      this.regime.set(next);
      this.rejection.set(null);
    }
  }

  protected async onStartModeIndexChange(index: number): Promise<void> {
    const mode: StartMode = index === 1 ? 'custom' : 'random';
    this.startMode.set(mode);
    this.rejection.set(null);

    if (mode === 'random') {
      this.papersLoadSeq++;
      this.loadingPapers.set(false);
      this.selectedPaperIds.set([]);
      this.availablePapers.set([]);
      return;
    }

    const seq = ++this.papersLoadSeq;
    this.loadingPapers.set(true);
    try {
      const papers = await this.launchApi.getAvailablePapers();
      if (seq !== this.papersLoadSeq || this.startMode() !== 'custom') {
        return;
      }
      this.availablePapers.set(papers);
      const minCount = this.options()?.minPapers ?? 1;
      const defaultCount = Math.max(minCount, Math.min(this.paperCount(), papers.length));
      this.selectedPaperIds.set(papers.slice(0, defaultCount).map((p) => p.id));
    } catch (error) {
      if (seq === this.papersLoadSeq) {
        this.error.set(errorMessage(error, 'Не удалось загрузить список бумаг.'));
      }
    } finally {
      if (seq === this.papersLoadSeq) {
        this.loadingPapers.set(false);
      }
    }
  }

  protected onCustomStartDayChange(day: TuiDay | null): void {
    this.customStartDate.set(day ? day.toJSON() : '');
    this.rejection.set(null);
  }

  protected paperCountIndex(counts: readonly number[], current: number): number {
    return counts.indexOf(current);
  }

  protected onPaperCountIndexChange(counts: readonly number[], index: number): void {
    const next = counts[index];
    if (next !== undefined) {
      this.paperCount.set(next);
      this.rejection.set(null);
    }
  }

  protected onCustomPaperCountChange(value: number | null): void {
    if (value !== null && Number.isFinite(value)) {
      this.paperCount.set(Math.round(value));
      this.rejection.set(null);
    }
  }

  protected onSelectedPaperIdsChange(ids: readonly string[]): void {
    this.selectedPaperIds.set(Array.from(new Set(ids)));
    this.rejection.set(null);
  }

  protected capitalIndex(presets: readonly number[], current: number | null): number {
    return current === null ? -1 : presets.indexOf(current);
  }

  protected onCapitalIndexChange(presets: readonly number[], index: number): void {
    const next = presets[index];
    if (next !== undefined) {
      this.initialCapitalRub.set(next);
      this.rejection.set(null);
    }
  }

  protected onCapitalInput(value: number | null): void {
    this.initialCapitalRub.set(value);
    this.rejection.set(null);
  }

  protected onBlindChange(value: boolean): void {
    this.blind.set(value);
    this.rejection.set(null);
  }

  protected formatParamHint(param: StrategyParamDecl): string {
    const parts: string[] = [];
    if (param.rangeMin !== null || param.rangeMax !== null) {
      parts.push(`${param.rangeMin ?? '−∞'}..${param.rangeMax ?? '+∞'}`);
    }
    if (param.step !== null) {
      parts.push(`шаг ${param.step}`);
    }
    if (param.integer) {
      parts.push('целое');
    }
    return parts.join(', ');
  }

  protected async submit(): Promise<void> {
    const version = this.selectedVersion();
    const capital = this.initialCapitalRub();
    if (!version || capital === null || !this.canSubmit() || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.rejection.set(null);

    try {
      const overrides: Record<string, number> = {};
      for (const param of this.selectedParams()) {
        const val = this.paramValues()[param.name];
        if (val !== null && val !== undefined) {
          overrides[param.name] = val;
        }
      }

      const customMode = this.startMode() === 'custom';
      const result = await this.runsApi.createRun({
        strategyVersionId: version.id ?? `${this.algorithm().id}-v${version.version}`,
        paramOverrides: this.selectedParams().length > 0 ? overrides : undefined,
        blind: this.blind(),
        durationDays: this.durationDays(),
        timeframe: this.timeframe(),
        regime: this.regime(),
        startMode: this.startMode(),
        customStartDate: customMode ? this.customStartDate().trim() : null,
        paperCount: customMode ? null : this.paperCount(),
        paperIds: customMode ? this.selectedPaperIds() : null,
        initialCapital: capital.toFixed(2),
      });

      if (!result.accepted) {
        this.rejection.set(formatRunRejection(result));
        return;
      }

      await this.router.navigate(['/runs', result.runId]);
    } catch (error) {
      this.error.set(errorMessage(error, 'Не удалось запустить прогон алгоритма.'));
    } finally {
      this.submitting.set(false);
    }
  }

  private syncParamsFromVersion(
    version: WorkshopAlgorithmVersion | null,
    overrides: Readonly<Record<string, number>> | null = null,
  ): void {
    const next: Record<string, number | null> = {};
    for (const param of version?.params ?? []) {
      const overrideVal = overrides?.[param.name];
      next[param.name] = overrideVal !== undefined ? overrideVal : param.defaultValue;
    }
    this.paramValues.set(next);
  }
}

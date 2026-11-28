import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiDay } from '@taiga-ui/cdk';
import { TuiButton, TuiCheckbox, TuiNotification, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge, TuiInputDate, TuiInputNumber, TuiSegmented } from '@taiga-ui/kit';
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
import { CreateCompareRunsCommand } from '../../runs/data/runs.models';

export type CompareLaunchPayload = Omit<CreateCompareRunsCommand, 'algorithmIds'>;

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
  selector: 'app-workshop-compare-launch',
  imports: [
    FormsModule,
    PaperPicker,
    TuiBadge,
    TuiButton,
    TuiCheckbox,
    TuiInputDate,
    TuiInputNumber,
    TuiNotification,
    TuiSegmented,
    TuiTextfield,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workshop-compare-launch.html',
  styleUrl: './workshop-compare-launch.less',
})
export class WorkshopCompareLaunch implements OnInit {
  private readonly launchApi = inject(LAUNCH_API);
  private papersLoadSeq = 0;

  readonly algorithmCount = input.required<number>();
  readonly skippedDraftNames = input<readonly string[]>([]);
  readonly busy = input(false);
  readonly rejection = input<LaunchRejectMessage | null>(null);
  readonly error = input<string | null>(null);

  readonly launch = output<CompareLaunchPayload>();
  readonly closed = output<void>();

  protected readonly loading = signal(false);
  protected readonly loadingPapers = signal(false);
  protected readonly optionsError = signal<string | null>(null);
  protected readonly options = signal<LaunchOptions | null>(null);
  protected readonly availablePapers = signal<readonly LaunchCustomPaper[]>([]);

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
    if (!opts || this.algorithmCount() < 2 || this.capitalError() !== null || this.busy()) {
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

  protected readonly submitLabel = computed(() => {
    if (this.busy()) {
      return 'Запуск и выполнение…';
    }
    const count = this.algorithmCount();
    const noun = count >= 2 && count <= 4 ? 'алгоритма' : 'алгоритмов';
    return `Запустить ${count} ${noun} на одном отрезке`;
  });

  ngOnInit(): void {
    void this.loadOptions();
  }

  protected async loadOptions(): Promise<void> {
    this.loading.set(true);
    this.optionsError.set(null);
    try {
      const opts = await this.launchApi.getLaunchOptions();
      this.options.set(opts);
      this.durationDays.set(opts.defaultDuration);
      this.timeframe.set(opts.defaultTimeframe);
      this.regime.set(opts.defaultRegime);
      this.initialCapitalRub.set(opts.defaultCapitalRub);
      this.paperCount.set(opts.defaultPaperCount);
    } catch (err) {
      this.optionsError.set(errorMessage(err, 'Не удалось загрузить параметры запуска.'));
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

  protected async onStartModeIndexChange(index: number): Promise<void> {
    const mode: StartMode = index === 1 ? 'custom' : 'random';
    this.startMode.set(mode);

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
    } catch (err) {
      if (seq === this.papersLoadSeq) {
        this.optionsError.set(errorMessage(err, 'Не удалось загрузить список бумаг.'));
      }
    } finally {
      if (seq === this.papersLoadSeq) {
        this.loadingPapers.set(false);
      }
    }
  }

  protected onCustomStartDayChange(day: TuiDay | null): void {
    this.customStartDate.set(day ? day.toJSON() : '');
  }

  protected paperCountIndex(counts: readonly number[], current: number): number {
    return counts.indexOf(current);
  }

  protected onPaperCountIndexChange(counts: readonly number[], index: number): void {
    const next = counts[index];
    if (next !== undefined) {
      this.paperCount.set(next);
    }
  }

  protected onCustomPaperCountChange(value: number | null): void {
    if (value !== null && Number.isFinite(value)) {
      this.paperCount.set(Math.round(value));
    }
  }

  protected onSelectedPaperIdsChange(ids: readonly string[]): void {
    this.selectedPaperIds.set(Array.from(new Set(ids)));
  }

  protected capitalIndex(presets: readonly number[], current: number | null): number {
    return current === null ? -1 : presets.indexOf(current);
  }

  protected onCapitalIndexChange(presets: readonly number[], index: number): void {
    const next = presets[index];
    if (next !== undefined) {
      this.initialCapitalRub.set(next);
    }
  }

  protected onCapitalInput(value: number | null): void {
    this.initialCapitalRub.set(value);
  }

  protected onBlindChange(value: boolean): void {
    this.blind.set(value);
  }

  protected submit(): void {
    const capital = this.initialCapitalRub();
    if (capital === null || !this.canSubmit()) {
      return;
    }
    const customMode = this.startMode() === 'custom';
    this.launch.emit({
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
  }
}

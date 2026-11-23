import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TuiDay } from '@taiga-ui/cdk';
import { TuiButton, TuiNotification, TuiTextfield } from '@taiga-ui/core';
import {
  TuiBadge,
  TuiChevron,
  TuiInputDate,
  TuiInputNumber,
  TuiSegmented,
  TuiSelect,
} from '@taiga-ui/kit';
import {
  CandleTimeframe,
  LAUNCH_API,
  LAUNCH_PRESETS,
  LaunchPreset,
  MAX_INITIAL_CAPITAL_RUB,
  MIN_INITIAL_CAPITAL_RUB,
  REGIME_HINTS,
  REGIME_LABELS,
  SessionDurationDays,
  TIMEFRAME_LABELS,
} from './data/launch.models';
import { LAUNCH_API_IMPL, WORKSHOP_API_IMPL } from '../../api-impls';
import { WORKSHOP_API } from '../workshop/data/workshop.models';
import { formatDecimalRu, formatDisplayDate, formatExecutionPct, formatRub } from './launch.format';
import { LaunchStore } from './launch.store';

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
  selector: 'app-launch-page',
  imports: [
    FormsModule,
    RouterLink,
    TuiButton,
    TuiBadge,
    TuiChevron,
    TuiInputDate,
    TuiInputNumber,
    TuiNotification,
    TuiSegmented,
    TuiSelect,
    TuiTextfield,
  ],
  providers: [
    { provide: LAUNCH_API, useClass: LAUNCH_API_IMPL },
    { provide: WORKSHOP_API, useClass: WORKSHOP_API_IMPL },
    LaunchStore,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './launch-page.html',
  styleUrl: './launch-page.less',
})
export class LaunchPage implements OnInit {
  protected readonly store = inject(LaunchStore);

  protected readonly customStartDay = computed<TuiDay | null>(() =>
    parseIsoDay(this.store.customStartDate()),
  );
  protected readonly backgroundAlgorithmOptions = computed<readonly string[]>(() => [
    '',
    ...this.store.backgroundAlgorithms().map((algo) => algo.id),
  ]);
  protected readonly backgroundAlgorithmLabel = computed<string>(() => {
    const selected = this.store.selectedBackgroundAlgorithm();
    if (selected) {
      return `${selected.name} · v${selected.latestVersion} · ${selected.author}`;
    }
    return this.store.options()?.backgroundAlgorithmName ?? 'Эталон платформы';
  });
  protected readonly backgroundAlgorithmStringify = (algorithmId: string): string => {
    const defaultName = this.store.options()?.backgroundAlgorithmName ?? 'Эталон платформы';
    if (!algorithmId) {
      return `${defaultName} (по умолчанию)`;
    }
    const algo = this.store.backgroundAlgorithms().find((item) => item.id === algorithmId);
    return algo ? `${algo.name} · v${algo.latestVersion} · ${algo.author}` : algorithmId;
  };

  protected readonly presets = LAUNCH_PRESETS;
  protected readonly advancedOpen = signal(false);

  protected readonly minCapital = MIN_INITIAL_CAPITAL_RUB;
  protected readonly maxCapital = MAX_INITIAL_CAPITAL_RUB;
  protected readonly timeframeLabels = TIMEFRAME_LABELS;
  protected readonly regimeLabels = REGIME_LABELS;
  protected readonly regimeHints = REGIME_HINTS;
  protected readonly formatRub = formatRub;
  protected readonly formatExecutionPct = formatExecutionPct;
  protected readonly formatDecimalRu = formatDecimalRu;
  protected readonly formatDisplayDate = formatDisplayDate;

  constructor() {
    effect(() => {
      if (this.store.submitError() || this.store.capitalError() || !this.store.isBlind()) {
        this.advancedOpen.set(true);
      }
    });
  }

  protected selectPreset(preset: LaunchPreset): void {
    this.store.applyPreset(preset);
  }

  protected toggleAdvanced(): void {
    this.advancedOpen.update((open) => !open);
  }

  protected disabledDurations(durations: readonly SessionDurationDays[]): SessionDurationDays[] {
    return durations.filter((d) => this.store.isPairDisabled(d, this.store.timeframe()));
  }

  protected disabledTimeframes(timeframes: readonly CandleTimeframe[]): CandleTimeframe[] {
    return timeframes.filter((tf) => this.store.isPairDisabled(this.store.durationDays(), tf));
  }

  protected labelsOf(timeframes: readonly CandleTimeframe[]): string {
    return timeframes.map((tf) => this.timeframeLabels[tf]).join(', ');
  }

  protected limitHint(maxBars: number): string {
    return `больше ${maxBars.toLocaleString('ru-RU')} свечей`;
  }

  ngOnInit(): void {
    void this.store.init();
  }

  protected durationIndex(durations: readonly number[], current: number): number {
    return Math.max(0, durations.indexOf(current));
  }

  protected onDurationIndexChange(
    durations: readonly (20 | 60 | 120 | 250)[],
    index: number,
  ): void {
    const next = durations[index];
    if (next !== undefined) {
      this.store.setDuration(next);
    }
  }

  protected timeframeIndex(timeframes: readonly string[], current: string): number {
    return Math.max(0, timeframes.indexOf(current));
  }

  protected onTimeframeIndexChange(
    timeframes: readonly ('1m' | '5m' | '10m' | '15m' | '1h' | '1d')[],
    index: number,
  ): void {
    const next = timeframes[index];
    if (next !== undefined) {
      this.store.setTimeframe(next);
    }
  }

  protected regimeIndex(regimes: readonly string[], current: string): number {
    return Math.max(0, regimes.indexOf(current));
  }

  protected onRegimeIndexChange(
    regimes: readonly ('calm' | 'medium' | 'stress')[],
    index: number,
  ): void {
    const next = regimes[index];
    if (next !== undefined) {
      this.store.setRegime(next);
    }
  }

  protected onStartModeIndexChange(index: number): void {
    void this.store.setStartMode(index === 1 ? 'custom' : 'random');
  }

  protected onCustomStartDayChange(day: TuiDay | null): void {
    this.store.setCustomStartDate(day ? day.toJSON() : '');
  }

  protected paperCountIndex(counts: readonly number[], current: number): number {
    return Math.max(0, counts.indexOf(current));
  }

  protected onPaperCountIndexChange(counts: readonly number[], index: number): void {
    const next = counts[index];
    if (next !== undefined) {
      this.store.setPaperCount(next);
    }
  }

  // -1 — своё значение, ни один пресет не выбран.
  protected capitalIndex(presets: readonly number[], current: number | null): number {
    return current === null ? -1 : presets.indexOf(current);
  }

  protected onCapitalIndexChange(presets: readonly number[], index: number): void {
    const next = presets[index];
    if (next !== undefined) {
      this.store.setInitialCapital(next);
    }
  }
}

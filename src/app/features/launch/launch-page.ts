import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiDay } from '@taiga-ui/cdk';
import { TuiButton, TuiNotification } from '@taiga-ui/core';
import { TuiBadge, TuiInputDate, TuiSegmented } from '@taiga-ui/kit';
import { LAUNCH_API, REGIME_HINTS, REGIME_LABELS, TIMEFRAME_LABELS } from './data/launch.models';
import { StubLaunchApi } from './data/stub-launch.api';
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
  imports: [FormsModule, TuiButton, TuiBadge, TuiInputDate, TuiNotification, TuiSegmented],
  providers: [{ provide: LAUNCH_API, useClass: StubLaunchApi }, LaunchStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './launch-page.html',
  styleUrl: './launch-page.less',
})
export class LaunchPage implements OnInit {
  protected readonly store = inject(LaunchStore);

  protected readonly customStartDay = computed<TuiDay | null>(() =>
    parseIsoDay(this.store.customStartDate()),
  );

  protected readonly timeframeLabels = TIMEFRAME_LABELS;
  protected readonly regimeLabels = REGIME_LABELS;
  protected readonly regimeHints = REGIME_HINTS;
  protected readonly formatRub = formatRub;
  protected readonly formatExecutionPct = formatExecutionPct;
  protected readonly formatDecimalRu = formatDecimalRu;
  protected readonly formatDisplayDate = formatDisplayDate;

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

  protected capitalIndex(presets: readonly number[], current: number): number {
    return Math.max(0, presets.indexOf(current));
  }

  protected onCapitalIndexChange(presets: readonly number[], index: number): void {
    const next = presets[index];
    if (next !== undefined) {
      this.store.setInitialCapital(next);
    }
  }
}

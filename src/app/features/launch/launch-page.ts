import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiNotification, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge, TuiSegmented } from '@taiga-ui/kit';
import { LAUNCH_API, REGIME_HINTS, REGIME_LABELS, TIMEFRAME_LABELS } from './data/launch.models';
import { StubLaunchApi } from './data/stub-launch.api';
import { formatExecutionPct, formatRub } from './launch.format';
import { LaunchStore } from './launch.store';

@Component({
  selector: 'app-launch-page',
  imports: [FormsModule, TuiButton, TuiBadge, TuiNotification, TuiSegmented, TuiTextfield],
  providers: [{ provide: LAUNCH_API, useClass: StubLaunchApi }, LaunchStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './launch-page.html',
  styleUrl: './launch-page.less',
})
export class LaunchPage implements OnInit {
  protected readonly store = inject(LaunchStore);

  protected readonly timeframeLabels = TIMEFRAME_LABELS;
  protected readonly regimeLabels = REGIME_LABELS;
  protected readonly regimeHints = REGIME_HINTS;
  protected readonly formatRub = formatRub;
  protected readonly formatExecutionPct = formatExecutionPct;

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
    this.store.setStartMode(index === 1 ? 'custom' : 'random');
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

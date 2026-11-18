import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { formatLaunchRejection, LaunchRejectMessage } from './launch.format';
import {
  CandleTimeframe,
  LAUNCH_API,
  LaunchOptions,
  MarketRegime,
  SessionDurationDays,
  StartMode,
  TraderKind,
} from './data/launch.models';

@Injectable()
export class LaunchStore {
  private readonly api = inject(LAUNCH_API);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly rejection = signal<LaunchRejectMessage | null>(null);
  readonly options = signal<LaunchOptions | null>(null);

  readonly traderKind = signal<TraderKind>('human');
  readonly durationDays = signal<SessionDurationDays>(60);
  readonly timeframe = signal<CandleTimeframe>('1d');
  readonly regime = signal<MarketRegime>('medium');
  readonly startMode = signal<StartMode>('random');
  readonly customStartDate = signal('2020-02-26');
  readonly selectedPaperIds = signal<readonly string[]>(['A', 'B', 'C']);
  readonly initialCapitalRub = signal(1_000_000);

  readonly isBlind = computed(() => this.startMode() === 'random');

  readonly selectedPapers = computed(() => {
    const opts = this.options();
    if (!opts) {
      return [];
    }
    const selected = new Set(this.selectedPaperIds());
    return opts.papers.filter((p) => selected.has(p.id));
  });

  async init(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const opts = await this.api.getLaunchOptions();
      this.options.set(opts);
      this.durationDays.set(opts.defaultDuration);
      this.timeframe.set(opts.defaultTimeframe);
      this.regime.set(opts.defaultRegime);
      this.initialCapitalRub.set(opts.defaultCapitalRub);
      this.selectedPaperIds.set(opts.papers.slice(0, 3).map((p) => p.id));
    } catch {
      this.error.set('Не удалось загрузить параметры запуска.');
    } finally {
      this.loading.set(false);
    }
  }

  setDuration(days: SessionDurationDays): void {
    this.durationDays.set(days);
    this.rejection.set(null);
  }

  setTimeframe(tf: CandleTimeframe): void {
    this.timeframe.set(tf);
    this.rejection.set(null);
  }

  setRegime(regime: MarketRegime): void {
    this.regime.set(regime);
    this.rejection.set(null);
  }

  setStartMode(mode: StartMode): void {
    this.startMode.set(mode);
    this.rejection.set(null);
  }

  setCustomStartDate(date: string): void {
    this.customStartDate.set(date);
    this.rejection.set(null);
  }

  setInitialCapital(amountRub: number): void {
    this.initialCapitalRub.set(amountRub);
    this.rejection.set(null);
  }

  togglePaper(paperId: string): void {
    const opts = this.options();
    const min = opts?.minPapers ?? 1;
    const max = opts?.maxPapers ?? 5;
    const current = this.selectedPaperIds();

    if (current.includes(paperId)) {
      if (current.length <= min) {
        return;
      }
      this.selectedPaperIds.set(current.filter((id) => id !== paperId));
    } else {
      if (current.length >= max) {
        return;
      }
      this.selectedPaperIds.set([...current, paperId]);
    }
    this.rejection.set(null);
  }

  async launch(): Promise<boolean> {
    if (this.submitting()) {
      return false;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.rejection.set(null);

    try {
      const result = await this.api.startSession({
        traderKind: this.traderKind(),
        durationDays: this.durationDays(),
        timeframe: this.timeframe(),
        regime: this.regime(),
        startMode: this.startMode(),
        customStartDate: this.startMode() === 'custom' ? this.customStartDate() : undefined,
        paperIds: this.selectedPaperIds(),
        initialCapitalRub: this.initialCapitalRub(),
      });

      if (!result.accepted) {
        this.rejection.set(
          formatLaunchRejection(result.reason, {
            field: result.field,
            barsCount: result.barsCount,
            maxBars: result.maxBars,
          }),
        );
        return false;
      }

      await this.router.navigate(['/arena']);
      return true;
    } catch {
      this.error.set('Не удалось запустить сессию. Попробуйте ещё раз.');
      return false;
    } finally {
      this.submitting.set(false);
    }
  }
}

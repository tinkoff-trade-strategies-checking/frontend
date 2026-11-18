import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  CandleTimeframe,
  LAUNCH_API,
  LaunchCustomPaper,
  LaunchOptions,
  MarketRegime,
  SessionDurationDays,
  StartMode,
  TraderKind,
} from './data/launch.models';
import { formatLaunchRejection, LaunchRejectMessage } from './launch.format';

@Injectable()
export class LaunchStore {
  private readonly api = inject(LAUNCH_API);
  private readonly router = inject(Router);
  private customPapersLoadSeq = 0;

  readonly loading = signal(false);
  readonly loadingCustomPapers = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly rejection = signal<LaunchRejectMessage | null>(null);
  readonly options = signal<LaunchOptions | null>(null);
  readonly customPapers = signal<readonly LaunchCustomPaper[]>([]);

  readonly traderKind = signal<TraderKind>('human');
  readonly durationDays = signal<SessionDurationDays>(60);
  readonly timeframe = signal<CandleTimeframe>('1d');
  readonly regime = signal<MarketRegime>('medium');
  readonly startMode = signal<StartMode>('random');
  readonly customStartDate = signal('2020-02-26');
  readonly paperCount = signal(3);
  readonly selectedPaperIds = signal<readonly string[]>([]);
  readonly initialCapitalRub = signal(1_000_000);

  readonly isBlind = computed(() => this.startMode() === 'random');

  readonly paperCountOptions = computed<readonly number[]>(() => {
    const opts = this.options();
    if (!opts) {
      return [];
    }
    const counts: number[] = [];
    for (let n = opts.minPapers; n <= opts.maxPapers; n++) {
      counts.push(n);
    }
    return counts;
  });

  readonly selectedCustomPapers = computed(() => {
    const selected = new Set(this.selectedPaperIds());
    return this.customPapers().filter((p) => selected.has(p.id));
  });

  readonly submitBlockHint = computed<string | null>(() => {
    const opts = this.options();
    if (!opts || this.isBlind()) {
      return null;
    }
    if (!this.customStartDate().trim()) {
      return 'Укажите дату начала периода.';
    }
    if (this.selectedPaperIds().length < opts.minPapers) {
      return `Выберите от ${opts.minPapers} до ${opts.maxPapers} бумаг.`;
    }
    return null;
  });

  readonly canSubmit = computed(() => {
    const opts = this.options();
    if (!opts) {
      return false;
    }
    if (this.isBlind()) {
      return this.paperCount() >= opts.minPapers && this.paperCount() <= opts.maxPapers;
    }
    return this.submitBlockHint() === null;
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
      this.paperCount.set(opts.defaultPaperCount);
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

  async setStartMode(mode: StartMode): Promise<void> {
    this.startMode.set(mode);
    this.rejection.set(null);

    if (mode === 'random') {
      this.customPapersLoadSeq++;
      this.loadingCustomPapers.set(false);
      this.selectedPaperIds.set([]);
      this.customPapers.set([]);
      return;
    }

    const seq = ++this.customPapersLoadSeq;
    this.loadingCustomPapers.set(true);
    try {
      const papers = await this.api.getAvailablePapers();
      if (seq !== this.customPapersLoadSeq || this.startMode() !== 'custom') {
        return;
      }
      this.customPapers.set(papers);
      const minCount = this.options()?.minPapers ?? 1;
      const defaultSelection = Math.max(minCount, Math.min(this.paperCount(), papers.length));
      this.selectedPaperIds.set(papers.slice(0, defaultSelection).map((p) => p.id));
    } catch {
      if (seq === this.customPapersLoadSeq) {
        this.error.set('Не удалось загрузить список бумаг.');
      }
    } finally {
      if (seq === this.customPapersLoadSeq) {
        this.loadingCustomPapers.set(false);
      }
    }
  }

  setCustomStartDate(date: string): void {
    this.customStartDate.set(date);
    this.rejection.set(null);
  }

  setPaperCount(count: number): void {
    this.paperCount.set(count);
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
    if (this.submitting() || !this.canSubmit()) {
      return false;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.rejection.set(null);

    try {
      const blind = this.isBlind();
      const result = await this.api.startSession({
        traderKind: this.traderKind(),
        durationDays: this.durationDays(),
        timeframe: this.timeframe(),
        regime: this.regime(),
        startMode: this.startMode(),
        customStartDate: blind ? null : this.customStartDate(),
        paperCount: blind ? this.paperCount() : null,
        paperIds: blind ? null : this.selectedPaperIds(),
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

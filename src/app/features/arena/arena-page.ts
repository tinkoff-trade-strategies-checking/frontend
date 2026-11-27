import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TuiButton, TuiDialogService, TuiNotification } from '@taiga-ui/core';
import { TUI_CONFIRM, TuiBadge } from '@taiga-ui/kit';
import { ArenaStore } from './arena.store';
import { TA_OSCILLATOR_OPTIONS, TaOscillatorId } from './arena-ta';
import { ArenaChart } from './components/arena-chart';
import { ArenaOrderTicket } from './components/arena-order-ticket';
import { ArenaOrdersPanel } from './components/arena-orders-panel';
import { ArenaPaperSwitcher } from './components/arena-paper-switcher';
import { ArenaPlayer } from './components/arena-player';
import { ArenaPortfolioPanel } from './components/arena-portfolio-panel';
import { ArenaTaSummary } from './components/arena-ta-summary';
import { ArenaFundamentalsTrigger } from '../../shared/paper-fundamentals/arena-fundamentals-trigger';
import { UiModeService } from '../../shared/ui-mode.service';
import { ARENA_API, ArenaApi } from './data/arena.models';
import { ARENA_API_IMPL } from '../../api-impls';

const ARENA_GUIDE_STORAGE_KEY = 'ttsc.arenaGuideDismissed';

interface ArenaTourStep {
  readonly title: string;
  readonly description: string;
}

const ARENA_TOUR_STEPS: readonly ArenaTourStep[] = [
  {
    title: 'График цены',
    description:
      'Здесь видно, как меняется цена выбранной бумаги. Каждая свеча — это один шаг времени.',
  },
  {
    title: 'Панель покупки и продажи',
    description:
      'Справа выберите действие, количество лотов и нажмите кнопку — заявка встанет в очередь.',
  },
  {
    title: 'Кнопки «Шаг» и «Старт»',
    description:
      'Нажмите «Следующая свеча» для одного шага или «Пуск» для автопроигрывания. Заявки срабатывают на открытии следующей свечи.',
  },
];

function readGuideDismissed(): boolean {
  try {
    return (
      typeof localStorage !== 'undefined' && localStorage.getItem(ARENA_GUIDE_STORAGE_KEY) === '1'
    );
  } catch {
    return false;
  }
}

@Component({
  selector: 'app-arena-page',
  imports: [
    RouterLink,
    TuiButton,
    TuiBadge,
    TuiNotification,
    ArenaPlayer,
    ArenaPaperSwitcher,
    ArenaChart,
    ArenaTaSummary,
    ArenaOrdersPanel,
    ArenaOrderTicket,
    ArenaPortfolioPanel,
    ArenaFundamentalsTrigger,
  ],
  providers: [{ provide: ARENA_API, useClass: ARENA_API_IMPL }, ArenaStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './arena-page.html',
  styleUrl: './arena-page.less',
})
export class ArenaPage implements OnInit {
  protected readonly store = inject(ArenaStore);
  protected readonly uiMode = inject(UiModeService);
  private readonly dialogs = inject(TuiDialogService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  readonly readOnly = input(false);
  readonly headerTitle = input('Арена');
  readonly periodLabel = input<string | null>(null);
  readonly reportRoute = input<string | null>(null);
  readonly apiSource = input<ArenaApi | null>(null);

  protected readonly oscillatorOptions = TA_OSCILLATOR_OPTIONS;
  protected readonly tourSteps = ARENA_TOUR_STEPS;
  protected readonly showSma20 = signal(false);
  protected readonly showSma50 = signal(false);
  protected readonly showEma20 = signal(false);
  protected readonly showEma50 = signal(false);
  protected readonly showBollinger = signal(false);
  protected readonly showVwap = signal(false);
  protected readonly oscillator = signal<TaOscillatorId>('none');
  protected readonly showTaPanel = signal(false);
  protected readonly taToolbarOpen = signal(false);
  protected readonly guideDismissed = signal(readGuideDismissed());
  protected readonly tourStep = signal(0);

  protected readonly showTaControls = computed(() => this.uiMode.isPro() || this.taToolbarOpen());
  protected readonly showTour = computed(
    () => !this.readOnly() && !this.store.finished() && !this.guideDismissed(),
  );
  protected readonly currentTourStep = computed(
    () => this.tourSteps[this.tourStep()] ?? this.tourSteps[0],
  );
  protected readonly showPauseTrapCallout = computed(
    () =>
      !this.readOnly() &&
      !this.store.finished() &&
      !this.store.playing() &&
      this.store.pendingOrderWhilePaused(),
  );

  protected toggleTaToolbar(): void {
    this.taToolbarOpen.update((open) => !open);
  }

  protected nextTourStep(): void {
    if (this.tourStep() < this.tourSteps.length - 1) {
      this.tourStep.update((step) => step + 1);
    } else {
      this.dismissGuide();
    }
  }

  protected prevTourStep(): void {
    if (this.tourStep() > 0) {
      this.tourStep.update((step) => step - 1);
    }
  }

  protected onOscillatorChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as TaOscillatorId;
    this.oscillator.set(value);
  }

  protected shortSessionId(id: string | null): string {
    if (!id) {
      return '';
    }
    return id.length <= 12 ? id : `#${id.slice(0, 8)}`;
  }

  protected readonly selectedPaperOrders = computed(() => {
    const id = this.store.selectedPaperId();
    return this.store.activeOrders().filter((o) => o.paperId === id);
  });

  protected readonly selectedPaperFills = computed(() => {
    const id = this.store.selectedPaperId();
    return this.store.fills().filter((f) => f.paperId === id);
  });

  ngOnInit(): void {
    const customApi = this.apiSource();
    if (customApi || this.readOnly() || !this.route) {
      void this.store.init(customApi ?? undefined);
      return;
    }

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id') ?? undefined;
      void this.store.init(undefined, id);
    });
  }

  protected dismissGuide(): void {
    this.guideDismissed.set(true);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ARENA_GUIDE_STORAGE_KEY, '1');
      }
    } catch {
      // Игнорируем ошибку доступа к localStorage (private mode / SSR).
    }
  }

  protected confirmFinish(): void {
    this.store.pause();
    const day = this.store.day();
    const totalDays = this.store.totalDays();

    this.dialogs
      .open<boolean>(TUI_CONFIRM, {
        label: `Завершить сессию на дне ${day}?`,
        size: 's',
        data: {
          content: `Осталось дней: ${Math.max(0, totalDays - day)}. После завершения новые заявки принимать нельзя.`,
          yes: 'Завершить сессию',
          no: 'Продолжить торговлю',
        },
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          void this.store.finishSession();
        }
      });
  }
}

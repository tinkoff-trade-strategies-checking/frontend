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
import { TuiButton, TuiDialogService, TuiHint, TuiNotification } from '@taiga-ui/core';
import { TUI_CONFIRM, TuiBadge } from '@taiga-ui/kit';
import { formatPct, formatPrice } from './arena.format';
import { ArenaStore } from './arena.store';
import { ArenaChart } from './components/arena-chart';
import { ArenaOrderTicket } from './components/arena-order-ticket';
import { ArenaOrdersPanel } from './components/arena-orders-panel';
import { ArenaPlayer } from './components/arena-player';
import { ArenaPortfolioPanel } from './components/arena-portfolio-panel';
import { ARENA_API, ArenaApi } from './data/arena.models';
import { ARENA_API_IMPL } from '../../api-impls';

const ONBOARDING_STORAGE_KEY = 'ttsc_arena_onboarding_dismissed';

function readOnboardingDismissed(): boolean {
  try {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeOnboardingDismissed(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
    }
  } catch {
    // ignore storage errors in restricted environments
  }
}

@Component({
  selector: 'app-arena-page',
  imports: [
    RouterLink,
    TuiButton,
    TuiBadge,
    TuiHint,
    TuiNotification,
    ArenaPlayer,
    ArenaChart,
    ArenaOrdersPanel,
    ArenaOrderTicket,
    ArenaPortfolioPanel,
  ],
  providers: [{ provide: ARENA_API, useClass: ARENA_API_IMPL }, ArenaStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './arena-page.html',
  styleUrl: './arena-page.less',
})
export class ArenaPage implements OnInit {
  protected readonly store = inject(ArenaStore);
  private readonly dialogs = inject(TuiDialogService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  readonly readOnly = input(false);
  readonly headerTitle = input('Арена');
  readonly periodLabel = input<string | null>(null);
  readonly reportRoute = input<string | null>(null);
  readonly apiSource = input<ArenaApi | null>(null);

  protected readonly showSma20 = signal(false);
  protected readonly showSma50 = signal(false);
  protected readonly onboardingDismissed = signal(readOnboardingDismissed());
  protected readonly formatPct = formatPct;
  protected readonly formatPrice = formatPrice;

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

  protected dismissOnboarding(): void {
    this.onboardingDismissed.set(true);
    writeOnboardingDismissed();
  }

  protected confirmFinish(): void {
    this.store.pause();
    const day = this.store.day();
    const totalDays = this.store.totalDays();
    const remaining = Math.max(0, totalDays - day);
    const baseText = `Осталось дней: ${remaining}. После завершения новые заявки принимать нельзя.`;
    const content =
      this.store.fills().length === 0
        ? `${baseText} Вы пока не совершили ни одной сделки — отчёт будет без результатов торговли.`
        : baseText;

    this.dialogs
      .open<boolean>(TUI_CONFIRM, {
        label: `Завершить сессию на дне ${day}?`,
        size: 's',
        data: {
          content,
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

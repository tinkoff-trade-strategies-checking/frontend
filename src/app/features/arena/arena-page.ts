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
import { formatPct, formatPrice } from './arena.format';
import { ArenaStore } from './arena.store';
import { ArenaChart } from './components/arena-chart';
import { ArenaOrderTicket } from './components/arena-order-ticket';
import { ArenaOrdersPanel } from './components/arena-orders-panel';
import { ArenaPlayer } from './components/arena-player';
import { ArenaPortfolioPanel } from './components/arena-portfolio-panel';
import { ARENA_API, ArenaApi } from './data/arena.models';
import { ARENA_API_IMPL } from '../../api-impls';

@Component({
  selector: 'app-arena-page',
  imports: [
    RouterLink,
    TuiButton,
    TuiBadge,
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

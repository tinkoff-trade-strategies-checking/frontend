import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TuiButton, TuiHint, TuiNotification } from '@taiga-ui/core';
import { TuiBadge, TuiSegmented } from '@taiga-ui/kit';
import { LAUNCH_API_IMPL, REPORT_API_IMPL } from '../../api-impls';
import { STUB_MODE } from '../../core/api-mode';
import { errorMessage } from '../../core/api-problem';
import { UiModeService } from '../../shared/ui-mode.service';
import { LAUNCH_API, SessionDurationDays, StartSessionCommand } from '../launch/data/launch.models';
import { ReportEquityChart } from './components/report-equity-chart';
import { ReportUnderwaterChart } from './components/report-underwater-chart';
import { ReportExportFormat, ReportExportService } from './data/report-export.service';
import { DivergenceType, EquityCurvePoint, REPORT_API, SessionReport } from './data/report.models';
import {
  buildExecutiveSummary,
  DIVERGENCE_TYPE_LABELS,
  formatDeltaBars,
  formatDrawdownDuration,
  formatLaunchRejectReason,
  formatPct,
  formatRatio,
  formatRub,
  formatRubExact,
  REPORT_ORDER_TYPE_LABELS,
  REPORT_REGIME_LABELS,
  REPORT_TIMEFRAME_LABELS,
  WINNER_LABELS,
} from './report.format';
import { DivergenceFilter, DivergenceSort, ReportStore, ReportTab } from './report.store';

const VALID_DURATIONS: readonly SessionDurationDays[] = [20, 60, 120, 250];

function isSessionDurationDays(value: number): value is SessionDurationDays {
  return (VALID_DURATIONS as readonly number[]).includes(value);
}

const REPORT_TABS: readonly { readonly id: ReportTab; readonly label: string }[] = [
  { id: 'metrics', label: 'Метрики и издержки' },
  { id: 'divergences', label: 'Расхождения' },
  { id: 'reverse', label: 'Обратная проверка' },
  { id: 'fills', label: 'Сделки' },
];

const DIVERGENCE_FILTERS: readonly { readonly id: DivergenceFilter; readonly label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'extra', label: DIVERGENCE_TYPE_LABELS.extra },
  { id: 'missed', label: DIVERGENCE_TYPE_LABELS.missed },
  { id: 'size', label: DIVERGENCE_TYPE_LABELS.size },
  { id: 'timing', label: DIVERGENCE_TYPE_LABELS.timing },
];

const DIVERGENCE_SORTS: readonly { readonly id: DivergenceSort; readonly label: string }[] = [
  { id: 'time', label: 'По времени' },
  { id: 'errorCost', label: 'По цене ошибки' },
];

const REPORT_HINTS = {
  equityCurve:
    'Показывает, как менялась общая стоимость вашего счёта (свободные деньги + бумаги) на каждом шаге.',
  netReturn:
    'Итоговый результат в процентах после вычета всех комиссий, биржевого сбора, спреда и проскальзывания.',
  finalCapital:
    'Сколько рублей осталось на счёте в конце периода по сравнению со стартовым капиталом.',
  benchmark: 'Средняя доходность российского рынка акций (индекс Мосбиржи IMOEX) за тот же период.',
  maxDrawdown:
    'На сколько процентов ваш счёт максимально проседал от своего лучшего результата за сессию.',
  costsTotal:
    'Суммарные расходы на комиссию брокера, биржевой сбор, спред и проскальзывание за всю сессию.',
  tradesCount: 'Количество завершённых циклов «покупка → продажа».',
  totalReturn: 'Общее изменение капитала за период в процентах.',
  cagr: 'Среднегодовая доходность: сколько процентов вышло бы за полный год при таком же темпе.',
  grossReturn: 'Доходность до вычета комиссии брокера и биржевого сбора.',
  drawdownDuration: 'Сколько времени счёт находился ниже своего предыдущего максимума.',
  volatility:
    'Насколько сильно колебалась стоимость счёта в пересчёте на год. Чем ниже, тем спокойнее.',
  sharpe:
    'Коэффициент Шарпа: доходность сверх безрисковой ставки RUONIA на единицу общего риска. Выше — лучше.',
  sortino:
    'Коэффициент Сортино: как Шарпа, но учитывает только колебания вниз (просадки). Выше — лучше.',
  turnover: 'Во сколько раз суммарный объём покупок и продаж превысил стартовый капитал.',
  fifoTrades:
    'Завершённые пары «покупка → продажа», сопоставленные по очереди (FIFO: первая покупка закрывается первой).',
  winRate: 'Доля закрытых сделок, которые принесли чистую прибыль.',
  rejectsPartials:
    'Сколько заявок было отклонено или исполнено частично из-за нехватки денег, бумаг или ликвидности.',
  hhi: 'Индекс концентрации портфеля от 0 до 1: ближе к 1 — деньги в одной бумаге, ближе к 0 — распределены равномерно.',
  largestPosition: 'Максимальная доля одной бумаги в портфеле за период.',
  spreadCost: 'Потери из-за разницы между ценой покупки и ценой продажи в биржевом стакане.',
  slippageCost:
    'Смещение цены исполнения крупной заявки по сравнению с ценой в момент её отправки.',
  errorCost:
    'Сколько рублей вы недополучили (или сэкономили) по сравнению с действием фонового алгоритма до следующего решения.',
  horizon: 'Шаг и день, до которого оценивается эффект этого расхождения.',
  because: 'Какое правило сработало у фонового алгоритма в этот момент.',
  lots: 'Минимальный пакет акций для сделки на бирже (в одном лоте может быть 1, 10, 100 и более акций).',
  fillCost: 'Комиссия брокера, биржевой сбор, спред и проскальзывание по этой сделке.',
  grossPnl: 'Прибыль или убыток по сделке без учёта комиссий и сборов.',
} as const;

@Component({
  selector: 'app-report-page',
  imports: [
    RouterLink,
    TuiButton,
    TuiBadge,
    TuiHint,
    TuiNotification,
    TuiSegmented,
    ReportEquityChart,
    ReportUnderwaterChart,
  ],
  providers: [
    { provide: REPORT_API, useClass: REPORT_API_IMPL },
    { provide: LAUNCH_API, useClass: LAUNCH_API_IMPL },
    ReportStore,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-page.html',
  styleUrl: './report-page.less',
})
export class ReportPage implements OnInit {
  protected readonly store = inject(ReportStore);
  protected readonly uiMode = inject(UiModeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly exportService = inject(ReportExportService);
  private readonly launchApi = inject(LAUNCH_API);

  protected readonly stubMode = inject(STUB_MODE);
  protected readonly exporting = signal(false);
  protected readonly exportError = signal<string | null>(null);
  protected readonly replayingPeriod = signal(false);
  protected readonly replayPeriodError = signal<string | null>(null);

  private readonly proDetailsOverride = signal<boolean | null>(null);
  protected readonly proDetailsOpen = computed(
    () => this.proDetailsOverride() ?? this.uiMode.isPro(),
  );

  protected readonly hints = REPORT_HINTS;
  protected readonly tabs = REPORT_TABS;
  protected readonly divergenceFilters = DIVERGENCE_FILTERS;
  protected readonly divergenceSorts = DIVERGENCE_SORTS;
  protected readonly regimeLabels = REPORT_REGIME_LABELS;
  protected readonly timeframeLabels = REPORT_TIMEFRAME_LABELS;
  protected readonly divergenceLabels = DIVERGENCE_TYPE_LABELS;
  protected readonly orderTypeLabels = REPORT_ORDER_TYPE_LABELS;
  protected readonly winnerLabels = WINNER_LABELS;
  protected readonly formatRub = formatRub;
  protected readonly formatRubExact = formatRubExact;
  protected readonly formatDeltaBars = formatDeltaBars;
  protected readonly formatDrawdownDuration = formatDrawdownDuration;
  protected readonly formatPct = formatPct;
  protected readonly formatRatio = formatRatio;
  protected readonly buildExecutiveSummary = buildExecutiveSummary;

  constructor() {
    effect(() => {
      this.uiMode.mode();
      this.proDetailsOverride.set(null);
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id') ?? 'S-0103';
      this.replayPeriodError.set(null);
      this.proDetailsOverride.set(null);
      void this.store.load(id);
    });
  }

  protected toggleProDetails(): void {
    this.proDetailsOverride.set(!this.proDetailsOpen());
  }

  protected canRepeatPeriod(rep: SessionReport): boolean {
    return (
      isSessionDurationDays(rep.totalDays) &&
      rep.papers.length > 0 &&
      rep.period.startDate.trim().length > 0
    );
  }

  protected async repeatPeriod(rep: SessionReport): Promise<void> {
    if (!isSessionDurationDays(rep.totalDays) || rep.papers.length === 0) {
      return;
    }
    this.replayingPeriod.set(true);
    this.replayPeriodError.set(null);
    try {
      const command: StartSessionCommand = {
        traderKind: 'human',
        durationDays: rep.totalDays,
        timeframe: rep.timeframe,
        regime: rep.regime,
        startMode: 'custom',
        customStartDate: rep.period.startDate,
        paperCount: null,
        paperIds: this.stubMode ? rep.papers.map((p) => p.ticker) : rep.papers.map((p) => p.id),
        initialCapital: rep.humanMetrics.initialCapitalRub.toFixed(2),
      };
      const result = await this.launchApi.startSession(command);
      if (result.accepted) {
        await this.router.navigate(['/arena', result.sessionId]);
      } else {
        this.replayPeriodError.set(
          formatLaunchRejectReason(result.reason, result.barsCount, result.maxBars),
        );
      }
    } catch (error) {
      this.replayPeriodError.set(errorMessage(error, 'Не удалось запустить повторную сессию.'));
    } finally {
      this.replayingPeriod.set(false);
    }
  }

  protected async download(sessionId: string, format: ReportExportFormat): Promise<void> {
    this.exporting.set(true);
    this.exportError.set(null);
    try {
      await this.exportService.download(sessionId, format);
    } catch (error) {
      this.exportError.set(errorMessage(error, 'Не удалось выгрузить отчёт.'));
    } finally {
      this.exporting.set(false);
    }
  }

  /** Заголовок как в истории: «бумаги · период»; идентификатор показывается рядом мелко. */
  protected reportTitle(rep: SessionReport): string {
    const tickers = rep.papers.map((p) => p.ticker).join(', ');
    return tickers ? `${tickers} · ${rep.period.label}` : rep.period.label;
  }

  protected equityCurveSubtitle(points: readonly EquityCurvePoint[]): string {
    const parts = ['Вы'];
    if (points.some((p) => p.algoCapitalRub !== null)) {
      parts.push('алгоритм');
    }
    if (points.some((p) => p.benchmarkCapitalRub !== null)) {
      parts.push('бенчмарк IMOEX');
    }
    return parts.join(', ');
  }

  protected tabIndex(current: ReportTab): number {
    return Math.max(
      0,
      this.tabs.findIndex((t) => t.id === current),
    );
  }

  protected onTabIndexChange(index: number): void {
    const next = this.tabs[index];
    if (next) {
      this.store.setTab(next.id);
    }
  }

  protected divergenceTypeLabel(type: DivergenceType): string {
    return this.divergenceLabels[type];
  }
}

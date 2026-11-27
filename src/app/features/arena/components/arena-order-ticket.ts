import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiHint, TuiNotification, TuiTextfield } from '@taiga-ui/core';
import { TuiInputNumber, TuiSegmented, TuiSelect } from '@taiga-ui/kit';
import { UiModeService } from '../../../shared/ui-mode.service';
import { formatPct, formatPrice, formatRejectReason } from '../arena.format';
import { OrderDraft } from '../arena.store';
import {
  ArenaOrder,
  ArenaPaper,
  ArenaPortfolio,
  EstimateOrderCommand,
  ORDER_TYPE_LABELS,
  OrderSide,
  OrderEstimateLeg,
  OrderEstimateResult,
  OrderType,
  TimeInForce,
} from '../data/arena.models';

/** Параметры формы для оценки заявки ядром; `lots` может быть ещё не введён. */
export type EstimateDraft = Omit<EstimateOrderCommand, 'lots'> & { lots: number | null };

const ORDER_TYPES: readonly OrderType[] = [
  'market',
  'limit',
  'stop',
  'stop_limit',
  'take_profit',
  'trailing',
  'oco',
];

const SELL_ONLY_TYPES = new Set<OrderType>(['take_profit', 'trailing', 'oco']);

const ORDER_TYPE_HINTS: Readonly<Record<OrderType, string>> = {
  market: 'Исполняется на открытии следующей свечи по рыночной цене.',
  limit: 'Исполняется только по указанной цене или выгоднее для вас.',
  stop: 'Активируется как рыночная заявка, когда цена дойдёт до уровня стопа.',
  stop_limit: 'При достижении стоп-цены выставляет лимитную заявку по указанной цене.',
  take_profit: 'Автоматически продаёт бумагу при росте до целевой цены прибыли.',
  trailing:
    'Стоп-цена подтягивается вслед за ростом и срабатывает при откате от пика на указанный %.',
  oco: 'Две связанные заявки на продажу: стоп ограничивает убыток, тейк фиксирует прибыль. Срабатывает только одна.',
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Component({
  selector: 'app-arena-order-ticket',
  imports: [
    FormsModule,
    TuiButton,
    TuiHint,
    TuiNotification,
    TuiTextfield,
    TuiSelect,
    TuiInputNumber,
    TuiSegmented,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <div class="panel-header">
        <h2 class="tui-text_h6">
          {{ editingOrder() ? 'Замена заявки ' + editingOrder()!.id : 'Заявка' }}
        </h2>
      </div>

      <div class="ticket-body">
        @if (blind() && !finished()) {
          <p class="tui-text_body-xs blind-note">
            В слепом режиме цены условные (старт = 100), а суммы — в % от счёта, чтобы нельзя было
            угадать компанию.
          </p>
        }

        <label tuiLabel for="arena-paper">
          Бумага
          <tui-textfield tuiTextfieldSize="s" [stringify]="paperStringify">
            <select
              id="arena-paper"
              tuiSelect
              [items]="paperIds()"
              [disabled]="Boolean(editingOrder())"
              [ngModel]="selectedPaperId()"
              (ngModelChange)="paperSelect.emit($event)"
            ></select>
          </tui-textfield>
        </label>

        @if (!showProOrderControls() && selectedPositionLots() > 0) {
          <tui-segmented
            size="s"
            [activeItemIndex]="orderType() === 'oco' ? 1 : 0"
            (activeItemIndexChange)="onBeginnerModeIndexChange($event)"
          >
            <button type="button" [tuiHint]="orderTypeHints.market">По рынку</button>
            <button type="button" [tuiHint]="orderTypeHints.oco">
              Защита позиции (Стоп / Тейк)
            </button>
          </tui-segmented>
        }

        @if (showProOrderControls() || orderType() !== 'oco') {
          <tui-segmented
            size="s"
            [activeItemIndex]="side() === 'buy' ? 0 : 1"
            [disabled]="Boolean(editingOrder())"
            (activeItemIndexChange)="onSideIndexChange($event)"
          >
            <button type="button" [disabled]="isSellOnly()">Купить</button>
            <button type="button">Продать</button>
          </tui-segmented>
        }

        @if (showProOrderControls()) {
          <label tuiLabel for="arena-order-type" [tuiHint]="orderTypeHint()">
            Тип заявки
            <tui-textfield tuiTextfieldSize="s" [stringify]="orderTypeStringify">
              <select
                id="arena-order-type"
                tuiSelect
                [items]="availableOrderTypes()"
                [disabled]="Boolean(editingOrder())"
                [ngModel]="orderType()"
                (ngModelChange)="onOrderTypeChange($event)"
              ></select>
            </tui-textfield>
          </label>
        }

        @if (orderType() === 'limit') {
          <label tuiLabel for="arena-limit-price">
            Цена лимита
            <tui-textfield tuiTextfieldSize="s">
              <input
                id="arena-limit-price"
                tuiInputNumber
                [min]="0.01"
                [ngModel]="limitPrice()"
                (ngModelChange)="limitPrice.set($event ?? 0)"
              />
            </tui-textfield>
          </label>
        }

        @if (orderType() === 'stop') {
          <label tuiLabel for="arena-stop-price">
            Цена стопа
            <tui-textfield tuiTextfieldSize="s">
              <input
                id="arena-stop-price"
                tuiInputNumber
                [min]="0.01"
                [ngModel]="stopPrice()"
                (ngModelChange)="stopPrice.set($event ?? 0)"
              />
            </tui-textfield>
          </label>
        }

        @if (orderType() === 'stop_limit') {
          <div class="grid-2">
            <label tuiLabel for="arena-sl-stop">
              Стоп
              <tui-textfield tuiTextfieldSize="s">
                <input
                  id="arena-sl-stop"
                  tuiInputNumber
                  [min]="0.01"
                  [ngModel]="stopPrice()"
                  (ngModelChange)="stopPrice.set($event ?? 0)"
                />
              </tui-textfield>
            </label>
            <label tuiLabel for="arena-sl-limit">
              Лимит
              <tui-textfield tuiTextfieldSize="s">
                <input
                  id="arena-sl-limit"
                  tuiInputNumber
                  [min]="0.01"
                  [ngModel]="limitPrice()"
                  (ngModelChange)="limitPrice.set($event ?? 0)"
                />
              </tui-textfield>
            </label>
          </div>
        }

        @if (orderType() === 'take_profit') {
          <label tuiLabel for="arena-tp-price">
            Цена тейк-профита
            <tui-textfield tuiTextfieldSize="s">
              <input
                id="arena-tp-price"
                tuiInputNumber
                [min]="0.01"
                [ngModel]="takeProfitPrice()"
                (ngModelChange)="takeProfitPrice.set($event ?? 0)"
              />
            </tui-textfield>
          </label>
        }

        @if (orderType() === 'trailing') {
          <label tuiLabel for="arena-trailing-pct">
            Отступ от пика, % (до 50 %)
            <tui-textfield tuiTextfieldSize="s">
              <input
                id="arena-trailing-pct"
                tuiInputNumber
                [min]="0.1"
                [max]="50"
                [ngModel]="trailingPct()"
                (ngModelChange)="trailingPct.set($event ?? 0)"
              />
            </tui-textfield>
          </label>
        }

        @if (orderType() === 'oco') {
          <div class="grid-2">
            <label
              tuiLabel
              for="arena-oco-stop"
              tuiHint="Если цена упадёт до этого уровня, позиция продастся, чтобы ограничить убыток."
            >
              Стоп
              <tui-textfield tuiTextfieldSize="s">
                <input
                  id="arena-oco-stop"
                  tuiInputNumber
                  [min]="0.01"
                  [ngModel]="stopPrice()"
                  (ngModelChange)="stopPrice.set($event ?? 0)"
                />
              </tui-textfield>
            </label>
            <label
              tuiLabel
              for="arena-oco-tp"
              tuiHint="Если цена вырастет до этого уровня, позиция продастся с фиксацией прибыли."
            >
              Тейк-профит
              <tui-textfield tuiTextfieldSize="s">
                <input
                  id="arena-oco-tp"
                  tuiInputNumber
                  [min]="0.01"
                  [ngModel]="takeProfitPrice()"
                  (ngModelChange)="takeProfitPrice.set($event ?? 0)"
                />
              </tui-textfield>
            </label>
          </div>
        }

        <label tuiLabel for="arena-lots">
          Количество, лотов
          <tui-textfield tuiTextfieldSize="s">
            <input
              id="arena-lots"
              tuiInputNumber
              [ngModel]="lots()"
              (ngModelChange)="onLotsChange($event)"
              (focus)="selectOnFocus($event)"
            />
          </tui-textfield>
        </label>

        @if (side() === 'sell' && selectedPositionLots() > 0) {
          <div class="sell-chips" role="group" aria-label="Быстрый выбор объёма продажи">
            <button
              tuiButton
              type="button"
              size="xs"
              appearance="outline"
              (click)="setSellFraction(0.25)"
            >
              25%
            </button>
            <button
              tuiButton
              type="button"
              size="xs"
              appearance="outline"
              (click)="setSellFraction(0.5)"
            >
              50%
            </button>
            <button
              tuiButton
              type="button"
              size="xs"
              appearance="outline"
              (click)="setSellFraction(1)"
            >
              Всё
            </button>
          </div>
        }

        <div class="hint-row tui-text_body-xs">
          <span>Цена: {{ lastPrice() !== null ? formatPrice(lastPrice()!) : '—' }}</span>
          <span>Оценка: {{ estimatedPct() !== null ? formatPct(estimatedPct()!) : '—' }}</span>
        </div>
        @if (estimateRejection(); as rejection) {
          <p class="tui-text_body-xs estimate-warning" role="status">
            Заявка не будет принята: {{ rejection }}
          </p>
        }
        @if (estimate()?.legs; as legs) {
          @if (legs.length > 1) {
            <ul class="tui-text_body-xs estimate-legs">
              @for (leg of legs; track $index) {
                <li>
                  {{ legLabel(leg.type) }}: {{ formatPct(leg.amountPct) }}
                  @if (!leg.canPlace) {
                    — {{ legRejection(leg) }}
                  }
                </li>
              }
            </ul>
          }
        }

        @if (showProOrderControls()) {
          <tui-segmented
            size="s"
            [activeItemIndex]="tif() === 'day' ? 0 : 1"
            (activeItemIndexChange)="tif.set($event === 0 ? 'day' : 'gtc')"
          >
            <button
              type="button"
              tuiHint="Заявка действует до конца текущего торгового дня и снимается автоматически."
            >
              На день
            </button>
            <button
              type="button"
              tuiHint="Заявка остаётся активной, пока не исполнится или вы её не отмените."
            >
              До отмены
            </button>
          </tui-segmented>
        }

        @if (validationError()) {
          <div tuiNotification appearance="warning" size="s">
            {{ validationError() }}
          </div>
        }

        @if (error()) {
          <div tuiNotification appearance="negative" size="s">
            {{ error() }}
          </div>
        }

        <div class="actions">
          <button
            tuiButton
            type="button"
            size="m"
            appearance="primary"
            class="submit-btn"
            [disabled]="finished() || Boolean(validationError())"
            (click)="onSubmit()"
          >
            {{ submitLabel() }}
          </button>

          @if (editingOrder()) {
            <button tuiButton type="button" size="m" appearance="flat" (click)="cancelEdit.emit()">
              Отмена
            </button>
          }
        </div>
      </div>
    </section>
  `,
  styles: `
    .panel {
      background: var(--tui-background-base);
      border: 1px solid var(--tui-border-normal);
      border-radius: var(--tui-radius-l);
      padding: 1rem;
    }

    .panel-header {
      margin-bottom: 0.75rem;
    }

    .panel-header h2 {
      margin: 0;
    }

    .ticket-body {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .blind-note {
      margin: 0;
      padding: 0.5rem 0.65rem;
      border-radius: var(--tui-radius-m);
      background: var(--tui-background-neutral-1);
      color: var(--tui-text-secondary);
      line-height: 1.35;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }

    .sell-chips {
      display: flex;
      gap: 0.4rem;
    }

    .sell-chips button {
      flex: 1;
    }

    .estimate-warning {
      margin: 0;
      color: var(--tui-text-negative);
    }

    .estimate-legs {
      margin: 0;
      padding-left: 1rem;
    }

    .hint-row {
      display: flex;
      justify-content: space-between;
      color: var(--tui-text-secondary);
      font-variant-numeric: tabular-nums;
    }

    .actions {
      display: flex;
      gap: 0.5rem;
    }

    .submit-btn {
      flex: 1;
    }
  `,
})
export class ArenaOrderTicket {
  protected readonly uiMode = inject(UiModeService);

  readonly papers = input.required<readonly ArenaPaper[]>();
  readonly selectedPaperId = input.required<string>();
  readonly step = input<number>(0);
  readonly portfolio = input.required<ArenaPortfolio>();
  readonly finished = input.required<boolean>();
  readonly blind = input(false);
  readonly editingOrder = input<ArenaOrder | null>(null);
  readonly estimate = input<OrderEstimateResult | null>(null);
  protected readonly estimatedPct = computed(() => this.estimate()?.amountPct ?? null);
  protected readonly estimateRejection = computed(() => {
    const est = this.estimate();
    return est && est.canPlace === false ? formatRejectReason(est.reason, est.field) : null;
  });
  readonly error = input<string | null>(null);

  readonly paperSelect = output<string>();
  readonly estimateRequest = output<EstimateDraft>();
  readonly submitOrder = output<OrderDraft>();
  readonly submitReplace = output<{
    orderId: string;
    draft: Omit<OrderDraft, 'paperId' | 'side' | 'type'>;
  }>();
  readonly cancelEdit = output<void>();

  protected readonly orderTypeHints = ORDER_TYPE_HINTS;
  protected readonly orderTypeStringify = (type: OrderType): string => ORDER_TYPE_LABELS[type];
  protected readonly paperStringify = (id: string): string =>
    this.papers().find((p) => p.id === id)?.label ?? `Бумага ${id}`;
  protected readonly Boolean = Boolean;
  protected readonly formatPrice = formatPrice;
  protected readonly formatPct = formatPct;

  protected readonly side = signal<OrderSide>('buy');
  protected readonly orderType = signal<OrderType>('market');
  protected readonly lots = signal<number | null>(5);
  protected readonly tif = signal<TimeInForce>('day');
  protected readonly limitPrice = signal(97);
  protected readonly stopPrice = signal(103);
  protected readonly takeProfitPrice = signal(108);
  protected readonly trailingPct = signal(5);

  private lastPaperId: string | null = null;
  private estimateRequested = false;

  protected readonly paperIds = computed(() => this.papers().map((p) => p.id));
  protected readonly selectedPositionLots = computed(
    () => this.portfolio().positions[this.selectedPaperId()]?.lots ?? 0,
  );
  protected readonly showProOrderControls = computed(
    () => this.uiMode.isPro() || Boolean(this.editingOrder()),
  );
  protected readonly availableOrderTypes = computed<readonly OrderType[]>(() => {
    if (this.editingOrder() || this.selectedPositionLots() > 0) {
      return ORDER_TYPES;
    }
    return ORDER_TYPES.filter((type) => !SELL_ONLY_TYPES.has(type));
  });
  protected readonly isSellOnly = computed(() => SELL_ONLY_TYPES.has(this.orderType()));
  protected readonly orderTypeHint = computed(() => ORDER_TYPE_HINTS[this.orderType()]);
  protected readonly lastPrice = computed<number | null>(() => {
    const found = this.papers().find((p) => p.id === this.selectedPaperId());
    return found ? found.lastPrice : null;
  });

  protected readonly submitLabel = computed(() => {
    if (this.editingOrder()) {
      return 'Заменить заявку';
    }
    if (this.orderType() === 'market') {
      return this.side() === 'buy' ? 'Купить (на след. шаге)' : 'Продать (на след. шаге)';
    }
    return 'Выставить заявку';
  });

  protected readonly validationError = computed<string | null>(() => {
    const lots = this.lots();
    if (lots === null || !Number.isInteger(lots) || lots < 1) {
      return 'Укажите целое число лотов (от 1).';
    }
    const type = this.orderType();
    if (type === 'trailing') {
      const d = this.trailingPct();
      if (!(d > 0 && d <= 50)) {
        return 'Отступ трейлинг-стопа должен быть в диапазоне (0; 50] %.';
      }
    }
    if (type === 'oco' && this.stopPrice() >= this.takeProfitPrice()) {
      return 'Стоп в OCO должен быть ниже тейк-профита.';
    }
    if ((type === 'limit' || type === 'stop_limit') && !(this.limitPrice() > 0)) {
      return 'Укажите корректную цену лимита.';
    }
    if ((type === 'stop' || type === 'stop_limit' || type === 'oco') && !(this.stopPrice() > 0)) {
      return 'Укажите корректную цену стопа.';
    }
    if ((type === 'take_profit' || type === 'oco') && !(this.takeProfitPrice() > 0)) {
      return 'Укажите корректную цену тейк-профита.';
    }
    return null;
  });

  constructor() {
    effect(() => {
      const edit = this.editingOrder();
      if (edit) {
        this.side.set(edit.side);
        this.orderType.set(edit.type);
        this.lots.set(edit.lots);
        this.tif.set(edit.tif);
        if (edit.limitPrice !== undefined) {
          this.limitPrice.set(edit.limitPrice);
        }
        if (edit.stopPrice !== undefined) {
          this.stopPrice.set(edit.stopPrice);
        }
        if (edit.takeProfitPrice !== undefined) {
          this.takeProfitPrice.set(edit.takeProfitPrice);
        }
        if (edit.trailingPct !== undefined) {
          this.trailingPct.set(edit.trailingPct);
        }
      }
    });

    effect(() => {
      const paperId = this.selectedPaperId();
      if (!this.editingOrder() && this.lastPaperId !== paperId) {
        this.lastPaperId = paperId;
        this.syncDefaultPrices(this.orderType(), this.side());
      }
    });

    effect(() => {
      if (this.editingOrder()) {
        return;
      }
      const posLots = this.selectedPositionLots();
      const type = this.orderType();
      if (posLots === 0 && SELL_ONLY_TYPES.has(type)) {
        this.orderType.set('market');
        this.tif.set('day');
        return;
      }
      if (this.uiMode.isBeginner() && type !== 'market' && !(type === 'oco' && posLots > 0)) {
        this.orderType.set('market');
        this.tif.set('day');
      }
    });

    effect((onCleanup) => {
      // INV-6: оценка запрашивается у источника по параметрам формы (сторона, тип, цены), клиент не считает.
      const type = this.orderType();
      const draft: EstimateDraft = {
        paperId: this.selectedPaperId(),
        side: this.side(),
        type,
        lots: this.lots(),
        tif: this.tif(),
        limitPrice:
          type === 'limit' || type === 'stop_limit' ? (this.limitPrice() ?? undefined) : undefined,
        stopPrice:
          type === 'stop' || type === 'stop_limit' || type === 'oco'
            ? (this.stopPrice() ?? undefined)
            : undefined,
        takeProfitPrice:
          type === 'take_profit' || type === 'oco'
            ? (this.takeProfitPrice() ?? undefined)
            : undefined,
        trailingPct: type === 'trailing' ? (this.trailingPct() ?? undefined) : undefined,
      };
      this.step();
      const first = !this.estimateRequested;
      this.estimateRequested = true;
      if (first) {
        this.estimateRequest.emit(draft);
        return;
      }
      const timer = setTimeout(() => this.estimateRequest.emit(draft), 200);
      onCleanup(() => clearTimeout(timer));
    });
  }

  protected legLabel(type: OrderType): string {
    return ORDER_TYPE_LABELS[type];
  }

  protected legRejection(leg: OrderEstimateLeg): string {
    return formatRejectReason(leg.reason, leg.field);
  }

  protected onBeginnerModeIndexChange(index: number): void {
    if (index === 1) {
      this.orderType.set('oco');
      this.side.set('sell');
      this.tif.set('gtc');
      this.syncDefaultPrices('oco', 'sell');
    } else {
      this.orderType.set('market');
      this.tif.set('day');
      this.syncDefaultPrices('market', this.side());
    }
  }

  protected onSideIndexChange(index: number): void {
    const next: OrderSide = index === 0 ? 'buy' : 'sell';
    if (next === 'buy' && this.isSellOnly()) {
      return;
    }
    this.side.set(next);
    this.syncDefaultPrices(this.orderType(), next);
  }

  protected onOrderTypeChange(type: OrderType): void {
    this.orderType.set(type);
    if (SELL_ONLY_TYPES.has(type)) {
      this.side.set('sell');
    }
    if (type !== 'market' && type !== 'limit') {
      this.tif.set('gtc');
    }
    this.syncDefaultPrices(type, this.side());
  }

  protected setSellFraction(fraction: 0.25 | 0.5 | 1): void {
    const posLots = this.selectedPositionLots();
    if (posLots <= 0) {
      return;
    }
    const nextLots = fraction === 1 ? posLots : Math.max(1, Math.floor(posLots * fraction));
    this.lots.set(nextLots);
  }

  /** Предзаполненное значение выделяем при фокусе: ввод «5» заменяет его, а не даёт «55». */
  protected selectOnFocus(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  protected onLotsChange(value: number | null): void {
    this.lots.set(value);
  }

  protected onSubmit(): void {
    const lots = this.lots();
    if (this.validationError() || this.finished() || lots === null) {
      return;
    }
    const type = this.orderType();
    const edit = this.editingOrder();
    const params = {
      lots,
      tif: this.tif(),
      limitPrice: type === 'limit' || type === 'stop_limit' ? this.limitPrice() : undefined,
      stopPrice:
        type === 'stop' || type === 'stop_limit' || type === 'oco' ? this.stopPrice() : undefined,
      takeProfitPrice:
        type === 'take_profit' || type === 'oco' ? this.takeProfitPrice() : undefined,
      trailingPct: type === 'trailing' ? this.trailingPct() : undefined,
    };

    if (edit) {
      this.submitReplace.emit({ orderId: edit.id, draft: params });
      return;
    }

    this.submitOrder.emit({
      paperId: this.selectedPaperId(),
      side: this.side(),
      type,
      ...params,
    });
  }

  private syncDefaultPrices(type: OrderType, side: OrderSide): void {
    const px = this.lastPrice();
    if (px === null) {
      return;
    }
    if (type === 'limit') {
      this.limitPrice.set(round2(px * (side === 'buy' ? 0.97 : 1.03)));
    } else if (type === 'stop') {
      this.stopPrice.set(round2(px * (side === 'buy' ? 1.03 : 0.95)));
    } else if (type === 'stop_limit') {
      this.stopPrice.set(round2(px * (side === 'buy' ? 1.03 : 0.95)));
      this.limitPrice.set(round2(px * (side === 'buy' ? 1.04 : 0.94)));
    } else if (type === 'take_profit') {
      this.takeProfitPrice.set(round2(px * 1.08));
    } else if (type === 'oco') {
      this.stopPrice.set(round2(px * 0.94));
      this.takeProfitPrice.set(round2(px * 1.08));
    }
  }
}

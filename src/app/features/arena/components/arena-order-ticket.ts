import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiNotification, TuiTextfield } from '@taiga-ui/core';
import { TuiChevron, TuiInputNumber, TuiSegmented, TuiSelect } from '@taiga-ui/kit';
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Component({
  selector: 'app-arena-order-ticket',
  imports: [
    FormsModule,
    TuiButton,
    TuiNotification,
    TuiTextfield,
    TuiChevron,
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
        <label tuiLabel for="arena-paper">
          Бумага
          <tui-textfield
            tuiChevron
            tuiTextfieldSize="s"
            [tuiTextfieldCleaner]="false"
            [stringify]="paperStringify"
          >
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

        <tui-segmented
          size="s"
          class="side-segmented"
          [activeItemIndex]="side() === 'buy' ? 0 : 1"
          [disabled]="Boolean(editingOrder())"
          (activeItemIndexChange)="onSideIndexChange($event)"
        >
          <button type="button" class="side-btn side-btn-buy" [disabled]="isSellOnly()">
            Купить
          </button>
          <button type="button" class="side-btn side-btn-sell">Продать</button>
        </tui-segmented>

        <label tuiLabel for="arena-order-type">
          Тип заявки
          <tui-textfield
            tuiChevron
            tuiTextfieldSize="s"
            [tuiTextfieldCleaner]="false"
            [stringify]="orderTypeStringify"
          >
            <select
              id="arena-order-type"
              tuiSelect
              [items]="orderTypes"
              [disabled]="Boolean(editingOrder())"
              [ngModel]="orderType()"
              (ngModelChange)="onOrderTypeChange($event)"
            ></select>
          </tui-textfield>
        </label>

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
            <label tuiLabel for="arena-oco-stop">
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
            <label tuiLabel for="arena-oco-tp">
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

        <tui-segmented
          size="s"
          [activeItemIndex]="tif() === 'day' ? 0 : 1"
          (activeItemIndexChange)="tif.set($event === 0 ? 'day' : 'gtc')"
        >
          <button type="button">На день</button>
          <button type="button">До отмены</button>
        </tui-segmented>

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
            [class.submit-buy]="side() === 'buy'"
            [class.submit-sell]="side() === 'sell'"
            [disabled]="finished() || Boolean(validationError())"
            (click)="onSubmit()"
          >
            {{ editingOrder() ? 'Заменить заявку' : 'Выставить заявку' }}
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

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
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

    .submit-buy {
      --tui-background-accent-1: var(--tui-text-positive);
      --tui-background-accent-1-hover: var(--tui-text-positive);
      --tui-background-accent-1-pressed: var(--tui-text-positive);
    }

    .submit-sell {
      --tui-background-accent-1: var(--tui-text-negative);
      --tui-background-accent-1-hover: var(--tui-text-negative);
      --tui-background-accent-1-pressed: var(--tui-text-negative);
    }

    .side-btn-buy {
      color: var(--tui-text-positive);
      font-weight: 600;
    }

    .side-btn-sell {
      color: var(--tui-text-negative);
      font-weight: 600;
    }
  `,
})
export class ArenaOrderTicket {
  readonly papers = input.required<readonly ArenaPaper[]>();
  readonly selectedPaperId = input.required<string>();
  readonly step = input<number>(0);
  readonly portfolio = input.required<ArenaPortfolio>();
  readonly finished = input.required<boolean>();
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

  protected readonly orderTypes = ORDER_TYPES;
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
  protected readonly isSellOnly = computed(() => SELL_ONLY_TYPES.has(this.orderType()));
  protected readonly lastPrice = computed<number | null>(() => {
    const found = this.papers().find((p) => p.id === this.selectedPaperId());
    return found ? found.lastPrice : null;
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

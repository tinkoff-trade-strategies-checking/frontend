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
import { TuiInputNumber, TuiSegmented, TuiSelect } from '@taiga-ui/kit';
import { formatPct, formatPrice } from '../arena.format';
import { OrderDraft } from '../arena.store';
import {
  ArenaOrder,
  ArenaPaper,
  ArenaPortfolio,
  ORDER_TYPE_LABELS,
  OrderSide,
  OrderType,
  TimeInForce,
} from '../data/arena.models';

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
        <tui-textfield tuiTextfieldSize="s" [stringify]="paperStringify">
          <label tuiLabel for="arena-paper">Бумага</label>
          <select
            id="arena-paper"
            tuiSelect
            [items]="paperIds()"
            [disabled]="Boolean(editingOrder())"
            [ngModel]="selectedPaperId()"
            (ngModelChange)="paperSelect.emit($event)"
          ></select>
        </tui-textfield>

        <tui-segmented
          size="s"
          [activeItemIndex]="side() === 'buy' ? 0 : 1"
          [disabled]="Boolean(editingOrder())"
          (activeItemIndexChange)="onSideIndexChange($event)"
        >
          <button type="button" [disabled]="isSellOnly()">Купить</button>
          <button type="button">Продать</button>
        </tui-segmented>

        <tui-textfield tuiTextfieldSize="s" [stringify]="orderTypeStringify">
          <label tuiLabel for="arena-order-type">Тип заявки</label>
          <select
            id="arena-order-type"
            tuiSelect
            [items]="orderTypes"
            [disabled]="Boolean(editingOrder())"
            [ngModel]="orderType()"
            (ngModelChange)="onOrderTypeChange($event)"
          ></select>
        </tui-textfield>

        @if (orderType() === 'limit') {
          <tui-textfield tuiTextfieldSize="s">
            <label tuiLabel for="arena-limit-price">Цена лимита</label>
            <input
              id="arena-limit-price"
              tuiInputNumber
              [min]="0.01"
              [ngModel]="limitPrice()"
              (ngModelChange)="limitPrice.set($event ?? 0)"
            />
          </tui-textfield>
        }

        @if (orderType() === 'stop') {
          <tui-textfield tuiTextfieldSize="s">
            <label tuiLabel for="arena-stop-price">Цена стопа</label>
            <input
              id="arena-stop-price"
              tuiInputNumber
              [min]="0.01"
              [ngModel]="stopPrice()"
              (ngModelChange)="stopPrice.set($event ?? 0)"
            />
          </tui-textfield>
        }

        @if (orderType() === 'stop_limit') {
          <div class="grid-2">
            <tui-textfield tuiTextfieldSize="s">
              <label tuiLabel for="arena-sl-stop">Стоп</label>
              <input
                id="arena-sl-stop"
                tuiInputNumber
                [min]="0.01"
                [ngModel]="stopPrice()"
                (ngModelChange)="stopPrice.set($event ?? 0)"
              />
            </tui-textfield>
            <tui-textfield tuiTextfieldSize="s">
              <label tuiLabel for="arena-sl-limit">Лимит</label>
              <input
                id="arena-sl-limit"
                tuiInputNumber
                [min]="0.01"
                [ngModel]="limitPrice()"
                (ngModelChange)="limitPrice.set($event ?? 0)"
              />
            </tui-textfield>
          </div>
        }

        @if (orderType() === 'take_profit') {
          <tui-textfield tuiTextfieldSize="s">
            <label tuiLabel for="arena-tp-price">Цена тейк-профита</label>
            <input
              id="arena-tp-price"
              tuiInputNumber
              [min]="0.01"
              [ngModel]="takeProfitPrice()"
              (ngModelChange)="takeProfitPrice.set($event ?? 0)"
            />
          </tui-textfield>
        }

        @if (orderType() === 'trailing') {
          <tui-textfield tuiTextfieldSize="s">
            <label tuiLabel for="arena-trailing-pct">Отступ от пика, % (до 50 %)</label>
            <input
              id="arena-trailing-pct"
              tuiInputNumber
              [min]="0.1"
              [max]="50"
              [ngModel]="trailingPct()"
              (ngModelChange)="trailingPct.set($event ?? 0)"
            />
          </tui-textfield>
        }

        @if (orderType() === 'oco') {
          <div class="grid-2">
            <tui-textfield tuiTextfieldSize="s">
              <label tuiLabel for="arena-oco-stop">Стоп</label>
              <input
                id="arena-oco-stop"
                tuiInputNumber
                [min]="0.01"
                [ngModel]="stopPrice()"
                (ngModelChange)="stopPrice.set($event ?? 0)"
              />
            </tui-textfield>
            <tui-textfield tuiTextfieldSize="s">
              <label tuiLabel for="arena-oco-tp">Тейк-профит</label>
              <input
                id="arena-oco-tp"
                tuiInputNumber
                [min]="0.01"
                [ngModel]="takeProfitPrice()"
                (ngModelChange)="takeProfitPrice.set($event ?? 0)"
              />
            </tui-textfield>
          </div>
        }

        <tui-textfield tuiTextfieldSize="s">
          <label tuiLabel for="arena-lots">Количество, лотов</label>
          <input
            id="arena-lots"
            tuiInputNumber
            [ngModel]="lots()"
            (ngModelChange)="onLotsChange($event)"
          />
        </tui-textfield>

        <div class="hint-row tui-text_body-xs">
          <span>Цена: {{ lastPrice() !== null ? formatPrice(lastPrice()!) : '—' }}</span>
          <span>Оценка: {{ estimatedPct() !== null ? formatPct(estimatedPct()!) : '—' }}</span>
        </div>

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
  readonly papers = input.required<readonly ArenaPaper[]>();
  readonly selectedPaperId = input.required<string>();
  readonly step = input<number>(0);
  readonly portfolio = input.required<ArenaPortfolio>();
  readonly finished = input.required<boolean>();
  readonly editingOrder = input<ArenaOrder | null>(null);
  readonly estimatedPct = input<number | null>(null);
  readonly error = input<string | null>(null);

  readonly paperSelect = output<string>();
  readonly estimateRequest = output<{ paperId: string; lots: number | null }>();
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
  private lastEstimatedLots: number | null | undefined;

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
      // INV-6: оценка суммы запрашивается у источника, клиент не считает.
      const paperId = this.selectedPaperId();
      const lots = this.lots();
      this.step();
      const lotsChanged = this.lastEstimatedLots !== undefined && this.lastEstimatedLots !== lots;
      this.lastEstimatedLots = lots;

      if (!lotsChanged) {
        this.estimateRequest.emit({ paperId, lots });
        return;
      }

      const timer = setTimeout(() => {
        this.estimateRequest.emit({ paperId, lots });
      }, 200);
      onCleanup(() => clearTimeout(timer));
    });
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

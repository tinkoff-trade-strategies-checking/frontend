import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { TuiBadge, TuiTabs } from '@taiga-ui/kit';
import { formatBlindCandleLabel, formatLots, formatPct, formatPrice } from '../arena.format';
import { ArenaFill, ArenaOrder, ORDER_TYPE_LABELS } from '../data/arena.models';

@Component({
  selector: 'app-arena-orders-panel',
  imports: [TuiButton, TuiBadge, TuiTabs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <tui-tabs [(activeItemIndex)]="activeTab" class="tabs-bar">
        <button tuiTab type="button">
          Активные заявки
          <span tuiBadge size="s" class="tab-badge">{{ activeOrders().length }}</span>
        </button>
        <button tuiTab type="button">
          Сделки
          <span tuiBadge size="s" class="tab-badge">{{ fills().length }}</span>
        </button>
      </tui-tabs>

      @if (activeTab() === 0) {
        @if (activeOrders().length === 0) {
          <div class="empty tui-text_body-s">Активных заявок нет.</div>
        } @else {
          <div class="table-scroll">
            <table class="arena-table">
              <thead>
                <tr>
                  <th>Бумага</th>
                  <th>Тип</th>
                  <th class="num">Лоты</th>
                  <th>Условия</th>
                  <th>Срок</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (order of activeOrders(); track order.id) {
                  <tr>
                    <td>
                      <span [class]="order.side === 'buy' ? 'pos' : 'neg'">
                        {{ order.side === 'buy' ? 'Купить' : 'Продать' }}
                      </span>
                      Бумага {{ order.paperId }}
                    </td>
                    <td>{{ typeLabel(order.type) }}</td>
                    <td class="num">{{ formatLots(order.lots - order.filledLots) }}</td>
                    <td class="tui-text_body-xs">{{ describeOrder(order) }}</td>
                    <td class="tui-text_body-xs">
                      {{ order.tif === 'gtc' ? 'до отмены' : 'день' }}
                    </td>
                    <td class="actions-cell">
                      @if (!finished()) {
                        <button
                          tuiButton
                          type="button"
                          size="xs"
                          appearance="flat"
                          (click)="replaceOrder.emit(order)"
                        >
                          Заменить
                        </button>
                        <button
                          tuiButton
                          type="button"
                          size="xs"
                          appearance="flat-destructive"
                          (click)="cancelOrder.emit(order.id)"
                        >
                          Отменить
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      } @else {
        @if (fills().length === 0) {
          <div class="empty tui-text_body-s">
            Сделок пока нет. Рыночная заявка исполняется на открытии следующей свечи.
          </div>
        } @else {
          <div class="table-scroll">
            <table class="arena-table">
              <thead>
                <tr>
                  <th>Свеча</th>
                  <th>Бумага</th>
                  <th>Сторона</th>
                  <th class="num">Лоты</th>
                  <th class="num">Цена</th>
                  <th class="num">Сумма</th>
                  <th class="num">Издержки</th>
                </tr>
              </thead>
              <tbody>
                @for (fill of fills(); track fill.id) {
                  <tr>
                    <td class="tui-text_body-xs">{{ formatCandle(fill.day, fill.candleInDay) }}</td>
                    <td>Бумага {{ fill.paperId }}</td>
                    <td [class]="fill.side === 'buy' ? 'pos' : 'neg'">
                      {{ fill.side === 'buy' ? 'Покупка' : 'Продажа' }}
                    </td>
                    <td class="num">{{ formatLots(fill.lots) }}</td>
                    <td class="num">{{ formatPrice(fill.price) }}</td>
                    <td class="num">{{ formatPct(fill.amountPct) }}</td>
                    <td class="num">{{ formatPct(fill.costPct) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </section>
  `,
  styles: `
    .panel {
      background: var(--tui-background-base);
      border: 1px solid var(--tui-border-normal);
      border-radius: var(--tui-radius-l);
      overflow: hidden;
    }

    .tabs-bar {
      padding: 0 1rem;
    }

    .tab-badge {
      margin-left: 0.4rem;
    }

    .empty {
      padding: 1.5rem 1rem;
      text-align: center;
      color: var(--tui-text-secondary);
    }

    .table-scroll {
      overflow-x: auto;
      max-height: 20rem;
    }

    .arena-table {
      width: 100%;
      border-collapse: collapse;
    }

    .arena-table th {
      text-align: left;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--tui-text-secondary);
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid var(--tui-border-normal);
      white-space: nowrap;
    }

    .arena-table td {
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid var(--tui-border-normal);
      white-space: nowrap;
    }

    .arena-table tr:last-child td {
      border-bottom: 0;
    }

    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .actions-cell {
      text-align: right;
      display: flex;
      justify-content: flex-end;
      gap: 0.25rem;
    }

    .pos {
      color: var(--tui-text-positive);
      font-weight: 600;
    }

    .neg {
      color: var(--tui-text-negative);
      font-weight: 600;
    }
  `,
})
export class ArenaOrdersPanel {
  readonly activeOrders = input.required<readonly ArenaOrder[]>();
  readonly fills = input.required<readonly ArenaFill[]>();
  readonly finished = input.required<boolean>();

  readonly cancelOrder = output<string>();
  readonly replaceOrder = output<ArenaOrder>();

  protected readonly activeTab = signal(0);
  protected readonly formatLots = formatLots;
  protected readonly formatPrice = formatPrice;
  protected readonly formatPct = formatPct;
  protected readonly formatCandle = formatBlindCandleLabel;

  protected typeLabel(type: ArenaOrder['type']): string {
    return ORDER_TYPE_LABELS[type];
  }

  protected describeOrder(order: ArenaOrder): string {
    const parts: string[] = [];
    if (order.limitPrice !== undefined) {
      parts.push(`лимит ${formatPrice(order.limitPrice)}`);
    }
    if (order.stopPrice !== undefined) {
      parts.push(`стоп ${formatPrice(order.stopPrice)}`);
    }
    if (order.takeProfitPrice !== undefined) {
      parts.push(`тейк ${formatPrice(order.takeProfitPrice)}`);
    }
    if (order.trailingPct !== undefined) {
      parts.push(`отступ ${formatPct(order.trailingPct)}`);
    }
    return parts.length > 0 ? parts.join(', ') : 'по рынку';
  }
}

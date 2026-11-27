import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { TermHint } from '../../../shared/term-hint/term-hint';
import { BondCalculation, BondSummary } from '../data/instruments.models';
import { formatDateRu, formatDurationYears, formatPct, formatRub } from '../instruments.format';

@Component({
  selector: 'app-bond-ytm-calculator',
  imports: [FormsModule, TuiButton, TuiBadge, TermHint],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel calc-panel" aria-label="Калькулятор доходности облигации">
      <div class="calc-header">
        <div>
          <span class="tui-text_body-xs muted calc-eyebrow">Серверный YTM-калькулятор</span>
          <h2 class="tui-text_h6 calc-title">
            @if (bond(); as b) {
              {{ b.name }}
            } @else {
              Выберите облигацию
            }
          </h2>
        </div>
        @if (bond(); as b) {
          <div class="calc-badges">
            <span tuiBadge size="s" [appearance]="b.bondType === 'OFZ' ? 'info' : 'neutral'">
              {{ b.bondType === 'OFZ' ? 'ОФЗ' : 'Корпоративная' }}
            </span>
            @if (b.amortized) {
              <span tuiBadge size="s" appearance="warning">Амортизация</span>
            }
          </div>
        }
      </div>

      @if (bond(); as b) {
        <div class="calc-body">
          <div class="calc-meta tui-text_body-xs muted">
            <span class="mono">{{ b.ticker }}</span>
            <span>·</span>
            <span>{{ b.issuer }}</span>
            <span>·</span>
            <span>Номинал {{ formatRub(b.faceValueRub) }}</span>
          </div>

          <div class="price-control">
            <div class="price-control-top">
              <label for="bond-price-pct-input" class="tui-text_body-s field-label">
                Цена (% от номинала)
              </label>
              <button
                type="button"
                tuiButton
                size="xs"
                appearance="flat"
                class="reset-price-btn"
                [disabled]="loading() || pricePct() === b.pricePct"
                (click)="resetPrice.emit()"
              >
                К текущей ({{ formatPct(b.pricePct) }})
              </button>
            </div>

            <div class="price-inputs-row">
              <input
                id="bond-price-pct-slider"
                type="range"
                class="price-slider"
                min="30"
                max="130"
                step="0.5"
                aria-label="Цена в процентах от номинала"
                [ngModel]="pricePct()"
                (ngModelChange)="onPriceChange($event)"
              />
              <div class="price-number-wrap">
                <input
                  id="bond-price-pct-input"
                  type="number"
                  class="price-number-input num"
                  min="10"
                  max="200"
                  step="0.1"
                  [ngModel]="pricePct()"
                  (ngModelChange)="onPriceChange($event)"
                />
                <span class="price-unit muted">%</span>
              </div>
            </div>
          </div>

          @if (error(); as err) {
            <p class="calc-error tui-text_body-s" role="alert">{{ err }}</p>
          }

          @if (result(); as res) {
            <div class="calc-hero" [class.calc-loading]="loading()">
              <div class="hero-metric">
                <span class="metric-label muted">
                  Доходность к погашению (YTM)
                  <app-term-hint
                    term="YTM (Доходность к погашению)"
                    text="Эффективная годовая доходность облигации с учётом цены покупки, всех оставшихся купонов и возврата номинала в дату погашения."
                  />
                </span>
                <strong class="hero-value num positive">{{ formatPct(res.ytmPct) }}</strong>
              </div>
              <div class="hero-metric">
                <span class="metric-label muted">
                  Текущая доходность
                  <app-term-hint
                    term="Текущая доходность"
                    text="Отношение годовых купонных выплат к чистой цене покупки, без учёта разницы между ценой покупки и номиналом при погашении."
                  />
                </span>
                <strong class="hero-subvalue num">{{ formatPct(res.currentYieldPct) }}</strong>
              </div>
            </div>

            <div class="calc-kv-list" [class.calc-loading]="loading()">
              <div class="kv">
                <span class="muted">Чистая цена</span>
                <span class="num">{{ formatRub(res.cleanPriceRub) }}</span>
              </div>
              <div class="kv">
                <span class="muted label-with-hint">
                  <span>НКД</span>
                  <app-term-hint
                    term="НКД (Накопленный купонный доход)"
                    text="Часть ближайшего купона, накопленная с даты предыдущей выплаты. Вы компенсируете её продавцу при покупке и получаете весь купон целиком в дату выплаты."
                  />
                </span>
                <span class="num">{{ formatRub(res.accruedInterestRub) }}</span>
              </div>
              <div class="kv kv-strong">
                <span>Полная цена покупки</span>
                <span class="num">{{ formatRub(res.dirtyPriceRub) }}</span>
              </div>
              <div class="divider"></div>
              <div class="kv">
                <span class="muted label-with-hint">
                  <span>Купон</span>
                  <app-term-hint
                    term="Купон"
                    text="Регулярная процентная выплата держателю облигации."
                  />
                </span>
                <span class="num">
                  {{ formatRub(res.couponValueRub) }} (раз в {{ b.couponPeriodDays }} дн.)
                </span>
              </div>
              <div class="kv">
                <span class="muted">Ближайший купон</span>
                <span class="num">{{ formatDateRu(res.nextCouponDate) }}</span>
              </div>
              @if (b.offerDate) {
                <div class="kv">
                  <span class="muted">Дата оферты</span>
                  <span class="num">{{ formatDateRu(b.offerDate) }}</span>
                </div>
              }
              <div class="kv">
                <span class="muted">Осталось купонов</span>
                <span class="num">{{ res.remainingCouponsCount }}</span>
              </div>
              <div class="kv">
                <span class="muted">До погашения / дюрация</span>
                <span class="num">
                  {{ formatDurationYears(res.yearsToMaturity) }} /
                  {{ formatDurationYears(b.durationYears) }}
                </span>
              </div>
            </div>

            @if (res.amortized) {
              <p class="amort-note tui-text_body-xs muted">
                Облигация с амортизацией: часть номинала возвращается до даты погашения, поэтому
                сумма будущих купонов постепенно уменьшается.
              </p>
            }
          } @else if (loading()) {
            <p class="tui-text_body-s muted">Считаем доходность на сервере…</p>
          }
        </div>
      } @else {
        <div class="calc-empty tui-text_body-s muted">
          Нажмите на любую облигацию в списке слева, чтобы рассчитать полную цену с НКД и доходность
          к погашению (YTM) при разной цене покупки.
        </div>
      }
    </section>
  `,
  styles: `
    .calc-panel {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .calc-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 1rem 1.15rem 0.85rem;
      border-bottom: 1px solid var(--ttsc-border);
    }

    .calc-eyebrow {
      display: block;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 600;
      margin-bottom: 0.15rem;
    }

    .calc-title {
      margin: 0;
    }

    .calc-badges {
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
    }

    .calc-body {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      padding: 1rem 1.15rem 1.15rem;
    }

    .calc-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      align-items: center;
    }

    .muted {
      color: var(--tui-text-secondary);
    }

    .price-control {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem 0.85rem;
      border-radius: 10px;
      background: var(--tui-background-elevation-2, var(--ttsc-surface-alt));
      border: 1px solid var(--ttsc-border);
    }

    .price-control-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .field-label {
      font-weight: 600;
    }

    .price-inputs-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .price-slider {
      flex: 1;
      min-width: 0;
      accent-color: var(--ttsc-accent);
      cursor: pointer;
    }

    .price-number-wrap {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      border-radius: 8px;
      border: 1px solid var(--ttsc-border);
      background: var(--tui-background-elevation-1);
    }

    .price-number-input {
      width: 4.5rem;
      border: none;
      background: transparent;
      color: var(--tui-text-primary);
      font-size: 0.9rem;
      font-weight: 600;
      text-align: right;
      outline: none;
    }

    .price-unit {
      font-size: 0.8rem;
    }

    .calc-hero {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      padding: 0.85rem;
      border-radius: 10px;
      border: 1px solid var(--ttsc-border);
      background: var(--tui-background-elevation-2, var(--ttsc-surface-alt));
      transition: opacity 0.15s ease;
    }

    .calc-loading {
      opacity: 0.65;
    }

    .hero-metric {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .metric-label {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.75rem;
      line-height: 1.3;
    }

    .hero-value {
      font-size: 1.35rem;
      line-height: 1.2;
      color: var(--ttsc-positive);
    }

    .hero-subvalue {
      font-size: 1.1rem;
      line-height: 1.2;
      color: var(--tui-text-primary);
    }

    .calc-kv-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      font-size: 0.875rem;
      transition: opacity 0.15s ease;
    }

    .kv {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .kv-strong {
      font-weight: 700;
      color: var(--tui-text-primary);
    }

    .label-with-hint {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }

    .divider {
      height: 1px;
      background: var(--ttsc-border);
      margin: 0.2rem 0;
    }

    .amort-note {
      margin: 0;
      padding: 0.6rem 0.75rem;
      border-radius: 8px;
      background: var(--ttsc-accent-soft);
      color: var(--tui-text-primary);
      line-height: 1.4;
    }

    .calc-error {
      margin: 0;
      color: var(--ttsc-negative);
    }

    .calc-empty {
      padding: 1.5rem 1.15rem;
      line-height: 1.5;
    }
  `,
})
export class BondYtmCalculator {
  readonly bond = input<BondSummary | null>(null);
  readonly pricePct = input<number>(100);
  readonly result = input<BondCalculation | null>(null);
  readonly loading = input<boolean>(false);
  readonly error = input<string | null>(null);

  readonly pricePctChange = output<number>();
  readonly resetPrice = output<void>();

  protected readonly formatRub = formatRub;
  protected readonly formatPct = formatPct;
  protected readonly formatDurationYears = formatDurationYears;
  protected readonly formatDateRu = formatDateRu;

  protected onPriceChange(raw: number | string | null): void {
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(parsed) && parsed >= 10 && parsed <= 200) {
      this.pricePctChange.emit(parsed);
    }
  }
}

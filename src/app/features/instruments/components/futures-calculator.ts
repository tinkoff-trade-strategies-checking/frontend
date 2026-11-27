import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { TermHint } from '../../../shared/term-hint/term-hint';
import { FuturesCalculation, FuturesDirection, FuturesSummary } from '../data/instruments.models';
import {
  formatDateRu,
  formatLeverage,
  formatNumber,
  formatRub,
  formatSignedPct,
  formatSignedRub,
} from '../instruments.format';

@Component({
  selector: 'app-futures-calculator',
  imports: [FormsModule, TuiButton, TuiBadge, TermHint],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel calc-panel" aria-label="Калькулятор фьючерса">
      <div class="calc-header">
        <div>
          <span class="tui-text_body-xs muted calc-eyebrow">Серверный калькулятор ФОРТС</span>
          <h2 class="tui-text_h6 calc-title">
            @if (future(); as f) {
              {{ f.name }}
            } @else {
              Выберите фьючерс
            }
          </h2>
        </div>
        @if (future(); as f) {
          <span tuiBadge size="s" [appearance]="f.settlementType === 'CASH' ? 'info' : 'warning'">
            {{ f.settlementType === 'CASH' ? 'Расчётный' : 'Поставочный' }}
          </span>
        }
      </div>

      @if (future(); as f) {
        <div class="calc-body">
          <div class="calc-meta tui-text_body-xs muted">
            <span class="mono">{{ f.ticker }}</span>
            <span>·</span>
            <span>Базовый актив: {{ f.underlying }}</span>
            <span>·</span>
            <span>Шаг {{ formatNumber(f.priceStep) }} = {{ formatRub(f.stepPriceRub) }}</span>
          </div>

          <div class="calc-controls">
            <div class="controls-top">
              <div class="direction-toggle" role="group" aria-label="Направление позиции">
                <button
                  type="button"
                  class="dir-btn"
                  [class.active-long]="direction() === 'LONG'"
                  [attr.aria-pressed]="direction() === 'LONG'"
                  data-futures-dir="LONG"
                  (click)="directionChange.emit('LONG')"
                >
                  Лонг (покупка)
                </button>
                <button
                  type="button"
                  class="dir-btn"
                  [class.active-short]="direction() === 'SHORT'"
                  [attr.aria-pressed]="direction() === 'SHORT'"
                  data-futures-dir="SHORT"
                  (click)="directionChange.emit('SHORT')"
                >
                  Шорт (продажа)
                </button>
              </div>

              <button
                type="button"
                tuiButton
                size="xs"
                appearance="flat"
                [disabled]="loading()"
                (click)="resetParams.emit()"
              >
                Сбросить
              </button>
            </div>

            <div class="inputs-grid">
              <label class="field-box" for="futures-entry-price">
                <span class="tui-text_body-xs muted">Цена входа</span>
                <input
                  id="futures-entry-price"
                  type="number"
                  class="num-input num"
                  [step]="f.priceStep"
                  min="0.0001"
                  [ngModel]="entryPrice()"
                  (ngModelChange)="onEntryPriceChange($event)"
                />
              </label>

              <label class="field-box" for="futures-current-price">
                <span class="tui-text_body-xs muted">Текущая цена</span>
                <input
                  id="futures-current-price"
                  type="number"
                  class="num-input num"
                  [step]="f.priceStep"
                  min="0.0001"
                  [ngModel]="currentPrice()"
                  (ngModelChange)="onCurrentPriceChange($event)"
                />
              </label>

              <label class="field-box" for="futures-contracts">
                <span class="tui-text_body-xs muted">Контракты</span>
                <input
                  id="futures-contracts"
                  type="number"
                  class="num-input num"
                  min="1"
                  max="100000"
                  step="1"
                  [ngModel]="contracts()"
                  (ngModelChange)="onContractsChange($event)"
                />
              </label>
            </div>
          </div>

          @if (error(); as err) {
            <p class="calc-error tui-text_body-s" role="alert">{{ err }}</p>
          }

          @if (result(); as res) {
            <div class="calc-hero" [class.calc-loading]="loading()">
              <div class="hero-metric">
                <span class="metric-label muted">
                  Вариационная маржа
                  <app-term-hint
                    term="Вариационная маржа"
                    text="Прибыль или убыток по фьючерсу в рублях от изменения цены относительно цены входа. Зачисляется или списывается в клиринг."
                  />
                </span>
                <strong
                  class="hero-value num"
                  [class.positive]="res.variationMarginRub > 0"
                  [class.negative]="res.variationMarginRub < 0"
                >
                  {{ formatSignedRub(res.variationMarginRub) }}
                </strong>
              </div>
              <div class="hero-metric">
                <span class="metric-label muted">
                  Доходность на ГО
                  <app-term-hint
                    term="Доходность на ГО (%)"
                    text="Отношение вариационной маржи к сумме заблокированного гарантийного обеспечения. Из-за встроенного плеча процент выше, чем изменение цены актива."
                  />
                </span>
                <strong
                  class="hero-subvalue num"
                  [class.positive]="res.roeOnMarginPct > 0"
                  [class.negative]="res.roeOnMarginPct < 0"
                >
                  {{ formatSignedPct(res.roeOnMarginPct) }}
                </strong>
              </div>
            </div>

            <div class="calc-kv-list" [class.calc-loading]="loading()">
              <div class="kv kv-strong">
                <span class="label-with-hint">
                  <span>Итого ГО</span>
                  <app-term-hint
                    term="ГО (Гарантийное обеспечение)"
                    text="Сумма рублей, которую биржа заморозит на вашем счёте в качестве залога для открытия выбранного числа контрактов."
                  />
                </span>
                <span class="num">{{ formatRub(res.initialMarginTotalRub) }}</span>
              </div>
              <div class="kv">
                <span class="muted">Номинал позиции</span>
                <span class="num">{{ formatRub(res.notionalRub) }}</span>
              </div>
              <div class="kv">
                <span class="muted label-with-hint">
                  <span>Эффективное плечо</span>
                  <app-term-hint
                    term="Эффективное плечо"
                    text="Во сколько раз стоимость позиции превышает гарантийное обеспечение. Чем выше плечо, тем быстрее растёт как прибыль, так и убыток."
                  />
                </span>
                <span class="num">{{ formatLeverage(res.effectiveLeverage) }}</span>
              </div>
              <div class="divider"></div>
              <div class="kv">
                <span class="muted label-with-hint">
                  <span>Дней до экспирации</span>
                  <app-term-hint
                    term="Экспирация"
                    text="Дата завершения обращения контракта. По расчётным фьючерсам происходит финальный денежный расчёт, по поставочным — поставка базового актива."
                  />
                </span>
                <span class="num">
                  @if (res.expired) {
                    Истёк
                  } @else {
                    {{ res.daysToExpiration }} дн. (до {{ formatDateRu(res.expirationDate) }})
                  }
                </span>
              </div>
            </div>
          } @else if (loading()) {
            <p class="tui-text_body-s muted">Считаем маржу на сервере…</p>
          }
        </div>
      } @else {
        <div class="calc-empty tui-text_body-s muted">
          Нажмите на любой фьючерс в таблице слева, чтобы рассчитать вариационную маржу, требуемое
          ГО и эффективное плечо.
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

    .calc-controls {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      padding: 0.75rem 0.85rem;
      border-radius: 10px;
      background: var(--tui-background-elevation-2, var(--ttsc-surface-alt));
      border: 1px solid var(--ttsc-border);
    }

    .controls-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .direction-toggle {
      display: inline-flex;
      border-radius: 8px;
      border: 1px solid var(--ttsc-border);
      overflow: hidden;
      background: var(--tui-background-elevation-1);
    }

    .dir-btn {
      padding: 0.35rem 0.7rem;
      border: none;
      background: transparent;
      color: var(--tui-text-secondary);
      font: inherit;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      transition:
        background-color 0.15s ease,
        color 0.15s ease;

      &.active-long {
        background: var(--tui-status-positive-pale);
        color: var(--ttsc-positive);
      }

      &.active-short {
        background: var(--tui-status-negative-pale);
        color: var(--ttsc-negative);
      }
    }

    .inputs-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.5rem;
    }

    .field-box {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .num-input {
      width: 100%;
      box-sizing: border-box;
      padding: 0.4rem 0.5rem;
      border-radius: 8px;
      border: 1px solid var(--ttsc-border);
      background: var(--tui-background-elevation-1);
      color: var(--tui-text-primary);
      font-size: 0.88rem;
      font-weight: 600;
      outline: none;

      &:focus {
        border-color: var(--ttsc-accent);
      }
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
      font-size: 1.3rem;
      line-height: 1.2;
      color: var(--tui-text-primary);
    }

    .hero-subvalue {
      font-size: 1.1rem;
      line-height: 1.2;
      color: var(--tui-text-primary);
    }

    .positive {
      color: var(--ttsc-positive);
    }

    .negative {
      color: var(--ttsc-negative);
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

    .calc-error {
      margin: 0;
      color: var(--ttsc-negative);
    }

    .calc-empty {
      padding: 1.5rem 1.15rem;
      line-height: 1.5;
    }

    @media (max-width: 520px) {
      .inputs-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class FuturesCalculator {
  readonly future = input<FuturesSummary | null>(null);
  readonly direction = input<FuturesDirection>('LONG');
  readonly entryPrice = input<number>(0);
  readonly currentPrice = input<number>(0);
  readonly contracts = input<number>(1);
  readonly result = input<FuturesCalculation | null>(null);
  readonly loading = input<boolean>(false);
  readonly error = input<string | null>(null);

  readonly directionChange = output<FuturesDirection>();
  readonly entryPriceChange = output<number>();
  readonly currentPriceChange = output<number>();
  readonly contractsChange = output<number>();
  readonly resetParams = output<void>();

  protected readonly formatRub = formatRub;
  protected readonly formatSignedRub = formatSignedRub;
  protected readonly formatSignedPct = formatSignedPct;
  protected readonly formatNumber = formatNumber;
  protected readonly formatLeverage = formatLeverage;
  protected readonly formatDateRu = formatDateRu;

  protected onEntryPriceChange(raw: number | string | null): void {
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      this.entryPriceChange.emit(parsed);
    }
  }

  protected onCurrentPriceChange(raw: number | string | null): void {
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      this.currentPriceChange.emit(parsed);
    }
  }

  protected onContractsChange(raw: number | string | null): void {
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 100000) {
      this.contractsChange.emit(Math.trunc(parsed));
    }
  }
}

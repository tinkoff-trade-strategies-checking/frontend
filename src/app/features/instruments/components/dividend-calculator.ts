import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { TermHint } from '../../../shared/term-hint/term-hint';
import {
  DividendEventSummary,
  DividendPayoutCalculation,
  DividendTaxRate,
} from '../data/instruments.models';
import { formatDateRu, formatPct, formatRub } from '../instruments.format';

@Component({
  selector: 'app-dividend-calculator',
  imports: [FormsModule, TuiButton, TuiBadge, TermHint],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel calc-panel" aria-label="Калькулятор дивидендов">
      <div class="calc-header">
        <div>
          <span class="tui-text_body-xs muted calc-eyebrow">Серверный калькулятор (T+1)</span>
          <h2 class="tui-text_h6 calc-title">
            @if (dividend(); as d) {
              {{ d.issuerName }}
            } @else {
              Выберите дивидендную отсечку
            }
          </h2>
        </div>
        @if (dividend(); as d) {
          <span tuiBadge size="s" appearance="info">{{ d.ticker }}</span>
        }
      </div>

      @if (dividend(); as d) {
        <div class="calc-body">
          <div class="calc-meta tui-text_body-xs muted">
            <span>Дивиденд: {{ formatRub(d.dividendPerShareRub) }} / акц.</span>
            <span>·</span>
            <span>Доходность: {{ formatPct(d.yieldPct) }}</span>
            <span>·</span>
            <span>Оценка дивгэпа: {{ formatPct(d.estimatedGapPct) }}</span>
          </div>

          <div class="calc-controls">
            <div class="controls-top">
              <div class="tax-toggle" role="group" aria-label="Ставка НДФЛ">
                <button
                  type="button"
                  class="tax-btn"
                  [class.active]="taxRatePct() === 13"
                  [attr.aria-pressed]="taxRatePct() === 13"
                  data-div-tax="13"
                  (click)="taxRateChange.emit(13)"
                >
                  НДФЛ 13%
                </button>
                <button
                  type="button"
                  class="tax-btn"
                  [class.active]="taxRatePct() === 15"
                  [attr.aria-pressed]="taxRatePct() === 15"
                  data-div-tax="15"
                  (click)="taxRateChange.emit(15)"
                >
                  НДФЛ 15%
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

            <label class="field-box" for="dividend-shares-input">
              <span class="tui-text_body-xs muted">Количество акций</span>
              <input
                id="dividend-shares-input"
                type="number"
                class="num-input num"
                min="1"
                max="10000000"
                step="10"
                [ngModel]="shares()"
                (ngModelChange)="onSharesChange($event)"
              />
            </label>
          </div>

          @if (error(); as err) {
            <p class="calc-error tui-text_body-s" role="alert">{{ err }}</p>
          }

          @if (result(); as res) {
            <div class="calc-hero" [class.calc-loading]="loading()">
              <div class="hero-metric">
                <span class="metric-label muted">
                  Чистыми на счёт
                  <app-term-hint
                    term="НДФЛ 13% / 15%"
                    text="Сумма дивидендов, которая поступит на брокерский счёт после автоматического удержания НДФЛ брокером."
                  />
                </span>
                <strong class="hero-value num positive" data-div-metric="net">
                  {{ formatRub(res.netPayoutRub) }}
                </strong>
              </div>
              <div class="hero-metric">
                <span class="metric-label muted">
                  Последний день покупки (T+1)
                  <app-term-hint
                    term="Режим T+1"
                    text="На МосБирже расчёты проходят на следующий рабочий день (T+1). Чтобы попасть в реестр, купите акции не позднее этой даты."
                  />
                </span>
                <strong class="hero-subvalue num" data-div-metric="lastBuyDate">
                  {{ formatDateRu(res.lastBuyDate) }}
                </strong>
              </div>
            </div>

            <div class="calc-kv-list" [class.calc-loading]="loading()">
              <div class="kv">
                <span class="muted">Грязными (до налога)</span>
                <span class="num" data-div-metric="gross">{{ formatRub(res.grossPayoutRub) }}</span>
              </div>
              <div class="kv">
                <span class="muted">Налог НДФЛ ({{ res.taxRatePct }}%)</span>
                <span class="num negative" data-div-metric="tax">
                  −{{ formatRub(res.taxWithheldRub) }}
                </span>
              </div>
              <div class="kv kv-strong">
                <span>Чистыми на счёт</span>
                <span class="num positive">{{ formatRub(res.netPayoutRub) }}</span>
              </div>
              <div class="divider"></div>
              <div class="kv">
                <span class="muted label-with-hint">
                  <span>Дивгэп (экс-дата)</span>
                  <app-term-hint
                    term="Дивидендный гэп"
                    text="День, когда акция открывается ниже примерно на размер дивиденда за вычетом налога. Покупка в эту дату уже не даёт право на выплату."
                  />
                </span>
                <span class="num">{{ formatDateRu(res.exDividendDate) }}</span>
              </div>
              <div class="kv">
                <span class="muted label-with-hint">
                  <span>Закрытие реестра</span>
                  <app-term-hint
                    term="Дивидендная отсечка"
                    text="Официальная дата фиксации списка акционеров для выплаты дивидендов."
                  />
                </span>
                <span class="num">{{ formatDateRu(res.recordDate) }}</span>
              </div>
              <div class="kv">
                <span class="muted">Ориентир выплаты</span>
                <span class="num">{{ formatDateRu(res.paymentDate) }}</span>
              </div>
            </div>
          } @else if (loading()) {
            <p class="tui-text_body-s muted">Считаем дивиденды на сервере…</p>
          }
        </div>
      } @else {
        <div class="calc-empty tui-text_body-s muted">
          Нажмите на любую компанию в таблице слева, чтобы рассчитать дивиденды грязными, налог НДФЛ
          и чистую выплату на счёт с учётом режима T+1.
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

    .tax-toggle {
      display: inline-flex;
      border-radius: 8px;
      border: 1px solid var(--ttsc-border);
      overflow: hidden;
      background: var(--tui-background-elevation-1);
    }

    .tax-btn {
      padding: 0.35rem 0.75rem;
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

      &.active {
        background: var(--ttsc-accent-soft);
        color: var(--ttsc-accent-text);
      }
    }

    .field-box {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .num-input {
      width: 100%;
      box-sizing: border-box;
      padding: 0.45rem 0.55rem;
      border-radius: 8px;
      border: 1px solid var(--ttsc-border);
      background: var(--tui-background-elevation-1);
      color: var(--tui-text-primary);
      font-size: 0.9rem;
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
      font-size: 1.05rem;
      line-height: 1.25;
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
  `,
})
export class DividendCalculator {
  readonly dividend = input<DividendEventSummary | null>(null);
  readonly shares = input<number>(100);
  readonly taxRatePct = input<DividendTaxRate>(13);
  readonly result = input<DividendPayoutCalculation | null>(null);
  readonly loading = input<boolean>(false);
  readonly error = input<string | null>(null);

  readonly sharesChange = output<number>();
  readonly taxRateChange = output<DividendTaxRate>();
  readonly resetParams = output<void>();

  protected readonly formatRub = formatRub;
  protected readonly formatPct = formatPct;
  protected readonly formatDateRu = formatDateRu;

  protected onSharesChange(raw: number | string | null): void {
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(parsed) && parsed >= 1) {
      this.sharesChange.emit(Math.trunc(parsed));
    }
  }
}

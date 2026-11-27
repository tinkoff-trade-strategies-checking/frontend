import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton } from '@taiga-ui/core';
import { TermHint } from '../../../shared/term-hint/term-hint';
import {
  TAX_ACCOUNT_TYPE_LABELS,
  TaxAccountType,
  TaxCalculation,
} from '../data/instruments.models';
import { formatPct, formatRub } from '../instruments.format';

const ACCOUNT_TYPES: readonly TaxAccountType[] = ['BROKERAGE', 'IIS_A', 'IIS_B', 'IIS_3'];

@Component({
  selector: 'app-tax-iis-calculator',
  imports: [FormsModule, TuiButton, TermHint],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel calc-panel" aria-label="Калькулятор НДФЛ и ИИС">
      <div class="calc-header">
        <div>
          <span class="tui-text_body-xs muted calc-eyebrow">Серверный налоговый расчёт (РФ)</span>
          <h2 class="tui-text_h6 calc-title">
            Калькулятор НДФЛ и ИИС
            <app-term-hint
              term="ИИС (А / Б / 3)"
              text="Индивидуальный инвестиционный счёт снижает налоги: тип А возвращает НДФЛ с взносов (до 400 000 ₽ в год), тип Б освобождает от налога прибыль со сделок, ИИС-3 объединяет обе льготы при долгосрочном владении."
            />
          </h2>
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

      <div class="calc-body">
        <div class="account-pills" role="group" aria-label="Тип счёта">
          @for (acc of accountTypes; track acc) {
            <button
              type="button"
              class="account-pill"
              [class.active]="accountType() === acc"
              [attr.aria-pressed]="accountType() === acc"
              [attr.data-tax-account]="acc"
              (click)="accountTypeChange.emit(acc)"
            >
              {{ accountLabels[acc] }}
            </button>
          }
        </div>

        <div class="inputs-grid">
          <label class="field-box" for="tax-gross-profit">
            <span class="tui-text_body-xs muted label-with-hint">
              <span>Прибыль от сделок (₽)</span>
              <app-term-hint
                term="НДФЛ 13% / 15%"
                text="Положительный финансовый результат от продажи ценных бумаг за год. Базовая ставка 13 %, сверх порога прогрессивной шкалы — 15 %."
              />
            </span>
            <input
              id="tax-gross-profit"
              type="number"
              class="num-input num"
              min="0"
              step="10000"
              [ngModel]="grossProfitRub()"
              (ngModelChange)="onNonNegativeChange($event, grossProfitChange)"
            />
          </label>

          <label class="field-box" for="tax-prior-losses">
            <span class="tui-text_body-xs muted label-with-hint">
              <span>Убытки прошлых лет (₽)</span>
              <app-term-hint
                term="Сальдирование убытков"
                text="Перенесённые убытки прошлых лет (до 10 лет) уменьшают налогооблагаемую прибыль от сделок. Дивиденды с убытками не сальдируются."
              />
            </span>
            <input
              id="tax-prior-losses"
              type="number"
              class="num-input num"
              min="0"
              step="5000"
              [ngModel]="priorLossesRub()"
              (ngModelChange)="onNonNegativeChange($event, priorLossesChange)"
            />
          </label>

          <label class="field-box" for="tax-dividends">
            <span class="tui-text_body-xs muted">Дивиденды (₽)</span>
            <input
              id="tax-dividends"
              type="number"
              class="num-input num"
              min="0"
              step="5000"
              [ngModel]="dividendsRub()"
              (ngModelChange)="onNonNegativeChange($event, dividendsChange)"
            />
          </label>

          <label class="field-box" for="tax-iis-contributions">
            <span class="tui-text_body-xs muted">Взносы на ИИС за год (₽)</span>
            <input
              id="tax-iis-contributions"
              type="number"
              class="num-input num"
              min="0"
              step="25000"
              [disabled]="accountType() === 'BROKERAGE' || accountType() === 'IIS_B'"
              [ngModel]="annualContributionsRub()"
              (ngModelChange)="onNonNegativeChange($event, annualContributionsChange)"
            />
          </label>
        </div>

        @if (error(); as err) {
          <p class="calc-error tui-text_body-s" role="alert">{{ err }}</p>
        }

        @if (result(); as res) {
          <div class="calc-hero" [class.calc-loading]="loading()">
            <div class="hero-metric">
              <span class="metric-label muted">Итог на руки (с вычетом)</span>
              <strong class="hero-value num positive" data-tax-metric="net">
                {{ formatRub(res.netAfterTaxRub) }}
              </strong>
            </div>
            <div class="hero-metric">
              <span class="metric-label muted">Эффективная ставка</span>
              <strong class="hero-subvalue num" data-tax-metric="effectiveRate">
                {{ formatPct(res.effectiveTaxRatePct) }}
              </strong>
            </div>
          </div>

          <div class="calc-kv-list" [class.calc-loading]="loading()">
            <div class="kv">
              <span class="muted">Налогооблагаемая база (сделки)</span>
              <span class="num" data-tax-metric="taxableProfit">
                {{ formatRub(res.taxableProfitRub) }}
              </span>
            </div>
            <div class="kv">
              <span class="muted">Зачтённый убыток (сальдирование)</span>
              <span class="num positive" data-tax-metric="lossOffset">
                {{ formatRub(res.lossOffsetUsedRub) }}
              </span>
            </div>
            <div class="divider"></div>
            <div class="kv">
              <span class="muted">Налог со сделок</span>
              <span class="num negative" data-tax-metric="tradingTax">
                {{ formatRub(res.tradingTaxRub) }}
              </span>
            </div>
            <div class="kv">
              <span class="muted">Налог с дивидендов</span>
              <span class="num negative" data-tax-metric="dividendTax">
                {{ formatRub(res.dividendTaxRub) }}
              </span>
            </div>
            <div class="kv">
              <span class="muted">Итого налог НДФЛ</span>
              <span class="num negative">{{ formatRub(res.totalTaxRub) }}</span>
            </div>
            <div class="kv kv-strong">
              <span class="label-with-hint">
                <span>Налоговый вычет ИИС-А / ИИС-3</span>
                <app-term-hint
                  term="Вычет на взнос"
                  text="Возврат НДФЛ со взносов на ИИС типа А или ИИС-3 (в пределах лимита 400 000 ₽ в год при наличии официального дохода, облагаемого НДФЛ)."
                />
              </span>
              <span class="num positive" data-tax-metric="iisRefund">
                +{{ formatRub(res.iisDeductionRefundRub) }}
              </span>
            </div>
          </div>
        } @else if (loading()) {
          <p class="tui-text_body-s muted">Считаем налоги на сервере…</p>
        }
      </div>
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
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .calc-body {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      padding: 1rem 1.15rem 1.15rem;
    }

    .muted {
      color: var(--tui-text-secondary);
    }

    .account-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .account-pill {
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      border: 1px solid var(--ttsc-border);
      background: var(--tui-background-elevation-1);
      color: var(--tui-text-secondary);
      font: inherit;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      transition:
        border-color 0.15s ease,
        background-color 0.15s ease,
        color 0.15s ease;

      &:hover {
        border-color: var(--tui-border-hover);
        color: var(--tui-text-primary);
      }

      &.active {
        border-color: var(--ttsc-accent);
        background: var(--ttsc-accent-soft);
        color: var(--ttsc-accent-text);
        font-weight: 600;
      }
    }

    .inputs-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.65rem;
      padding: 0.8rem 0.9rem;
      border-radius: 10px;
      background: var(--tui-background-elevation-2, var(--ttsc-surface-alt));
      border: 1px solid var(--ttsc-border);
    }

    .field-box {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .num-input {
      width: 100%;
      box-sizing: border-box;
      padding: 0.42rem 0.55rem;
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

      &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
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
      font-size: 0.75rem;
      line-height: 1.3;
    }

    .hero-value {
      font-size: 1.3rem;
      line-height: 1.2;
    }

    .hero-subvalue {
      font-size: 1.15rem;
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

    @media (max-width: 560px) {
      .inputs-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class TaxIisCalculator {
  readonly accountType = input<TaxAccountType>('BROKERAGE');
  readonly grossProfitRub = input<number>(250000);
  readonly priorLossesRub = input<number>(50000);
  readonly dividendsRub = input<number>(40000);
  readonly annualContributionsRub = input<number>(400000);
  readonly result = input<TaxCalculation | null>(null);
  readonly loading = input<boolean>(false);
  readonly error = input<string | null>(null);

  readonly accountTypeChange = output<TaxAccountType>();
  readonly grossProfitChange = output<number>();
  readonly priorLossesChange = output<number>();
  readonly dividendsChange = output<number>();
  readonly annualContributionsChange = output<number>();
  readonly resetParams = output<void>();

  protected readonly accountTypes = ACCOUNT_TYPES;
  protected readonly accountLabels = TAX_ACCOUNT_TYPE_LABELS;
  protected readonly formatRub = formatRub;
  protected readonly formatPct = formatPct;

  protected onNonNegativeChange(
    raw: number | string | null,
    emitter: { emit(value: number): void },
  ): void {
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      emitter.emit(parsed);
    }
  }
}

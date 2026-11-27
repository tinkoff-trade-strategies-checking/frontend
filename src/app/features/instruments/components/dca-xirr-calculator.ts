import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton } from '@taiga-ui/core';
import { TermHint } from '../../../shared/term-hint/term-hint';
import { DcaCalculation, DcaCashflowItem } from '../data/instruments.models';
import { formatRub, formatSignedPct, formatSignedRub } from '../instruments.format';

@Component({
  selector: 'app-dca-xirr-calculator',
  imports: [FormsModule, TuiButton, TermHint],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel calc-panel" aria-label="Калькулятор пополнений DCA и XIRR">
      <div class="calc-header">
        <div>
          <span class="tui-text_body-xs muted calc-eyebrow">Серверный расчёт доходности</span>
          <h2 class="tui-text_h6 calc-title">
            Калькулятор пополнений (DCA / XIRR)
            <app-term-hint
              term="DCA (Усреднение по времени)"
              text="Регулярные пополнения портфеля равными суммами по графику. Укажите даты и суммы пополнений (отрицательные значения — снятия) и итоговую стоимость портфеля."
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
        <div class="cashflows-box">
          <div class="cashflows-head">
            <span class="tui-text_body-xs muted">
              Денежные потоки ({{ cashflows().length }}) — положительные = взнос, отрицательные =
              вывод
            </span>
            <button
              type="button"
              tuiButton
              size="xs"
              appearance="outline"
              data-dca-add-row
              (click)="addCashflow.emit()"
            >
              + Добавить строку
            </button>
          </div>

          <div class="cashflow-rows">
            @for (cf of cashflows(); track $index) {
              <div class="cashflow-row" [attr.data-dca-row]="$index">
                <input
                  type="date"
                  class="row-input"
                  [attr.aria-label]="'Дата операции ' + ($index + 1)"
                  [ngModel]="cf.date"
                  (ngModelChange)="onDateChange($index, $event)"
                />
                <input
                  type="number"
                  class="row-input num"
                  step="5000"
                  placeholder="Сумма, ₽"
                  [attr.aria-label]="'Сумма операции ' + ($index + 1)"
                  [ngModel]="cf.amountRub"
                  (ngModelChange)="onAmountChange($index, $event)"
                />
                <button
                  type="button"
                  class="remove-btn"
                  [disabled]="cashflows().length <= 1"
                  [attr.aria-label]="'Удалить строку ' + ($index + 1)"
                  [attr.data-dca-remove]="$index"
                  (click)="removeCashflow.emit($index)"
                >
                  ×
                </button>
              </div>
            }
          </div>

          <div class="final-grid">
            <label class="field-box" for="dca-final-value">
              <span class="tui-text_body-xs muted">Итоговая стоимость портфеля (₽)</span>
              <input
                id="dca-final-value"
                type="number"
                class="row-input num"
                min="0"
                step="5000"
                [ngModel]="finalValueRub()"
                (ngModelChange)="onFinalValueChange($event)"
              />
            </label>

            <label class="field-box" for="dca-final-date">
              <span class="tui-text_body-xs muted">Дата оценки</span>
              <input
                id="dca-final-date"
                type="date"
                class="row-input"
                [ngModel]="finalDate()"
                (ngModelChange)="onFinalDateChange($event)"
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
                XIRR (годовых %)
                <app-term-hint
                  term="XIRR / TWR"
                  text="XIRR (внутренняя норма доходности) учитывает точные даты и размеры ваших пополнений и показывает личную годовую доходность инвестора."
                />
              </span>
              <strong
                class="hero-value num"
                data-dca-metric="xirr"
                [class.positive]="res.xirrPct > 0"
                [class.negative]="res.xirrPct < 0"
              >
                {{ formatSignedPct(res.xirrPct) }}
              </strong>
            </div>
            <div class="hero-metric">
              <span class="metric-label muted">
                TWR %
                <app-term-hint
                  term="TWR (Доходность, взвешенная по времени)"
                  text="Оценивает результат самой стратегии, очищенный от влияния моментов пополнений и выводов средств."
                />
              </span>
              <strong
                class="hero-subvalue num"
                data-dca-metric="twr"
                [class.positive]="res.twrPct > 0"
                [class.negative]="res.twrPct < 0"
              >
                {{ formatSignedPct(res.twrPct) }}
              </strong>
            </div>
          </div>

          <div class="calc-kv-list" [class.calc-loading]="loading()">
            <div class="kv">
              <span class="muted">Всего внесено</span>
              <span class="num" data-dca-metric="contributed">
                {{ formatRub(res.totalContributedRub) }}
              </span>
            </div>
            @if (res.totalWithdrawnRub > 0) {
              <div class="kv">
                <span class="muted">Выведено средств</span>
                <span class="num">{{ formatRub(res.totalWithdrawnRub) }}</span>
              </div>
            }
            <div class="kv kv-strong">
              <span>Чистая прибыль</span>
              <span
                class="num"
                data-dca-metric="netProfit"
                [class.positive]="res.netProfitRub > 0"
                [class.negative]="res.netProfitRub < 0"
              >
                {{ formatSignedRub(res.netProfitRub) }}
              </span>
            </div>
            <div class="kv">
              <span class="muted">Простая доходность</span>
              <span class="num" data-dca-metric="simpleReturn">
                {{ formatSignedPct(res.simpleReturnPct) }}
              </span>
            </div>
            <div class="divider"></div>
            <div class="kv">
              <span class="muted">Срок инвестирования</span>
              <span class="num">{{ res.holdingDays }} дн. · {{ res.cashflowsCount }} опер.</span>
            </div>
          </div>
        } @else if (loading()) {
          <p class="tui-text_body-s muted">Считаем XIRR и TWR на сервере…</p>
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

    .cashflows-box {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      padding: 0.8rem 0.9rem;
      border-radius: 10px;
      background: var(--tui-background-elevation-2, var(--ttsc-surface-alt));
      border: 1px solid var(--ttsc-border);
    }

    .cashflows-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .cashflow-rows {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }

    .cashflow-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
      gap: 0.45rem;
      align-items: center;
    }

    .final-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.6rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--ttsc-border);
    }

    .field-box {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .row-input {
      width: 100%;
      box-sizing: border-box;
      padding: 0.4rem 0.5rem;
      border-radius: 8px;
      border: 1px solid var(--ttsc-border);
      background: var(--tui-background-elevation-1);
      color: var(--tui-text-primary);
      font-size: 0.86rem;
      font-weight: 600;
      outline: none;

      &:focus {
        border-color: var(--ttsc-accent);
      }
    }

    .remove-btn {
      width: 1.9rem;
      height: 1.9rem;
      border-radius: 8px;
      border: 1px solid var(--ttsc-border);
      background: var(--tui-background-elevation-1);
      color: var(--tui-text-secondary);
      font-size: 1rem;
      line-height: 1;
      cursor: pointer;

      &:hover:not(:disabled) {
        border-color: var(--ttsc-negative);
        color: var(--ttsc-negative);
      }

      &:disabled {
        opacity: 0.4;
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
      .final-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class DcaXirrCalculator {
  readonly cashflows = input<readonly DcaCashflowItem[]>([]);
  readonly finalValueRub = input<number>(236000);
  readonly finalDate = input<string>('2026-01-15');
  readonly result = input<DcaCalculation | null>(null);
  readonly loading = input<boolean>(false);
  readonly error = input<string | null>(null);

  readonly cashflowChange = output<{ readonly index: number; readonly item: DcaCashflowItem }>();
  readonly addCashflow = output<void>();
  readonly removeCashflow = output<number>();
  readonly finalValueChange = output<number>();
  readonly finalDateChange = output<string>();
  readonly resetParams = output<void>();

  protected readonly formatRub = formatRub;
  protected readonly formatSignedRub = formatSignedRub;
  protected readonly formatSignedPct = formatSignedPct;

  protected onDateChange(index: number, raw: string | null): void {
    const current = this.cashflows()[index];
    if (!current || !raw) {
      return;
    }
    this.cashflowChange.emit({ index, item: { ...current, date: raw } });
  }

  protected onAmountChange(index: number, raw: number | string | null): void {
    const current = this.cashflows()[index];
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (!current || !Number.isFinite(parsed) || parsed === 0) {
      return;
    }
    this.cashflowChange.emit({ index, item: { ...current, amountRub: parsed } });
  }

  protected onFinalValueChange(raw: number | string | null): void {
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      this.finalValueChange.emit(parsed);
    }
  }

  protected onFinalDateChange(raw: string | null): void {
    if (raw) {
      this.finalDateChange.emit(raw);
    }
  }
}

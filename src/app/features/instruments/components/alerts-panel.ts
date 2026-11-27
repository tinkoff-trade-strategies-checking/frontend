import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { TermHint } from '../../../shared/term-hint/term-hint';
import {
  ALERT_CONDITION_LABELS,
  CreatePriceAlertParams,
  PriceAlert,
  PriceAlertConditionType,
} from '../data/instruments.models';
import { formatDateRu, formatNumber } from '../instruments.format';

const CONDITION_OPTIONS: readonly {
  readonly id: PriceAlertConditionType;
  readonly label: string;
}[] = [
  { id: 'PRICE_ABOVE', label: ALERT_CONDITION_LABELS.PRICE_ABOVE },
  { id: 'PRICE_BELOW', label: ALERT_CONDITION_LABELS.PRICE_BELOW },
  { id: 'RSI_BELOW', label: ALERT_CONDITION_LABELS.RSI_BELOW },
  { id: 'RSI_ABOVE', label: ALERT_CONDITION_LABELS.RSI_ABOVE },
];

@Component({
  selector: 'app-alerts-panel',
  imports: [FormsModule, TuiButton, TuiBadge, TermHint],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel alerts-panel" aria-label="Мои алерты">
      <div class="alerts-header">
        <div>
          <span class="tui-text_body-xs muted">Персональные сигналы (до 50 активных)</span>
          <h2 class="tui-text_h6 alerts-title">
            Мои алерты ({{ alerts().length }})
            <app-term-hint
              term="Ценовой / RSI алерт"
              text="Условие отслеживания цены или индикатора RSI по выбранному тикеру. Удобно, чтобы фиксировать ключевые уровни входа и перепроданности."
            />
          </h2>
        </div>
      </div>

      <form class="alert-form" (ngSubmit)="onSubmit()">
        <div class="form-row">
          <label class="field-box" for="alert-ticker-input">
            <span class="tui-text_body-xs muted">Тикер</span>
            <input
              id="alert-ticker-input"
              name="ticker"
              type="text"
              class="text-input mono"
              maxlength="32"
              placeholder="SBER"
              [ngModel]="ticker()"
              (ngModelChange)="ticker.set(($event ?? '').toUpperCase())"
            />
          </label>

          <label class="field-box" for="alert-condition-select">
            <span class="tui-text_body-xs muted">Условие</span>
            <select
              id="alert-condition-select"
              name="conditionType"
              class="text-input"
              [ngModel]="conditionType()"
              (ngModelChange)="onConditionChange($event)"
            >
              @for (opt of conditionOptions; track opt.id) {
                <option [value]="opt.id">{{ opt.label }}</option>
              }
            </select>
          </label>
        </div>

        <div class="form-row">
          <label class="field-box" for="alert-threshold-input">
            <span class="tui-text_body-xs muted">
              Порог ({{ isRsiCondition() ? 'RSI 1–100' : '₽' }})
            </span>
            <input
              id="alert-threshold-input"
              name="thresholdValue"
              type="number"
              class="text-input num"
              min="0.0001"
              [max]="isRsiCondition() ? 100 : null"
              step="any"
              [ngModel]="thresholdValue()"
              (ngModelChange)="thresholdValue.set($event)"
            />
          </label>

          <label class="field-box" for="alert-note-input">
            <span class="tui-text_body-xs muted">Заметка (необязательно)</span>
            <input
              id="alert-note-input"
              name="note"
              type="text"
              class="text-input"
              maxlength="200"
              placeholder="Напр.: зона поддержки"
              [ngModel]="note()"
              (ngModelChange)="note.set($event ?? '')"
            />
          </label>
        </div>

        @if (validationError(); as vErr) {
          <p class="form-error tui-text_body-xs" role="alert">{{ vErr }}</p>
        }

        @if (error(); as apiErr) {
          <p class="form-error tui-text_body-xs" role="alert">{{ apiErr }}</p>
        }

        <button
          tuiButton
          type="submit"
          size="s"
          appearance="primary"
          data-alert-submit
          [disabled]="saving()"
        >
          {{ saving() ? 'Сохраняем…' : 'Создать алерт' }}
        </button>
      </form>

      <div class="alerts-list">
        @if (alerts().length === 0) {
          <p class="tui-text_body-s muted empty-note">
            Активных алертов пока нет. Добавьте первый выше — например, SBER цена выше 310 ₽ или RSI
            ниже 30.
          </p>
        } @else {
          @for (alert of alerts(); track alert.id) {
            <article class="alert-item" [attr.data-alert-id]="alert.id">
              <div class="alert-item-main">
                <div class="alert-item-top">
                  <strong class="mono">{{ alert.ticker }}</strong>
                  <span tuiBadge size="s" [appearance]="badgeAppearance(alert.conditionType)">
                    {{ conditionLabels[alert.conditionType] }}
                    {{ formatThreshold(alert) }}
                  </span>
                </div>
                @if (alert.note) {
                  <p class="tui-text_body-xs muted alert-note">{{ alert.note }}</p>
                }
                <span class="tui-text_body-xs muted">
                  Создан: {{ formatDateRu(alert.createdAt) }}
                </span>
              </div>

              <button
                tuiButton
                type="button"
                size="xs"
                appearance="flat"
                [attr.data-alert-delete]="alert.id"
                [disabled]="deletingId() === alert.id"
                (click)="deleteAlert.emit(alert.id)"
              >
                Удалить
              </button>
            </article>
          }
        }
      </div>
    </section>
  `,
  styles: [
    `
      .alerts-panel {
        padding: 1.15rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .alerts-title {
        margin: 0.15rem 0 0;
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }

      .muted {
        color: var(--tui-text-secondary);
      }

      .alert-form {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--ttsc-border);
      }

      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.65rem;
      }

      .field-box {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .text-input {
        height: 2.15rem;
        padding: 0 0.6rem;
        border-radius: 8px;
        border: 1px solid var(--ttsc-border);
        background: var(--tui-background-elevation-1);
        color: var(--tui-text-primary);
        font: inherit;
        font-size: 0.85rem;
        width: 100%;
        box-sizing: border-box;
      }

      .form-error {
        margin: 0;
        color: var(--ttsc-negative);
      }

      .alerts-list {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }

      .empty-note {
        margin: 0;
        line-height: 1.45;
      }

      .alert-item {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.65rem;
        padding: 0.75rem 0.85rem;
        border-radius: 10px;
        border: 1px solid var(--ttsc-border);
        background: var(--tui-background-elevation-2, var(--ttsc-surface-alt));
      }

      .alert-item-main {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        min-width: 0;
      }

      .alert-item-top {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: wrap;
      }

      .alert-note {
        margin: 0;
        word-break: break-word;
      }

      @media (max-width: 640px) {
        .form-row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AlertsPanel {
  readonly alerts = input.required<readonly PriceAlert[]>();
  readonly draftTicker = input<string>('SBER');
  readonly saving = input<boolean>(false);
  readonly deletingId = input<string | null>(null);
  readonly error = input<string | null>(null);

  readonly createAlert = output<CreatePriceAlertParams>();
  readonly deleteAlert = output<string>();

  protected readonly conditionOptions = CONDITION_OPTIONS;
  protected readonly conditionLabels = ALERT_CONDITION_LABELS;
  protected readonly formatDateRu = formatDateRu;

  protected readonly ticker = signal('SBER');
  protected readonly conditionType = signal<PriceAlertConditionType>('PRICE_ABOVE');
  protected readonly thresholdValue = signal<number | string>(310);
  protected readonly note = signal('');
  protected readonly validationError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const next = this.draftTicker().trim().toUpperCase();
      if (next) {
        this.ticker.set(next);
      }
    });
  }

  protected isRsiCondition(): boolean {
    const c = this.conditionType();
    return c === 'RSI_BELOW' || c === 'RSI_ABOVE';
  }

  protected onConditionChange(next: PriceAlertConditionType): void {
    this.conditionType.set(next);
    if ((next === 'RSI_BELOW' || next === 'RSI_ABOVE') && Number(this.thresholdValue()) > 100) {
      this.thresholdValue.set(next === 'RSI_BELOW' ? 30 : 70);
    }
  }

  protected badgeAppearance(
    conditionType: PriceAlertConditionType,
  ): 'positive' | 'negative' | 'info' | 'warning' {
    if (conditionType === 'PRICE_ABOVE') {
      return 'positive';
    }
    if (conditionType === 'PRICE_BELOW') {
      return 'negative';
    }
    if (conditionType === 'RSI_BELOW') {
      return 'info';
    }
    return 'warning';
  }

  protected formatThreshold(alert: PriceAlert): string {
    const num = formatNumber(alert.thresholdValue);
    if (alert.conditionType === 'RSI_BELOW' || alert.conditionType === 'RSI_ABOVE') {
      return num;
    }
    return `${num} ₽`;
  }

  protected onSubmit(): void {
    this.validationError.set(null);
    const cleanTicker = this.ticker().trim().toUpperCase();
    if (!cleanTicker) {
      this.validationError.set('Укажите тикер бумаги, например SBER.');
      return;
    }
    const threshold = Number(this.thresholdValue());
    if (!Number.isFinite(threshold) || threshold <= 0) {
      this.validationError.set('Порог должен быть числом больше 0.');
      return;
    }
    if (this.isRsiCondition() && threshold > 100) {
      this.validationError.set('Для условий по RSI порог должен быть от 1 до 100.');
      return;
    }
    this.createAlert.emit({
      ticker: cleanTicker,
      conditionType: this.conditionType(),
      thresholdValue: threshold,
      note: this.note().trim() || null,
    });
    this.note.set('');
  }
}

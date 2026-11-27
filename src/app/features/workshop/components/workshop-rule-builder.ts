import { ChangeDetectionStrategy, Component, computed, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton } from '@taiga-ui/core';
import {
  BUILDER_ACTION_LABELS,
  BUILDER_INDICATOR_LABELS,
  BuilderAction,
  BuilderComparator,
  BuilderIndicator,
  BuilderRule,
  comparatorLabel,
  defaultBuilderRule,
  generateDsl,
  MAX_BUILDER_RULES,
} from '../data/rule-builder';

@Component({
  selector: 'app-workshop-rule-builder',
  imports: [FormsModule, TuiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rule-builder" aria-label="Конструктор правил Если → То">
      <p class="tui-text_body-s muted">
        Соберите правила без кода: выберите условие и действие — конструктор напишет DSL, который
        пройдёт ту же проверку.
      </p>

      @for (rule of rules(); track $index; let i = $index) {
        <div class="builder-row" [attr.data-builder-row]="i">
          <span class="builder-label">Если</span>
          <select
            class="builder-input"
            [attr.aria-label]="'Индикатор правила ' + (i + 1)"
            [ngModel]="rule.indicator"
            (ngModelChange)="patch(i, { indicator: $event })"
          >
            @for (opt of indicatorOptions; track opt.id) {
              <option [value]="opt.id">{{ opt.label }}</option>
            }
          </select>
          <select
            class="builder-input"
            [attr.aria-label]="'Условие правила ' + (i + 1)"
            [ngModel]="rule.comparator"
            (ngModelChange)="patch(i, { comparator: $event })"
          >
            <option value="below">{{ label(rule, 'below') }}</option>
            <option value="above">{{ label(rule, 'above') }}</option>
          </select>

          @if (rule.indicator === 'rsi') {
            <label class="builder-num">
              период
              <input
                type="number"
                min="2"
                max="100"
                [ngModel]="rule.period"
                (ngModelChange)="patch(i, { period: +$event })"
              />
            </label>
            <label class="builder-num">
              уровень
              <input
                type="number"
                min="1"
                max="99"
                [ngModel]="rule.level"
                (ngModelChange)="patch(i, { level: +$event })"
              />
            </label>
          } @else if (rule.indicator === 'sma_price') {
            <label class="builder-num">
              период
              <input
                type="number"
                min="2"
                max="250"
                [ngModel]="rule.period"
                (ngModelChange)="patch(i, { period: +$event })"
              />
            </label>
          } @else {
            <label class="builder-num">
              быстрая
              <input
                type="number"
                min="2"
                max="250"
                [ngModel]="rule.fastPeriod"
                (ngModelChange)="patch(i, { fastPeriod: +$event })"
              />
            </label>
            <label class="builder-num">
              медленная
              <input
                type="number"
                min="2"
                max="250"
                [ngModel]="rule.slowPeriod"
                (ngModelChange)="patch(i, { slowPeriod: +$event })"
              />
            </label>
          }

          <span class="builder-label">То</span>
          <select
            class="builder-input"
            [attr.aria-label]="'Действие правила ' + (i + 1)"
            [ngModel]="rule.action"
            (ngModelChange)="patch(i, { action: $event })"
          >
            <option value="buy">{{ actionLabels.buy }}</option>
            <option value="sell">{{ actionLabels.sell }}</option>
          </select>
          <label class="builder-num">
            {{ rule.action === 'buy' ? '% свободных денег' : '% позиции' }}
            <input
              type="number"
              min="1"
              max="100"
              [ngModel]="rule.sizePct"
              (ngModelChange)="patch(i, { sizePct: +$event })"
            />
          </label>

          <button
            tuiButton
            type="button"
            size="xs"
            appearance="flat"
            [disabled]="rules().length <= 1"
            [attr.data-builder-remove]="i"
            (click)="remove(i)"
          >
            Удалить
          </button>
        </div>
      }

      <div class="builder-actions">
        <button
          tuiButton
          type="button"
          size="xs"
          appearance="outline"
          data-builder-add
          [disabled]="rules().length >= maxRules"
          (click)="add()"
        >
          Добавить правило
        </button>
        <button
          tuiButton
          type="button"
          size="xs"
          appearance="primary"
          data-builder-apply
          (click)="apply()"
        >
          Вставить в редактор
        </button>
      </div>

      <details class="builder-preview">
        <summary class="tui-text_body-xs muted">Показать получившийся код</summary>
        <pre data-builder-preview>{{ preview() }}</pre>
      </details>
    </section>
  `,
  styles: [
    `
      .rule-builder {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        padding: 0.85rem 1rem;
        border: 1px dashed var(--ttsc-border);
        border-radius: 12px;
      }

      .muted {
        color: var(--tui-text-secondary);
        margin: 0;
      }

      .builder-row {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 0.5rem;
      }

      .builder-label {
        font-weight: 700;
        align-self: center;
      }

      .builder-input,
      .builder-num input {
        height: 2rem;
        padding: 0 0.5rem;
        border-radius: 8px;
        border: 1px solid var(--ttsc-border);
        background: var(--tui-background-elevation-1);
        color: var(--tui-text-primary);
        font: inherit;
        font-size: 0.82rem;
      }

      .builder-num {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        font-size: 0.72rem;
        color: var(--tui-text-secondary);
      }

      .builder-num input {
        width: 5rem;
      }

      .builder-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .builder-preview pre {
        margin: 0.5rem 0 0;
        padding: 0.65rem;
        border-radius: 8px;
        background: var(--tui-background-neutral-1);
        font-size: 0.78rem;
        overflow-x: auto;
      }
    `,
  ],
})
export class WorkshopRuleBuilder {
  readonly applyCode = output<string>();

  protected readonly maxRules = MAX_BUILDER_RULES;
  protected readonly actionLabels = BUILDER_ACTION_LABELS;
  protected readonly indicatorOptions: readonly {
    readonly id: BuilderIndicator;
    readonly label: string;
  }[] = (Object.keys(BUILDER_INDICATOR_LABELS) as BuilderIndicator[]).map((id) => ({
    id,
    label: BUILDER_INDICATOR_LABELS[id],
  }));

  protected readonly rules = signal<readonly BuilderRule[]>([
    defaultBuilderRule('buy'),
    defaultBuilderRule('sell'),
  ]);
  protected readonly preview = computed(() => generateDsl(this.rules()));

  protected label(rule: BuilderRule, comparator: BuilderComparator): string {
    return comparatorLabel(rule.indicator, comparator);
  }

  protected patch(index: number, change: Partial<BuilderRule>): void {
    this.rules.update((list) =>
      list.map((rule, i) => (i === index ? { ...rule, ...change } : rule)),
    );
  }

  protected add(): void {
    if (this.rules().length >= MAX_BUILDER_RULES) {
      return;
    }
    this.rules.update((list) => [...list, defaultBuilderRule('buy' as BuilderAction)]);
  }

  protected remove(index: number): void {
    if (this.rules().length <= 1) {
      return;
    }
    this.rules.update((list) => list.filter((_, i) => i !== index));
  }

  protected apply(): void {
    this.applyCode.emit(this.preview());
  }
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { TermHint } from '../../../shared/term-hint/term-hint';
import { OptionGreeksCalculation, OptionSummary } from '../data/instruments.models';
import {
  formatDateRu,
  formatGreek,
  formatNumber,
  formatPct,
  formatRub,
} from '../instruments.format';

@Component({
  selector: 'app-option-greeks-calculator',
  imports: [FormsModule, TuiButton, TuiBadge, TermHint],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel calc-panel" aria-label="Калькулятор греков опциона">
      <div class="calc-header">
        <div>
          <span class="tui-text_body-xs muted calc-eyebrow">Калькулятор Блэка — Шоулза</span>
          <h2 class="tui-text_h6 calc-title">
            @if (option(); as opt) {
              {{ opt.name }}
            } @else {
              Выберите опцион
            }
          </h2>
        </div>
        @if (option(); as opt) {
          <span
            tuiBadge
            size="s"
            [appearance]="opt.optionType === 'CALL' ? 'positive' : 'negative'"
          >
            {{ opt.optionType === 'CALL' ? 'Call (колл)' : 'Put (пут)' }}
          </span>
        }
      </div>

      @if (option(); as opt) {
        <div class="calc-body">
          <div class="calc-meta tui-text_body-xs muted">
            <span class="mono">{{ opt.ticker }}</span>
            <span>·</span>
            <span>Страйк {{ formatNumber(opt.strike) }}</span>
            <span>·</span>
            <span>ГО {{ formatRub(opt.initialMarginRub) }}</span>
          </div>

          <div class="calc-controls">
            <div class="controls-top">
              <span class="tui-text_body-s field-label">Параметры модели</span>
              <button
                type="button"
                tuiButton
                size="xs"
                appearance="flat"
                [disabled]="loading()"
                (click)="resetParams.emit()"
              >
                К рыночным
              </button>
            </div>

            <div class="inputs-grid">
              <label class="field-box" for="option-spot-input">
                <span class="tui-text_body-xs muted">Спот</span>
                <input
                  id="option-spot-input"
                  type="number"
                  class="num-input num"
                  min="0.01"
                  step="any"
                  [ngModel]="spot()"
                  (ngModelChange)="onSpotChange($event)"
                />
              </label>

              <label class="field-box" for="option-iv-input">
                <span class="tui-text_body-xs muted">Волатильность IV (%)</span>
                <input
                  id="option-iv-input"
                  type="number"
                  class="num-input num"
                  min="1"
                  max="500"
                  step="1"
                  [ngModel]="volatilityPct()"
                  (ngModelChange)="onVolatilityChange($event)"
                />
              </label>

              <label class="field-box" for="option-rate-input">
                <span class="tui-text_body-xs muted">Ставка (%)</span>
                <input
                  id="option-rate-input"
                  type="number"
                  class="num-input num"
                  min="0"
                  max="100"
                  step="0.5"
                  [ngModel]="riskFreeRatePct()"
                  (ngModelChange)="onRiskFreeRateChange($event)"
                />
              </label>
            </div>

            <div class="slider-row">
              <span class="tui-text_body-xs muted">IV {{ formatPct(volatilityPct()) }}</span>
              <input
                id="option-iv-slider"
                type="range"
                class="iv-slider"
                min="5"
                max="150"
                step="1"
                aria-label="Волатильность IV в процентах"
                [ngModel]="volatilityPct()"
                (ngModelChange)="onVolatilityChange($event)"
              />
            </div>
          </div>

          @if (error(); as err) {
            <p class="calc-error tui-text_body-s" role="alert">{{ err }}</p>
          }

          @if (result(); as res) {
            <div class="calc-hero" [class.calc-loading]="loading()">
              <div class="hero-metric">
                <span class="metric-label muted">
                  Теоретическая цена
                  <app-term-hint
                    term="Теоретическая цена (Премия)"
                    text="Справедливая стоимость опциона по модели Блэка — Шоулза. Складывается из внутренней и временной стоимости."
                  />
                </span>
                <strong class="hero-value num">{{ formatNumber(res.premium) }}</strong>
              </div>
              <div class="hero-split">
                <div class="mini-metric">
                  <span class="tui-text_body-xs muted">Внутренняя</span>
                  <span class="num mini-val">{{ formatNumber(res.intrinsicValue) }}</span>
                </div>
                <div class="mini-metric">
                  <span class="tui-text_body-xs muted">Временная</span>
                  <span class="num mini-val">{{ formatNumber(res.timeValue) }}</span>
                </div>
              </div>
            </div>

            <div class="greeks-section" [class.calc-loading]="loading()">
              <div class="greeks-heading tui-text_body-xs muted">
                <span>Греки опциона</span>
                <app-term-hint
                  term="Греки опциона"
                  text="Показатели чувствительности цены опциона к движению базового актива, времени, волатильности и процентной ставки."
                />
              </div>

              <div class="greeks-grid">
                <div class="greek-card" data-greek="delta">
                  <span class="greek-label muted">
                    Delta (Δ)
                    <app-term-hint
                      term="Delta (Δ)"
                      text="На сколько изменится цена опциона при росте базового актива на 1 пункт. Для Call от 0 до +1, для Put от -1 до 0. Также примерно отражает вероятность истечения «в деньгах»."
                    />
                  </span>
                  <strong class="greek-val num">{{ formatGreek(res.delta) }}</strong>
                </div>

                <div class="greek-card" data-greek="gamma">
                  <span class="greek-label muted">
                    Gamma (Γ)
                    <app-term-hint
                      term="Gamma (Γ)"
                      text="Скорость изменения Delta при движении базового актива на 1 пункт. Максимальна около страйка и ближе к экспирации."
                    />
                  </span>
                  <strong class="greek-val num">{{ formatGreek(res.gamma) }}</strong>
                </div>

                <div class="greek-card" data-greek="theta">
                  <span class="greek-label muted">
                    Theta (Θ / день)
                    <app-term-hint
                      term="Theta (Θ — временной распад)"
                      text="На сколько пунктов опцион теряет в стоимости за 1 календарный день при неизменной цене базового актива. Покупатель опциона платит тету, продавец — получает."
                    />
                  </span>
                  <strong class="greek-val num" [class.negative]="res.theta < 0">
                    {{ formatGreek(res.theta) }}
                  </strong>
                </div>

                <div class="greek-card" data-greek="vega">
                  <span class="greek-label muted">
                    Vega (ν / +1% IV)
                    <app-term-hint
                      term="Vega (ν — чувствительность к волатильности)"
                      text="На сколько изменится цена опциона при росте подразумеваемой волатильности (IV) на 1 процентный пункт."
                    />
                  </span>
                  <strong class="greek-val num">{{ formatGreek(res.vega) }}</strong>
                </div>

                <div class="greek-card greek-card-wide" data-greek="rho">
                  <span class="greek-label muted">
                    Rho (ρ / +1% ставки)
                    <app-term-hint
                      term="Rho (ρ — чувствительность к ставке)"
                      text="На сколько изменится цена опциона при росте безрисковой процентной ставки на 1 процентный пункт."
                    />
                  </span>
                  <strong class="greek-val num">{{ formatGreek(res.rho) }}</strong>
                </div>
              </div>
            </div>

            <div class="calc-kv-list" [class.calc-loading]="loading()">
              <div class="kv">
                <span class="muted">До экспирации</span>
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
            <p class="tui-text_body-s muted">Считаем цену и греки на сервере…</p>
          }
        </div>
      } @else {
        <div class="calc-empty tui-text_body-s muted">
          Нажмите на любой опцион в таблице слева, чтобы рассчитать теоретическую цену и 5 греков по
          модели Блэка — Шоулза.
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
      gap: 0.6rem;
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
    }

    .field-label {
      font-weight: 600;
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

    .slider-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .iv-slider {
      flex: 1;
      min-width: 0;
      accent-color: var(--ttsc-accent);
      cursor: pointer;
    }

    .calc-hero {
      display: flex;
      align-items: center;
      justify-content: space-between;
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
      gap: 0.2rem;
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
      color: var(--tui-text-primary);
    }

    .hero-split {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      text-align: right;
    }

    .mini-metric {
      display: flex;
      flex-direction: column;
      gap: 0.05rem;
    }

    .mini-val {
      font-size: 0.88rem;
      font-weight: 600;
    }

    .greeks-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      transition: opacity 0.15s ease;
    }

    .greeks-heading {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 600;
    }

    .greeks-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.5rem;
    }

    .greek-card {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      padding: 0.6rem 0.7rem;
      border-radius: 8px;
      border: 1px solid var(--ttsc-border);
      background: var(--tui-background-elevation-2, var(--ttsc-surface-alt));
    }

    .greek-card-wide {
      grid-column: span 2;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }

    .greek-label {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
    }

    .greek-val {
      font-size: 0.98rem;
      font-weight: 700;
      color: var(--tui-text-primary);
    }

    .negative {
      color: var(--ttsc-negative);
    }

    .calc-kv-list {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      font-size: 0.85rem;
    }

    .kv {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
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
export class OptionGreeksCalculator {
  readonly option = input<OptionSummary | null>(null);
  readonly spot = input<number>(0);
  readonly volatilityPct = input<number>(30);
  readonly riskFreeRatePct = input<number>(16);
  readonly result = input<OptionGreeksCalculation | null>(null);
  readonly loading = input<boolean>(false);
  readonly error = input<string | null>(null);

  readonly spotChange = output<number>();
  readonly volatilityPctChange = output<number>();
  readonly riskFreeRatePctChange = output<number>();
  readonly resetParams = output<void>();

  protected readonly formatRub = formatRub;
  protected readonly formatPct = formatPct;
  protected readonly formatNumber = formatNumber;
  protected readonly formatGreek = formatGreek;
  protected readonly formatDateRu = formatDateRu;

  protected onSpotChange(raw: number | string | null): void {
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      this.spotChange.emit(parsed);
    }
  }

  protected onVolatilityChange(raw: number | string | null): void {
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 500) {
      this.volatilityPctChange.emit(parsed);
    }
  }

  protected onRiskFreeRateChange(raw: number | string | null): void {
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      this.riskFreeRatePctChange.emit(parsed);
    }
  }
}

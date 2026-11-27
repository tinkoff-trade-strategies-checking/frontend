import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TuiButton, TuiInput, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { TermHint } from '../../../shared/term-hint/term-hint';
import {
  SCREENER_PRESET_LABELS,
  ScreenerPaper,
  ScreenerPreset,
  ScreenerSortField,
  SortDirection,
} from '../data/instruments.models';
import { formatMarketCapRub, formatPct, formatRatio } from '../instruments.format';

const SCREENER_PRESETS: readonly { readonly id: ScreenerPreset; readonly label: string }[] = [
  { id: 'all', label: SCREENER_PRESET_LABELS.all },
  { id: 'dividend_gt_10', label: SCREENER_PRESET_LABELS.dividend_gt_10 },
  { id: 'undervalued_pe_lt_6', label: SCREENER_PRESET_LABELS.undervalued_pe_lt_6 },
  { id: 'high_roe_gt_20', label: SCREENER_PRESET_LABELS.high_roe_gt_20 },
  { id: 'low_debt_lt_0_5', label: SCREENER_PRESET_LABELS.low_debt_lt_0_5 },
  { id: 'with_fundamentals', label: SCREENER_PRESET_LABELS.with_fundamentals },
];

@Component({
  selector: 'app-screener-panel',
  imports: [FormsModule, RouterLink, TuiButton, TuiBadge, TuiInput, TuiTextfield, TermHint],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="screener-layout">
      <section class="panel screener-catalog" aria-label="Скринер акций MOEX">
        <div class="catalog-toolbar">
          <div class="toolbar-top">
            <h2 class="tui-text_h6 toolbar-title">
              Скринер акций MOEX ({{ totalCount() }} бумаг)
              <app-term-hint
                term="Скринер акций"
                text="Быстрый отбор акций Московской биржи по фундаментальным показателям: P/E, P/B, ROE, дивидендной доходности, долгу и сектору."
              />
            </h2>
            <span class="tui-text_body-xs muted num">
              Найдено: {{ filteredCount() }} из {{ totalCount() }}
            </span>
          </div>

          <div class="filter-pills" role="group" aria-label="Быстрые пресеты скринера">
            @for (preset of presets; track preset.id) {
              <button
                type="button"
                class="filter-pill"
                [class.active]="activePreset() === preset.id"
                [attr.aria-pressed]="activePreset() === preset.id"
                [attr.data-screener-preset]="preset.id"
                (click)="presetChange.emit(preset.id)"
              >
                {{ preset.label }}
              </button>
            }
          </div>

          <div class="screener-controls">
            <tui-textfield tuiTextfieldSize="s" class="search-field">
              <input
                id="screener-search"
                tuiInput
                type="search"
                placeholder="Поиск по тикеру, компании или сектору…"
                aria-label="Поиск акций в скринере"
                [ngModel]="query()"
                (ngModelChange)="queryChange.emit($event ?? '')"
              />
            </tui-textfield>

            <label class="inline-filter" for="screener-sector-select">
              <span class="tui-text_body-xs muted">Сектор</span>
              <select
                id="screener-sector-select"
                class="native-select"
                [ngModel]="sector()"
                (ngModelChange)="sectorChange.emit($event)"
              >
                <option value="all">Все сектора</option>
                @for (s of sectors(); track s) {
                  <option [value]="s">{{ s }}</option>
                }
              </select>
            </label>

            <label class="inline-filter" for="screener-max-pe">
              <span class="tui-text_body-xs muted">P/E max</span>
              <input
                id="screener-max-pe"
                type="number"
                class="num-input num"
                min="0"
                step="0.5"
                placeholder="напр. 8"
                [ngModel]="maxPe()"
                (ngModelChange)="onNullableNumChange($event, maxPeChange)"
              />
            </label>

            <label class="inline-filter" for="screener-min-roe">
              <span class="tui-text_body-xs muted">ROE min %</span>
              <input
                id="screener-min-roe"
                type="number"
                class="num-input num"
                step="1"
                placeholder="напр. 15"
                [ngModel]="minRoe()"
                (ngModelChange)="onNullableNumChange($event, minRoeChange)"
              />
            </label>

            <label class="inline-filter" for="screener-min-div">
              <span class="tui-text_body-xs muted">Див. min %</span>
              <input
                id="screener-min-div"
                type="number"
                class="num-input num"
                min="0"
                step="0.5"
                placeholder="напр. 8"
                [ngModel]="minDivYield()"
                (ngModelChange)="onNullableNumChange($event, minDivYieldChange)"
              />
            </label>

            <button
              type="button"
              tuiButton
              size="xs"
              appearance="flat"
              data-screener-reset
              (click)="resetFilters.emit()"
            >
              Сбросить
            </button>
          </div>
        </div>

        @if (papers().length === 0) {
          <div class="empty-state">
            <p class="tui-text_body-m muted">По выбранным условиям акции не найдены.</p>
            <button
              tuiButton
              type="button"
              size="s"
              appearance="outline"
              (click)="resetFilters.emit()"
            >
              Сбросить фильтры
            </button>
          </div>
        } @else {
          <div class="table-wrap">
            <table class="screener-table">
              <thead>
                <tr>
                  <th>
                    <button
                      type="button"
                      class="sort-btn"
                      data-sort="ticker"
                      (click)="sortToggle.emit('ticker')"
                    >
                      Тикер {{ sortIndicator('ticker') }}
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      class="sort-btn"
                      data-sort="name"
                      (click)="sortToggle.emit('name')"
                    >
                      Компания {{ sortIndicator('name') }}
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      class="sort-btn"
                      data-sort="sector"
                      (click)="sortToggle.emit('sector')"
                    >
                      Сектор {{ sortIndicator('sector') }}
                    </button>
                  </th>
                  <th class="num">
                    <button
                      type="button"
                      class="sort-btn num"
                      data-sort="marketCapRub"
                      (click)="sortToggle.emit('marketCapRub')"
                    >
                      Капитализация {{ sortIndicator('marketCapRub') }}
                    </button>
                  </th>
                  <th class="num">
                    <span class="th-with-hint">
                      <button
                        type="button"
                        class="sort-btn num"
                        data-sort="peRatio"
                        (click)="sortToggle.emit('peRatio')"
                      >
                        P/E {{ sortIndicator('peRatio') }}
                      </button>
                      <app-term-hint
                        term="P/E (Цена / Прибыль)"
                        text="За сколько лет текущей чистой прибыли окупится покупка компании. Чем ниже P/E, тем дешевле оценка."
                      />
                    </span>
                  </th>
                  <th class="num">
                    <span class="th-with-hint">
                      <button
                        type="button"
                        class="sort-btn num"
                        data-sort="pbRatio"
                        (click)="sortToggle.emit('pbRatio')"
                      >
                        P/B {{ sortIndicator('pbRatio') }}
                      </button>
                      <app-term-hint
                        term="P/B (Цена / Балансовая стоимость)"
                        text="Отношение капитализации к собственному капиталу компании. Значение ниже 1 может указывать на недооценку."
                      />
                    </span>
                  </th>
                  <th class="num">
                    <span class="th-with-hint">
                      <button
                        type="button"
                        class="sort-btn num"
                        data-sort="roe"
                        (click)="sortToggle.emit('roe')"
                      >
                        ROE % {{ sortIndicator('roe') }}
                      </button>
                      <app-term-hint
                        term="ROE (Рентабельность капитала)"
                        text="Сколько процентов годовой прибыли компания зарабатывает на собственный капитал."
                      />
                    </span>
                  </th>
                  <th class="num">
                    <button
                      type="button"
                      class="sort-btn num"
                      data-sort="dividendYield"
                      (click)="sortToggle.emit('dividendYield')"
                    >
                      Див. % {{ sortIndicator('dividendYield') }}
                    </button>
                  </th>
                  <th class="num">
                    <span class="th-with-hint">
                      <button
                        type="button"
                        class="sort-btn num"
                        data-sort="debtToEquity"
                        (click)="sortToggle.emit('debtToEquity')"
                      >
                        Долг/Кап. {{ sortIndicator('debtToEquity') }}
                      </button>
                      <app-term-hint
                        term="Долг / Капитал (D/E)"
                        text="Отношение заёмных средств к собственному капиталу. Ниже 0,5 — низкая долговая нагрузка."
                      />
                    </span>
                  </th>
                  <th class="num">
                    <span class="th-with-hint">
                      <button
                        type="button"
                        class="sort-btn num"
                        data-sort="beta"
                        (click)="sortToggle.emit('beta')"
                      >
                        Бета {{ sortIndicator('beta') }}
                      </button>
                      <app-term-hint
                        term="Бета (Beta)"
                        text="Чувствительность акции к колебаниям рынка (IMOEX). Ниже 1 — спокойнее рынка, выше 1 — волатильнее."
                      />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (paper of papers(); track paper.ticker) {
                  @let selected = selectedTicker() === paper.ticker;
                  <tr
                    class="screener-row"
                    [class.selected]="selected"
                    [attr.data-screener-ticker]="paper.ticker"
                    tabindex="0"
                    (click)="selectPaper.emit(paper)"
                    (keydown.enter)="selectPaper.emit(paper)"
                    (keydown.space)="$event.preventDefault(); selectPaper.emit(paper)"
                  >
                    <td>
                      <strong class="mono">{{ paper.ticker }}</strong>
                    </td>
                    <td>{{ paper.name }}</td>
                    <td>
                      <span tuiBadge size="s" appearance="neutral">{{ paper.sector }}</span>
                    </td>
                    <td class="num">{{ formatMarketCapRub(paper.marketCapRub) }}</td>
                    <td class="num">{{ formatRatio(paper.peRatio) }}</td>
                    <td class="num">{{ formatRatio(paper.pbRatio) }}</td>
                    <td class="num" [class.positive-val]="(paper.roe ?? 0) > 20">
                      {{ formatPct(paper.roe) }}
                    </td>
                    <td class="num" [class.positive-val]="(paper.dividendYield ?? 0) > 10">
                      {{ formatPct(paper.dividendYield) }}
                    </td>
                    <td class="num">{{ formatRatio(paper.debtToEquity) }}</td>
                    <td class="num">{{ formatRatio(paper.beta) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (totalPages() > 1) {
            <div class="pagination-bar" data-screener-pagination>
              <span class="tui-text_body-xs muted num">
                Показано {{ pageRangeStart() }}–{{ pageRangeEnd() }} из {{ filteredCount() }}
              </span>
              <div class="pagination-actions">
                <button
                  tuiButton
                  type="button"
                  size="xs"
                  appearance="outline"
                  data-screener-prev
                  [disabled]="page() <= 1"
                  (click)="prevPage.emit()"
                >
                  ← Назад
                </button>
                <span class="tui-text_body-xs muted num pagination-indicator" data-screener-page>
                  Стр. {{ page() }} из {{ totalPages() }}
                </span>
                <button
                  tuiButton
                  type="button"
                  size="xs"
                  appearance="outline"
                  data-screener-next
                  [disabled]="page() >= totalPages()"
                  (click)="nextPage.emit()"
                >
                  Вперёд →
                </button>
              </div>
            </div>
          }
        }
      </section>

      <aside class="fundamentals-col">
        <section class="panel detail-panel" aria-label="Фундаментальный профиль бумаги">
          @if (selectedPaper(); as p) {
            <div class="detail-header">
              <div>
                <span class="tui-text_body-xs muted">Фундаментальные мультипликаторы</span>
                <h3 class="tui-text_h6 detail-title">{{ p.name }}</h3>
                <span class="tui-text_body-xs muted">{{ p.sector }}</span>
              </div>
              <span tuiBadge size="s" appearance="info">{{ p.ticker }}</span>
            </div>

            @if (!p.hasFundamentals) {
              <p class="tui-text_body-s muted no-fund-note">
                Для этой бумаги фундаментальные коэффициенты пока не опубликованы. Вы можете открыть
                её график и потренироваться на исторических данных.
              </p>
            } @else {
              <div class="detail-grid">
                <div class="kv">
                  <span class="muted">Капитализация</span>
                  <strong class="num">{{ formatMarketCapRub(p.marketCapRub) }}</strong>
                </div>
                <div class="kv">
                  <span class="muted">P/E</span>
                  <strong class="num">{{ formatRatio(p.peRatio) }}</strong>
                </div>
                <div class="kv">
                  <span class="muted">P/B</span>
                  <strong class="num">{{ formatRatio(p.pbRatio) }}</strong>
                </div>
                <div class="kv">
                  <span class="muted">P/S</span>
                  <strong class="num">{{ formatRatio(p.psRatio) }}</strong>
                </div>
                <div class="kv">
                  <span class="muted label-with-hint">
                    <span>EV/EBITDA</span>
                    <app-term-hint
                      term="EV/EBITDA"
                      text="Стоимость бизнеса с учётом чистого долга к операционной прибыли до амортизации."
                    />
                  </span>
                  <strong class="num">{{ formatRatio(p.evEbitda) }}</strong>
                </div>
                <div class="kv">
                  <span class="muted">ROE</span>
                  <strong class="num">{{ formatPct(p.roe) }}</strong>
                </div>
                <div class="kv">
                  <span class="muted">Чистая маржа</span>
                  <strong class="num">{{ formatPct(p.netMargin) }}</strong>
                </div>
                <div class="kv">
                  <span class="muted">Долг / Капитал (D/E)</span>
                  <strong class="num">{{ formatRatio(p.debtToEquity) }}</strong>
                </div>
                <div class="kv">
                  <span class="muted">Див. доходность</span>
                  <strong class="num positive-val">{{ formatPct(p.dividendYield) }}</strong>
                </div>
                <div class="kv">
                  <span class="muted">Бета</span>
                  <strong class="num">{{ formatRatio(p.beta) }}</strong>
                </div>
              </div>
            }

            <div class="detail-actions">
              <a
                tuiButton
                size="s"
                appearance="primary"
                [routerLink]="['/new']"
                [queryParams]="{ papers: p.ticker }"
                data-screener-launch
              >
                Тренироваться с {{ p.ticker }}
              </a>
              <button
                tuiButton
                type="button"
                size="s"
                appearance="outline"
                data-screener-alert
                (click)="createAlertForTicker.emit(p.ticker)"
              >
                Создать алерт
              </button>
            </div>
          } @else {
            <p class="tui-text_body-s muted">
              Выберите акцию в таблице, чтобы увидеть мультипликаторы.
            </p>
          }
        </section>
      </aside>
    </div>
  `,
  styles: [
    `
      .screener-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.85fr) minmax(290px, 0.9fr);
        gap: 1.25rem;
        align-items: start;
      }

      .screener-catalog {
        overflow: hidden;
      }

      .fundamentals-col {
        position: sticky;
        top: 1rem;
      }

      .catalog-toolbar {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1rem 1.15rem;
        border-bottom: 1px solid var(--ttsc-border);
        background: var(--tui-background-elevation-2, var(--ttsc-surface-alt));
      }

      .toolbar-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .toolbar-title {
        margin: 0;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
      }

      .muted {
        color: var(--tui-text-secondary);
      }

      .filter-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
      }

      .filter-pill {
        padding: 0.3rem 0.75rem;
        border-radius: 999px;
        border: 1px solid var(--ttsc-border);
        background: var(--tui-background-elevation-1);
        color: var(--tui-text-secondary);
        font: inherit;
        font-size: 0.78rem;
        font-weight: 500;
        cursor: pointer;
        transition:
          border-color 0.15s ease,
          background-color 0.15s ease,
          color 0.15s ease;
      }

      .filter-pill:hover {
        border-color: var(--tui-border-hover);
        color: var(--tui-text-primary);
      }

      .filter-pill.active {
        border-color: var(--ttsc-accent);
        background: var(--ttsc-accent-soft);
        color: var(--ttsc-accent-text);
        font-weight: 600;
      }

      .screener-controls {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 0.65rem;
      }

      .search-field {
        min-width: 14rem;
        flex: 1 1 15rem;
      }

      .inline-filter {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .native-select,
      .num-input {
        height: 2rem;
        padding: 0 0.55rem;
        border-radius: 8px;
        border: 1px solid var(--ttsc-border);
        background: var(--tui-background-elevation-1);
        color: var(--tui-text-primary);
        font: inherit;
        font-size: 0.82rem;
      }

      .num-input {
        width: 5.5rem;
      }

      .table-wrap {
        overflow-x: auto;
      }

      .screener-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.84rem;
      }

      .screener-table th,
      .screener-table td {
        padding: 0.65rem 0.7rem;
        border-bottom: 1px solid var(--ttsc-border);
        vertical-align: middle;
        white-space: nowrap;
      }

      .screener-table thead th {
        font-size: 0.73rem;
        font-weight: 600;
        color: var(--tui-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .sort-btn {
        border: none;
        background: transparent;
        color: inherit;
        font: inherit;
        text-transform: inherit;
        letter-spacing: inherit;
        cursor: pointer;
        padding: 0;
      }

      .sort-btn:hover {
        color: var(--tui-text-primary);
      }

      .th-with-hint {
        display: inline-flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.25rem;
      }

      .screener-row {
        cursor: pointer;
        transition: background-color 0.12s ease;
        content-visibility: auto;
        contain-intrinsic-size: auto 44px;
      }

      .screener-row:hover {
        background: var(--tui-background-neutral-1);
      }

      .screener-row.selected {
        background: var(--ttsc-accent-soft);
      }

      .positive-val {
        color: var(--ttsc-positive);
        font-weight: 600;
      }

      .pagination-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.85rem 1.15rem;
        border-top: 1px solid var(--ttsc-border);
        flex-wrap: wrap;
      }

      .pagination-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .pagination-indicator {
        min-width: 5.5rem;
        text-align: center;
      }

      .detail-panel {
        padding: 1.15rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .detail-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .detail-title {
        margin: 0.15rem 0;
      }

      .no-fund-note {
        margin: 0;
        line-height: 1.45;
      }

      .detail-grid {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .kv {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        font-size: 0.85rem;
        padding-bottom: 0.4rem;
        border-bottom: 1px dashed var(--ttsc-border);
      }

      .kv:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }

      .label-with-hint {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
      }

      .detail-actions {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 2.5rem 1rem;
        text-align: center;
      }

      .empty-state p {
        margin: 0;
      }

      @media (max-width: 1080px) {
        .screener-layout {
          grid-template-columns: 1fr;
        }

        .fundamentals-col {
          position: static;
        }
      }
    `,
  ],
})
export class ScreenerPanel {
  readonly papers = input.required<readonly ScreenerPaper[]>();
  readonly totalCount = input.required<number>();
  readonly filteredCount = input.required<number>();
  readonly sectors = input.required<readonly string[]>();
  readonly query = input.required<string>();
  readonly sector = input.required<string>();
  readonly activePreset = input.required<ScreenerPreset>();
  readonly maxPe = input.required<number | null>();
  readonly minRoe = input.required<number | null>();
  readonly minDivYield = input.required<number | null>();
  readonly sortField = input.required<ScreenerSortField>();
  readonly sortDir = input.required<SortDirection>();
  readonly selectedTicker = input.required<string | null>();
  readonly selectedPaper = input.required<ScreenerPaper | null>();
  readonly page = input<number>(1);
  readonly totalPages = input<number>(1);
  readonly pageSize = input<number>(50);

  readonly queryChange = output<string>();
  readonly sectorChange = output<string>();
  readonly presetChange = output<ScreenerPreset>();
  readonly maxPeChange = output<number | null>();
  readonly minRoeChange = output<number | null>();
  readonly minDivYieldChange = output<number | null>();
  readonly sortToggle = output<ScreenerSortField>();
  readonly resetFilters = output<void>();
  readonly selectPaper = output<ScreenerPaper>();
  readonly prevPage = output<void>();
  readonly nextPage = output<void>();
  readonly createAlertForTicker = output<string>();

  protected readonly presets = SCREENER_PRESETS;
  protected readonly formatMarketCapRub = formatMarketCapRub;
  protected readonly formatPct = formatPct;
  protected readonly formatRatio = formatRatio;

  protected readonly pageRangeStart = computed(() =>
    this.filteredCount() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1,
  );
  protected readonly pageRangeEnd = computed(() =>
    Math.min(this.filteredCount(), (this.page() - 1) * this.pageSize() + this.papers().length),
  );

  protected sortIndicator(field: ScreenerSortField): string {
    if (this.sortField() !== field) {
      return '';
    }
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  protected onNullableNumChange(
    raw: number | string | null | undefined,
    emitter: { emit(value: number | null): void },
  ): void {
    if (raw === '' || raw === null || raw === undefined) {
      emitter.emit(null);
      return;
    }
    const num = Number(raw);
    emitter.emit(Number.isFinite(num) ? num : null);
  }
}

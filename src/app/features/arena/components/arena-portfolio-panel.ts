import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiInput, TuiTextfield } from '@taiga-ui/core';
import { formatLots, formatPct, formatPrice, formatRub } from '../arena.format';
import { ArenaPaper, ArenaPortfolio, ArenaPosition } from '../data/arena.models';

export const PORTFOLIO_COMPACT_THRESHOLD = 5;

@Component({
  selector: 'app-arena-portfolio-panel',
  imports: [FormsModule, TuiInput, TuiTextfield],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <div class="panel-header">
        <h2 class="tui-text_h6">Портфель</h2>
        <span class="tui-text_body-xs muted">
          {{ portfolio().equityRub !== undefined ? 'в ₽ и %' : 'в % от капитала' }}
        </span>
      </div>

      <div class="summary">
        <div class="equity-row">
          <div class="metric-item">
            <span class="tui-text_body-xs muted">Стоимость портфеля</span>
            @let equityRub = portfolio().equityRub;
            <div class="metric-values">
              @if (equityRub !== undefined && equityRub !== null) {
                <span class="tui-text_h5 num">{{ formatRub(equityRub) }}</span>
                <span class="tui-text_body-xs muted num">{{
                  formatPct(portfolio().equityPct)
                }}</span>
              } @else {
                <span class="tui-text_h5 num">{{ formatPct(portfolio().equityPct) }}</span>
              }
            </div>
          </div>
          <div class="metric-item">
            <span class="tui-text_body-xs muted">Прибыль / убыток</span>
            <div class="metric-values">
              @if (portfolio().pnlRub !== undefined) {
                <span
                  class="tui-text_h5 num"
                  [class.pos]="portfolio().pnlPct > 0"
                  [class.neg]="portfolio().pnlPct < 0"
                >
                  {{ formatRub(portfolio().pnlRub!, true) }}
                </span>
                <span
                  class="tui-text_body-xs num"
                  [class.pos]="portfolio().pnlPct > 0"
                  [class.neg]="portfolio().pnlPct < 0"
                >
                  {{ formatPct(portfolio().pnlPct, true) }}
                </span>
              } @else {
                <span
                  class="tui-text_h5 num"
                  [class.pos]="portfolio().pnlPct > 0"
                  [class.neg]="portfolio().pnlPct < 0"
                >
                  {{ formatPct(portfolio().pnlPct, true) }}
                </span>
              }
            </div>
          </div>
        </div>

        <div class="kv">
          <span>Свободные деньги</span>
          <span class="num">
            {{
              portfolio().cashRub !== undefined
                ? formatRub(portfolio().cashRub!)
                : formatPct(portfolio().cashPct)
            }}
          </span>
        </div>
        <div class="kv">
          <span>В бумагах</span>
          <span class="num">
            {{
              portfolio().investedRub !== undefined
                ? formatRub(portfolio().investedRub!)
                : formatPct(portfolio().investedPct)
            }}
          </span>
        </div>
        <div class="kv">
          <span>Издержки</span>
          <span class="num">
            {{
              portfolio().costsRub !== undefined
                ? formatRub(portfolio().costsRub!)
                : formatPct(portfolio().costsPct)
            }}
          </span>
        </div>
      </div>

      @if (isCompactMode()) {
        <div class="pos-controls">
          <div class="pos-filter-tabs" role="tablist" aria-label="Фильтр позиций портфеля">
            <button
              type="button"
              role="tab"
              class="pos-filter-btn"
              [class.active]="showHeldOnly()"
              [attr.aria-selected]="showHeldOnly()"
              (click)="showHeldOnly.set(true)"
            >
              С позицией ({{ heldCount() }})
            </button>
            <button
              type="button"
              role="tab"
              class="pos-filter-btn"
              [class.active]="!showHeldOnly()"
              [attr.aria-selected]="!showHeldOnly()"
              (click)="showHeldOnly.set(false)"
            >
              Все ({{ papers().length }})
            </button>
          </div>
          <tui-textfield tuiTextfieldSize="s" class="pos-search">
            <input
              tuiInput
              type="search"
              autocomplete="off"
              placeholder="Фильтр бумаг…"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
            />
          </tui-textfield>
        </div>
      }

      <div class="pos-table-wrap" [class.bounded]="isCompactMode()">
        @if (visiblePapers().length === 0 && isCompactMode()) {
          <div class="pos-empty tui-text_body-xs muted">
            @if (searchQuery().trim()) {
              Ничего не найдено по запросу.
            } @else {
              Открытых позиций пока нет — переключитесь на «Все ({{ papers().length }})».
            }
          </div>
        } @else {
          <table class="pos-table">
            <thead>
              <tr>
                <th>Бумага</th>
                <th class="num">Лоты</th>
                <th class="num">Цена входа</th>
                <th class="num">Прибыль</th>
              </tr>
            </thead>
            <tbody>
              @for (paper of visiblePapers(); track paper.id) {
                @let pos = positionOf(paper.id);
                <tr
                  class="clickable"
                  [class.selected]="paper.id === selectedPaperId()"
                  (click)="onRowClick(paper.id)"
                >
                  <td>{{ paper.label }}</td>
                  <td class="num">{{ pos ? formatLots(pos.lots) : '0 лот.' }}</td>
                  <td class="num">
                    {{ pos && pos.avgPrice !== null ? formatPrice(pos.avgPrice) : '—' }}
                  </td>
                  <td
                    class="num"
                    [class.pos]="(pos?.pnlPct ?? 0) > 0"
                    [class.neg]="(pos?.pnlPct ?? 0) < 0"
                  >
                    {{ pos && pos.lots > 0 ? formatPct(pos.pnlPct, true) : '—' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </section>
  `,
  styles: `
    .panel {
      background: var(--tui-background-base);
      border: 1px solid var(--tui-border-normal);
      border-radius: var(--tui-radius-l);
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding: 1rem 1rem 0.5rem;
    }

    .panel-header h2 {
      margin: 0;
    }

    .muted {
      color: var(--tui-text-secondary);
    }

    .summary {
      padding: 0 1rem 0.75rem;
    }

    .equity-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
      margin-bottom: 0.65rem;
    }

    .metric-item {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.35rem;
      padding: 0.55rem 0.65rem;
      background: var(--tui-background-neutral-1);
      border-radius: var(--tui-radius-m);
      min-width: 0;
    }

    .metric-values {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .kv {
      display: flex;
      justify-content: space-between;
      padding: 0.35rem 0;
      border-bottom: 1px solid var(--tui-border-normal);
      color: var(--tui-text-secondary);
    }

    .kv:last-child {
      border-bottom: 0;
    }

    .kv span:last-child {
      color: var(--tui-text-primary);
    }

    .pos-controls {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      padding: 0.5rem 0.75rem;
      border-top: 1px solid var(--tui-border-normal);
      background: var(--tui-background-neutral-1);
    }

    .pos-filter-tabs {
      display: flex;
      gap: 0.35rem;
    }

    .pos-filter-btn {
      flex: 1;
      padding: 0.22rem 0.5rem;
      border-radius: 999px;
      border: 1px solid var(--tui-border-normal);
      background: var(--tui-background-base);
      color: var(--tui-text-secondary);
      font: inherit;
      font-size: 0.75rem;
      cursor: pointer;
    }

    .pos-filter-btn.active {
      border-color: var(--ttsc-accent, var(--tui-background-accent-1));
      background: var(--ttsc-accent-soft, var(--tui-background-neutral-2));
      color: var(--ttsc-accent-text, var(--tui-text-primary));
      font-weight: 600;
    }

    .pos-search {
      width: 100%;
    }

    .pos-table-wrap.bounded {
      max-height: 16rem;
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    .pos-empty {
      padding: 0.85rem 0.75rem;
      text-align: center;
      border-top: 1px solid var(--tui-border-normal);
    }

    .pos-table {
      width: 100%;
      border-collapse: collapse;
      border-top: 1px solid var(--tui-border-normal);
    }

    .pos-table th {
      position: sticky;
      top: 0;
      background: var(--tui-background-base);
      text-align: left;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--tui-text-secondary);
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid var(--tui-border-normal);
    }

    .pos-table td {
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid var(--tui-border-normal);
    }

    .pos-table tr:last-child td {
      border-bottom: 0;
    }

    .pos-table tr.clickable {
      cursor: pointer;
    }

    .pos-table tr.clickable:hover td {
      background: var(--tui-background-neutral-1-hover);
    }

    .pos-table tr.selected td {
      background: var(--ttsc-accent-soft, var(--tui-background-neutral-1));
    }

    .pos-table th.num,
    .pos-table td.num,
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .pos {
      color: var(--tui-text-positive);
    }

    .neg {
      color: var(--tui-text-negative);
    }
  `,
})
export class ArenaPortfolioPanel {
  readonly papers = input.required<readonly ArenaPaper[]>();
  readonly portfolio = input.required<ArenaPortfolio>();
  readonly selectedPaperId = input<string | null>(null);

  readonly selectPaper = output<string>();

  protected readonly showHeldOnly = signal(true);
  protected readonly searchQuery = signal('');

  protected readonly formatLots = formatLots;
  protected readonly formatPrice = formatPrice;
  protected readonly formatPct = formatPct;
  protected readonly formatRub = formatRub;

  protected readonly isCompactMode = computed(
    () => this.papers().length > PORTFOLIO_COMPACT_THRESHOLD,
  );

  protected readonly heldCount = computed(() => {
    const positions = this.portfolio().positions;
    return this.papers().reduce((acc, p) => acc + ((positions[p.id]?.lots ?? 0) > 0 ? 1 : 0), 0);
  });

  protected readonly visiblePapers = computed<readonly ArenaPaper[]>(() => {
    const all = this.papers();
    if (!this.isCompactMode()) {
      return all;
    }
    const positions = this.portfolio().positions;
    const query = this.searchQuery().trim().toLowerCase();
    let list = this.showHeldOnly() ? all.filter((p) => (positions[p.id]?.lots ?? 0) > 0) : all;

    if (query) {
      list = list.filter(
        (p) =>
          p.label.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query) ||
          p.sector.toLowerCase().includes(query),
      );
    }
    return list;
  });

  protected positionOf(paperId: string): ArenaPosition | undefined {
    return this.portfolio().positions[paperId];
  }

  protected onRowClick(paperId: string): void {
    this.selectPaper.emit(paperId);
  }
}

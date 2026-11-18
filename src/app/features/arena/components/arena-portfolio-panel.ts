import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { formatLots, formatPct, formatPrice, formatRub } from '../arena.format';
import { ArenaPaper, ArenaPortfolio, ArenaPosition } from '../data/arena.models';

@Component({
  selector: 'app-arena-portfolio-panel',
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
            @if (equityRub !== undefined && equityRub !== null) {
              <span class="tui-text_h5 num">{{ formatRub(equityRub) }}</span>
              <span class="tui-text_body-xs muted num">{{ formatPct(portfolio().equityPct) }}</span>
            } @else {
              <span class="tui-text_h5 num">{{ formatPct(portfolio().equityPct) }}</span>
            }
          </div>
          <div class="metric-item">
            <span class="tui-text_body-xs muted">P&amp;L</span>
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

      <table class="pos-table">
        <thead>
          <tr>
            <th>Бумага</th>
            <th class="num">Лоты</th>
            <th class="num">Средняя</th>
            <th class="num">P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          @for (paper of papers(); track paper.id) {
            @let pos = positionOf(paper.id);
            <tr>
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
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }

    .metric-item {
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

    .pos-table {
      width: 100%;
      border-collapse: collapse;
      border-top: 1px solid var(--tui-border-normal);
    }

    .pos-table th {
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

  protected readonly formatLots = formatLots;
  protected readonly formatPrice = formatPrice;
  protected readonly formatPct = formatPct;
  protected readonly formatRub = formatRub;

  protected positionOf(paperId: string): ArenaPosition | undefined {
    return this.portfolio().positions[paperId];
  }
}

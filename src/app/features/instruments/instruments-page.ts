import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiInput, TuiNotification, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge, TuiSegmented } from '@taiga-ui/kit';
import { INSTRUMENTS_API_IMPL } from '../../api-impls';
import { TermHint } from '../../shared/term-hint/term-hint';
import { BondYtmCalculator } from './components/bond-ytm-calculator';
import {
  BondSummary,
  ETF_CATEGORY_LABELS,
  ETF_FILTER_LABELS,
  INSTRUMENTS_API,
} from './data/instruments.models';
import { formatDateRu, formatDurationYears, formatPct, formatRub } from './instruments.format';
import { BondFilter, EtfFilter, InstrumentsStore } from './instruments.store';

const BOND_FILTERS: readonly { readonly id: BondFilter; readonly label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'ofz', label: 'ОФЗ' },
  { id: 'corporate', label: 'Корпоративные' },
  { id: 'amortized', label: 'С амортизацией' },
];

const ETF_FILTERS: readonly { readonly id: EtfFilter; readonly label: string }[] = [
  { id: 'all', label: ETF_FILTER_LABELS.all },
  { id: 'liquidity', label: ETF_FILTER_LABELS.liquidity },
  { id: 'equity', label: ETF_FILTER_LABELS.equity },
  { id: 'bond', label: ETF_FILTER_LABELS.bond },
  { id: 'gold_currency', label: ETF_FILTER_LABELS.gold_currency },
];

@Component({
  selector: 'app-instruments-page',
  imports: [
    FormsModule,
    TuiButton,
    TuiBadge,
    TuiInput,
    TuiNotification,
    TuiSegmented,
    TuiTextfield,
    TermHint,
    BondYtmCalculator,
  ],
  providers: [{ provide: INSTRUMENTS_API, useClass: INSTRUMENTS_API_IMPL }, InstrumentsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './instruments-page.html',
  styleUrl: './instruments-page.less',
})
export class InstrumentsPage implements OnInit {
  protected readonly store = inject(InstrumentsStore);

  protected readonly bondFilters = BOND_FILTERS;
  protected readonly etfFilters = ETF_FILTERS;
  protected readonly etfCategoryLabels = ETF_CATEGORY_LABELS;

  protected readonly formatRub = formatRub;
  protected readonly formatPct = formatPct;
  protected readonly formatDurationYears = formatDurationYears;
  protected readonly formatDateRu = formatDateRu;

  ngOnInit(): void {
    void this.store.init();
  }

  protected onTabIndexChange(index: number): void {
    this.store.activeTab.set(index === 1 ? 'etfs' : 'bonds');
  }

  protected onSelectBond(bond: BondSummary): void {
    void this.store.selectBond(bond);
  }

  protected onCalcPriceChange(pricePct: number): void {
    void this.store.updateCalcPricePct(pricePct);
  }

  protected onResetCalcPrice(): void {
    void this.store.resetCalcPrice();
  }

  protected retry(): void {
    void this.store.init();
  }
}

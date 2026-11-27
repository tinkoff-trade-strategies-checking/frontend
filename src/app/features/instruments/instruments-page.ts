import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiInput, TuiNotification, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge, TuiSegmented } from '@taiga-ui/kit';
import { INSTRUMENTS_API_IMPL } from '../../api-impls';
import { TermHint } from '../../shared/term-hint/term-hint';
import { BondYtmCalculator } from './components/bond-ytm-calculator';
import { DcaXirrCalculator } from './components/dca-xirr-calculator';
import { DividendCalculator } from './components/dividend-calculator';
import { FuturesCalculator } from './components/futures-calculator';
import { OptionGreeksCalculator } from './components/option-greeks-calculator';
import { TaxIisCalculator } from './components/tax-iis-calculator';
import {
  BondSummary,
  DcaCashflowItem,
  DividendEventSummary,
  DividendTaxRate,
  ETF_CATEGORY_LABELS,
  ETF_FILTER_LABELS,
  FuturesDirection,
  FuturesSummary,
  INSTRUMENTS_API,
  OptionSummary,
  TaxAccountType,
} from './data/instruments.models';
import {
  formatDateRu,
  formatDurationYears,
  formatNumber,
  formatPct,
  formatRub,
} from './instruments.format';
import {
  BondFilter,
  EtfFilter,
  FuturesFilter,
  InstrumentsStore,
  InstrumentsTab,
  OptionFilter,
} from './instruments.store';

const TAB_ORDER: readonly InstrumentsTab[] = [
  'bonds',
  'etfs',
  'futures',
  'options',
  'dividends',
  'tax_dca',
];

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

const FUTURES_FILTERS: readonly { readonly id: FuturesFilter; readonly label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'cash', label: 'Расчётные' },
  { id: 'delivery', label: 'Поставочные' },
];

const OPTION_FILTERS: readonly { readonly id: OptionFilter; readonly label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'call', label: 'Call (колл)' },
  { id: 'put', label: 'Put (пут)' },
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
    FuturesCalculator,
    OptionGreeksCalculator,
    DividendCalculator,
    TaxIisCalculator,
    DcaXirrCalculator,
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
  protected readonly futuresFilters = FUTURES_FILTERS;
  protected readonly optionFilters = OPTION_FILTERS;
  protected readonly etfCategoryLabels = ETF_CATEGORY_LABELS;

  protected readonly formatRub = formatRub;
  protected readonly formatPct = formatPct;
  protected readonly formatNumber = formatNumber;
  protected readonly formatDurationYears = formatDurationYears;
  protected readonly formatDateRu = formatDateRu;

  ngOnInit(): void {
    void this.store.init();
  }

  protected activeTabIndex(): number {
    const idx = TAB_ORDER.indexOf(this.store.activeTab());
    return idx >= 0 ? idx : 0;
  }

  protected onTabIndexChange(index: number): void {
    const tab = TAB_ORDER[index] ?? 'bonds';
    this.store.activeTab.set(tab);
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

  protected onSelectFuture(future: FuturesSummary): void {
    void this.store.selectFuture(future);
  }

  protected onFuturesDirectionChange(direction: FuturesDirection): void {
    void this.store.updateFuturesDirection(direction);
  }

  protected onFuturesEntryPriceChange(price: number): void {
    void this.store.updateFuturesEntryPrice(price);
  }

  protected onFuturesCurrentPriceChange(price: number): void {
    void this.store.updateFuturesCurrentPrice(price);
  }

  protected onFuturesContractsChange(contracts: number): void {
    void this.store.updateFuturesContracts(contracts);
  }

  protected onResetFuturesParams(): void {
    void this.store.resetFuturesParams();
  }

  protected onSelectOption(option: OptionSummary): void {
    void this.store.selectOption(option);
  }

  protected onOptionSpotChange(spot: number): void {
    void this.store.updateOptionSpot(spot);
  }

  protected onOptionVolatilityChange(volatilityPct: number): void {
    void this.store.updateOptionVolatilityPct(volatilityPct);
  }

  protected onOptionRiskFreeRateChange(ratePct: number): void {
    void this.store.updateOptionRiskFreeRatePct(ratePct);
  }

  protected onResetOptionParams(): void {
    void this.store.resetOptionParams();
  }

  protected onSelectDividend(dividend: DividendEventSummary): void {
    void this.store.selectDividend(dividend);
  }

  protected onDividendSharesChange(shares: number): void {
    void this.store.updateDividendShares(shares);
  }

  protected onDividendTaxRateChange(rate: DividendTaxRate): void {
    void this.store.updateDividendTaxRate(rate);
  }

  protected onResetDividendParams(): void {
    void this.store.resetDividendParams();
  }

  protected onTaxAccountTypeChange(accountType: TaxAccountType): void {
    void this.store.updateTaxAccountType(accountType);
  }

  protected onTaxGrossProfitChange(value: number): void {
    void this.store.updateTaxGrossProfit(value);
  }

  protected onTaxPriorLossesChange(value: number): void {
    void this.store.updateTaxPriorLosses(value);
  }

  protected onTaxDividendsChange(value: number): void {
    void this.store.updateTaxDividends(value);
  }

  protected onTaxAnnualContributionsChange(value: number): void {
    void this.store.updateTaxAnnualContributions(value);
  }

  protected onResetTaxParams(): void {
    void this.store.resetTaxParams();
  }

  protected onDcaCashflowChange(event: {
    readonly index: number;
    readonly item: DcaCashflowItem;
  }): void {
    void this.store.updateDcaCashflow(event.index, event.item);
  }

  protected onAddDcaCashflow(): void {
    void this.store.addDcaCashflow();
  }

  protected onRemoveDcaCashflow(index: number): void {
    void this.store.removeDcaCashflow(index);
  }

  protected onDcaFinalValueChange(value: number): void {
    void this.store.updateDcaFinalValue(value);
  }

  protected onDcaFinalDateChange(date: string): void {
    void this.store.updateDcaFinalDate(date);
  }

  protected onResetDcaParams(): void {
    void this.store.resetDcaParams();
  }

  protected retry(): void {
    void this.store.init();
  }
}

import { computed, inject, Injectable, signal } from '@angular/core';
import {
  BondCalculation,
  BondSummary,
  DcaCalculation,
  DcaCashflowItem,
  DividendEventSummary,
  DividendPayoutCalculation,
  DividendTaxRate,
  EtfFilterGroup,
  EtfSummary,
  FuturesCalculation,
  FuturesDirection,
  FuturesSummary,
  INSTRUMENTS_API,
  OptionGreeksCalculation,
  OptionSummary,
  TaxAccountType,
  TaxCalculation,
} from './data/instruments.models';

export type InstrumentsTab = 'bonds' | 'etfs' | 'futures' | 'options' | 'dividends' | 'tax_dca';
export type BondFilter = 'all' | 'ofz' | 'corporate' | 'amortized';
export type EtfFilter = EtfFilterGroup;
export type FuturesFilter = 'all' | 'cash' | 'delivery';
export type OptionFilter = 'all' | 'call' | 'put';

const DEFAULT_DCA_CASHFLOWS: readonly DcaCashflowItem[] = [
  { date: '2025-01-15', amountRub: 50000 },
  { date: '2025-04-15', amountRub: 50000 },
  { date: '2025-07-15', amountRub: 50000 },
  { date: '2025-10-15', amountRub: 50000 },
];
const DEFAULT_DCA_FINAL_VALUE = 236000;
const DEFAULT_DCA_FINAL_DATE = '2026-01-15';

@Injectable()
export class InstrumentsStore {
  private readonly api = inject(INSTRUMENTS_API);

  readonly activeTab = signal<InstrumentsTab>('bonds');

  readonly bonds = signal<readonly BondSummary[]>([]);
  readonly etfs = signal<readonly EtfSummary[]>([]);
  readonly futures = signal<readonly FuturesSummary[]>([]);
  readonly options = signal<readonly OptionSummary[]>([]);
  readonly dividends = signal<readonly DividendEventSummary[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly bondFilter = signal<BondFilter>('all');
  readonly bondQuery = signal('');

  readonly etfFilter = signal<EtfFilter>('all');
  readonly etfQuery = signal('');

  readonly futuresFilter = signal<FuturesFilter>('all');
  readonly futuresQuery = signal('');

  readonly optionFilter = signal<OptionFilter>('all');
  readonly optionQuery = signal('');

  readonly dividendQuery = signal('');

  // Bond YTM calculator state
  readonly selectedBondTicker = signal<string | null>(null);
  readonly calcPricePct = signal<number>(100);
  readonly calcResult = signal<BondCalculation | null>(null);
  readonly calcLoading = signal(false);
  readonly calcError = signal<string | null>(null);

  // Futures calculator state
  readonly selectedFutureTicker = signal<string | null>(null);
  readonly futuresDirection = signal<FuturesDirection>('LONG');
  readonly futuresEntryPrice = signal<number>(0);
  readonly futuresCurrentPrice = signal<number>(0);
  readonly futuresContracts = signal<number>(1);
  readonly futuresCalcResult = signal<FuturesCalculation | null>(null);
  readonly futuresCalcLoading = signal(false);
  readonly futuresCalcError = signal<string | null>(null);

  // Option Greeks calculator state
  readonly selectedOptionTicker = signal<string | null>(null);
  readonly optionSpot = signal<number>(0);
  readonly optionVolatilityPct = signal<number>(30);
  readonly optionRiskFreeRatePct = signal<number>(16);
  readonly optionCalcResult = signal<OptionGreeksCalculation | null>(null);
  readonly optionCalcLoading = signal(false);
  readonly optionCalcError = signal<string | null>(null);

  // Dividend payout calculator state
  readonly selectedDividendId = signal<number | null>(null);
  readonly dividendShares = signal<number>(100);
  readonly dividendTaxRate = signal<DividendTaxRate>(13);
  readonly dividendCalcResult = signal<DividendPayoutCalculation | null>(null);
  readonly dividendCalcLoading = signal(false);
  readonly dividendCalcError = signal<string | null>(null);

  // Tax & IIS calculator state
  readonly taxAccountType = signal<TaxAccountType>('BROKERAGE');
  readonly taxGrossProfitRub = signal<number>(250000);
  readonly taxPriorLossesRub = signal<number>(50000);
  readonly taxDividendsRub = signal<number>(40000);
  readonly taxAnnualContributionsRub = signal<number>(400000);
  readonly taxCalcResult = signal<TaxCalculation | null>(null);
  readonly taxCalcLoading = signal(false);
  readonly taxCalcError = signal<string | null>(null);

  // DCA & XIRR calculator state
  readonly dcaCashflows = signal<readonly DcaCashflowItem[]>(DEFAULT_DCA_CASHFLOWS);
  readonly dcaFinalValueRub = signal<number>(DEFAULT_DCA_FINAL_VALUE);
  readonly dcaFinalDate = signal<string>(DEFAULT_DCA_FINAL_DATE);
  readonly dcaCalcResult = signal<DcaCalculation | null>(null);
  readonly dcaCalcLoading = signal(false);
  readonly dcaCalcError = signal<string | null>(null);

  private calcRequestId = 0;
  private futuresCalcRequestId = 0;
  private optionCalcRequestId = 0;
  private dividendCalcRequestId = 0;
  private taxCalcRequestId = 0;
  private dcaCalcRequestId = 0;

  readonly filteredBonds = computed<readonly BondSummary[]>(() => {
    const filter = this.bondFilter();
    const query = this.bondQuery().trim().toLowerCase();
    return this.bonds().filter((bond) => {
      if (filter === 'ofz' && bond.bondType !== 'OFZ') {
        return false;
      }
      if (filter === 'corporate' && bond.bondType !== 'CORPORATE') {
        return false;
      }
      if (filter === 'amortized' && !bond.amortized) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        bond.ticker.toLowerCase().includes(query) ||
        bond.name.toLowerCase().includes(query) ||
        bond.issuer.toLowerCase().includes(query)
      );
    });
  });

  readonly filteredEtfs = computed<readonly EtfSummary[]>(() => {
    const filter = this.etfFilter();
    const query = this.etfQuery().trim().toLowerCase();
    return this.etfs().filter((etf) => {
      if (filter === 'liquidity' && etf.category !== 'LIQUIDITY' && !etf.tracksRuonia) {
        return false;
      }
      if (filter === 'equity' && etf.category !== 'EQUITY_INDEX') {
        return false;
      }
      if (filter === 'bond' && etf.category !== 'BOND_INDEX') {
        return false;
      }
      if (filter === 'gold_currency' && etf.category !== 'GOLD' && etf.category !== 'CURRENCY') {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        etf.ticker.toLowerCase().includes(query) ||
        etf.name.toLowerCase().includes(query) ||
        etf.underlyingIndex.toLowerCase().includes(query) ||
        etf.description.toLowerCase().includes(query)
      );
    });
  });

  readonly filteredFutures = computed<readonly FuturesSummary[]>(() => {
    const filter = this.futuresFilter();
    const query = this.futuresQuery().trim().toLowerCase();
    return this.futures().filter((future) => {
      if (filter === 'cash' && future.settlementType !== 'CASH') {
        return false;
      }
      if (filter === 'delivery' && future.settlementType !== 'DELIVERY') {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        future.ticker.toLowerCase().includes(query) ||
        future.name.toLowerCase().includes(query) ||
        future.underlying.toLowerCase().includes(query)
      );
    });
  });

  readonly filteredOptions = computed<readonly OptionSummary[]>(() => {
    const filter = this.optionFilter();
    const query = this.optionQuery().trim().toLowerCase();
    return this.options().filter((option) => {
      if (filter === 'call' && option.optionType !== 'CALL') {
        return false;
      }
      if (filter === 'put' && option.optionType !== 'PUT') {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        option.ticker.toLowerCase().includes(query) ||
        option.name.toLowerCase().includes(query) ||
        option.underlying.toLowerCase().includes(query)
      );
    });
  });

  readonly selectedBond = computed<BondSummary | null>(() => {
    const ticker = this.selectedBondTicker();
    if (!ticker) {
      return null;
    }
    return this.bonds().find((bond) => bond.ticker === ticker) ?? null;
  });

  readonly selectedFuture = computed<FuturesSummary | null>(() => {
    const ticker = this.selectedFutureTicker();
    if (!ticker) {
      return null;
    }
    return this.futures().find((future) => future.ticker === ticker) ?? null;
  });

  readonly selectedOption = computed<OptionSummary | null>(() => {
    const ticker = this.selectedOptionTicker();
    if (!ticker) {
      return null;
    }
    return this.options().find((option) => option.ticker === ticker) ?? null;
  });

  readonly filteredDividends = computed<readonly DividendEventSummary[]>(() => {
    const query = this.dividendQuery().trim().toLowerCase();
    if (!query) {
      return this.dividends();
    }
    return this.dividends().filter(
      (div) =>
        div.ticker.toLowerCase().includes(query) || div.issuerName.toLowerCase().includes(query),
    );
  });

  readonly selectedDividend = computed<DividendEventSummary | null>(() => {
    const id = this.selectedDividendId();
    if (id === null) {
      return null;
    }
    return this.dividends().find((d) => d.id === id) ?? null;
  });

  async init(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [bonds, etfs, futures, options, dividends] = await Promise.all([
        this.api.listBonds(),
        this.api.listEtfs(),
        this.api.listFutures(),
        this.api.listOptions(),
        this.api.listDividends(),
      ]);
      this.bonds.set(bonds);
      this.etfs.set(etfs);
      this.futures.set(futures);
      this.options.set(options);
      this.dividends.set(dividends);

      const initCalcs: Promise<void>[] = [];
      if (bonds.length > 0 && !this.selectedBondTicker()) {
        initCalcs.push(this.selectBond(bonds[0]));
      }
      if (futures.length > 0 && !this.selectedFutureTicker()) {
        initCalcs.push(this.selectFuture(futures[0]));
      }
      if (options.length > 0 && !this.selectedOptionTicker()) {
        initCalcs.push(this.selectOption(options[0]));
      }
      if (dividends.length > 0 && this.selectedDividendId() === null) {
        initCalcs.push(this.selectDividend(dividends[0]));
      }
      initCalcs.push(this.recalculateTax(), this.recalculateDca());
      await Promise.all(initCalcs);
    } catch {
      this.error.set('Не удалось загрузить каталог инструментов. Попробуйте обновить страницу.');
    } finally {
      this.loading.set(false);
    }
  }

  async selectBond(bond: BondSummary): Promise<void> {
    this.selectedBondTicker.set(bond.ticker);
    this.calcPricePct.set(bond.pricePct);
    await this.recalculate(bond.ticker, bond.pricePct);
  }

  async updateCalcPricePct(pricePct: number): Promise<void> {
    const bond = this.selectedBond();
    if (!bond || !Number.isFinite(pricePct)) {
      return;
    }
    const clamped = Math.min(200, Math.max(10, Number(pricePct.toFixed(2))));
    this.calcPricePct.set(clamped);
    await this.recalculate(bond.ticker, clamped);
  }

  async resetCalcPrice(): Promise<void> {
    const bond = this.selectedBond();
    if (!bond) {
      return;
    }
    this.calcPricePct.set(bond.pricePct);
    await this.recalculate(bond.ticker, bond.pricePct);
  }

  async selectFuture(future: FuturesSummary): Promise<void> {
    this.selectedFutureTicker.set(future.ticker);
    this.futuresDirection.set('LONG');
    this.futuresEntryPrice.set(future.lastPrice);
    this.futuresCurrentPrice.set(future.lastPrice);
    this.futuresContracts.set(1);
    await this.recalculateFutures();
  }

  async updateFuturesDirection(direction: FuturesDirection): Promise<void> {
    this.futuresDirection.set(direction);
    await this.recalculateFutures();
  }

  async updateFuturesEntryPrice(entryPrice: number): Promise<void> {
    if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
      return;
    }
    this.futuresEntryPrice.set(entryPrice);
    await this.recalculateFutures();
  }

  async updateFuturesCurrentPrice(currentPrice: number): Promise<void> {
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      return;
    }
    this.futuresCurrentPrice.set(currentPrice);
    await this.recalculateFutures();
  }

  async updateFuturesContracts(contracts: number): Promise<void> {
    if (!Number.isFinite(contracts) || contracts < 1) {
      return;
    }
    const clamped = Math.min(100000, Math.max(1, Math.trunc(contracts)));
    this.futuresContracts.set(clamped);
    await this.recalculateFutures();
  }

  async resetFuturesParams(): Promise<void> {
    const future = this.selectedFuture();
    if (!future) {
      return;
    }
    await this.selectFuture(future);
  }

  async selectOption(option: OptionSummary): Promise<void> {
    this.selectedOptionTicker.set(option.ticker);
    this.optionSpot.set(option.underlyingPrice);
    this.optionVolatilityPct.set(option.impliedVolPct);
    this.optionRiskFreeRatePct.set(option.riskFreeRatePct);
    await this.recalculateOptionGreeks();
  }

  async updateOptionSpot(spot: number): Promise<void> {
    if (!Number.isFinite(spot) || spot <= 0) {
      return;
    }
    this.optionSpot.set(spot);
    await this.recalculateOptionGreeks();
  }

  async updateOptionVolatilityPct(volatilityPct: number): Promise<void> {
    if (!Number.isFinite(volatilityPct) || volatilityPct <= 0) {
      return;
    }
    const clamped = Math.min(500, Math.max(0.1, Number(volatilityPct.toFixed(2))));
    this.optionVolatilityPct.set(clamped);
    await this.recalculateOptionGreeks();
  }

  async updateOptionRiskFreeRatePct(riskFreeRatePct: number): Promise<void> {
    if (!Number.isFinite(riskFreeRatePct) || riskFreeRatePct < 0) {
      return;
    }
    const clamped = Math.min(100, Math.max(0, Number(riskFreeRatePct.toFixed(2))));
    this.optionRiskFreeRatePct.set(clamped);
    await this.recalculateOptionGreeks();
  }

  async resetOptionParams(): Promise<void> {
    const option = this.selectedOption();
    if (!option) {
      return;
    }
    await this.selectOption(option);
  }

  async selectDividend(dividend: DividendEventSummary): Promise<void> {
    this.selectedDividendId.set(dividend.id);
    await this.recalculateDividendPayout();
  }

  async updateDividendShares(shares: number): Promise<void> {
    if (!Number.isFinite(shares) || shares < 1) {
      return;
    }
    const clamped = Math.min(10_000_000, Math.max(1, Math.trunc(shares)));
    this.dividendShares.set(clamped);
    await this.recalculateDividendPayout();
  }

  async updateDividendTaxRate(rate: DividendTaxRate): Promise<void> {
    this.dividendTaxRate.set(rate);
    await this.recalculateDividendPayout();
  }

  async resetDividendParams(): Promise<void> {
    this.dividendShares.set(100);
    this.dividendTaxRate.set(13);
    await this.recalculateDividendPayout();
  }

  async updateTaxAccountType(accountType: TaxAccountType): Promise<void> {
    this.taxAccountType.set(accountType);
    await this.recalculateTax();
  }

  async updateTaxGrossProfit(value: number): Promise<void> {
    if (!Number.isFinite(value) || value < 0) {
      return;
    }
    this.taxGrossProfitRub.set(value);
    await this.recalculateTax();
  }

  async updateTaxPriorLosses(value: number): Promise<void> {
    if (!Number.isFinite(value) || value < 0) {
      return;
    }
    this.taxPriorLossesRub.set(value);
    await this.recalculateTax();
  }

  async updateTaxDividends(value: number): Promise<void> {
    if (!Number.isFinite(value) || value < 0) {
      return;
    }
    this.taxDividendsRub.set(value);
    await this.recalculateTax();
  }

  async updateTaxAnnualContributions(value: number): Promise<void> {
    if (!Number.isFinite(value) || value < 0) {
      return;
    }
    this.taxAnnualContributionsRub.set(value);
    await this.recalculateTax();
  }

  async resetTaxParams(): Promise<void> {
    this.taxAccountType.set('BROKERAGE');
    this.taxGrossProfitRub.set(250000);
    this.taxPriorLossesRub.set(50000);
    this.taxDividendsRub.set(40000);
    this.taxAnnualContributionsRub.set(400000);
    await this.recalculateTax();
  }

  async updateDcaCashflow(index: number, item: DcaCashflowItem): Promise<void> {
    const current = this.dcaCashflows();
    if (index < 0 || index >= current.length) {
      return;
    }
    const next = current.map((cf, i) => (i === index ? item : cf));
    this.dcaCashflows.set(next);
    await this.recalculateDca();
  }

  async addDcaCashflow(): Promise<void> {
    const current = this.dcaCashflows();
    if (current.length >= 120) {
      return;
    }
    const last = current[current.length - 1];
    const nextDate = last ? addMonthsIso(last.date, 3) : '2025-01-15';
    this.dcaCashflows.set([...current, { date: nextDate, amountRub: 50000 }]);
    if (nextDate >= this.dcaFinalDate()) {
      this.dcaFinalDate.set(addMonthsIso(nextDate, 3));
    }
    await this.recalculateDca();
  }

  async removeDcaCashflow(index: number): Promise<void> {
    const current = this.dcaCashflows();
    if (current.length <= 1 || index < 0 || index >= current.length) {
      return;
    }
    this.dcaCashflows.set(current.filter((_, i) => i !== index));
    await this.recalculateDca();
  }

  async updateDcaFinalValue(value: number): Promise<void> {
    if (!Number.isFinite(value) || value < 0) {
      return;
    }
    this.dcaFinalValueRub.set(value);
    await this.recalculateDca();
  }

  async updateDcaFinalDate(date: string): Promise<void> {
    if (!date) {
      return;
    }
    this.dcaFinalDate.set(date);
    await this.recalculateDca();
  }

  async resetDcaParams(): Promise<void> {
    this.dcaCashflows.set(DEFAULT_DCA_CASHFLOWS);
    this.dcaFinalValueRub.set(DEFAULT_DCA_FINAL_VALUE);
    this.dcaFinalDate.set(DEFAULT_DCA_FINAL_DATE);
    await this.recalculateDca();
  }

  private async recalculate(ticker: string, pricePct: number): Promise<void> {
    const reqId = ++this.calcRequestId;
    this.calcLoading.set(true);
    this.calcError.set(null);
    try {
      const result = await this.api.calculateBond(ticker, pricePct);
      if (reqId === this.calcRequestId) {
        this.calcResult.set(result);
      }
    } catch {
      if (reqId === this.calcRequestId) {
        this.calcError.set('Не удалось рассчитать доходность на сервере.');
      }
    } finally {
      if (reqId === this.calcRequestId) {
        this.calcLoading.set(false);
      }
    }
  }

  private async recalculateFutures(): Promise<void> {
    const future = this.selectedFuture();
    if (!future) {
      return;
    }
    const reqId = ++this.futuresCalcRequestId;
    this.futuresCalcLoading.set(true);
    this.futuresCalcError.set(null);
    const signedContracts =
      this.futuresDirection() === 'SHORT' ? -this.futuresContracts() : this.futuresContracts();
    try {
      const result = await this.api.calculateFutures(future.ticker, {
        entryPrice: this.futuresEntryPrice(),
        currentPrice: this.futuresCurrentPrice(),
        contracts: signedContracts,
      });
      if (reqId === this.futuresCalcRequestId) {
        this.futuresCalcResult.set(result);
      }
    } catch {
      if (reqId === this.futuresCalcRequestId) {
        this.futuresCalcError.set('Не удалось рассчитать фьючерс на сервере.');
      }
    } finally {
      if (reqId === this.futuresCalcRequestId) {
        this.futuresCalcLoading.set(false);
      }
    }
  }

  private async recalculateOptionGreeks(): Promise<void> {
    const option = this.selectedOption();
    if (!option) {
      return;
    }
    const reqId = ++this.optionCalcRequestId;
    this.optionCalcLoading.set(true);
    this.optionCalcError.set(null);
    try {
      const result = await this.api.calculateOptionGreeks(option.ticker, {
        spot: this.optionSpot(),
        volatilityPct: this.optionVolatilityPct(),
        riskFreeRatePct: this.optionRiskFreeRatePct(),
      });
      if (reqId === this.optionCalcRequestId) {
        this.optionCalcResult.set(result);
      }
    } catch {
      if (reqId === this.optionCalcRequestId) {
        this.optionCalcError.set('Не удалось рассчитать греки опциона на сервере.');
      }
    } finally {
      if (reqId === this.optionCalcRequestId) {
        this.optionCalcLoading.set(false);
      }
    }
  }

  private async recalculateDividendPayout(): Promise<void> {
    const dividend = this.selectedDividend();
    if (!dividend) {
      return;
    }
    const reqId = ++this.dividendCalcRequestId;
    this.dividendCalcLoading.set(true);
    this.dividendCalcError.set(null);
    try {
      const result = await this.api.calculateDividendPayout(dividend.ticker, {
        shares: this.dividendShares(),
        taxRatePct: this.dividendTaxRate(),
      });
      if (reqId === this.dividendCalcRequestId) {
        this.dividendCalcResult.set(result);
      }
    } catch {
      if (reqId === this.dividendCalcRequestId) {
        this.dividendCalcError.set('Не удалось рассчитать дивиденды на сервере.');
      }
    } finally {
      if (reqId === this.dividendCalcRequestId) {
        this.dividendCalcLoading.set(false);
      }
    }
  }

  private async recalculateTax(): Promise<void> {
    const reqId = ++this.taxCalcRequestId;
    this.taxCalcLoading.set(true);
    this.taxCalcError.set(null);
    try {
      const result = await this.api.calculateTax({
        accountType: this.taxAccountType(),
        grossProfitRub: this.taxGrossProfitRub(),
        priorLossesRub: this.taxPriorLossesRub(),
        dividendsRub: this.taxDividendsRub(),
        annualContributionsRub: this.taxAnnualContributionsRub(),
      });
      if (reqId === this.taxCalcRequestId) {
        this.taxCalcResult.set(result);
      }
    } catch {
      if (reqId === this.taxCalcRequestId) {
        this.taxCalcError.set('Не удалось рассчитать налог на сервере.');
      }
    } finally {
      if (reqId === this.taxCalcRequestId) {
        this.taxCalcLoading.set(false);
      }
    }
  }

  private async recalculateDca(): Promise<void> {
    const flows = this.dcaCashflows();
    if (flows.length === 0) {
      return;
    }
    const reqId = ++this.dcaCalcRequestId;
    this.dcaCalcLoading.set(true);
    this.dcaCalcError.set(null);
    try {
      const result = await this.api.calculateDca({
        cashflows: flows,
        finalValueRub: this.dcaFinalValueRub(),
        finalDate: this.dcaFinalDate(),
      });
      if (reqId === this.dcaCalcRequestId) {
        this.dcaCalcResult.set(result);
      }
    } catch {
      if (reqId === this.dcaCalcRequestId) {
        this.dcaCalcError.set('Не удалось рассчитать XIRR/TWR на сервере.');
      }
    } finally {
      if (reqId === this.dcaCalcRequestId) {
        this.dcaCalcLoading.set(false);
      }
    }
  }
}

function addMonthsIso(isoDate: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return isoDate;
  }
  const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + months, Number(match[3])));
  return d.toISOString().slice(0, 10);
}

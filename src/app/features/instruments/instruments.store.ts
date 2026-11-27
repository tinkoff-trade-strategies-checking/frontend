import { computed, inject, Injectable, signal } from '@angular/core';
import {
  BondCalculation,
  BondSummary,
  EtfFilterGroup,
  EtfSummary,
  FuturesCalculation,
  FuturesDirection,
  FuturesSummary,
  INSTRUMENTS_API,
  OptionGreeksCalculation,
  OptionSummary,
} from './data/instruments.models';

export type InstrumentsTab = 'bonds' | 'etfs' | 'futures' | 'options';
export type BondFilter = 'all' | 'ofz' | 'corporate' | 'amortized';
export type EtfFilter = EtfFilterGroup;
export type FuturesFilter = 'all' | 'cash' | 'delivery';
export type OptionFilter = 'all' | 'call' | 'put';

@Injectable()
export class InstrumentsStore {
  private readonly api = inject(INSTRUMENTS_API);

  readonly activeTab = signal<InstrumentsTab>('bonds');

  readonly bonds = signal<readonly BondSummary[]>([]);
  readonly etfs = signal<readonly EtfSummary[]>([]);
  readonly futures = signal<readonly FuturesSummary[]>([]);
  readonly options = signal<readonly OptionSummary[]>([]);
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

  private calcRequestId = 0;
  private futuresCalcRequestId = 0;
  private optionCalcRequestId = 0;

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

  async init(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [bonds, etfs, futures, options] = await Promise.all([
        this.api.listBonds(),
        this.api.listEtfs(),
        this.api.listFutures(),
        this.api.listOptions(),
      ]);
      this.bonds.set(bonds);
      this.etfs.set(etfs);
      this.futures.set(futures);
      this.options.set(options);

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
}

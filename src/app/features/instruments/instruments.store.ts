import { computed, inject, Injectable, signal } from '@angular/core';
import {
  BondCalculation,
  BondSummary,
  EtfFilterGroup,
  EtfSummary,
  INSTRUMENTS_API,
} from './data/instruments.models';

export type InstrumentsTab = 'bonds' | 'etfs';
export type BondFilter = 'all' | 'ofz' | 'corporate' | 'amortized';
export type EtfFilter = EtfFilterGroup;

@Injectable()
export class InstrumentsStore {
  private readonly api = inject(INSTRUMENTS_API);

  readonly activeTab = signal<InstrumentsTab>('bonds');

  readonly bonds = signal<readonly BondSummary[]>([]);
  readonly etfs = signal<readonly EtfSummary[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly bondFilter = signal<BondFilter>('all');
  readonly bondQuery = signal('');

  readonly etfFilter = signal<EtfFilter>('all');
  readonly etfQuery = signal('');

  readonly selectedBondTicker = signal<string | null>(null);
  readonly calcPricePct = signal<number>(100);
  readonly calcResult = signal<BondCalculation | null>(null);
  readonly calcLoading = signal(false);
  readonly calcError = signal<string | null>(null);

  private calcRequestId = 0;

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

  readonly selectedBond = computed<BondSummary | null>(() => {
    const ticker = this.selectedBondTicker();
    if (!ticker) {
      return null;
    }
    return this.bonds().find((bond) => bond.ticker === ticker) ?? null;
  });

  async init(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [bonds, etfs] = await Promise.all([this.api.listBonds(), this.api.listEtfs()]);
      this.bonds.set(bonds);
      this.etfs.set(etfs);
      if (bonds.length > 0 && !this.selectedBondTicker()) {
        await this.selectBond(bonds[0]);
      }
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
}

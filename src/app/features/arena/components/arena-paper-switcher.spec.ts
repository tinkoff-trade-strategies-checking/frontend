import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
import { ArenaPaper, ArenaPortfolio } from '../data/arena.models';
import { ArenaPaperSwitcher, INLINE_TABS_LIMIT } from './arena-paper-switcher';
import { ArenaPortfolioPanel } from './arena-portfolio-panel';

function makeArenaPapers(count: number): readonly ArenaPaper[] {
  const sectors = ['Финансы', 'Нефть и газ', 'IT', 'Металлы и добыча', ''];
  return Array.from({ length: count }, (_, i) => ({
    id: `P${i + 1}`,
    label: `TICK${String(i + 1).padStart(2, '0')}`,
    sector: sectors[i % sectors.length],
    candles: [],
    changePct: i % 2 === 0 ? 1.5 : -0.8,
    lastPrice: 100 + i,
  }));
}

function makePortfolio(heldIds: readonly string[]): ArenaPortfolio {
  const positions: Record<
    string,
    { paperId: string; lots: number; avgPrice: number | null; pnlPct: number; valuePct: number }
  > = {};
  for (const id of heldIds) {
    positions[id] = { paperId: id, lots: 5, avgPrice: 100, pnlPct: 2.5, valuePct: 10 };
  }
  return {
    equityPct: 100,
    cashPct: 80,
    investedPct: 20,
    pnlPct: 1,
    costsPct: 0.1,
    positions,
  };
}

@Component({
  imports: [ArenaPaperSwitcher],
  template: `
    <app-arena-paper-switcher
      [papers]="papers()"
      [selectedPaperId]="selectedPaperId()"
      [portfolio]="portfolio()"
      (selectPaper)="selectedPaperId.set($event)"
    />
  `,
})
class SwitcherHost {
  readonly papers = signal<readonly ArenaPaper[]>(makeArenaPapers(3));
  readonly selectedPaperId = signal('P1');
  readonly portfolio = signal<ArenaPortfolio>(makePortfolio(['P2']));
}

describe('ArenaPaperSwitcher', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SwitcherHost, ArenaPortfolioPanel],
      providers: [provideTaiga()],
    }).compileComponents();
  });

  it('показывает inline-вкладки при числе бумаг <= INLINE_TABS_LIMIT', () => {
    const fixture = TestBed.createComponent(SwitcherHost);
    fixture.componentInstance.papers.set(makeArenaPapers(INLINE_TABS_LIMIT));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.paper-tab').length).toBe(INLINE_TABS_LIMIT);
    expect(root.querySelector('.compact-switcher')).toBeNull();
  });

  it('переходит в компактный режим при большом числе бумаг с поиском, секторами и фильтром «В портфеле»', () => {
    const fixture = TestBed.createComponent(SwitcherHost);
    const host = fixture.componentInstance;
    host.papers.set(makeArenaPapers(40));
    host.selectedPaperId.set('P1');
    host.portfolio.set(makePortfolio(['P2', 'P15']));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.compact-switcher')).not.toBeNull();
    expect(root.querySelectorAll('.paper-tab').length).toBe(0);
    expect(root.querySelector('.nav-index')?.textContent?.trim()).toBe('1 / 40');

    // Стрелка «Следующая бумага» переключает на P2.
    root.querySelector<HTMLButtonElement>('button[aria-label="Следующая бумага"]')!.click();
    fixture.detectChanges();
    expect(host.selectedPaperId()).toBe('P2');
    expect(root.querySelector('.nav-index')?.textContent?.trim()).toBe('2 / 40');

    // Открываем каталог бумаг.
    root.querySelector<HTMLButtonElement>('.active-paper-trigger')!.click();
    fixture.detectChanges();
    expect(root.querySelector('.switcher-popover')).not.toBeNull();
    expect(root.querySelectorAll('.popover-row').length).toBe(40);

    // Фильтр «В портфеле» оставляет только 2 бумаги с открытой позицией.
    root.querySelector<HTMLButtonElement>('.cat-chip[data-category="__held__"]')!.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.popover-row').length).toBe(2);

    // Выбор бумаги из списка закрывает каталог и меняет выбранную бумагу.
    root.querySelector<HTMLButtonElement>('.popover-row[data-paper-id="P15"]')!.click();
    fixture.detectChanges();
    expect(host.selectedPaperId()).toBe('P15');
    expect(root.querySelector('.switcher-popover')).toBeNull();

    // Поиск по тикеру в каталоге.
    root.querySelector<HTMLButtonElement>('.catalog-toggle-btn')!.click();
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('.cat-chip[data-category="__all__"]')!.click();
    fixture.detectChanges();
    const search = root.querySelector<HTMLInputElement>('#arena-paper-search')!;
    search.value = 'TICK33';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelectorAll('.popover-row').length).toBe(1);
    expect(root.querySelector('.popover-row')?.textContent).toContain('TICK33');
  });

  it('ArenaPortfolioPanel в компактном режиме (>5 бумаг) фильтрует «С позицией» / «Все» и поддерживает поиск', () => {
    const fixture = TestBed.createComponent(ArenaPortfolioPanel);
    fixture.componentRef.setInput('papers', makeArenaPapers(30));
    fixture.componentRef.setInput('portfolio', makePortfolio(['P3', 'P10']));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.pos-controls')).not.toBeNull();
    expect(root.querySelector('.pos-table-wrap.bounded')).not.toBeNull();
    // По умолчанию показываются только 2 бумаги с открытой позицией.
    expect(root.querySelectorAll('tbody tr').length).toBe(2);

    // Переключение на «Все (30)» показывает все 30 бумаг в ограниченном скролл-контейнере.
    const allBtn = Array.from(root.querySelectorAll<HTMLButtonElement>('.pos-filter-btn')).find(
      (b) => b.textContent?.includes('Все (30)'),
    )!;
    allBtn.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('tbody tr').length).toBe(30);
  });
});

import { TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
import { vi } from 'vitest';
import {
  FUNDAMENTALS_API,
  FundamentalsApi,
  PaperFundamentals,
} from '../../core/api/fundamentals.models';
import { ArenaPaper } from '../../features/arena/data/arena.models';
import { ArenaFundamentalsTrigger } from './arena-fundamentals-trigger';
import { PaperFundamentalsPanel } from './paper-fundamentals-panel';

const SBER_SAMPLE: PaperFundamentals = {
  ticker: 'SBER',
  reportDate: '2025-12-31',
  availableAt: '2026-02-26',
  periodType: 'FY',
  currency: 'RUB',
  marketCapRub: 6_780_000_000_000,
  peRatio: 4.28,
  pbRatio: 0.91,
  psRatio: 2.15,
  evEbitda: null,
  roe: 23.4,
  roa: 2.85,
  grossMargin: 58.2,
  operatingMargin: 46.1,
  netMargin: 38.5,
  revenueGrowthYoy: 14.2,
  epsGrowthYoy: 7.8,
  debtToEquity: null,
  currentRatio: null,
  beta: 1.05,
  freeFloat: 48.0,
  eps: 70.1,
  bookValuePerShare: 329.5,
  dividendYield: 11.6,
  payoutRatio: 50.0,
};

describe('PaperFundamentalsPanel', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaperFundamentalsPanel],
      providers: [provideTaiga()],
    }).compileComponents();
  });

  it('отображает 4 категории Investing.com, отформатированные значения, дату отчётности и подсказки', () => {
    const fixture = TestBed.createComponent(PaperFundamentalsPanel);
    fixture.componentRef.setInput('fundamentals', SBER_SAMPLE);
    fixture.componentRef.setInput('paperName', 'Сбербанк');
    fixture.componentRef.setInput('sector', 'Финансы');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';

    expect(text).toContain('SBER');
    expect(text).toContain('Сбербанк');
    expect(text).toContain('Финансы');
    expect(text).toContain('31.12.2025');
    expect(text).toContain('Оценка');
    expect(text).toContain('Рентабельность и рост');
    expect(text).toContain('Устойчивость');
    expect(text).toContain('На акцию и дивиденды');

    expect(root.querySelector('[data-metric="marketCapRub"]')?.textContent?.trim()).toBe(
      '6,78 трлн ₽',
    );
    expect(root.querySelector('[data-metric="peRatio"]')?.textContent?.trim()).toBe('4,28x');
    expect(root.querySelector('[data-metric="evEbitda"]')?.textContent?.trim()).toBe('—');
    expect(root.querySelector('[data-metric="roe"]')?.textContent?.trim()).toBe('23,4%');
    expect(root.querySelector('[data-metric="revenueGrowthYoy"]')?.textContent?.trim()).toBe(
      '+14,2%',
    );
    expect(root.querySelector('[data-metric="eps"]')?.textContent?.trim()).toBe('70,10 ₽');

    // Клик по кнопке «?» раскрывает подсказку для новичка.
    expect(root.querySelector('.metric-hint')).toBeNull();
    root.querySelector<HTMLButtonElement>('button[aria-label="Справка: P/E"]')!.click();
    fixture.detectChanges();
    expect(root.querySelector('.metric-hint')?.textContent).toContain('Цена / Прибыль');
  });

  it('показывает пустое состояние, когда данные не загружены', () => {
    const fixture = TestBed.createComponent(PaperFundamentalsPanel);
    fixture.componentRef.setInput('fundamentals', null);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="fundamentals-empty"]')?.textContent).toContain(
      'Фундаментальные данные для этой бумаги пока не загружены',
    );
  });

  it('INV-7: в слепом режиме скрывает все показатели, тикер и дату отчётности даже при переданных данных', () => {
    const fixture = TestBed.createComponent(PaperFundamentalsPanel);
    fixture.componentRef.setInput('fundamentals', SBER_SAMPLE);
    fixture.componentRef.setInput('ticker', 'SBER');
    fixture.componentRef.setInput('paperName', 'Сбербанк');
    fixture.componentRef.setInput('hiddenByBlindMode', true);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    expect(root.querySelector('[data-testid="fundamentals-blind-notice"]')?.textContent).toContain(
      'В слепом режиме фундаментальные показатели скрыты до завершения сессии',
    );
    expect(text).not.toContain('SBER');
    expect(text).not.toContain('Сбербанк');
    expect(text).not.toContain('6,78 трлн ₽');
    expect(text).not.toContain('4,28x');
    expect(text).not.toContain('31.12.2025');
    expect(root.querySelectorAll('.category-card').length).toBe(0);
  });
});

describe('ArenaFundamentalsTrigger (INV-7)', () => {
  let mockApi: FundamentalsApi;

  const samplePaper: ArenaPaper = {
    id: 'SBER',
    label: 'SBER',
    sector: 'Финансы',
    candles: [],
    changePct: 1.2,
    lastPrice: 300,
  };

  beforeEach(async () => {
    mockApi = {
      getPaperFundamentals: vi.fn().mockResolvedValue(SBER_SAMPLE),
      getSessionFundamentals: vi.fn().mockResolvedValue({
        hiddenByBlindMode: false,
        asOfDate: '2026-03-15',
        items: [
          {
            paperId: 'SBER',
            ticker: 'SBER',
            name: 'Сбербанк',
            sector: 'Финансы',
            available: true,
            snapshot: SBER_SAMPLE,
          },
        ],
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ArenaFundamentalsTrigger],
      providers: [provideTaiga(), { provide: FUNDAMENTALS_API, useValue: mockApi }],
    }).compileComponents();
  });

  it('INV-7: в активной слепой сессии отключает кнопку с подсказкой и не запрашивает API', async () => {
    const fixture = TestBed.createComponent(ArenaFundamentalsTrigger);
    fixture.componentRef.setInput('sessionId', 'S-BLIND');
    fixture.componentRef.setInput('paper', { ...samplePaper, id: 'A', label: 'Бумага A' });
    fixture.componentRef.setInput('blind', true);
    fixture.componentRef.setInput('finished', false);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const btn = root.querySelector<HTMLButtonElement>('[data-testid="arena-fundamentals-btn"]')!;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('title')).toContain(
      'В слепом режиме фундаментальные показатели скрыты до завершения сессии',
    );
    expect(root.querySelector('app-term-hint')).not.toBeNull();

    btn.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockApi.getSessionFundamentals).not.toHaveBeenCalled();
    expect(mockApi.getPaperFundamentals).not.toHaveBeenCalled();
    expect(root.querySelector('app-paper-fundamentals-modal')).toBeNull();
  });

  it('в открытой сессии загружает фундаментальные показатели по sessionId с датой asOfDate', async () => {
    const fixture = TestBed.createComponent(ArenaFundamentalsTrigger);
    fixture.componentRef.setInput('sessionId', 'S-OPEN');
    fixture.componentRef.setInput('paper', samplePaper);
    fixture.componentRef.setInput('blind', false);
    fixture.componentRef.setInput('finished', false);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('[data-testid="arena-fundamentals-btn"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockApi.getSessionFundamentals).toHaveBeenCalledWith('S-OPEN');
    expect(root.textContent).toContain('6,78 трлн ₽');
    expect(root.textContent).toContain('15.03.2026');
  });
});

import { TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
import { PapersReveal, REVEAL_COMPACT_THRESHOLD, RevealablePaper } from './papers-reveal';

function makeRevealPapers(count: number): readonly RevealablePaper[] {
  const sectors = ['Финансы', 'Нефть и газ', 'IT', ''];
  return Array.from({ length: count }, (_, i) => ({
    id: `R${i + 1}`,
    ticker: `SYM${String(i + 1).padStart(2, '0')}`,
    name: `Компания ${i + 1}`,
    sector: sectors[i % sectors.length],
    lotSize: 10,
    startPriceRub: 150 + i,
  }));
}

describe('PapersReveal', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PapersReveal],
      providers: [provideTaiga()],
    }).compileComponents();
  });

  it('отображает обычную сетку карточек при числе бумаг <= REVEAL_COMPACT_THRESHOLD', () => {
    const fixture = TestBed.createComponent(PapersReveal);
    fixture.componentRef.setInput('papers', makeRevealPapers(REVEAL_COMPACT_THRESHOLD));
    fixture.componentRef.setInput('periodLabel', '01.01.2024 — 31.03.2024');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.reveal-grid')).not.toBeNull();
    expect(root.querySelector('.compact-reveal')).toBeNull();
    expect(root.querySelectorAll('.reveal-card').length).toBe(REVEAL_COMPACT_THRESHOLD + 1);
  });

  it('переходит в компактный фильтруемый блок при большом количестве бумаг', () => {
    const fixture = TestBed.createComponent(PapersReveal);
    fixture.componentRef.setInput('papers', makeRevealPapers(32));
    fixture.componentRef.setInput('periodLabel', '01.01.2024 — 31.03.2024');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.compact-reveal')).not.toBeNull();
    expect(root.querySelectorAll('.compact-card').length).toBe(32);

    // Фильтр по сектору.
    const itChip = Array.from(root.querySelectorAll<HTMLButtonElement>('.cat-chip')).find((b) =>
      b.textContent?.includes('IT'),
    )!;
    itChip.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.compact-card').length).toBe(8);

    // Поиск по тикеру.
    const search = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'SYM03';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelectorAll('.compact-card').length).toBe(1);
    expect(root.querySelector('.compact-card')?.textContent).toContain('SYM03');
  });
});

import { TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
import { INSTRUMENTS_API } from './data/instruments.models';
import { StubInstrumentsApi } from './data/stub-instruments.api';
import { InstrumentsPage } from './instruments-page';
import { InstrumentsStore } from './instruments.store';

describe('InstrumentsPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstrumentsPage],
      providers: [provideTaiga()],
    })
      .overrideComponent(InstrumentsPage, {
        set: {
          providers: [{ provide: INSTRUMENTS_API, useClass: StubInstrumentsApi }, InstrumentsStore],
        },
      })
      .compileComponents();
  });

  async function flushAsync(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('отображает вкладку облигаций с фильтрами, таблицей, подсказками TermHint и YTM-калькулятором', async () => {
    const fixture = TestBed.createComponent(InstrumentsPage);
    fixture.detectChanges();
    await flushAsync();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Инструменты');
    expect(root.querySelectorAll('tbody tr.bond-row').length).toBeGreaterThanOrEqual(5);
    expect(root.querySelector('app-bond-ytm-calculator')?.textContent).toContain('ОФЗ-ПД 26238');
    expect(root.querySelectorAll('app-term-hint').length).toBeGreaterThanOrEqual(4);

    // Фильтрация по амортизации.
    root.querySelector<HTMLButtonElement>('[data-bond-filter="amortized"]')?.click();
    fixture.detectChanges();
    const amortizedRows = Array.from(root.querySelectorAll('tbody tr.bond-row'));
    expect(amortizedRows.length).toBeGreaterThan(0);
    expect(amortizedRows.every((row) => row.textContent?.includes('Аморт.'))).toBe(true);

    // Выбор облигации обновляет YTM-калькулятор.
    (amortizedRows[0] as HTMLElement).click();
    await flushAsync();
    fixture.detectChanges();
    expect(root.querySelector('app-bond-ytm-calculator')?.textContent).toContain('Амортизация');
  });

  it('переключается на вкладку БПИФ/ETF, фильтрует фонды ликвидности и показывает пометку RUONIA и TER', async () => {
    const fixture = TestBed.createComponent(InstrumentsPage);
    fixture.detectChanges();
    await flushAsync();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#tab-etfs')?.click();
    fixture.detectChanges();

    expect(root.querySelectorAll('.etf-card').length).toBeGreaterThanOrEqual(6);
    expect(root.textContent).toContain('Следует за RUONIA');
    expect(root.textContent).toContain('Комиссия фонда (TER)');

    root.querySelector<HTMLButtonElement>('[data-etf-filter="liquidity"]')?.click();
    fixture.detectChanges();
    const cards = Array.from(root.querySelectorAll('.etf-card'));
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(cards.every((card) => card.textContent?.includes('Следует за RUONIA'))).toBe(true);
  });
});

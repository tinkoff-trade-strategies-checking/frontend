import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { INSTRUMENTS_API } from './data/instruments.models';
import { StubInstrumentsApi } from './data/stub-instruments.api';
import { InstrumentsPage } from './instruments-page';
import { InstrumentsStore } from './instruments.store';

describe('InstrumentsPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstrumentsPage],
      providers: [provideTaiga(), provideRouter([])],
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

  it('не показывает фиктивные (0) на незагруженных вкладках и автоматически подставляет реальные счётчики', async () => {
    const fixture = TestBed.createComponent(InstrumentsPage);
    const api = fixture.debugElement.injector.get(INSTRUMENTS_API);
    let resolveEtfs!: (value: Awaited<ReturnType<typeof api.listEtfs>>) => void;
    const originalListEtfs = api.listEtfs.bind(api);
    api.listEtfs = () =>
      new Promise((resolve) => {
        resolveEtfs = resolve;
      });

    fixture.detectChanges();
    await flushAsync();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const etfsTab = root.querySelector<HTMLButtonElement>('#tab-etfs')!;
    // Пока список БПИФ/ETF не загружен, на вкладке нет вводящего в заблуждение (0).
    expect(etfsTab.textContent?.trim()).toBe('БПИФ / ETF');
    expect(etfsTab.textContent).not.toContain('(0)');

    // Остальные вкладки уже получили реальные счётчики фоновой подгрузкой.
    expect(root.querySelector('#tab-bonds')?.textContent).toMatch(/Облигации\s*\([1-9]\d*\)/);
    expect(root.querySelector('#tab-futures')?.textContent).toMatch(
      /Фьючерсы \(ФОРТС\)\s*\([1-9]\d*\)/,
    );
    expect(root.querySelector('#tab-options')?.textContent).toMatch(
      /Опционы \(ФОРТС\)\s*\([1-9]\d*\)/,
    );
    expect(root.querySelector('#tab-dividends')?.textContent).toMatch(
      /Дивиденды \(T\+1\)\s*\([1-9]\d*\)/,
    );
    expect(root.querySelector('#tab-screener')?.textContent).toMatch(
      /Скринер акций\s*\([1-9]\d*\)/,
    );
    expect(root.querySelector('#tab-events-alerts')?.textContent).toMatch(
      /События и Алерты\s*\([1-9]\d*\)/,
    );

    // После завершения загрузки БПИФ/ETF появляется актуальный счётчик.
    resolveEtfs(await originalListEtfs());
    await flushAsync();
    fixture.detectChanges();
    expect(etfsTab.textContent).toMatch(/БПИФ \/ ETF\s*\([1-9]\d*\)/);
  });

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
    await flushAsync();
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

  it('переключается на вкладку Фьючерсы (ФОРТС), фильтрует расчётные/поставочные и считает маржу в калькуляторе', async () => {
    const fixture = TestBed.createComponent(InstrumentsPage);
    fixture.detectChanges();
    await flushAsync();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#tab-futures')?.click();
    await flushAsync();
    fixture.detectChanges();

    expect(root.querySelectorAll('tbody tr.future-row').length).toBeGreaterThanOrEqual(6);
    expect(root.querySelector('app-futures-calculator')?.textContent).toContain(
      'Вариационная маржа',
    );
    expect(root.querySelector('app-futures-calculator')?.textContent).toContain('Итого ГО');

    root.querySelector<HTMLButtonElement>('[data-futures-filter="delivery"]')?.click();
    fixture.detectChanges();
    const deliveryRows = Array.from(root.querySelectorAll('tbody tr.future-row'));
    expect(deliveryRows.length).toBeGreaterThan(0);
    expect(deliveryRows.every((row) => row.textContent?.includes('Постав.'))).toBe(true);

    (deliveryRows[0] as HTMLElement).click();
    await flushAsync();
    fixture.detectChanges();
    expect(root.querySelector('app-futures-calculator')?.textContent).toContain('Поставочный');

    root.querySelector<HTMLButtonElement>('[data-futures-dir="SHORT"]')?.click();
    await flushAsync();
    fixture.detectChanges();
    expect(
      root
        .querySelector<HTMLButtonElement>('[data-futures-dir="SHORT"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('переключается на вкладку Опционы (ФОРТС), фильтрует Call/Put и показывает 5 греков с TermHint', async () => {
    const fixture = TestBed.createComponent(InstrumentsPage);
    fixture.detectChanges();
    await flushAsync();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#tab-options')?.click();
    await flushAsync();
    fixture.detectChanges();

    expect(root.querySelectorAll('tbody tr.option-row').length).toBeGreaterThanOrEqual(6);
    const calc = root.querySelector('app-option-greeks-calculator')!;
    expect(calc.querySelector('[data-greek="delta"]')).not.toBeNull();
    expect(calc.querySelector('[data-greek="gamma"]')).not.toBeNull();
    expect(calc.querySelector('[data-greek="theta"]')).not.toBeNull();
    expect(calc.querySelector('[data-greek="vega"]')).not.toBeNull();
    expect(calc.querySelector('[data-greek="rho"]')).not.toBeNull();
    expect(calc.querySelectorAll('app-term-hint').length).toBeGreaterThanOrEqual(6);

    root.querySelector<HTMLButtonElement>('[data-option-filter="put"]')?.click();
    fixture.detectChanges();
    const putRows = Array.from(root.querySelectorAll('tbody tr.option-row'));
    expect(putRows.length).toBeGreaterThan(0);
    expect(putRows.every((row) => row.textContent?.includes('Put'))).toBe(true);

    (putRows[0] as HTMLElement).click();
    await flushAsync();
    fixture.detectChanges();
    expect(calc.textContent).toContain('Put (пут)');
  });

  it('переключается на вкладку Дивиденды (T+1), ищет эмитента и считает чистую выплату в калькуляторе', async () => {
    const fixture = TestBed.createComponent(InstrumentsPage);
    fixture.detectChanges();
    await flushAsync();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#tab-dividends')?.click();
    await flushAsync();
    fixture.detectChanges();

    expect(root.querySelectorAll('tbody tr.dividend-row').length).toBeGreaterThanOrEqual(8);
    const calc = root.querySelector('app-dividend-calculator')!;
    expect(calc.querySelector('[data-div-metric="net"]')).not.toBeNull();
    expect(calc.querySelector('[data-div-metric="lastBuyDate"]')).not.toBeNull();

    root.querySelector<HTMLButtonElement>('[data-div-tax="15"]')?.click();
    await flushAsync();
    fixture.detectChanges();
    expect(
      root.querySelector<HTMLButtonElement>('[data-div-tax="15"]')?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(calc.textContent).toContain('НДФЛ (15%)');
  });

  it('переключается на вкладку Налоги (ИИС) и DCA, меняет тип счёта и добавляет пополнение DCA', async () => {
    const fixture = TestBed.createComponent(InstrumentsPage);
    fixture.detectChanges();
    await flushAsync();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#tab-tax-dca')?.click();
    await flushAsync();
    fixture.detectChanges();

    const taxCalc = root.querySelector('app-tax-iis-calculator')!;
    expect(taxCalc.querySelector('[data-tax-metric="net"]')).not.toBeNull();
    expect(taxCalc.querySelector('[data-tax-metric="effectiveRate"]')).not.toBeNull();

    root.querySelector<HTMLButtonElement>('[data-tax-account="IIS_A"]')?.click();
    await flushAsync();
    fixture.detectChanges();
    expect(
      root
        .querySelector<HTMLButtonElement>('[data-tax-account="IIS_A"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');

    const dcaCalc = root.querySelector('app-dca-xirr-calculator')!;
    expect(dcaCalc.querySelectorAll('[data-dca-row]').length).toBe(4);
    expect(dcaCalc.querySelector('[data-dca-metric="xirr"]')).not.toBeNull();
    expect(dcaCalc.querySelector('[data-dca-metric="twr"]')).not.toBeNull();

    dcaCalc.querySelector<HTMLButtonElement>('[data-dca-add-row]')?.click();
    await flushAsync();
    fixture.detectChanges();
    expect(dcaCalc.querySelectorAll('[data-dca-row]').length).toBe(5);
  });

  it('переключается на вкладку Скринер акций, применяет пресеты, сортирует и открывает профиль бумаги', async () => {
    const fixture = TestBed.createComponent(InstrumentsPage);
    fixture.detectChanges();
    await flushAsync();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#tab-screener')?.click();
    await flushAsync();
    fixture.detectChanges();

    const initialRows = root.querySelectorAll('tbody tr.screener-row');
    expect(initialRows.length).toBeGreaterThanOrEqual(10);
    expect(root.querySelector('[data-screener-launch]')?.textContent).toContain('Тренироваться с');

    root.querySelector<HTMLButtonElement>('[data-screener-preset="dividend_gt_10"]')?.click();
    fixture.detectChanges();
    const divRows = root.querySelectorAll('tbody tr.screener-row');
    expect(divRows.length).toBeGreaterThan(0);
    expect(divRows.length).toBeLessThan(initialRows.length);

    root.querySelector<HTMLButtonElement>('[data-screener-reset]')?.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('tbody tr.screener-row').length).toBe(initialRows.length);

    root.querySelector<HTMLButtonElement>('[data-screener-alert]')?.click();
    await flushAsync();
    fixture.detectChanges();
    expect(root.querySelector('app-alerts-panel')).not.toBeNull();
  });

  it('ограничивает DOM скринера 50 строками на страницу и переключает страницы кнопками Назад/Вперёд', async () => {
    const manyPapers = Array.from({ length: 120 }, (_, i) => ({
      ticker: `P${String(i + 1).padStart(3, '0')}`,
      name: `Эмитент ${i + 1}`,
      sector: 'Финансы',
      marketCapRub: (120 - i) * 1_000_000_000,
      peRatio: 5,
      pbRatio: 1,
      psRatio: 1,
      evEbitda: 4,
      roe: 22,
      netMargin: 15,
      debtToEquity: 0.2,
      dividendYield: 12,
      beta: 0.9,
      hasFundamentals: true,
    }));

    const fixture = TestBed.createComponent(InstrumentsPage);
    const api = fixture.debugElement.injector.get(INSTRUMENTS_API);
    api.listScreenerPapers = () => Promise.resolve(manyPapers);

    fixture.detectChanges();
    await flushAsync();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#tab-screener')?.click();
    await flushAsync();
    fixture.detectChanges();

    expect(root.querySelectorAll('tbody tr.screener-row')).toHaveLength(50);
    expect(root.textContent).not.toContain('Показать все');
    expect(root.querySelector('[data-screener-page]')?.textContent?.trim()).toBe('Стр. 1 из 3');
    expect(root.querySelector<HTMLButtonElement>('[data-screener-prev]')?.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-screener-next]')?.disabled).toBe(false);

    root.querySelector<HTMLButtonElement>('[data-screener-next]')?.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('tbody tr.screener-row')).toHaveLength(50);
    expect(root.querySelector('[data-screener-page]')?.textContent?.trim()).toBe('Стр. 2 из 3');
    expect(root.querySelector<HTMLButtonElement>('[data-screener-prev]')?.disabled).toBe(false);

    root.querySelector<HTMLButtonElement>('[data-screener-next]')?.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('tbody tr.screener-row')).toHaveLength(20);
    expect(root.querySelector('[data-screener-page]')?.textContent?.trim()).toBe('Стр. 3 из 3');
    expect(root.querySelector<HTMLButtonElement>('[data-screener-next]')?.disabled).toBe(true);
  });

  it('переключается на вкладку События и Алерты, фильтрует события, создаёт и удаляет алерт', async () => {
    const fixture = TestBed.createComponent(InstrumentsPage);
    fixture.detectChanges();
    await flushAsync();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#tab-events-alerts')?.click();
    await flushAsync();
    fixture.detectChanges();

    expect(root.querySelectorAll('.event-card').length).toBeGreaterThanOrEqual(4);
    expect(root.querySelector('[data-event-importance="HIGH"]')).not.toBeNull();

    root.querySelector<HTMLButtonElement>('[data-event-filter="CBR_RATE"]')?.click();
    fixture.detectChanges();
    const cbrCards = Array.from(root.querySelectorAll('.event-card'));
    expect(cbrCards.length).toBeGreaterThan(0);
    expect(cbrCards.every((c) => c.getAttribute('data-event-type') === 'CBR_RATE')).toBe(true);

    const initialAlerts = root.querySelectorAll('.alert-item').length;
    root.querySelector<HTMLButtonElement>('[data-alert-submit]')?.click();
    await flushAsync();
    fixture.detectChanges();
    expect(root.querySelectorAll('.alert-item').length).toBe(initialAlerts + 1);

    root.querySelector<HTMLButtonElement>('[data-alert-delete]')?.click();
    await flushAsync();
    fixture.detectChanges();
    expect(root.querySelectorAll('.alert-item').length).toBe(initialAlerts);
  });
});

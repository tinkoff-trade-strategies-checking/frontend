import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
import { vi } from 'vitest';
import { formatBlindAxisTick, formatBlindCandleLabel, formatRejectReason } from './arena.format';
import { ArenaPage } from './arena-page';
import { ArenaChart } from './components/arena-chart';
import { ArenaPortfolioPanel } from './components/arena-portfolio-panel';
import { ARENA_API, ArenaCandle, ArenaFill, ArenaOrder } from './data/arena.models';
import { StubArenaApi } from './data/stub-arena.api';

@Component({
  selector: 'app-arena-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="stub-chart">Свечей: {{ candles().length }}</div>`,
})
class StubArenaChart {
  readonly paperId = input<string>('');
  readonly candles = input.required<readonly ArenaCandle[]>();
  readonly orders = input<readonly ArenaOrder[]>([]);
  readonly fills = input<readonly ArenaFill[]>([]);
  readonly showSma20 = input(false);
  readonly showSma50 = input(false);
}

describe('ArenaPage', () => {
  let stubApi: StubArenaApi;

  beforeEach(async () => {
    stubApi = new StubArenaApi();
    vi.spyOn(stubApi, 'estimateOrder').mockResolvedValue({ amountPct: 77.77 });

    await TestBed.configureTestingModule({
      imports: [ArenaPage],
      providers: [provideTaiga()],
    })
      .overrideComponent(ArenaPage, {
        remove: {
          imports: [ArenaChart],
          providers: [{ provide: ARENA_API, useClass: StubArenaApi }],
        },
        add: {
          imports: [StubArenaChart],
          providers: [{ provide: ARENA_API, useValue: stubApi }],
        },
      })
      .compileComponents();
  });

  it('INV-6/INV-7: отображает оценку из ArenaApi, русские типы заявок, подписи портфеля и вкладку Снятые без ₽', async () => {
    const fixture = TestBed.createComponent(ArenaPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    expect(text).toContain('Арена');
    expect(text).toContain('Слепая сессия');
    expect(text).toContain('День 1 из 60');
    expect(text).toContain('Бумага A');
    expect(text).toContain('Бумага B');
    expect(text).toContain('Бумага C');
    expect(text).toContain('Выставить заявку');
    expect(text).toContain('Портфель');
    expect(text).toContain('Стоимость портфеля');
    expect(text).toContain('P&L');
    expect(text).toContain('Снятые');
    expect(text).toContain('77,77 %');

    const typeSelect = root.querySelector('#arena-order-type') as HTMLSelectElement | null;
    expect(typeSelect).not.toBeNull();
    const optionTexts = Array.from(typeSelect!.options).map((o) => o.textContent?.trim());
    expect(optionTexts).toContain('Рыночная');
    expect(optionTexts).toContain('OCO: стоп + тейк');
    expect(optionTexts).not.toContain('market');

    // Подписи полей формы заявки расположены снаружи tui-textfield (не обрезаются у size="s").
    const ticketLabels = Array.from(
      root.querySelectorAll('app-arena-order-ticket label[tuiLabel]'),
    );
    expect(ticketLabels.length).toBeGreaterThanOrEqual(3);
    for (const label of ticketLabels) {
      expect(label.closest('tui-textfield')).toBeNull();
      expect(label.querySelector('tui-textfield')).not.toBeNull();
      expect(label.getAttribute('data-orientation')).toBe('vertical');
    }
    const labelTexts = ticketLabels.map((l) => l.textContent ?? '');
    expect(labelTexts.some((t) => t.includes('Бумага'))).toBe(true);
    expect(labelTexts.some((t) => t.includes('Тип заявки'))).toBe(true);
    expect(labelTexts.some((t) => t.includes('Количество, лотов'))).toBe(true);

    // INV-7: в слепом режиме нет рублёвых сумм и тикеров.
    expect(text).not.toContain('₽');
    expect(text).not.toContain('SBER');
    expect(text).not.toContain('GAZP');
  });

  it('форматирует короткие метки оси времени и полные подписи перекрестия', () => {
    expect(formatBlindAxisTick(-1, 0)).toBe('п−1');
    expect(formatBlindAxisTick(-3, 0)).toBe('п−3');
    expect(formatBlindAxisTick(5, 6)).toBe('д6');
    expect(formatBlindCandleLabel(5, 1)).toBe('день 5, свеча 1');
  });

  it('F6: форматирует новые причины снятия заявок из proto', () => {
    expect(formatRejectReason('REPLACED')).toBe('Заменена пользователем.');
    expect(formatRejectReason('DAY_EXPIRED')).toBe('Истёк срок заявки (день).');
    expect(formatRejectReason('OCO_SIBLING_FILLED')).toBe('Снята при исполнении второй ноги OCO.');
    expect(formatRejectReason('SESSION_END')).toBe('Снята при завершении сессии.');
  });

  it('F3: нулевой капитал (equityRub === 0) при банкротстве отображается в рублях, а не уходит в ветку процентов', () => {
    const fixture = TestBed.createComponent(ArenaPortfolioPanel);
    fixture.componentRef.setInput('papers', []);
    fixture.componentRef.setInput('portfolio', {
      equityPct: 0,
      cashPct: 0,
      investedPct: 0,
      pnlPct: -100,
      costsPct: 0,
      equityRub: 0,
      cashRub: 0,
      investedRub: 0,
      pnlRub: -1_000_000,
      costsRub: 0,
      positions: {},
    });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const primaryEquity = root.querySelector('.equity-row .metric-item .tui-text_h5');
    expect(primaryEquity?.textContent?.trim()).toBe('0 ₽');
    expect(root.textContent ?? '').toContain('в ₽ и %');
  });

  it('F8: отображает индикатор загрузки и ошибку на уровне страницы, включая режим только чтения', async () => {
    let rejectLoad!: (err: Error) => void;
    vi.spyOn(stubApi, 'getSnapshot').mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectLoad = reject;
        }),
    );

    const fixture = TestBed.createComponent(ArenaPage);
    fixture.componentRef.setInput('readOnly', true);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent ?? '').toContain('Загрузка сессии…');

    rejectLoad(new Error('Сеть недоступна'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent ?? '').toContain('Сеть недоступна');
  });
});

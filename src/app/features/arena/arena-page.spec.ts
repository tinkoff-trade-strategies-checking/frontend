import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
import { formatBlindAxisTick, formatBlindCandleLabel } from './arena.format';
import { ArenaPage } from './arena-page';
import { ArenaChart } from './components/arena-chart';
import { ArenaCandle, ArenaFill, ArenaOrder } from './data/arena.models';

@Component({
  selector: 'app-arena-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="stub-chart">Свечей: {{ candles().length }}</div>`,
})
class StubArenaChart {
  readonly candles = input.required<readonly ArenaCandle[]>();
  readonly orders = input<readonly ArenaOrder[]>([]);
  readonly fills = input<readonly ArenaFill[]>([]);
  readonly showSma20 = input(false);
  readonly showSma50 = input(false);
}

describe('ArenaPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArenaPage],
      providers: [provideTaiga()],
    })
      .overrideComponent(ArenaPage, {
        remove: { imports: [ArenaChart] },
        add: { imports: [StubArenaChart] },
      })
      .compileComponents();
  });

  it('отображает плеер, вкладки бумаг, форму заявки и портфель в слепом режиме без рублёвых сумм', async () => {
    const fixture = TestBed.createComponent(ArenaPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
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
    expect(text).toContain('в % от капитала');

    const root = fixture.nativeElement as HTMLElement;
    const typeSelect = root.querySelector('#arena-order-type') as HTMLSelectElement | null;
    expect(typeSelect).not.toBeNull();
    const optionTexts = Array.from(typeSelect!.options).map((o) => o.textContent?.trim());
    expect(optionTexts).toContain('Рыночная');
    expect(optionTexts).toContain('OCO: стоп + тейк');
    expect(optionTexts).not.toContain('market');

    // INV-7: в слепом режиме нет рублёвых сумм и тикеров.
    expect(text).not.toContain('₽');
    expect(text).not.toContain('SBER');
    expect(text).not.toContain('GAZP');
  });

  it('форматирует короткие метки оси времени и полные подписи перекрестия', () => {
    expect(formatBlindAxisTick(0, 0)).toBe('п−1');
    expect(formatBlindAxisTick(-2, 0)).toBe('п−3');
    expect(formatBlindAxisTick(5, 5)).toBe('д5');
    expect(formatBlindCandleLabel(5, 1)).toBe('день 5, свеча 1');
  });
});

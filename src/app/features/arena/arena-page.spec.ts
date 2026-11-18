import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
import { vi } from 'vitest';
import { formatBlindAxisTick, formatBlindCandleLabel } from './arena.format';
import { ArenaPage } from './arena-page';
import { ArenaChart } from './components/arena-chart';
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
});

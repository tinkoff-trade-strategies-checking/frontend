import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
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
    expect(text).toContain('в % от капитала');

    // INV-7: в слепом режиме нет рублёвых сумм и тикеров.
    expect(text).not.toContain('₽');
    expect(text).not.toContain('SBER');
    expect(text).not.toContain('GAZP');
  });
});

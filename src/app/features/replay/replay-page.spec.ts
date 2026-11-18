import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { BehaviorSubject } from 'rxjs';
import { ArenaPage } from '../arena/arena-page';
import { ArenaChart } from '../arena/components/arena-chart';
import { ArenaCandle, ArenaFill, ArenaOrder } from '../arena/data/arena.models';
import { ReplayPage } from './replay-page';

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

describe('ReplayPage', () => {
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    paramMap$ = new BehaviorSubject(convertToParamMap({ id: 'S-0103' }));

    await TestBed.configureTestingModule({
      imports: [ReplayPage],
      providers: [
        provideTaiga(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: paramMap$.asObservable() },
        },
      ],
    })
      .overrideComponent(ArenaPage, {
        remove: { imports: [ArenaChart] },
        add: { imports: [StubArenaChart] },
      })
      .compileComponents();
  });

  it('отображает воспроизведение S-0103 в режиме только чтения без формы заявки', async () => {
    const fixture = TestBed.createComponent(ReplayPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Воспроизведение S-0103');
    expect(text).toContain('Только просмотр: заявки из журнала');
    expect(text).toContain('Открыть отчёт');
    expect(text).toContain('26.02.2020 — 21.05.2020');
    expect(text).toContain('SBER');
    expect(text).toContain('GAZP');
    expect(text).toContain('YDEX');
    expect(text).not.toContain('Выставить заявку');
    expect(text).not.toContain('Завершить сессию');
  });

  it('INV-7: для незавершённой слепой сессии S-0104 воспроизведение недоступно', async () => {
    paramMap$.next(convertToParamMap({ id: 'S-0104' }));
    const fixture = TestBed.createComponent(ReplayPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Воспроизведение недоступно до завершения слепой сессии');
    expect(text).toContain('Вернуться на арену');
    expect(text).not.toMatch(/SBER|GAZP|YDEX|26\.02\.2020|21\.05\.2020/);
  });
});

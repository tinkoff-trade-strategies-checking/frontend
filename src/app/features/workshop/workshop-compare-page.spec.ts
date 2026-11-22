import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { HISTORY_API } from '../history/data/history.models';
import { StubHistoryApi } from '../history/data/stub-history.api';
import { RUNS_API } from '../runs/data/runs.models';
import { StubRunsApi } from '../runs/data/stub-runs.api';
import { WorkshopCompareChart } from './components/workshop-compare-chart';
import { StubWorkshopApi } from './data/stub-workshop.api';
import { WORKSHOP_API } from './data/workshop.models';
import { WorkshopComparePage } from './workshop-compare-page';
import { CompareChartSeries } from './workshop-compare.store';

@Component({
  selector: 'app-workshop-compare-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="stub-compare-chart">{{ series().length }}</div>`,
})
class StubCompareChart {
  readonly series = input.required<readonly CompareChartSeries[]>();
}

describe('WorkshopComparePage', () => {
  let queryParamMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    queryParamMap$ = new BehaviorSubject(convertToParamMap({ ids: 'A-0002,A-0003,A-0001' }));

    await TestBed.configureTestingModule({
      imports: [WorkshopComparePage],
      providers: [
        provideTaiga(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamMap$.asObservable() } },
      ],
    })
      .overrideComponent(WorkshopComparePage, {
        remove: {
          imports: [WorkshopCompareChart],
          providers: [
            { provide: WORKSHOP_API, useClass: StubWorkshopApi },
            { provide: HISTORY_API, useClass: StubHistoryApi },
            { provide: RUNS_API, useClass: StubRunsApi },
          ],
        },
        add: {
          imports: [StubCompareChart],
          providers: [
            { provide: WORKSHOP_API, useClass: StubWorkshopApi },
            { provide: HISTORY_API, useClass: StubHistoryApi },
            { provide: RUNS_API, useClass: StubRunsApi },
          ],
        },
      })
      .compileComponents();
  });

  async function flushAsync(): Promise<void> {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
    }
  }

  it('отображает сравнительную таблицу метрик, выделение лучшего значения, предупреждение о разных периодах и «Нет прогона»', async () => {
    const fixture = TestBed.createComponent(WorkshopComparePage);
    fixture.detectChanges();
    await flushAsync();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const text = (el.textContent ?? '').replace(/\u00a0/g, ' ');

    expect(text).toContain('Сравнение алгоритмов');
    expect(text).toContain('Momentum RSI');
    expect(text).toContain('Breakout ATR');
    expect(text).toContain('Эталон платформы');
    expect(text).toContain('+8,15 %');
    expect(text).toContain('+3,74 %');
    expect(text).toContain('Нет прогона');
    expect(text).toContain('Запустить прогон');
    expect(text).toContain('разных периодах или наборах бумаг');
    expect(el.querySelector('.stub-compare-chart')?.textContent).toBe('2');
    expect(el.querySelectorAll('.best-cell').length).toBeGreaterThan(0);
  });

  it('удаляет алгоритм из сравнения и обновляет queryParams', async () => {
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(WorkshopComparePage);
    fixture.detectChanges();
    await flushAsync();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const removeChipBtn = el.querySelector(
      'button[aria-label="Убрать Эталон платформы из сравнения"]',
    ) as HTMLButtonElement | null;
    expect(removeChipBtn).not.toBeNull();
    removeChipBtn?.click();
    fixture.detectChanges();

    expect(el.querySelector('th[data-compare-algo="A-0001"]')).toBeNull();
    expect(navSpy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { ids: 'A-0002,A-0003' },
        replaceUrl: true,
      }),
    );
  });

  it('при пустом списке показывает пустое состояние со ссылкой в Мастерскую', async () => {
    queryParamMap$.next(convertToParamMap({}));
    const fixture = TestBed.createComponent(WorkshopComparePage);
    fixture.detectChanges();
    await flushAsync();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Нет выбранных алгоритмов для сравнения.');
    expect(el.querySelector('a[href="/workshop"]')).not.toBeNull();
  });
});

describe('WorkshopCompareChart', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkshopCompareChart],
      providers: [provideTaiga()],
    }).compileComponents();
  });

  it('отрисовывает легенду серий и позволяет переключать видимость серии', () => {
    const fixture = TestBed.createComponent(WorkshopCompareChart);
    fixture.componentRef.setInput('series', [
      {
        id: 'A-0002',
        name: 'Momentum RSI',
        colorVar: 'var(--tui-text-action)',
        initialCapitalRub: 1_000_000,
        points: [
          { step: 0, dateLabel: '10.04.2023', capitalRub: 1_000_000, benchmarkCapitalRub: null },
          { step: 60, dateLabel: '05.07.2023', capitalRub: 1_081_500, benchmarkCapitalRub: null },
        ],
      },
      {
        id: 'A-0003',
        name: 'Breakout ATR',
        colorVar: 'var(--tui-text-positive)',
        initialCapitalRub: 1_000_000,
        points: [
          { step: 0, dateLabel: '11.07.2023', capitalRub: 1_000_000, benchmarkCapitalRub: null },
          { step: 60, dateLabel: '03.10.2023', capitalRub: 1_037_400, benchmarkCapitalRub: null },
        ],
      },
    ]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const legendBtns = Array.from(el.querySelectorAll('.legend-btn')) as HTMLButtonElement[];
    expect(legendBtns.length).toBe(2);
    expect(legendBtns[0].getAttribute('aria-pressed')).toBe('true');

    legendBtns[0].click();
    fixture.detectChanges();
    expect(legendBtns[0].getAttribute('aria-pressed')).toBe('false');
    expect(legendBtns[0].classList.contains('legend-hidden')).toBe(true);
  });
});

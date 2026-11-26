import { TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
import { vi } from 'vitest';
import { CompareChartSeries } from '../workshop-compare.store';
import { WorkshopCompareChart } from './workshop-compare-chart';

interface MockSeriesApi {
  applyOptions: ReturnType<typeof vi.fn>;
  setData: ReturnType<typeof vi.fn>;
}

const mockState = vi.hoisted(() => {
  let visibleRange = { from: 3400, to: 3740 };
  const createdSeries: MockSeriesApi[] = [];
  const timeScale = {
    fitContent: vi.fn(),
    getVisibleLogicalRange: vi.fn(() => visibleRange),
    setVisibleLogicalRange: vi.fn((next: { from: number; to: number }) => {
      visibleRange = next;
    }),
  };
  const chart = {
    addSeries: vi.fn(() => {
      const api: MockSeriesApi = {
        applyOptions: vi.fn(),
        setData: vi.fn(),
      };
      createdSeries.push(api);
      return api;
    }),
    removeSeries: vi.fn(),
    applyOptions: vi.fn(),
    timeScale: vi.fn(() => timeScale),
    remove: vi.fn(),
  };
  const createChart = vi.fn(() => chart);
  return {
    reset() {
      visibleRange = { from: 3400, to: 3740 };
      createdSeries.length = 0;
      timeScale.fitContent.mockClear();
      timeScale.getVisibleLogicalRange.mockClear();
      timeScale.setVisibleLogicalRange.mockClear();
      chart.addSeries.mockClear();
      chart.removeSeries.mockClear();
      chart.applyOptions.mockClear();
      chart.timeScale.mockClear();
      chart.remove.mockClear();
      createChart.mockClear();
    },
    getVisibleRange: () => visibleRange,
    createdSeries,
    timeScale,
    chart,
    createChart,
  };
});

vi.mock('lightweight-charts', () => ({
  LineSeries: 'LineSeries',
  createChart: mockState.createChart,
}));

const SAMPLE_SERIES: readonly CompareChartSeries[] = [
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
];

describe('WorkshopCompareChart — стабильность оси X', () => {
  beforeEach(async () => {
    mockState.reset();
    await TestBed.configureTestingModule({
      imports: [WorkshopCompareChart],
      providers: [provideTaiga()],
    }).compileComponents();
  });

  it('переключение видимости кривой меняет только visible и не сдвигает ось X', () => {
    const fixture = TestBed.createComponent(WorkshopCompareChart);
    fixture.componentRef.setInput('series', SAMPLE_SERIES);
    fixture.detectChanges();

    expect(mockState.createChart).toHaveBeenCalledTimes(1);
    expect(mockState.createdSeries).toHaveLength(2);
    expect(mockState.timeScale.fitContent).toHaveBeenCalledTimes(1);
    expect(mockState.timeScale.setVisibleLogicalRange).toHaveBeenCalledTimes(1);
    const rangeAfterInit = mockState.getVisibleRange();

    const firstSeries = mockState.createdSeries[0];
    const secondSeries = mockState.createdSeries[1];
    firstSeries.setData.mockClear();
    secondSeries.setData.mockClear();
    firstSeries.applyOptions.mockClear();

    const legendBtn = fixture.nativeElement.querySelector('.legend-btn') as HTMLButtonElement;
    for (let i = 0; i < 5; i++) {
      legendBtn.click();
      fixture.detectChanges();
      legendBtn.click();
      fixture.detectChanges();
    }

    expect(firstSeries.applyOptions).toHaveBeenCalledWith({ visible: false });
    expect(firstSeries.applyOptions).toHaveBeenCalledWith({ visible: true });
    expect(firstSeries.setData).not.toHaveBeenCalled();
    expect(secondSeries.setData).not.toHaveBeenCalled();
    expect(mockState.timeScale.fitContent).toHaveBeenCalledTimes(1);
    expect(mockState.timeScale.setVisibleLogicalRange).toHaveBeenCalledTimes(1);
    expect(mockState.getVisibleRange()).toEqual(rangeAfterInit);
  });

  it('переключение режима % / ₽ сохраняет текущий видимый диапазон без fitContent', () => {
    const fixture = TestBed.createComponent(WorkshopCompareChart);
    fixture.componentRef.setInput('series', SAMPLE_SERIES);
    fixture.detectChanges();

    const rangeAfterInit = mockState.getVisibleRange();
    mockState.timeScale.fitContent.mockClear();
    mockState.timeScale.setVisibleLogicalRange.mockClear();

    const rubBtn = Array.from(
      fixture.nativeElement.querySelectorAll(
        'tui-segmented button',
      ) as NodeListOf<HTMLButtonElement>,
    ).find((b) => (b.textContent ?? '').includes('Капитал'));
    expect(rubBtn).toBeDefined();
    rubBtn?.click();
    fixture.detectChanges();

    expect(mockState.timeScale.fitContent).not.toHaveBeenCalled();
    expect(mockState.timeScale.setVisibleLogicalRange).toHaveBeenCalledWith(rangeAfterInit);
    expect(mockState.getVisibleRange()).toEqual(rangeAfterInit);
  });
});

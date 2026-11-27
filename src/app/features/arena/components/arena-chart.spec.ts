import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ArenaCandle } from '../data/arena.models';

const addSeriesCalls: { type: unknown; options: unknown; paneIndex?: number }[] = [];
const seriesMocks: {
  setData: ReturnType<typeof vi.fn>;
  applyOptions: ReturnType<typeof vi.fn>;
  createPriceLine: ReturnType<typeof vi.fn>;
  removePriceLine: ReturnType<typeof vi.fn>;
  coordinateToPrice: ReturnType<typeof vi.fn>;
  priceToCoordinate: ReturnType<typeof vi.fn>;
}[] = [];

const chartApplyOptionsMock = vi.fn();

vi.mock('lightweight-charts', () => {
  const CandlestickSeries = { __type: 'CandlestickSeries' };
  const HistogramSeries = { __type: 'HistogramSeries' };
  const LineSeries = { __type: 'LineSeries' };
  const LineStyle = { Solid: 0, Dotted: 1, Dashed: 2, LargeDashed: 3, SparseDotted: 4 };

  const createSeriesMock = () => {
    const mock = {
      setData: vi.fn(),
      applyOptions: vi.fn(),
      createPriceLine: vi.fn(() => ({})),
      removePriceLine: vi.fn(),
      coordinateToPrice: vi.fn(() => 100),
      priceToCoordinate: vi.fn(() => 50),
    };
    seriesMocks.push(mock);
    return mock;
  };

  return {
    CandlestickSeries,
    HistogramSeries,
    LineSeries,
    LineStyle,
    createSeriesMarkers: vi.fn(() => ({ setMarkers: vi.fn() })),
    createChart: vi.fn(() => ({
      addSeries: vi.fn((type: unknown, options: unknown, paneIndex?: number) => {
        addSeriesCalls.push({ type, options, paneIndex });
        return createSeriesMock();
      }),
      removeSeries: vi.fn(),
      addPane: vi.fn(),
      removePane: vi.fn(),
      panes: vi.fn(() => [{ setStretchFactor: vi.fn() }]),
      paneSize: vi.fn(() => ({ width: 800, height: 360 })),
      priceScale: vi.fn(() => ({ applyOptions: vi.fn() })),
      applyOptions: chartApplyOptionsMock,
      timeScale: vi.fn(() => ({
        fitContent: vi.fn(),
        subscribeVisibleLogicalRangeChange: vi.fn(),
        unsubscribeVisibleLogicalRangeChange: vi.fn(),
        subscribeSizeChange: vi.fn(),
        unsubscribeSizeChange: vi.fn(),
        coordinateToTime: vi.fn(() => null),
        coordinateToLogical: vi.fn(() => null),
        timeToCoordinate: vi.fn(() => null),
      })),
      remove: vi.fn(),
    })),
  };
});

import { ArenaChart } from './arena-chart';

function makeCandles(count: number): ArenaCandle[] {
  const out: ArenaCandle[] = [];
  for (let i = 0; i < count; i++) {
    const open = 100 + i * 0.5;
    const close = open + 0.4;
    out.push({
      step: i,
      day: i + 1,
      candleInDay: 1,
      open,
      high: close + 0.5,
      low: open - 0.5,
      close,
      volume: 1000 + i * 10,
    });
  }
  return out;
}

describe('ArenaChart', () => {
  beforeEach(async () => {
    addSeriesCalls.length = 0;
    seriesMocks.length = 0;
    chartApplyOptionsMock.mockClear();

    await TestBed.configureTestingModule({
      imports: [ArenaChart],
    }).compileComponents();
  });

  it('лениво создаёт серии оверлеев и линии закрытия только при их включении', () => {
    const fixture = TestBed.createComponent(ArenaChart);
    const candles = makeCandles(60);
    fixture.componentRef.setInput('paperId', 'A');
    fixture.componentRef.setInput('candles', candles);
    fixture.detectChanges();

    // При старте в режиме свечей без оверлеев создаются только 2 серии: свечи и объём (не 11).
    expect(addSeriesCalls).toHaveLength(2);

    // Включаем SMA 20 -> добавляется ровно 1 линейная серия.
    fixture.componentRef.setInput('showSma20', true);
    fixture.detectChanges();
    expect(addSeriesCalls).toHaveLength(3);
    const sma20Mock = seriesMocks[2];
    expect(sma20Mock.setData).toHaveBeenCalledTimes(1);
    expect((sma20Mock.setData.mock.calls[0][0] as unknown[]).length).toBeGreaterThan(0);

    // Выключаем SMA 20 -> очищается один раз; на следующем шаге повторно не трогается.
    fixture.componentRef.setInput('showSma20', false);
    fixture.detectChanges();
    expect(sma20Mock.setData).toHaveBeenCalledTimes(2);
    expect(sma20Mock.setData).toHaveBeenLastCalledWith([]);

    fixture.componentRef.setInput('candles', makeCandles(61));
    fixture.detectChanges();
    expect(sma20Mock.setData).toHaveBeenCalledTimes(2);

    // Включаем Bollinger -> лениво добавляются 3 серии.
    fixture.componentRef.setInput('showBollinger', true);
    fixture.detectChanges();
    expect(addSeriesCalls).toHaveLength(6);

    // Переключаем в режим «Линия» -> лениво добавляется серия closeLine.
    fixture.componentRef.setInput('chartMode', 'line');
    fixture.detectChanges();
    expect(addSeriesCalls).toHaveLength(7);
  });
});

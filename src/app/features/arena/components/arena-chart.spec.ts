import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ArenaCandle } from '../data/arena.models';
import { ArenaChart } from './arena-chart';

interface SeriesLike {
  data(): readonly unknown[];
  setData(data: readonly unknown[]): void;
}

interface ArenaChartInternals {
  candleSeries: SeriesLike | null;
  volumeSeries: SeriesLike | null;
  closeLineSeries: SeriesLike | null;
  sma20Series: SeriesLike | null;
  sma50Series: SeriesLike | null;
  ema20Series: SeriesLike | null;
  ema50Series: SeriesLike | null;
  bbUpperSeries: SeriesLike | null;
  bbMiddleSeries: SeriesLike | null;
  bbLowerSeries: SeriesLike | null;
  vwapSeries: SeriesLike | null;
}

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
    await TestBed.configureTestingModule({
      imports: [ArenaChart],
    }).compileComponents();
  });

  it('лениво создаёт серии оверлеев и линии закрытия только при их включении', () => {
    const fixture = TestBed.createComponent(ArenaChart);
    fixture.componentRef.setInput('paperId', 'A');
    fixture.componentRef.setInput('candles', makeCandles(60));
    fixture.detectChanges();

    const chart = fixture.componentInstance as unknown as ArenaChartInternals;

    // При старте в режиме свечей без оверлеев создаются только 2 серии: свечи и объём.
    expect(chart.candleSeries).not.toBeNull();
    expect(chart.volumeSeries).not.toBeNull();
    expect(chart.closeLineSeries).toBeNull();
    expect(chart.sma20Series).toBeNull();
    expect(chart.sma50Series).toBeNull();
    expect(chart.ema20Series).toBeNull();
    expect(chart.ema50Series).toBeNull();
    expect(chart.bbUpperSeries).toBeNull();
    expect(chart.bbMiddleSeries).toBeNull();
    expect(chart.bbLowerSeries).toBeNull();
    expect(chart.vwapSeries).toBeNull();

    // Включаем SMA 20 -> лениво создаётся только sma20Series.
    fixture.componentRef.setInput('showSma20', true);
    fixture.detectChanges();
    expect(chart.sma20Series).not.toBeNull();
    expect(chart.sma20Series!.data().length).toBeGreaterThan(0);
    expect(chart.sma50Series).toBeNull();
    expect(chart.ema20Series).toBeNull();
    expect(chart.bbUpperSeries).toBeNull();
    expect(chart.vwapSeries).toBeNull();

    // Выключаем SMA 20 -> очищается один раз; на следующем шаге повторно не трогается.
    const setDataSpy = vi.spyOn(chart.sma20Series!, 'setData');
    fixture.componentRef.setInput('showSma20', false);
    fixture.detectChanges();
    expect(setDataSpy).toHaveBeenCalledTimes(1);
    expect(setDataSpy).toHaveBeenLastCalledWith([]);
    expect(chart.sma20Series!.data()).toHaveLength(0);

    fixture.componentRef.setInput('candles', makeCandles(61));
    fixture.detectChanges();
    expect(setDataSpy).toHaveBeenCalledTimes(1);

    // Включаем Bollinger -> лениво создаются 3 серии полос Боллинджера.
    fixture.componentRef.setInput('showBollinger', true);
    fixture.detectChanges();
    expect(chart.bbUpperSeries).not.toBeNull();
    expect(chart.bbMiddleSeries).not.toBeNull();
    expect(chart.bbLowerSeries).not.toBeNull();
    expect(chart.bbUpperSeries!.data().length).toBeGreaterThan(0);

    // Переключаем в режим «Линия» -> лениво создаётся серия closeLineSeries.
    fixture.componentRef.setInput('chartMode', 'line');
    fixture.detectChanges();
    expect(chart.closeLineSeries).not.toBeNull();
    expect(chart.closeLineSeries!.data()).toHaveLength(61);
  });
});

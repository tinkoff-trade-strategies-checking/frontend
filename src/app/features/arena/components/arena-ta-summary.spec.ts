import { TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
import { vi } from 'vitest';
import { ArenaTaSummary } from './arena-ta-summary';
import { ArenaCandle } from '../data/arena.models';

function buildCandles(count: number): ArenaCandle[] {
  const out: ArenaCandle[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const open = price;
    const close = open + 0.8 + Math.sin(i * 0.5) * 0.3;
    out.push({
      step: i,
      day: i + 1,
      candleInDay: 1,
      open: Number(open.toFixed(2)),
      high: Number((Math.max(open, close) + 1).toFixed(2)),
      low: Number((Math.min(open, close) - 0.8).toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: 1000 + i * 10,
    });
    price = close;
  }
  return out;
}

describe('ArenaTaSummary', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArenaTaSummary],
      providers: [provideTaiga()],
    }).compileComponents();
  });

  it('отображает общую 5-уровневую сводку, счётчики и 3 вкладки без утечек ₽/дат (INV-7)', () => {
    const fixture = TestBed.createComponent(ArenaTaSummary);
    fixture.componentRef.setInput('candles', buildCandles(65));
    fixture.componentRef.setInput('paperLabel', 'Бумага A');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    expect(text).toContain('Сводка теханализа');
    expect(text).toContain('Бумага A');
    expect(text).toContain('Покупать:');
    expect(text).toContain('Продавать:');
    expect(text).toContain('Индикаторы (12)');
    expect(text).toContain('Скользящие (12)');
    expect(text).toContain('Точки разворота');

    // Вкладка по умолчанию: 12 индикаторов
    expect(root.querySelectorAll('tbody tr')).toHaveLength(12);
    expect(text).toContain('RSI(14)');
    expect(text).toContain('MACD(12,26)');
    expect(text).toContain('Bull/Bear Power(13)');

    // INV-7: без символа ₽ и без тикеров
    expect(text).not.toContain('₽');
    expect(text).not.toContain('SBER');

    // Переключаемся на «Скользящие (12)»
    const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    tabs[1].click();
    fixture.detectChanges();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(6);
    expect(root.textContent).toContain('MA5');
    expect(root.textContent).toContain('MA200');

    // Переключаемся на «Точки разворота»
    tabs[2].click();
    fixture.detectChanges();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(root.textContent).toContain('Классические');
    expect(root.textContent).toContain('Фибоначчи');
    expect(root.textContent).toContain('Камарилья');
    expect(root.textContent).toContain('Вуди');
    expect(root.textContent).toContain('ДеМарк');
  });

  it('эмитит closePanel при нажатии кнопки «Свернуть»', () => {
    const fixture = TestBed.createComponent(ArenaTaSummary);
    fixture.componentRef.setInput('candles', buildCandles(30));
    const spy = vi.fn();
    fixture.componentInstance.closePanel.subscribe(spy);
    fixture.detectChanges();

    const closeBtn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-label="Свернуть панель теханализа"]',
    );
    closeBtn?.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

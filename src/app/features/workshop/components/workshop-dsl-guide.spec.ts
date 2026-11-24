import { TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
import { vi } from 'vitest';
import { DSL_GUIDE_EXAMPLES, DSL_QUICKSTART_CODE } from '../data/dsl-guide.data';
import { WorkshopDslGuide } from './workshop-dsl-guide';

function findTab(el: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(el.querySelectorAll<HTMLButtonElement>('button[role="tab"]')).find(
    (b) => b.textContent?.trim() === label,
  );
}

describe('WorkshopDslGuide', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkshopDslGuide],
      providers: [provideTaiga()],
    }).compileComponents();
  });

  it('открывает вкладку «Быстрый старт» с минимальной стратегией, разбором и правилами исполнения', () => {
    const fixture = TestBed.createComponent(WorkshopDslGuide);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
    expect(el.textContent).toContain('Справка по языку DSL');
    expect(el.textContent).toContain('Минимальная рабочая стратегия');
    expect(el.textContent).toContain('Разбор по частям');
    expect(el.textContent).toContain('Как исполняется стратегия');
    expect(el.querySelectorAll('.code-line').length).toBeGreaterThan(5);
    expect(el.textContent).not.toContain('Вставить в редактор');
  });

  it('переключает все вкладки и фильтрует справочник индикаторов и функций', () => {
    const fixture = TestBed.createComponent(WorkshopDslGuide);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;

    findTab(el, 'Синтаксис')?.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Структура файла и параметры');
    expect(el.textContent).toContain('Действия (then)');
    expect(el.textContent).toContain('take_profit');
    expect(el.textContent).toContain('Ограничения языка');

    findTab(el, 'Индикаторы и данные')?.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Данные свечи и смещения');
    expect(el.textContent).toContain('bars_in_position');
    expect(el.textContent).toContain('crossover(a, b)');

    const searchInput = el.querySelector('#dsl-guide-ref-search') as HTMLInputElement;
    expect(searchInput).not.toBeNull();
    searchInput.value = 'atr';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.textContent).toContain('atr(n)');
    expect(el.textContent).not.toContain('sma(x, n)');

    searchInput.value = 'неизвестная_функция_xyz';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.textContent).toContain('По запросу ничего не найдено.');

    findTab(el, 'Примеры стратегий')?.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Эталон платформы');
    expect(el.textContent).toContain('Пробой канала Дончиана');

    findTab(el, 'Частые ошибки')?.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('E-LA01');
    expect(el.textContent).toContain('E-BEC');
    expect(el.textContent).toContain('L001');
    expect(el.textContent).toContain('W-LA01');
  });

  it('показывает кнопку «Вставить в редактор» при canInsert=true, эмитит код и копирует в буфер', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const fixture = TestBed.createComponent(WorkshopDslGuide);
    fixture.componentRef.setInput('canInsert', true);

    const inserted: string[] = [];
    let closeCalls = 0;
    fixture.componentInstance.insertCode.subscribe((code) => inserted.push(code));
    fixture.componentInstance.closed.subscribe(() => {
      closeCalls += 1;
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const copyBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Скопировать',
    );
    expect(copyBtn).toBeDefined();
    copyBtn?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(writeText).toHaveBeenCalledWith(DSL_QUICKSTART_CODE);
    expect(el.textContent).toContain('Скопировано');

    const insertBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Вставить в редактор',
    );
    expect(insertBtn).toBeDefined();
    insertBtn?.click();
    expect(inserted).toEqual([DSL_QUICKSTART_CODE]);

    const closeBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Закрыть',
    );
    closeBtn?.click();
    expect(closeCalls).toBe(1);
  });

  it('все примеры стратегий используют корректный синтаксис DSL без точек с запятой', () => {
    const snippets = [DSL_QUICKSTART_CODE, ...DSL_GUIDE_EXAMPLES.map((item) => item.code)];
    for (const code of snippets) {
      expect(code).not.toContain(';');
      expect(code).toMatch(/\bparam\s+[a-z_][a-z0-9_]*\s*=/);
      expect(code).toMatch(/\brule\s+"[^"]+"/);
      expect(code).toMatch(/\bwhen\b/);
      expect(code).toMatch(/\bthen\b/);
      expect(code).toMatch(/\bbecause\s+"[^"]+"/);
    }
  });
});

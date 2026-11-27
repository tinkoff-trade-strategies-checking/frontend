import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { vi } from 'vitest';
import { formatBlindAxisTick, formatBlindCandleLabel, formatRejectReason } from './arena.format';
import { ArenaDrawingTool } from './arena-drawing';
import { ArenaPage } from './arena-page';
import { TaOscillatorId } from './arena-ta';
import { ArenaChart } from './components/arena-chart';
import { ArenaPortfolioPanel } from './components/arena-portfolio-panel';
import { ARENA_API, ArenaCandle, ArenaFill, ArenaOrder } from './data/arena.models';
import { StubArenaApi } from './data/stub-arena.api';
import { UI_MODE_STORAGE_KEY, UiModeService } from '../../shared/ui-mode.service';

@Component({
  selector: 'app-arena-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="stub-chart">Свечей: {{ candles().length }}</div>`,
})
class StubArenaChart {
  readonly paperId = input<string>('');
  readonly paperKey = input<string>('');
  readonly blind = input(true);
  readonly candles = input.required<readonly ArenaCandle[]>();
  readonly orders = input<readonly ArenaOrder[]>([]);
  readonly fills = input<readonly ArenaFill[]>([]);
  readonly showSma20 = input(false);
  readonly showSma50 = input(false);
  readonly showEma20 = input(false);
  readonly showEma50 = input(false);
  readonly showBollinger = input(false);
  readonly showVwap = input(false);
  readonly oscillator = input<TaOscillatorId>('none');
  readonly drawingTool = input<ArenaDrawingTool>('none');
  readonly undoNonce = input(0);
  readonly clearNonce = input(0);
  readonly drawingsCountChange = output<number>();
  readonly drawingToolChange = output<ArenaDrawingTool>();
}

describe('ArenaPage', () => {
  let stubApi: StubArenaApi;

  beforeEach(async () => {
    localStorage.removeItem('ttsc.arenaGuideDismissed');
    localStorage.removeItem(UI_MODE_STORAGE_KEY);
    stubApi = new StubArenaApi();
    vi.spyOn(stubApi, 'estimateOrder').mockResolvedValue({ amountPct: 77.77 });

    await TestBed.configureTestingModule({
      imports: [ArenaPage],
      providers: [provideTaiga(), provideRouter([])],
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

  it('«Завершить сессию» есть у идущей сессии и исчезает после завершения', async () => {
    const fixture = TestBed.createComponent(ArenaPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const finishButton = () =>
      Array.from(root.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Завершить сессию'),
      );
    expect(finishButton()).toBeDefined();

    fixture.componentInstance['store'].finished.set(true);
    fixture.detectChanges();
    expect(finishButton()).toBeUndefined();
  });

  it('завершённая слепая сессия подписана «Слепая (раскрыта)»', async () => {
    const fixture = TestBed.createComponent(ArenaPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Слепая сессия');
    expect(root.textContent).not.toContain('Слепая (раскрыта)');

    fixture.componentInstance['store'].finished.set(true);
    fixture.detectChanges();
    expect(root.textContent).toContain('Слепая (раскрыта)');
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
    expect(text).toContain('Купить 5 лот.');
    expect(text).toContain('Портфель');
    expect(text).toContain('Стоимость портфеля');
    expect(text).toContain('Прибыль / убыток');
    expect(text).toContain('Цена входа');
    expect(text).toContain('Снятые');
    expect(text).toContain('77,77 %');

    // В Базовом режиме без позиции доступны только Рыночная и Лимитная, а срок действия (На день / До отмены) скрыт на рыночной.
    const typeSelect = root.querySelector('#arena-order-type') as HTMLSelectElement | null;
    expect(typeSelect).not.toBeNull();
    const basicOptions = Array.from(typeSelect!.options).map((o) => o.textContent?.trim());
    expect(basicOptions).toEqual(['Рыночная', 'Лимитная']);
    expect(basicOptions).not.toContain('market');
    expect(root.querySelector('app-arena-order-ticket')?.textContent).not.toContain('На день');

    // В режиме Профи с открытой позицией доступны все 7 типов заявок, включая OCO.
    TestBed.inject(UiModeService).setMode('pro');
    fixture.componentInstance['store'].portfolio.update((p) => ({
      ...p,
      positions: {
        ...p.positions,
        A: { paperId: 'A', lots: 10, avgPrice: 100, pnlPct: 0, valuePct: 10 },
      },
    }));
    fixture.detectChanges();
    const proOptions = Array.from(typeSelect!.options).map((o) => o.textContent?.trim());
    expect(proOptions).toContain('Рыночная');
    expect(proOptions).toContain('OCO: стоп + тейк');
    expect(proOptions.length).toBe(7);

    // Подписи полей формы заявки расположены снаружи tui-textfield (не обрезаются у size="s").
    const ticketLabels = Array.from(
      root.querySelectorAll('app-arena-order-ticket label[tuiLabel]'),
    );
    expect(ticketLabels.length).toBeGreaterThanOrEqual(3);
    for (const label of ticketLabels) {
      expect(label.closest('tui-textfield')).toBeNull();
      expect(label.querySelector('tui-textfield')).not.toBeNull();
      expect(label.getAttribute('data-orientation')).toBe('vertical');
    }
    const labelTexts = ticketLabels.map((l) => l.textContent ?? '');
    expect(labelTexts.some((t) => t.includes('Бумага'))).toBe(true);
    expect(labelTexts.some((t) => t.includes('Тип заявки'))).toBe(true);
    expect(labelTexts.some((t) => t.includes('Количество, лотов'))).toBe(true);

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

  it('F6: форматирует новые причины снятия заявок из proto', () => {
    expect(formatRejectReason('REPLACED')).toBe('Заменена пользователем.');
    expect(formatRejectReason('DAY_EXPIRED')).toBe('Истёк срок заявки (день).');
    expect(formatRejectReason('OCO_SIBLING_FILLED')).toBe('Снята при исполнении второй ноги OCO.');
    expect(formatRejectReason('POSITION_CLOSED')).toBe('Снята при закрытии позиции.');
    expect(formatRejectReason('SESSION_END')).toBe('Снята при завершении сессии.');
  });

  it('F3: нулевой капитал (equityRub === 0) при банкротстве отображается в рублях, а не уходит в ветку процентов', () => {
    const fixture = TestBed.createComponent(ArenaPortfolioPanel);
    fixture.componentRef.setInput('papers', []);
    fixture.componentRef.setInput('portfolio', {
      equityPct: 0,
      cashPct: 0,
      investedPct: 0,
      pnlPct: -100,
      costsPct: 0,
      equityRub: 0,
      cashRub: 0,
      investedRub: 0,
      pnlRub: -1_000_000,
      costsRub: 0,
      positions: {},
    });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const primaryEquity = root.querySelector('.equity-row .metric-item .tui-text_h5');
    expect(primaryEquity?.textContent?.trim()).toBe('0,00 ₽');
    expect(root.textContent ?? '').toContain('в ₽ и %');
  });

  it('F8: отображает индикатор загрузки и ошибку на уровне страницы, включая режим только чтения', async () => {
    let rejectLoad!: (err: Error) => void;
    vi.spyOn(stubApi, 'getSnapshot').mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectLoad = reject;
        }),
    );

    const fixture = TestBed.createComponent(ArenaPage);
    fixture.componentRef.setInput('readOnly', true);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent ?? '').toContain('Загрузка сессии…');

    rejectLoad(new Error('Сеть недоступна'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent ?? '').toContain('Сеть недоступна');
  });

  it('после завершения сессии в тикете показывает «Оценка: —», а карточки портфеля содержат контейнер .metric-values', async () => {
    const fixture = TestBed.createComponent(ArenaPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Оценка: 77,77 %');

    fixture.componentInstance['store'].finished.set(true);
    fixture.detectChanges();

    const ticketText = root.querySelector('app-arena-order-ticket')?.textContent ?? '';
    expect(ticketText).toContain('Оценка: —');
    expect(ticketText).not.toContain('0,00 %');
    expect(root.querySelectorAll('.equity-row .metric-item .metric-values').length).toBe(2);
  });

  it('показывает 3-шаговый микро-тур на активной арене, скрывает его по завершении и не показывает в режиме только чтения', async () => {
    const fixture = TestBed.createComponent(ArenaPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.guide-banner')?.textContent).toContain('Шаг 1 из 3');
    expect(root.querySelector('.guide-banner')?.textContent).toContain('График цены');
    expect(root.querySelector('app-arena-order-ticket')?.textContent).toContain(
      'Исполнение по цене открытия следующей свечи',
    );

    const clickTourBtn = (label: string) => {
      const btn = Array.from(root.querySelectorAll('.guide-banner button')).find(
        (b) => b.textContent?.trim() === label,
      ) as HTMLButtonElement | undefined;
      expect(btn).toBeDefined();
      btn!.click();
      fixture.detectChanges();
    };

    clickTourBtn('Далее');
    expect(root.querySelector('.guide-banner')?.textContent).toContain('Шаг 2 из 3');
    expect(root.querySelector('.guide-banner')?.textContent).toContain('Панель покупки и продажи');

    clickTourBtn('Далее');
    expect(root.querySelector('.guide-banner')?.textContent).toContain('Шаг 3 из 3');
    expect(root.querySelector('.guide-banner')?.textContent).toContain('Кнопки «Шаг» и «Старт»');

    clickTourBtn('Понятно');
    expect(root.querySelector('.guide-banner')).toBeNull();
    expect(localStorage.getItem('ttsc.arenaGuideDismissed')).toBe('1');

    // В режиме только чтения (воспроизведение) тур не показывается даже с пустым localStorage.
    localStorage.removeItem('ttsc.arenaGuideDismissed');
    const roFixture = TestBed.createComponent(ArenaPage);
    roFixture.componentRef.setInput('readOnly', true);
    roFixture.detectChanges();
    await roFixture.whenStable();
    roFixture.detectChanges();
    expect((roFixture.nativeElement as HTMLElement).querySelector('.guide-banner')).toBeNull();
  });

  it('INV-2: при отправке заявки на паузе показывает подсказку с кнопкой «Сделать шаг вперёд» и переключает бумагу по клику в портфеле', async () => {
    const fixture = TestBed.createComponent(ArenaPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const buyBtn = Array.from(root.querySelectorAll('app-arena-order-ticket button')).find((b) =>
      b.textContent?.includes('Купить 5 лот.'),
    ) as HTMLButtonElement | undefined;
    expect(buyBtn).toBeDefined();
    buyBtn!.click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const callout = root.querySelector('[data-testid="arena-pause-callout"]');
    expect(callout).not.toBeNull();
    expect(callout?.textContent).toContain('Заявка принята и сработает на следующей свече');

    const stepBtn = Array.from(callout!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Сделать шаг вперёд'),
    ) as HTMLButtonElement | undefined;
    expect(stepBtn).toBeDefined();
    stepBtn!.click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="arena-pause-callout"]')).toBeNull();
    expect(fixture.componentInstance['store'].day()).toBe(2);

    // Клик по строке «Бумага B» в таблице портфеля переключает активную бумагу.
    const rows = Array.from(root.querySelectorAll('app-arena-portfolio-panel tbody tr'));
    const rowB = rows.find((r) => r.textContent?.includes('Бумага B')) as HTMLElement | undefined;
    expect(rowB).toBeDefined();
    rowB!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['store'].selectedPaperId()).toBe('B');
  });

  it('в Базовом режиме скрывает панель ТА за переключателем, а при раскрытии открывает «Теханализ» и осциллятор', async () => {
    const fixture = TestBed.createComponent(ArenaPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-arena-ta-summary')).toBeNull();
    expect(root.querySelector('#arena-oscillator-select')).toBeNull();

    const toggleBtn = root.querySelector<HTMLButtonElement>('[data-testid="arena-ta-toggle"]');
    expect(toggleBtn).not.toBeNull();
    toggleBtn!.click();
    fixture.detectChanges();

    const taButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Теханализ',
    );
    expect(taButton).toBeDefined();
    taButton!.click();
    fixture.detectChanges();

    expect(root.querySelector('app-arena-ta-summary')).not.toBeNull();
    expect(root.textContent).toContain('Сводка теханализа');
    expect(root.textContent).not.toContain('₽');

    const oscSelect = root.querySelector('#arena-oscillator-select') as HTMLSelectElement | null;
    expect(oscSelect).not.toBeNull();
    oscSelect!.value = 'rsi';
    oscSelect!.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance['oscillator']()).toBe('rsi');
  });

  it('в Базовом режиме скрывает панель рисования за кнопкой «Рисование», а в Профи показывает сразу', async () => {
    const fixture = TestBed.createComponent(ArenaPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="arena-drawing-toolbar"]')).toBeNull();

    const toggleBtn = root.querySelector<HTMLButtonElement>('[data-testid="arena-drawing-toggle"]');
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn!.textContent?.trim()).toBe('Рисование');
    toggleBtn!.click();
    fixture.detectChanges();

    const toolbar = root.querySelector('[data-testid="arena-drawing-toolbar"]');
    expect(toolbar).not.toBeNull();
    const toolbarText = toolbar!.textContent ?? '';
    expect(toolbarText).toContain('Курсор');
    expect(toolbarText).toContain('Карандаш');
    expect(toolbarText).toContain('Уровень');
    expect(toolbarText).toContain('Тренд');
    expect(toolbarText).toContain('Фибоначчи');
    expect(toolbarText).toContain('Линейка');
    expect(toolbarText).toContain('Отменить');
    expect(toolbarText).toContain('Очистить');
    expect(toolbarText).not.toContain('₽');

    const cursorBtn = root.querySelector<HTMLButtonElement>('[data-testid="arena-draw-none"]');
    expect(cursorBtn?.title).toBe('Перемещение графика');

    const freehandBtn = root.querySelector<HTMLButtonElement>(
      '[data-testid="arena-draw-freehand"]',
    );
    expect(freehandBtn).not.toBeNull();
    freehandBtn!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['drawingTool']()).toBe('freehand');

    const fibBtn = root.querySelector<HTMLButtonElement>('[data-testid="arena-draw-fib"]');
    expect(fibBtn).not.toBeNull();
    fibBtn!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['drawingTool']()).toBe('fib');

    // Скрываем панель в Базовом, затем включаем режим Профи — панель рисования видна сразу.
    toggleBtn!.click();
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="arena-drawing-toolbar"]')).toBeNull();

    TestBed.inject(UiModeService).setMode('pro');
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="arena-drawing-toolbar"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="arena-drawing-toggle"]')).toBeNull();
  });
});

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTaiga, TuiDialogService } from '@taiga-ui/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { UiModeService } from '../../shared/ui-mode.service';
import { formatBlindAxisTick, formatBlindCandleLabel, formatRejectReason } from './arena.format';
import { ArenaPage } from './arena-page';
import { ArenaChart } from './components/arena-chart';
import { ArenaOrderTicket } from './components/arena-order-ticket';
import { ArenaPortfolioPanel } from './components/arena-portfolio-panel';
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
    localStorage.clear();
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

  it('INV-6/INV-7: отображает оценку из ArenaApi, подписи портфеля, пояснение слепого режима и типы заявок в Профи-режиме без ₽', async () => {
    const uiMode = TestBed.inject(UiModeService);
    uiMode.setMode('beginner');

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
    expect(text).toContain('Купить (на след. шаге)');
    expect(text).toContain('В слепом режиме цены условные (старт = 100)');
    expect(text).toContain('Портфель');
    expect(text).toContain('Стоимость портфеля');
    expect(text).toContain('Прибыль / убыток');
    expect(text).not.toContain('P&L');
    expect(text).toContain('Снятые');
    expect(text).toContain('77,77 %');

    // В базовом режиме список из 7 типов заявок скрыт.
    expect(root.querySelector('#arena-order-type')).toBeNull();

    // Переключаем в Профи-режим: при 0 лотов sell-only типы скрыты.
    uiMode.setMode('pro');
    fixture.detectChanges();

    const typeSelect = root.querySelector('#arena-order-type') as HTMLSelectElement | null;
    expect(typeSelect).not.toBeNull();
    const zeroPosOptions = Array.from(typeSelect!.options).map((o) => o.textContent?.trim());
    expect(zeroPosOptions).toContain('Рыночная');
    expect(zeroPosOptions).not.toContain('OCO: стоп + тейк');
    expect(zeroPosOptions).not.toContain('Тейк-профит');
    expect(zeroPosOptions).not.toContain('Трейлинг-стоп');
    expect(zeroPosOptions).not.toContain('market');

    // При наличии позиции по выбранной бумаге sell-only типы появляются.
    const store = fixture.componentInstance['store'];
    store.portfolio.set({
      ...store.portfolio(),
      positions: {
        A: { paperId: 'A', lots: 5, avgPrice: 100, pnlPct: 0, valuePct: 20 },
      },
    });
    fixture.detectChanges();

    const withPosOptions = Array.from(typeSelect!.options).map((o) => o.textContent?.trim());
    expect(withPosOptions).toContain('OCO: стоп + тейк');
    expect(withPosOptions).toContain('Тейк-профит');
    expect(withPosOptions).toContain('Трейлинг-стоп');

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
    const proText = root.textContent ?? '';
    expect(proText).not.toContain('₽');
    expect(proText).not.toContain('SBER');
    expect(proText).not.toContain('GAZP');
  });

  it('показывает баннер «Сделать шаг вперёд» при выставлении заявки на паузе и скрывает его после шага', async () => {
    const fixture = TestBed.createComponent(ArenaPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const store = fixture.componentInstance['store'];
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).not.toContain('Заявка принята и сработает на следующем шаге');

    await store.placeOrder({
      paperId: 'A',
      side: 'buy',
      type: 'market',
      lots: 2,
      tif: 'day',
    });
    fixture.detectChanges();

    expect(root.textContent).toContain('Заявка принята и сработает на следующем шаге');
    const stepBtn = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Сделать шаг вперёд'),
    );
    expect(stepBtn).toBeDefined();

    stepBtn!.click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(store.step()).toBe(1);
    expect(root.textContent).not.toContain('Заявка принята и сработает на следующем шаге');
  });

  it('быстрые кнопки 25% / 50% / Всё на продаже считают целые лоты от position.lots (INV-6)', () => {
    const fixture = TestBed.createComponent(ArenaOrderTicket);
    fixture.componentRef.setInput('papers', [
      { id: 'A', label: 'Бумага A', sector: 'Финансы', candles: [], changePct: 0, lastPrice: 100 },
    ]);
    fixture.componentRef.setInput('selectedPaperId', 'A');
    fixture.componentRef.setInput('finished', false);
    fixture.componentRef.setInput('portfolio', {
      equityPct: 100,
      cashPct: 50,
      investedPct: 50,
      pnlPct: 0,
      costsPct: 0,
      positions: {
        A: { paperId: 'A', lots: 10, avgPrice: 100, pnlPct: 0, valuePct: 50 },
      },
    });
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    comp['onSideIndexChange'](1);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const chipButtons = Array.from(
      root.querySelectorAll('.sell-chips button'),
    ) as HTMLButtonElement[];
    expect(chipButtons.map((b) => b.textContent?.trim())).toEqual(['25%', '50%', 'Всё']);

    chipButtons[0].click();
    expect(comp['lots']()).toBe(2);

    chipButtons[1].click();
    expect(comp['lots']()).toBe(5);

    chipButtons[2].click();
    expect(comp['lots']()).toBe(10);
  });

  it('клик по строке позиции в портфеле выбирает бумагу', () => {
    const fixture = TestBed.createComponent(ArenaPortfolioPanel);
    fixture.componentRef.setInput('papers', [
      { id: 'A', label: 'Бумага A', sector: 'Финансы', candles: [], changePct: 0, lastPrice: 100 },
      { id: 'B', label: 'Бумага B', sector: 'Нефть', candles: [], changePct: 0, lastPrice: 100 },
    ]);
    fixture.componentRef.setInput('selectedPaperId', 'A');
    fixture.componentRef.setInput('portfolio', {
      equityPct: 100,
      cashPct: 100,
      investedPct: 0,
      pnlPct: 0,
      costsPct: 0,
      positions: {},
    });
    const selected: string[] = [];
    fixture.componentInstance.paperSelect.subscribe((id) => selected.push(id));
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll(
      'tbody tr',
    ) as NodeListOf<HTMLTableRowElement>;
    rows[1].click();
    expect(selected).toEqual(['B']);
  });

  it('показывает микро-подсказку при первом входе и скрывает после нажатия «Понятно»', async () => {
    const fixture = TestBed.createComponent(ArenaPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.onboarding-card')).not.toBeNull();

    const okBtn = root.querySelector('.onboarding-card button') as HTMLButtonElement;
    okBtn.click();
    fixture.detectChanges();

    expect(root.querySelector('.onboarding-card')).toBeNull();
    expect(localStorage.getItem('ttsc_arena_onboarding_dismissed')).toBe('1');
  });

  it('предупреждает в модалке завершения сессии, если сделок 0', async () => {
    const dialogSpy = vi.spyOn(TestBed.inject(TuiDialogService), 'open').mockReturnValue(of(false));

    const fixture = TestBed.createComponent(ArenaPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance['confirmFinish']();
    expect(dialogSpy).toHaveBeenCalledTimes(1);
    const options = dialogSpy.mock.calls[0][1] as { data?: { content?: string } };
    expect(options?.data?.content).toContain(
      'Вы пока не совершили ни одной сделки — отчёт будет без результатов торговли',
    );
  });

  it('форматирует понятные метки оси времени и полные подписи перекрестия', () => {
    expect(formatBlindAxisTick(-1, 0)).toBe('До старта −1');
    expect(formatBlindAxisTick(-3, 0)).toBe('До старта −3');
    expect(formatBlindAxisTick(5, 6)).toBe('День 6');
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
});

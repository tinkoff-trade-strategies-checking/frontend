import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { ReportEquityChart } from './components/report-equity-chart';
import { ReportUnderwaterChart } from './components/report-underwater-chart';
import {
  EquityCurvePoint,
  REPORT_API,
  SessionReport,
  SessionReportResult,
  UnderwaterPoint,
} from './data/report.models';
import { StubReportApi } from './data/stub-report.api';
import { ReportPage } from './report-page';
import { ReportStore } from './report.store';

@Component({
  selector: 'app-report-equity-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="stub-equity">{{ points().length }}</div>`,
})
class StubEquityChart {
  readonly points = input.required<readonly EquityCurvePoint[]>();
}

@Component({
  selector: 'app-report-underwater-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="stub-underwater">{{ points().length }}</div>`,
})
class StubUnderwaterChart {
  readonly points = input.required<readonly UnderwaterPoint[]>();
}

describe('ReportPage', () => {
  let stubApi: StubReportApi;
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    stubApi = new StubReportApi();
    paramMap$ = new BehaviorSubject(convertToParamMap({ id: 'S-0103' }));

    await TestBed.configureTestingModule({
      imports: [ReportPage],
      providers: [
        provideTaiga(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$.asObservable() } },
      ],
    })
      .overrideComponent(ReportPage, {
        remove: {
          imports: [ReportEquityChart, ReportUnderwaterChart],
          providers: [{ provide: REPORT_API, useClass: StubReportApi }],
        },
        add: {
          imports: [StubEquityChart, StubUnderwaterChart],
          providers: [{ provide: REPORT_API, useValue: stubApi }],
        },
      })
      .compileComponents();
  });

  it('INV-6: отображает метрики и подпись сравнения из источника без пересчёта (даже если подпись расходится с числами)', async () => {
    const base = await stubApi.getReport('S-0103');
    if (base.status !== 'READY') {
      throw new Error('Ожидался готовый отчёт S-0103');
    }

    if (!base.report.comparison) {
      throw new Error('Ожидалось сравнение в S-0103');
    }
    const sentinel: SessionReportResult = {
      status: 'READY',
      report: {
        ...base.report,
        humanMetrics: {
          ...base.report.humanMetrics,
          sharpe: 3.14,
          sortino: 4.21,
          benchmarkImoexPct: 7.77,
        },
        comparison: {
          ...base.report.comparison,
          finalCapital: {
            humanRub: 1_234_567,
            algoRub: 1_100_000,
            winner: 'human',
            diffRub: 134_567,
            // Намеренно не равно 1 234 567 - 1 100 000 = 134 567 ₽, чтобы поймать клиентский пересчёт.
            diffLabel: 'Сентинел: вы лучше на 999 888 ₽',
          },
        },
      },
    };
    vi.spyOn(stubApi, 'getReport').mockResolvedValueOnce(sentinel);

    const fixture = TestBed.createComponent(ReportPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';

    expect(text).toContain('Сентинел: вы лучше на 999 888 ₽');
    expect(text).toContain('3,14');
    expect(text).toContain('4,21');
    expect(text).toContain('rf = RUONIA');
    expect(text).toContain('Вы, алгоритм, бенчмарк IMOEX');
    expect(text).toContain('+7,77 %');
    expect(text).toContain('Выгрузка отчёта пока недоступна');

    const buttons = Array.from(root.querySelectorAll('button'));
    const xlsxBtn = buttons.find((b) => b.textContent?.includes('Скачать XLSX'));
    const csvBtn = buttons.find((b) => b.textContent?.includes('Скачать CSV'));
    expect(xlsxBtn?.disabled).toBe(true);
    expect(csvBtn?.disabled).toBe(true);
  });

  it('период показан один раз (ДД.ММ.ГГГГ) с днями, заголовок — «бумаги · период», подпись сделок — про закрытые пары', async () => {
    const fixture = TestBed.createComponent(ReportPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const text = (root.textContent ?? '').replace(/\u00a0/g, ' ');
    const rep = (await stubApi.getReport('S-0103')) as { status: 'READY'; report: SessionReport };
    expect(root.querySelector('h1')?.textContent).toContain('·');
    expect(root.querySelector('h1')?.textContent).toContain(rep.report.period.label);
    expect(text).not.toContain(rep.report.period.startDate + ' —');
    expect(text).not.toContain('день 1 — день');
    expect(text).toContain('Закрытых сделок (пары FIFO)');
  });

  it('stopTakeSameBarCount > 0 — предупреждение; 0 или нет поля — без предупреждения', async () => {
    const base = await stubApi.getReport('S-0103');
    if (base.status !== 'READY') {
      throw new Error('Ожидался готовый отчёт S-0103');
    }
    const withCount = (count: number | undefined): SessionReportResult => ({
      status: 'READY',
      report: {
        ...base.report,
        humanMetrics: { ...base.report.humanMetrics, stopTakeSameBarCount: count },
      },
    });
    vi.spyOn(stubApi, 'getReport').mockResolvedValueOnce(withCount(3));
    let fixture = TestBed.createComponent(ReportPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.same-bar-warning')?.textContent,
    ).toContain('В 3 случаях стоп и тейк сработали на одном баре');

    vi.spyOn(stubApi, 'getReport').mockResolvedValueOnce(withCount(0));
    fixture = TestBed.createComponent(ReportPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.same-bar-warning')).toBeNull();
  });

  it('«Результаты сделок»: пары FIFO с результатом по сделке; без поля (заглушки) блока нет', async () => {
    const base = await stubApi.getReport('S-0103');
    if (base.status !== 'READY') {
      throw new Error('Ожидался готовый отчёт S-0103');
    }
    vi.spyOn(stubApi, 'getReport').mockResolvedValueOnce({
      status: 'READY',
      report: {
        ...base.report,
        roundTrips: [
          {
            paperTicker: 'SBER',
            entryStep: 3,
            exitStep: 20,
            entryDateLabel: '02.03.2020',
            exitDateLabel: '23.03.2020',
            lots: 80,
            entryPriceRub: 234.4,
            exitPriceRub: 240,
            grossPnlRub: 448,
            costsRub: 48,
            netPnlRub: 400,
          },
        ],
      },
    });
    const fixture = TestBed.createComponent(ReportPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.componentInstance['store'].setTab('fills');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const text = (root.textContent ?? '').replace(/\u00a0/g, ' ');
    expect(text).toContain('Результаты сделок');
    const row = root.querySelector('table.round-trips tbody tr');
    expect(row?.textContent).toContain('SBER');
    expect(row?.textContent).toContain('+400');
  });

  it('отчёт с null в полях контракта открывается: блоки скрываются или показывают «нет данных»', async () => {
    paramMap$.next(convertToParamMap({ id: 'S-NO-ALGO' }));

    const fixture = TestBed.createComponent(ReportPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const text = (root.textContent ?? '').replace(/\u00a0/g, ' ');
    expect(text).toContain('S-NO-ALGO');
    expect(text).toContain('SBER');
    expect(text).toContain('Сравнение с алгоритмом недоступно');
    expect(text).not.toContain('Алгоритм впереди');
    expect(text).toContain('Нет данных');
    expect(root.querySelector('.stub-underwater')).toBeNull();
    expect(root.querySelector('.stub-equity')).not.toBeNull();
    expect(text).not.toContain('— дн.');
    expect(text).toContain('Кривая капитала');
    expect(text).not.toContain('бенчмарк IMOEX');

    const tabButton = (label: string): HTMLButtonElement => {
      const btn = Array.from(root.querySelectorAll('button')).find((b) =>
        b.textContent?.includes(label),
      );
      if (!btn) {
        throw new Error(`Нет вкладки ${label}`);
      }
      return btn;
    };

    tabButton('Расхождения').click();
    fixture.detectChanges();
    expect(root.textContent).toContain('Разбор расхождений недоступен');

    tabButton('Обратная проверка').click();
    fixture.detectChanges();
    expect(root.textContent).toContain('Обратная проверка недоступна');

    tabButton('Сделки').click();
    fixture.detectChanges();
    expect(root.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
  });

  it('INV-7: отчёт незавершённой слепой сессии S-0104 не открывается и не раскрывает период и тикеры', async () => {
    paramMap$.next(convertToParamMap({ id: 'S-0104' }));

    const fixture = TestBed.createComponent(ReportPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Слепая сессия от 18.11.2026');
    expect(text).toContain('Отчёт недоступен до завершения слепой сессии');
    expect(text).toContain('Вернуться на арену');

    for (const forbidden of ['SBER', 'GAZP', 'YDEX', 'Сбербанк', '26.02.2020', '21.05.2020']) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('отбрасывает устаревший ответ при гонке load() и сбрасывает вкладку/фильтр при смене id', async () => {
    const fixture = TestBed.createComponent(ReportPage);
    const store = fixture.debugElement.injector.get(ReportStore);

    let resolveSlow!: (value: SessionReportResult) => void;
    const slowPromise = new Promise<SessionReportResult>((resolve) => {
      resolveSlow = resolve;
    });

    const spy = vi.spyOn(stubApi, 'getReport');
    spy.mockReturnValueOnce(slowPromise);

    store.setTab('fills');
    store.setDivergenceFilter('extra');

    const firstLoad = store.load('S-0103');
    expect(store.result()).toBeNull();
    expect(store.activeTab()).toBe('metrics');
    expect(store.divergenceFilter()).toBe('all');
    expect(store.loading()).toBe(true);

    const secondLoad = store.load('S-0105');
    await secondLoad;
    expect(store.result()?.status).toBe('READY');
    if (store.result()?.status === 'READY') {
      expect(
        store.result()!.status === 'READY' &&
          (store.result() as { report: { sessionId: string } }).report.sessionId,
      ).toBe('S-0105');
    }

    // Приходит запоздавший ответ первого запроса — он должен быть отброшен.
    const ready0103 = await new StubReportApi().getReport('S-0103');
    resolveSlow(ready0103);
    await firstLoad;

    const current = store.result();
    expect(current?.status).toBe('READY');
    if (current?.status === 'READY') {
      expect(current.report.sessionId).toBe('S-0105');
    }
  });

  it('отображает состояние BUILDING («Отчёт строится») с кнопкой обновления', async () => {
    paramMap$.next(convertToParamMap({ id: 'S-BUILDING' }));

    const fixture = TestBed.createComponent(ReportPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Отчёт строится');
    expect(text).toContain('Обновить');
  });

  it('INV-6: вкладка «Расхождения» отображает сводку, типы и знак цены ошибки из источника без пересчёта', async () => {
    const base = await stubApi.getReport('S-0103');
    if (base.status !== 'READY') {
      throw new Error('Ожидался готовый отчёт S-0103');
    }

    const sentinel: SessionReportResult = {
      status: 'READY',
      report: {
        ...base.report,
        divergenceSummary: {
          totalErrorCostRub: 123_456.78,
          totalErrorCostPct: 9.87,
          worstDivergenceId: 'DIV-SENTINEL',
          worstType: 'timing',
          worstDay: 55,
          worstErrorCostRub: 77_777.77,
        },
        divergences: [
          {
            id: 'DIV-S1',
            step: 5,
            day: 6,
            dateLabel: '04.03',
            paperTicker: 'SBER',
            sector: 'Финансы',
            type: 'extra',
            deltaBars: null,
            horizonStep: 12,
            horizonDay: 13,
            humanAction: 'Покупка 10 лот.',
            algoAction: 'Нет заявки',
            errorCostRub: -555.55,
            errorCostPct: -0.05,
            because: 'алгоритм здесь не действовал бы',
          },
          {
            id: 'DIV-S2',
            step: 9,
            day: 10,
            dateLabel: '10.03',
            paperTicker: 'GAZP',
            sector: 'Нефть и газ',
            type: 'timing',
            deltaBars: 3,
            horizonStep: 20,
            horizonDay: 21,
            humanAction: 'Покупка 20 лот.',
            algoAction: 'Покупка 20 лот.',
            errorCostRub: 77_777.77,
            errorCostPct: 7.77,
            because: 'сентинел-причина',
          },
        ],
      },
    };
    vi.spyOn(stubApi, 'getReport').mockResolvedValueOnce(sentinel);

    const fixture = TestBed.createComponent(ReportPage);
    const store = fixture.debugElement.injector.get(ReportStore);
    fixture.detectChanges();
    await fixture.whenStable();
    store.setTab('divergences');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const text = (root.textContent ?? '').replace(/\u00a0/g, ' ');

    // Сводка взята из divergenceSummary без пересчёта на клиенте.
    expect(text).toContain('123 456,78 ₽');
    expect(text).toContain('9,87 %');
    expect(text).toContain('момент на дне 55');
    expect(text).toContain('+77 777,77 ₽');

    // Знак цены ошибки: > 0 -> .neg (выгоднее алгоритм), < 0 -> .pos (вы поступили не хуже).
    const rows = Array.from(root.querySelectorAll('tbody tr'));
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('td.pos')?.textContent?.replace(/\u00a0/g, ' ')).toContain(
      '−555,55 ₽',
    );
    expect(rows[1].querySelector('td.neg')?.textContent?.replace(/\u00a0/g, ' ')).toContain(
      '+77 777,77 ₽',
    );
    expect(rows[1].textContent).toContain('Δt = +3 бар.');

    // Сортировка по цене ошибки ставит +77 777,77 ₽ первым.
    store.setDivergenceSort('errorCost');
    fixture.detectChanges();
    const sortedRows = Array.from(root.querySelectorAll('tbody tr'));
    expect(sortedRows[0].textContent).toContain('сентинел-причина');

    // Фильтрация по типу «Лишнее действие».
    store.setDivergenceFilter('extra');
    fixture.detectChanges();
    const filteredRows = Array.from(root.querySelectorAll('tbody tr'));
    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0].textContent).toContain('алгоритм здесь не действовал бы');

    // Ссылка на воспроизведение содержит ?step=5.
    const replayLink = filteredRows[0].querySelector('a');
    expect(replayLink?.getAttribute('href')).toContain('/replay/S-0103?step=5');
  });

  it('вкладка «Обратная проверка» показывает прибыльные сделки со входом «лишнее действие» и активную кнопку перехода в мастерскую', async () => {
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(ReportPage);
    const store = fixture.debugElement.injector.get(ReportStore);
    fixture.detectChanges();
    await fixture.whenStable();
    store.setTab('reverse');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const text = (root.textContent ?? '').replace(/\u00a0/g, ' ');
    expect(text).toContain('GAZP');
    expect(text).toContain('+7 470,00 ₽');

    const ruleBtn = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Написать правило'),
    );
    expect(ruleBtn).toBeDefined();
    expect(ruleBtn?.disabled).toBe(false);
    ruleBtn?.click();
    expect(navSpy).toHaveBeenCalledWith(['/workshop'], { queryParams: { create: '1' } });
  });

  it('для S-0105 кнопка «Посмотреть в воспроизведении» неактивна, а обратная проверка содержит SBER', async () => {
    paramMap$.next(convertToParamMap({ id: 'S-0105' }));
    const fixture = TestBed.createComponent(ReportPage);
    const store = fixture.debugElement.injector.get(ReportStore);
    fixture.detectChanges();
    await fixture.whenStable();
    store.setTab('divergences');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const replayBtns = Array.from(root.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Посмотреть в воспроизведении'),
    );
    expect(replayBtns.length).toBeGreaterThan(0);
    expect(replayBtns.every((b) => b.disabled)).toBe(true);

    store.setTab('reverse');
    fixture.detectChanges();
    const text = (root.textContent ?? '').replace(/\u00a0/g, ' ');
    expect(text).toContain('SBER');
    expect(text).toContain('+3 900,00 ₽');
  });

  it('показывает (малая выборка) при playedDays < 10, нулевую просадку без «−» и корректные ветки totalErrorCostRub', async () => {
    const base = await stubApi.getReport('S-0103');
    if (base.status !== 'READY' || !base.report.divergenceSummary || !base.report.comparison) {
      throw new Error('Ожидался готовый отчёт S-0103');
    }

    vi.spyOn(stubApi, 'getReport').mockResolvedValueOnce({
      status: 'READY',
      report: {
        ...base.report,
        playedDays: 5,
        humanMetrics: { ...base.report.humanMetrics, maxDrawdownPct: 0 },
        comparison: {
          ...base.report.comparison,
          maxDrawdown: {
            humanPct: 0,
            algoPct: 0,
            winner: 'tie',
            diffPctPoints: 0,
            diffLabel: 'Просадки равны',
          },
        },
        divergenceSummary: {
          ...base.report.divergenceSummary,
          totalErrorCostRub: -125.5,
          totalErrorCostPct: -1.25,
          worstType: null,
          worstDay: null,
          worstErrorCostRub: null,
        },
      },
    });

    const fixture = TestBed.createComponent(ReportPage);
    const store = fixture.debugElement.injector.get(ReportStore);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const metricsText = (root.textContent ?? '').replace(/\u00a0/g, ' ');
    expect(metricsText).toContain('(малая выборка)');
    expect(metricsText).not.toContain('−0,00 %');
    const ddCard = Array.from(root.querySelectorAll('.cmp-card')).find((c) =>
      c.textContent?.includes('Максимальная просадка'),
    );
    expect(ddCard?.querySelector('.neg')).toBeNull();
    expect(ddCard?.textContent).toContain('На уровне алгоритма');

    store.setTab('divergences');
    fixture.detectChanges();
    const divText = (root.textContent ?? '').replace(/\u00a0/g, ' ');
    expect(divText).toContain('Расхождения сложились в вашу пользу (сэкономлено 125,50 ₽, 1,25 %)');

    // Граничное значение |totalErrorCostRub| < 0.005 — нейтральная формулировка без «сэкономлено 0,00 ₽» и .neg.
    vi.spyOn(stubApi, 'getReport').mockResolvedValueOnce({
      status: 'READY',
      report: {
        ...base.report,
        divergenceSummary: {
          ...base.report.divergenceSummary,
          totalErrorCostRub: 0.002,
          totalErrorCostPct: 0.001,
          worstType: null,
          worstDay: null,
          worstErrorCostRub: null,
        },
      },
    });
    const zeroFixture = TestBed.createComponent(ReportPage);
    const zeroStore = zeroFixture.debugElement.injector.get(ReportStore);
    zeroFixture.detectChanges();
    await zeroFixture.whenStable();
    zeroStore.setTab('divergences');
    zeroFixture.detectChanges();
    const zeroText = ((zeroFixture.nativeElement as HTMLElement).textContent ?? '').replace(
      /\u00a0/g,
      ' ',
    );
    expect(zeroText).toContain('Расхождения не повлияли на итог (0,00 ₽)');
    expect(zeroText).not.toContain('сэкономлено 0,00 ₽');
    expect(zeroText).not.toContain('обошлись вам в 0,00 ₽');
  });
});

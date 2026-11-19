import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { ReportEquityChart } from './components/report-equity-chart';
import { ReportUnderwaterChart } from './components/report-underwater-chart';
import {
  EquityCurvePoint,
  REPORT_API,
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
    expect(text).toContain('+7,77 %');
    expect(text).toContain('Выгрузка отчёта пока недоступна');

    const buttons = Array.from(root.querySelectorAll('button'));
    const xlsxBtn = buttons.find((b) => b.textContent?.includes('Скачать XLSX'));
    const csvBtn = buttons.find((b) => b.textContent?.includes('Скачать CSV'));
    expect(xlsxBtn?.disabled).toBe(true);
    expect(csvBtn?.disabled).toBe(true);
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

  it('вкладка «Обратная проверка» показывает прибыльные сделки со входом «лишнее действие» и неактивную кнопку', async () => {
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
    expect(ruleBtn?.disabled).toBe(true);
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
});

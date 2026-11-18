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
    paramMap$ = new BehaviorSubject(convertToParamMap({ id: 'S-0104' }));

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

  it('INV-6: отображает метрики и сравнение «кто лучше и на сколько» из источника без пересчёта', async () => {
    const base = await stubApi.getReport('S-0104');
    if (base.status !== 'READY') {
      throw new Error('Ожидался готовый отчёт S-0104');
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
            diffLabel: 'Вы лучше на 134 567 ₽',
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

    expect(text).toContain('Вы лучше на 134 567 ₽');
    expect(text).toContain('3,14');
    expect(text).toContain('4,21');
    expect(text).toContain('rf = RUONIA');
    expect(text).toContain('+7,77 %');
    expect(text).toContain('после подключения API');

    const buttons = Array.from(root.querySelectorAll('button'));
    const xlsxBtn = buttons.find((b) => b.textContent?.includes('Скачать XLSX'));
    const csvBtn = buttons.find((b) => b.textContent?.includes('Скачать CSV'));
    expect(xlsxBtn?.disabled).toBe(true);
    expect(csvBtn?.disabled).toBe(true);
  });

  it('INV-7: отчёт незавершённой слепой сессии не открывается и не раскрывает период и тикеры', async () => {
    paramMap$.next(convertToParamMap({ id: 'S-BLIND-ACTIVE' }));

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
});

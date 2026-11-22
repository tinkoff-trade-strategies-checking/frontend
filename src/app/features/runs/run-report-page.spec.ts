import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { ReportEquityChart } from '../report/components/report-equity-chart';
import { ReportUnderwaterChart } from '../report/components/report-underwater-chart';
import { ReportExportService } from '../report/data/report-export.service';
import { EquityCurvePoint, UnderwaterPoint } from '../report/data/report.models';
import { RUNS_API } from './data/runs.models';
import { StubRunsApi } from './data/stub-runs.api';
import { RunReportPage } from './run-report-page';

@Component({
  selector: 'app-report-equity-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="stub-equity">{{ points().length }}:{{ primaryLabel() }}</div>`,
})
class StubEquityChart {
  readonly points = input.required<readonly EquityCurvePoint[]>();
  readonly primaryLabel = input('Вы');
}

@Component({
  selector: 'app-report-underwater-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="stub-underwater">{{ points().length }}:{{ primaryLabel() }}</div>`,
})
class StubUnderwaterChart {
  readonly points = input.required<readonly UnderwaterPoint[]>();
  readonly primaryLabel = input('Вы');
}

describe('RunReportPage', () => {
  let stubApi: StubRunsApi;
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let downloadRunSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    stubApi = new StubRunsApi();
    paramMap$ = new BehaviorSubject(convertToParamMap({ id: 'R-0205' }));
    downloadRunSpy = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [RunReportPage],
      providers: [
        provideTaiga(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$.asObservable() } },
        { provide: ReportExportService, useValue: { downloadRun: downloadRunSpy } },
      ],
    })
      .overrideComponent(RunReportPage, {
        remove: {
          imports: [ReportEquityChart, ReportUnderwaterChart],
          providers: [{ provide: RUNS_API, useClass: StubRunsApi }],
        },
        add: {
          imports: [StubEquityChart, StubUnderwaterChart],
          providers: [{ provide: RUNS_API, useValue: stubApi }],
        },
      })
      .compileComponents();
  });

  it('отображает level, findings, графики, метрики и вкладки Сделки / Заявки алгоритма', async () => {
    const fixture = TestBed.createComponent(RunReportPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const text = (root.textContent ?? '').replace(/\u00a0/g, ' ');
    expect(text).toContain('Momentum RSI v2');
    expect(text).toContain('Предупреждение');
    expect(text).toContain('W-RT01');
    expect(text).toContain('Первые 14 баров пропущены на прогрев индикатора RSI.');
    expect(text).toContain('SBER');
    expect(root.querySelector('.stub-equity')?.textContent).toBe('3:Алгоритм');
    expect(root.querySelector('.stub-underwater')?.textContent).toBe('3:Алгоритм');

    const ordersTab = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Заявки алгоритма'),
    );
    ordersTab?.click();
    fixture.detectChanges();
    expect(root.textContent).toContain('enter_rsi');
    expect(root.textContent).toContain('RSI(14) опустился ниже порога 30.');
  });

  it('показывает бейдж repeatMatch (INV-4) и вызывает export/repeat по кнопкам', async () => {
    const base = await stubApi.getRunReport('R-0205');
    if (base.status !== 'READY') {
      throw new Error('Ожидался READY');
    }
    vi.spyOn(stubApi, 'getRunReport').mockResolvedValueOnce({
      status: 'READY',
      report: { ...base.report, repeatOfRunId: 'R-0204', repeatMatch: true },
    });
    vi.spyOn(stubApi, 'repeatRun').mockResolvedValueOnce({ runId: 'R-0999' });

    const fixture = TestBed.createComponent(RunReportPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Повтор совпал');

    const buttons = Array.from(root.querySelectorAll('button'));
    buttons.find((b) => b.textContent?.includes('Скачать XLSX'))?.click();
    await fixture.whenStable();
    buttons.find((b) => b.textContent?.includes('Скачать CSV'))?.click();
    await fixture.whenStable();
    expect(downloadRunSpy).toHaveBeenCalledWith('R-0205', 'xlsx');
    expect(downloadRunSpy).toHaveBeenCalledWith('R-0205', 'csv');

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    buttons.find((b) => b.textContent?.includes('Повторить прогон'))?.click();
    await fixture.whenStable();
    expect(navSpy).toHaveBeenCalledWith(['/runs', 'R-0999']);
  });

  it('рендерит E-RT01, repeatMatch=false и игнорирует повторный вызов download пока идёт экспорт', async () => {
    const base = await stubApi.getRunReport('R-0205');
    if (base.status !== 'READY') {
      throw new Error('Ожидался READY');
    }
    let resolveDownload!: () => void;
    downloadRunSpy.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveDownload = resolve;
        }),
    );

    vi.spyOn(stubApi, 'getRunReport').mockResolvedValueOnce({
      status: 'READY',
      report: {
        ...base.report,
        status: 'failed',
        level: 'ERROR',
        repeatOfRunId: 'R-0204',
        repeatMatch: false,
        findings: [
          {
            code: 'E-RT01',
            level: 'ERROR',
            message: 'Деление на ноль при расчёте индикатора.',
            step: 3,
          },
        ],
        metrics: null,
      },
    });

    const fixture = TestBed.createComponent(RunReportPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('E-RT01');
    expect(root.textContent).toContain('Деление на ноль при расчёте индикатора.');
    expect(root.textContent).toContain('Повтор не совпал (расхождение INV-4)');

    const buttons = Array.from(root.querySelectorAll('button'));
    buttons.find((b) => b.textContent?.includes('Скачать XLSX'))?.click();
    buttons.find((b) => b.textContent?.includes('Скачать CSV'))?.click();
    expect(downloadRunSpy).toHaveBeenCalledTimes(1);
    expect(downloadRunSpy).toHaveBeenCalledWith('R-0205', 'xlsx');

    resolveDownload();
    await fixture.whenStable();
    fixture.detectChanges();
    buttons.find((b) => b.textContent?.includes('Скачать CSV'))?.click();
    await fixture.whenStable();
    expect(downloadRunSpy).toHaveBeenCalledTimes(2);
    expect(downloadRunSpy).toHaveBeenLastCalledWith('R-0205', 'csv');
  });

  it('обрабатывает NOT_FINISHED и NOT_FOUND', async () => {
    paramMap$.next(convertToParamMap({ id: 'R-0203' }));
    const fixture = TestBed.createComponent(RunReportPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Отчёт недоступен до завершения прогона',
    );
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('a[href="/runs/R-0203"]'),
    ).not.toBeNull();

    paramMap$.next(convertToParamMap({ id: 'R-MISSING' }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Прогон R-MISSING не найден.',
    );
  });
});

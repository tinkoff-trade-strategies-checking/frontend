import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { of } from 'rxjs';
import { STUB_MODE } from '../../core/api-mode';
import { ReportEquityChart } from './components/report-equity-chart';
import { ReportUnderwaterChart } from './components/report-underwater-chart';
import { EquityCurvePoint, REPORT_API, UnderwaterPoint } from './data/report.models';
import { StubReportApi } from './data/stub-report.api';
import { ReportPage } from './report-page';

@Component({
  selector: 'app-report-equity-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class FakeEquityChart {
  readonly points = input.required<readonly EquityCurvePoint[]>();
}

@Component({
  selector: 'app-report-underwater-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class FakeUnderwaterChart {
  readonly points = input.required<readonly UnderwaterPoint[]>();
}

describe('ReportPage: выгрузка отчёта', () => {
  async function render(stubMode: boolean) {
    await TestBed.configureTestingModule({
      imports: [ReportPage],
      providers: [
        provideTaiga(),
        provideRouter([]),
        { provide: STUB_MODE, useValue: stubMode },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 'S-0103' })) },
        },
      ],
    })
      .overrideComponent(ReportPage, {
        remove: {
          imports: [ReportEquityChart, ReportUnderwaterChart],
          providers: [{ provide: REPORT_API, useClass: StubReportApi }],
        },
        add: {
          imports: [FakeEquityChart, FakeUnderwaterChart],
          providers: [{ provide: REPORT_API, useClass: StubReportApi }],
        },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ReportPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('настоящий режим: ссылки на XLSX и CSV ведут на выгрузку сессии', async () => {
    const root = await render(false);
    const hrefs = Array.from(root.querySelectorAll<HTMLAnchorElement>('.export-group a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toEqual([
      '/api/v1/sessions/S-0103/report/export?format=xlsx',
      '/api/v1/sessions/S-0103/report/export?format=csv',
    ]);
  });

  it('заглушки: кнопки выгрузки выключены', async () => {
    const root = await render(true);
    expect(root.querySelectorAll('.export-group a')).toHaveLength(0);
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.export-group button'));
    expect(buttons.length).toBe(2);
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });
});

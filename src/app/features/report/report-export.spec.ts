import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { STUB_MODE } from '../../core/api-mode';
import { ReportEquityChart } from './components/report-equity-chart';
import { ReportUnderwaterChart } from './components/report-underwater-chart';
import { exportFileName, FILE_SAVER, ReportExportService } from './data/report-export.service';
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

describe('сохранение файла по умолчанию', () => {
  afterEach(() => vi.useRealTimers());

  it('ссылка вставляется в DOM на время клика, затем удаляется; URL отзывается позже', () => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const inDomAtClick: boolean[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      inDomAtClick.push(document.body.contains(this));
    });
    TestBed.inject(FILE_SAVER)(new Blob(['x']), 'report.xlsx');
    expect(inDomAtClick).toEqual([true]);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });
});

describe('exportFileName', () => {
  it('берёт имя из Content-Disposition, иначе по умолчанию', () => {
    expect(exportFileName('attachment; filename="report-s1.xlsx"', 's1', 'xlsx')).toBe(
      'report-s1.xlsx',
    );
    expect(exportFileName(null, 's1', 'xlsx')).toBe('report-s1.xlsx');
    expect(exportFileName('attachment; filename="bad%name.xlsx"', 's1', 'xlsx')).toBe(
      'report-s1.xlsx',
    );
    expect(exportFileName(null, 's1', 'csv')).toBe('report-s1.zip');
  });
});

describe('ReportPage: выгрузка отчёта', () => {
  const saved: { name: string; size: number }[] = [];

  async function render(stubMode: boolean) {
    saved.length = 0;
    await TestBed.configureTestingModule({
      imports: [ReportPage],
      providers: [
        provideTaiga(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STUB_MODE, useValue: stubMode },
        {
          provide: FILE_SAVER,
          useValue: (blob: Blob, name: string) => saved.push({ name, size: blob.size }),
        },
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
    return fixture;
  }

  const buttons = (root: HTMLElement) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('.export-group button'));

  it('настоящий режим: XLSX и CSV запрашивают выгрузку сессии и сохраняют файл с именем из ответа', async () => {
    const fixture = await render(false);
    const root = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);

    buttons(root)[0].click();
    const xlsx = http.expectOne(
      (r) => r.url === '/api/v1/sessions/S-0103/report/export' && r.params.get('format') === 'xlsx',
    );
    xlsx.flush(new Blob(['x']), {
      headers: { 'Content-Disposition': 'attachment; filename="report-S-0103.xlsx"' },
    });
    await vi.waitFor(() => expect(saved).toEqual([{ name: 'report-S-0103.xlsx', size: 1 }]));

    buttons(root)[1].click();
    const csv = http.expectOne(
      (r) => r.url === '/api/v1/sessions/S-0103/report/export' && r.params.get('format') === 'csv',
    );
    expect(csv.request.headers.get('Accept')).toBe('application/zip');
    csv.flush(new Blob(['zz']));
    await vi.waitFor(() => expect(saved.at(-1)).toEqual({ name: 'report-S-0103.zip', size: 2 }));
  });

  it('409 REPORT_BUILDING: сообщение по коду из тела-Blob, файла нет', async () => {
    const fixture = await render(false);
    const root = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    buttons(root)[0].click();
    http
      .expectOne((r) => r.url === '/api/v1/sessions/S-0103/report/export')
      .flush(new Blob([JSON.stringify({ code: 'REPORT_BUILDING', status: 409 })]), {
        status: 409,
        statusText: 'Conflict',
      });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.querySelector('.export-error')?.textContent).toContain('собирается');
    });
    expect(saved).toHaveLength(0);
    expect(TestBed.inject(ReportExportService)).toBeTruthy();
  });

  it('заглушки: кнопки выгрузки выключены', async () => {
    const fixture = await render(true);
    const list = buttons(fixture.nativeElement as HTMLElement);
    expect(list.length).toBe(2);
    expect(list.every((b) => b.disabled)).toBe(true);
  });

  it('игнорирует повторный вызов download пока идёт экспорт', async () => {
    const fixture = await render(false);
    const http = TestBed.inject(HttpTestingController);
    const page = fixture.componentInstance as unknown as {
      download: (sessionId: string, format: 'xlsx' | 'csv') => Promise<void>;
    };

    const first = page.download('S-0103', 'xlsx');
    const second = page.download('S-0103', 'csv');

    const req = http.expectOne(
      (r) => r.url === '/api/v1/sessions/S-0103/report/export' && r.params.get('format') === 'xlsx',
    );
    http.expectNone(
      (r) => r.url === '/api/v1/sessions/S-0103/report/export' && r.params.get('format') === 'csv',
    );
    req.flush(new Blob(['x']));
    await Promise.all([first, second]);
    expect(saved).toHaveLength(1);
  });
});

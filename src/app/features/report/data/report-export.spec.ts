import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { toProblem } from '../../../core/api-problem';
import { FILE_SAVER, ReportExportService, exportFileName } from './report-export.service';

describe('ReportExportService', () => {
  let service: ReportExportService;
  let http: HttpTestingController;
  let saveFile: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    saveFile = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: FILE_SAVER, useValue: saveFile },
      ],
    });
    service = TestBed.inject(ReportExportService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('exportFileName формирует fallback и разбирает Content-Disposition', () => {
    expect(exportFileName(null, 's-1', 'xlsx')).toBe('report-s-1.xlsx');
    expect(exportFileName(null, 'r-1', 'csv', 'run')).toBe('run-r-1.zip');
    expect(exportFileName('attachment; filename="custom.xlsx"', 'r-1', 'xlsx', 'run')).toBe(
      'custom.xlsx',
    );
    expect(
      exportFileName(
        "attachment; filename*=UTF-8''%D0%BE%D1%82%D1%87%D1%91%D1%82.zip",
        'r-1',
        'csv',
        'run',
      ),
    ).toBe('отчёт.zip');
  });

  it('downloadRun выгружает XLSX и CSV (zip) с fallback-именем run-<id>', async () => {
    const xlsxBlob = new Blob(['xlsx']);
    const pendingXlsx = service.downloadRun('run-10', 'xlsx');
    const req1 = http.expectOne('/api/v1/runs/run-10/report/export?format=xlsx');
    expect(req1.request.headers.get('Accept')).toContain('spreadsheetml.sheet');
    req1.flush(xlsxBlob);
    await pendingXlsx;
    expect(saveFile).toHaveBeenCalledWith(xlsxBlob, 'run-run-10.xlsx');

    const zipBlob = new Blob(['zip']);
    const pendingCsv = service.downloadRun('run-10', 'csv');
    const req2 = http.expectOne('/api/v1/runs/run-10/report/export?format=csv');
    expect(req2.request.headers.get('Accept')).toBe('application/zip');
    req2.flush(zipBlob, { headers: { 'Content-Disposition': 'attachment; filename="r10.zip"' } });
    await pendingCsv;
    expect(saveFile).toHaveBeenCalledWith(zipBlob, 'r10.zip');
  });

  it('downloadRun разбирает Blob-ошибку problem+json', async () => {
    const pending = service.downloadRun('run-99', 'xlsx');
    const req = http.expectOne('/api/v1/runs/run-99/report/export?format=xlsx');
    const errBlob = new Blob([JSON.stringify({ code: 'REPORT_BUILDING', detail: 'wait' })], {
      type: 'application/problem+json',
    });
    req.flush(errBlob, { status: 409, statusText: 'Conflict' });

    await expect(pending).rejects.toSatisfy((err: unknown) => {
      return toProblem(err).code === 'REPORT_BUILDING';
    });
  });
});

import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { Api } from '../../../api/api';
import { exportReport$VndOpenxmlformatsOfficedocumentSpreadsheetmlSheet as exportXlsx } from '../../../api/fn/analysis/export-report-vnd-openxmlformats-officedocument-spreadsheetml-sheet';
import { exportReport$Zip as exportZip } from '../../../api/fn/analysis/export-report-zip';

export type ReportExportFormat = 'xlsx' | 'csv';

/** Сохранение файла в браузере; в тестах подменяется (jsdom не умеет `URL.createObjectURL`). */
export type FileSaver = (blob: Blob, fileName: string) => void;

export const FILE_SAVER = new InjectionToken<FileSaver>('FILE_SAVER', {
  providedIn: 'root',
  factory: () => (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  },
});

/** Имя файла из `Content-Disposition`, иначе по умолчанию (`report-<id>.xlsx`, для CSV — `.zip`). */
export function exportFileName(
  header: string | null,
  sessionId: string,
  format: ReportExportFormat,
): string {
  const match = header === null ? null : /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return match
    ? decodeURIComponent(match[1])
    : `report-${sessionId}.${format === 'xlsx' ? 'xlsx' : 'zip'}`;
}

/** Тело ошибки при `responseType: blob` приходит Blob-ом: разбираем JSON, чтобы работало ветвление по `code`. */
async function readProblem(error: unknown): Promise<unknown> {
  if (error instanceof HttpErrorResponse && error.error instanceof Blob) {
    let body: unknown;
    try {
      body = JSON.parse(await error.error.text());
    } catch {
      body = null;
    }
    return new HttpErrorResponse({
      status: error.status,
      statusText: error.statusText,
      headers: error.headers,
      url: error.url ?? undefined,
      error: body,
    });
  }
  return error;
}

/** Выгрузка отчёта завершённой сессии (ФТ-17): XLSX или ZIP с CSV; данные берёт сервер из сохранённого отчёта. */
@Injectable({ providedIn: 'root' })
export class ReportExportService {
  private readonly api = inject(Api);
  private readonly saveFile = inject(FILE_SAVER);

  async download(sessionId: string, format: ReportExportFormat): Promise<void> {
    try {
      const response =
        format === 'xlsx'
          ? await this.api.invoke$Response(exportXlsx, { sessionId, format })
          : await this.api.invoke$Response(exportZip, { sessionId, format });
      this.saveFile(
        response.body,
        exportFileName(response.headers.get('Content-Disposition'), sessionId, format),
      );
    } catch (error) {
      throw await readProblem(error);
    }
  }
}

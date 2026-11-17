import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-report-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="tui-text_h3">Отчёт</h1>
    <p class="tui-text_body-m">Итоги сессии и разбор расхождений — в разработке.</p>
  `,
})
export class ReportPage {}

import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-workshop-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="tui-text_h3">Мастерская</h1>
    <p class="tui-text_body-m">Алгоритмы на DSL — в разработке.</p>
  `,
})
export class WorkshopPage {}

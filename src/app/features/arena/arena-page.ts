import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-arena-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="tui-text_h3">Арена</h1>
    <p class="tui-text_body-m">Слепой плеер и заявки — в разработке.</p>
  `,
})
export class ArenaPage {}

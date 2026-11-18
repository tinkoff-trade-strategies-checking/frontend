import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TuiButton, TuiRoot } from '@taiga-ui/core';
import { StubSessionRegistry } from './shared/stub-session-registry';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TuiRoot, TuiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.less',
})
export class App {
  private readonly sessionRegistry = inject(StubSessionRegistry);

  protected readonly sections = computed(() => {
    const lastReportId = this.sessionRegistry.lastFinishedSessionId();
    return [
      { path: '/new', title: 'Новая сессия' },
      { path: '/arena', title: 'Арена' },
      { path: '/workshop', title: 'Мастерская' },
      { path: lastReportId ? `/report/${lastReportId}` : '/history', title: 'Отчёт' },
      { path: '/history', title: 'История' },
    ] as const;
  });
}

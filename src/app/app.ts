import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { TuiButton, TuiRoot } from '@taiga-ui/core';
import { filter, map, startWith } from 'rxjs';
import { DEFAULT_REPORT_SESSION_ID } from './shared/default-report-session';
import { StubSessionRegistry } from './shared/stub-session-registry';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, TuiRoot, TuiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.less',
})
export class App {
  private readonly sessionRegistry = inject(StubSessionRegistry);
  private readonly router = inject(Router);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly sections = computed(() => {
    const lastReportId = this.sessionRegistry.lastFinishedSessionId();
    return [
      { path: '/new', title: 'Новая сессия', activePrefix: '/new' },
      { path: '/arena', title: 'Арена', activePrefix: '/arena' },
      { path: '/workshop', title: 'Мастерская', activePrefix: '/workshop' },
      {
        path: `/report/${lastReportId ?? DEFAULT_REPORT_SESSION_ID}`,
        title: 'Отчёт',
        activePrefix: '/report',
      },
      { path: '/history', title: 'История', activePrefix: '/history' },
    ] as const;
  });

  protected isSectionActive(prefix: string): boolean {
    const cleanUrl = this.currentUrl().split(/[?#]/)[0];
    return cleanUrl === prefix || cleanUrl.startsWith(`${prefix}/`);
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { TuiButton, TuiIcon, TuiRoot } from '@taiga-ui/core';
import { TuiSegmented } from '@taiga-ui/kit';
import { filter, map, startWith } from 'rxjs';
import { STUB_MODE } from './core/api-mode';
import { AuthService } from './core/auth/auth.service';
import { ThemeService } from './core/theme.service';
import { BeginnerGlossary } from './shared/beginner-glossary/beginner-glossary';
import { DEFAULT_REPORT_SESSION_ID } from './shared/default-report-session';
import { StubSessionRegistry } from './shared/stub-session-registry';
import { UiModeService } from './shared/ui-mode.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, TuiRoot, TuiButton, TuiIcon, TuiSegmented, BeginnerGlossary],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.less',
})
export class App {
  private readonly sessionRegistry = inject(StubSessionRegistry);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly uiModeService = inject(UiModeService);

  protected readonly user = this.auth.user;
  protected readonly stubMode = inject(STUB_MODE);
  protected readonly showNav = computed(() => this.stubMode || this.user() !== null);
  protected readonly theme = this.themeService.theme;
  protected readonly uiMode = this.uiModeService.mode;
  protected readonly glossaryOpen = signal(false);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly sections = computed(() => {
    if (!this.stubMode) {
      // Арена и отчёт открываются по id сессии: из запуска, истории и ссылки на завершение.
      return [
        { path: '/new', title: 'Новая сессия', activePrefix: '/new' },
        { path: '/instruments', title: 'Инструменты', activePrefix: '/instruments' },
        { path: '/workshop', title: 'Мастерская', activePrefix: '/workshop' },
        { path: '/history', title: 'История', activePrefix: '/history' },
      ] as const;
    }
    const lastReportId = this.sessionRegistry.lastFinishedSessionId();
    return [
      { path: '/new', title: 'Новая сессия', activePrefix: '/new' },
      { path: '/instruments', title: 'Инструменты', activePrefix: '/instruments' },
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

  protected toggleTheme(): void {
    this.themeService.toggle();
  }

  protected onUiModeIndexChange(index: number): void {
    this.uiModeService.setMode(index === 1 ? 'pro' : 'basic');
  }

  protected openGlossary(): void {
    this.glossaryOpen.set(true);
  }

  protected closeGlossary(): void {
    this.glossaryOpen.set(false);
  }

  protected async logout(): Promise<void> {
    try {
      await this.auth.logout();
    } finally {
      await this.router.navigate(['/login']);
    }
  }

  protected isSectionActive(prefix: string): boolean {
    const cleanUrl = this.currentUrl().split(/[?#]/)[0];
    return cleanUrl === prefix || cleanUrl.startsWith(`${prefix}/`);
  }
}

import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTaiga } from '@taiga-ui/core';
import { App } from './app';
import { STUB_MODE } from './core/api-mode';
import { AuthService } from './core/auth/auth.service';
import { routes } from './app.routes';
import { StubSessionRegistry } from './shared/stub-session-registry';

@Component({
  selector: 'app-dummy-route',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class DummyRoute {}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideTaiga(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  it('показывает разделы новой сессии, арены, мастерской, отчёта и истории', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nav a')).map(
      (a) => a.textContent?.trim(),
    );
    expect(links).toEqual(['Новая сессия', 'Арена', 'Мастерская', 'Отчёт', 'История']);

    const navLinks = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('nav a'),
    ) as HTMLAnchorElement[];
    const reportLink = navLinks.find((a) => a.textContent?.trim() === 'Отчёт');
    expect(reportLink?.getAttribute('href')).toBe('/report/S-0103');

    TestBed.inject(StubSessionRegistry).markFinished('S-0106', {
      playedDays: 5,
      finishedEarly: true,
      netReturnPct: 1.5,
    });
    fixture.detectChanges();
    expect(reportLink?.getAttribute('href')).toBe('/report/S-0106');
  });

  it('подсвечивает пункт «Отчёт» на любом маршруте /report/:id и не подсвечивает на /history', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: 'report/:id', component: DummyRoute },
          { path: 'history', component: DummyRoute },
          { path: '**', component: DummyRoute },
        ]),
        provideTaiga(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    fixture.detectChanges();

    const findNavLink = (title: string): HTMLAnchorElement | undefined =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nav a')).find(
        (a) => a.textContent?.trim() === title,
      ) as HTMLAnchorElement | undefined;

    await router.navigateByUrl('/report/S-0105');
    fixture.detectChanges();
    expect(findNavLink('Отчёт')?.classList.contains('active')).toBe(true);
    expect(findNavLink('История')?.classList.contains('active')).toBe(false);

    await router.navigateByUrl('/report/S-0103');
    fixture.detectChanges();
    expect(findNavLink('Отчёт')?.classList.contains('active')).toBe(true);

    await router.navigateByUrl('/history');
    fixture.detectChanges();
    expect(findNavLink('Отчёт')?.classList.contains('active')).toBe(false);
    expect(findNavLink('История')?.classList.contains('active')).toBe(true);
  });

  describe('маршруты', () => {
    async function open(url: string): Promise<{ path: string; heading: string | undefined }> {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(url);
      harness.detectChanges();
      return {
        path: TestBed.inject(Location).path(),
        heading: (harness.routeNativeElement as HTMLElement | null)
          ?.querySelector('h1')
          ?.textContent?.trim(),
      };
    }

    it('пустой путь ведёт на арену', async () => {
      expect(await open('/')).toEqual({ path: '/arena', heading: 'Арена' });
    });

    it('/workshop открывает мастерскую', async () => {
      expect(await open('/workshop')).toEqual({ path: '/workshop', heading: 'Мастерская' });
    });

    it('/new открывает экран новой сессии', async () => {
      expect(await open('/new')).toEqual({ path: '/new', heading: 'Новая сессия' });
    });

    it('/report/:id открывает отчёт по маршруту', async () => {
      const res = await open('/report/S-0103');
      expect(res.path).toBe('/report/S-0103');
    });

    it('/report без id ведёт на завершённую демо-сессию S-0103', async () => {
      const res = await open('/report');
      expect(res.path).toBe('/report/S-0103');
    });

    it('/history открывает историю сессий и прогонов', async () => {
      expect(await open('/history')).toEqual({
        path: '/history',
        heading: 'История сессий и прогонов',
      });
    });

    it('неизвестный путь ведёт на арену', async () => {
      expect(await open('/nope/nothing')).toEqual({ path: '/arena', heading: 'Арена' });
    });
  });

  it('настоящий режим: без арены и отчёта в навигации, с почтой и кнопкой выхода', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideTaiga(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STUB_MODE, useValue: false },
      ],
    }).compileComponents();
    TestBed.inject(AuthService).user.set({ id: 'u', email: 'a@b.c', role: 'USER' });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const links = Array.from(root.querySelectorAll('nav a')).map((a) => a.textContent?.trim());
    expect(links).toEqual(['Новая сессия', 'Мастерская', 'История']);
    expect(root.querySelector('.user')?.textContent).toContain('a@b.c');
    expect(root.querySelector('.user button')?.textContent).toContain('Выйти');
  });
});

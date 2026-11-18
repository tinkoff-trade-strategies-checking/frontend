import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTaiga } from '@taiga-ui/core';
import { App } from './app';
import { routes } from './app.routes';
import { StubSessionRegistry } from './shared/stub-session-registry';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideTaiga()],
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
    expect(reportLink?.getAttribute('href')).toBe('/history');

    TestBed.inject(StubSessionRegistry).markFinished('S-0106', {
      playedDays: 5,
      finishedEarly: true,
      netReturnPct: 1.5,
    });
    fixture.detectChanges();
    expect(reportLink?.getAttribute('href')).toBe('/report/S-0106');
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
});

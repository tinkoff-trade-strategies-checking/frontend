import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTaiga } from '@taiga-ui/core';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideTaiga()],
    }).compileComponents();
  });

  it('показывает разделы арены, мастерской и отчёта', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nav a')).map(
      (a) => a.textContent?.trim(),
    );
    expect(links).toEqual(['Арена', 'Мастерская', 'Отчёт']);
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

    it('неизвестный путь ведёт на арену', async () => {
      expect(await open('/nope/nothing')).toEqual({ path: '/arena', heading: 'Арена' });
    });
  });
});

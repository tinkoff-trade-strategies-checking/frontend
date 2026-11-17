import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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

  it('у каждого раздела свой маршрут', () => {
    const paths = routes.map((r) => r.path);
    expect(paths).toEqual(expect.arrayContaining(['arena', 'workshop', 'report']));
  });
});

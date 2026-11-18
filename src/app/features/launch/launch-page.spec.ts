import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { vi } from 'vitest';
import { LAUNCH_API } from './data/launch.models';
import { StubLaunchApi } from './data/stub-launch.api';
import { LaunchPage } from './launch-page';
import { LaunchStore } from './launch.store';

describe('LaunchPage', () => {
  let stubApi: StubLaunchApi;
  let router: Router;

  beforeEach(async () => {
    stubApi = new StubLaunchApi();

    await TestBed.configureTestingModule({
      imports: [LaunchPage],
      providers: [provideTaiga(), provideRouter([])],
    })
      .overrideComponent(LaunchPage, {
        remove: {
          providers: [{ provide: LAUNCH_API, useClass: StubLaunchApi }],
        },
        add: {
          providers: [{ provide: LAUNCH_API, useValue: stubApi }],
        },
      })
      .compileComponents();

    router = TestBed.inject(Router);
  });

  it('INV-7: в слепом режиме не запрашивает бумаги и не выводит тикеры и названия, показывает κ = 0,1', async () => {
    const papersSpy = vi.spyOn(stubApi, 'getAvailablePapers');
    const fixture = TestBed.createComponent(LaunchPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Новая сессия');
    expect(text).toContain('Торгую сам');
    expect(text).toContain('60 дн.');
    expect(text).toContain('1 д');
    expect(text).toContain('Эталон платформы');
    expect(text).toContain('κ = 0,1');
    expect(papersSpy).not.toHaveBeenCalled();

    expect(text).not.toContain('SBER');
    expect(text).not.toContain('GAZP');
    expect(text).not.toContain('Сбербанк');
  });

  it('переключение «своя дата → случайная» сбрасывает выбранные бумаги и блокирует пустую дату', async () => {
    const fixture = TestBed.createComponent(LaunchPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const store = fixture.debugElement.injector.get(LaunchStore);

    await store.setStartMode('custom');
    fixture.detectChanges();
    expect(store.selectedPaperIds().length).toBe(3);
    expect(store.customPapers().length).toBe(5);
    expect((fixture.nativeElement as HTMLElement).textContent ?? '').toContain('26.02.2020');

    // Пустая дата блокирует кнопку запуска и показывает подсказку.
    store.setCustomStartDate('');
    fixture.detectChanges();
    const launchBtn = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.includes('Запустить'));
    expect(launchBtn?.disabled).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent ?? '').toContain(
      'Укажите дату начала периода',
    );

    // Переключение обратно на случайную закрытую дату сбрасывает выбранные бумаги.
    await store.setStartMode('random');
    fixture.detectChanges();
    expect(store.selectedPaperIds()).toEqual([]);
    expect(store.customPapers()).toEqual([]);
    const textAfter = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(textAfter).not.toContain('SBER');
    expect(textAfter).not.toContain('Сбербанк');
  });

  it('показывает кнопку «Повторить» при ошибке загрузки параметров', async () => {
    vi.spyOn(stubApi, 'getLaunchOptions').mockRejectedValueOnce(new Error('Network error'));

    const fixture = TestBed.createComponent(LaunchPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent ?? '').toContain('Не удалось загрузить параметры запуска');
    const retryBtn = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Повторить'),
    );
    expect(retryBtn).toBeDefined();

    retryBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.textContent ?? '').toContain('Длительность в торговых днях');
  });

  it('показывает сообщение об отказе «6 480» при TOO_MANY_BARS и переходит на /arena при успешном запуске', async () => {
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LaunchPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    vi.spyOn(stubApi, 'startSession').mockResolvedValueOnce({
      accepted: false,
      reason: 'TOO_MANY_BARS',
      field: null,
      barsCount: 6480,
      maxBars: 5000,
    });

    const launchBtn = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.includes('Запустить'));
    expect(launchBtn).toBeDefined();

    launchBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const textAfterReject = ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(
      /\s+/g,
      ' ',
    );
    expect(textAfterReject).toContain('Слишком много свечей');
    expect(textAfterReject).toContain('6 480');
    expect(navSpy).not.toHaveBeenCalled();

    vi.spyOn(stubApi, 'startSession').mockResolvedValueOnce({
      accepted: true,
      sessionId: 'S-0105',
    });

    launchBtn!.click();
    await fixture.whenStable();

    expect(navSpy).toHaveBeenCalledWith(['/arena']);
  });
});

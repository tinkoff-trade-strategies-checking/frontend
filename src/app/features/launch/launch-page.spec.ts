import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { vi } from 'vitest';
import { LAUNCH_API } from './data/launch.models';
import { StubLaunchApi } from './data/stub-launch.api';
import { LaunchPage } from './launch-page';

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

  it('INV-7: в слепом режиме скрывает тикеры и названия, показывает параметры по умолчанию', async () => {
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
    expect(text).toContain('Бумага A');

    expect(text).not.toContain('SBER');
    expect(text).not.toContain('GAZP');
    expect(text).not.toContain('Сбербанк');
  });

  it('показывает сообщение об отказе при TOO_MANY_BARS и переходит на /arena при успешном запуске', async () => {
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LaunchPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    vi.spyOn(stubApi, 'startSession').mockResolvedValueOnce({
      accepted: false,
      reason: 'TOO_MANY_BARS',
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

    const textAfterReject = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(textAfterReject).toContain('Слишком много свечей');
    expect(textAfterReject).toContain('6');
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

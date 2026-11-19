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

  it('поле «Дата начала»: tuiInputDate внутри подписи, ввод и очистка меняют store', async () => {
    const fixture = TestBed.createComponent(LaunchPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const store = fixture.debugElement.injector.get(LaunchStore);

    await store.setStartMode('custom');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector<HTMLInputElement>(
      'label[for="launch-custom-date"] input[tuiInputDate]',
    );
    expect(input).not.toBeNull();
    expect(input?.id).toBe('launch-custom-date');

    input!.value = '01.02.2020';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(store.customStartDate()).toBe('2020-02-01');

    input!.value = '';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(store.customStartDate()).toBe('');
  });

  it('своё значение капитала: ввод в поле меняет store, вне 10 000 – 100 000 000 ₽ блокирует запуск', async () => {
    const fixture = TestBed.createComponent(LaunchPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const store = fixture.debugElement.injector.get(LaunchStore);
    const root = fixture.nativeElement as HTMLElement;

    const input = root.querySelector<HTMLInputElement>('#launch-capital');
    expect(input).not.toBeNull();

    const launchButton = (): HTMLButtonElement | undefined =>
      Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes('Запустить'));

    input!.value = '2 500 000';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(store.initialCapitalRub()).toBe(2_500_000);
    expect(store.capitalError()).toBeNull();
    expect(launchButton()?.disabled).toBe(false);
    expect((root.textContent ?? '').replace(/\u00a0/g, ' ')).toContain('2 500 000 ₽');

    store.setInitialCapital(9_999);
    fixture.detectChanges();
    expect(store.capitalError()).toContain('от 10 000 до 100 000 000');
    expect(launchButton()?.disabled).toBe(true);

    store.setInitialCapital(100_000_001);
    expect(store.canSubmit()).toBe(false);

    store.setInitialCapital(10_000.5);
    expect(store.capitalError()).toBeNull();
    store.setInitialCapital(10_000.555);
    expect(store.capitalError()).toContain('двух знаков');

    store.setInitialCapital(null);
    fixture.detectChanges();
    expect(store.canSubmit()).toBe(false);

    store.setInitialCapital(100_000_000);
    expect(store.canSubmit()).toBe(true);
    store.setInitialCapital(10_000);
    expect(store.canSubmit()).toBe(true);
  });

  it('своё значение капитала уходит в запрос запуска', async () => {
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const startSpy = vi.spyOn(stubApi, 'startSession');
    const fixture = TestBed.createComponent(LaunchPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const store = fixture.debugElement.injector.get(LaunchStore);

    store.setInitialCapital(12_345.67);
    expect(await store.launch()).toBe(true);
    // INV-6: деньги уходят строкой, как Money в контракте, без плавающей запятой.
    expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({ initialCapital: '12345.67' }));
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

    expect(navSpy).toHaveBeenCalledWith(['/arena', 'S-0105']);
  });
});

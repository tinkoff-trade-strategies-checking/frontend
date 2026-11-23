import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { vi } from 'vitest';
import { WORKSHOP_API } from '../workshop/data/workshop.models';
import { StubWorkshopApi } from '../workshop/data/stub-workshop.api';
import { LAUNCH_API } from './data/launch.models';
import { StubLaunchApi } from './data/stub-launch.api';
import { LaunchPage } from './launch-page';
import { LaunchStore } from './launch.store';

describe('LaunchPage', () => {
  let stubApi: StubLaunchApi;
  let stubWorkshopApi: StubWorkshopApi;
  let router: Router;

  beforeEach(async () => {
    stubApi = new StubLaunchApi();
    stubWorkshopApi = new StubWorkshopApi();

    await TestBed.configureTestingModule({
      imports: [LaunchPage],
      providers: [provideTaiga(), provideRouter([])],
      // TuiNativeSelect (select[tuiSelect]) наследует TuiInputDirective с [readOnly], которого нет у HTMLSelectElement в jsdom при overrideComponent.
      errorOnUnknownProperties: false,
    })
      .overrideComponent(LaunchPage, {
        remove: {
          providers: [
            { provide: LAUNCH_API, useClass: StubLaunchApi },
            { provide: WORKSHOP_API, useClass: StubWorkshopApi },
          ],
        },
        add: {
          providers: [
            { provide: LAUNCH_API, useValue: stubApi },
            { provide: WORKSHOP_API, useValue: stubWorkshopApi },
          ],
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

    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    expect(text).toContain('Новая сессия');
    expect(text).not.toContain('Кто торгует');
    expect(text).not.toContain('Торгую сам');
    expect(text).toContain('Мастерскую');
    expect(text).not.toContain('Запуск алгоритмов из мастерской пока недоступен');
    expect(root.querySelector('a[href="/workshop"]')).not.toBeNull();
    expect(text).toContain('Выберите сценарий');
    expect(text).toContain('Торгуйте на Арене');
    expect(text).toContain('Разберите ошибки с алгоритмом');
    expect(text).toContain('Быстрый старт');
    expect(text).toContain('Быстрая тренировка');
    expect(text).toContain('Полноценный квартал');
    expect(text).toContain('Стресс-тест рынка');
    expect(text).toContain('В слепом режиме названия бумаг и даты скрыты до конца сессии');
    expect(root.querySelector('#launch-advanced-toggle')?.getAttribute('aria-expanded')).toBe(
      'false',
    );
    expect(root.querySelector('#launch-advanced-panels')).toBeNull();
    expect(text).toContain('60 дн.');
    expect(text).toContain('1 д');
    expect(text).toContain('Эталон платформы');
    expect(text).toContain('κ = 0,1');
    expect(papersSpy).not.toHaveBeenCalled();

    expect(text).not.toContain('SBER');
    expect(text).not.toContain('GAZP');
    expect(text).not.toContain('Сбербанк');
  });

  it('пресеты «Быстрый старт» в 1 клик применяют параметры и подсвечивают активную карточку', async () => {
    const fixture = TestBed.createComponent(LaunchPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const store = fixture.debugElement.injector.get(LaunchStore);
    const card = (id: string): HTMLButtonElement => {
      const btn = root.querySelector<HTMLButtonElement>(`button[data-preset="${id}"]`);
      if (!btn) {
        throw new Error(`Нет карточки пресета ${id}`);
      }
      return btn;
    };

    // По умолчанию активен «Полноценный квартал» (60 дн., 1д, средний, 3 бумаги, 1 000 000 ₽).
    expect(card('quarter').classList.contains('active')).toBe(true);
    expect(card('quarter').getAttribute('aria-pressed')).toBe('true');

    // Клик по «Быстрая тренировка».
    card('quick').click();
    fixture.detectChanges();
    expect(store.durationDays()).toBe(20);
    expect(store.timeframe()).toBe('1d');
    expect(store.regime()).toBe('medium');
    expect(store.paperCount()).toBe(3);
    expect(store.initialCapitalRub()).toBe(1_000_000);
    expect(store.isBlind()).toBe(true);
    expect(card('quick').classList.contains('active')).toBe(true);
    expect(card('quarter').classList.contains('active')).toBe(false);
    expect(root.querySelector('aside.summary-col')?.textContent ?? '').toContain('20 дн.');

    // Клик по «Стресс-тест рынка».
    card('stress').click();
    fixture.detectChanges();
    expect(store.durationDays()).toBe(60);
    expect(store.timeframe()).toBe('1d');
    expect(store.regime()).toBe('stress');
    expect(store.paperCount()).toBe(3);
    expect(store.initialCapitalRub()).toBe(1_000_000);
    expect(store.isBlind()).toBe(true);
    expect(card('stress').classList.contains('active')).toBe(true);
    expect(root.querySelector('aside.summary-col')?.textContent ?? '').toContain('Стрессовый');

    // Возврат к «Полноценному кварталу» из неслепого режима сбрасывает custom-бумаги.
    await store.setStartMode('custom');
    fixture.detectChanges();
    expect(store.activePresetId()).toBeNull();
    card('quarter').click();
    fixture.detectChanges();
    expect(store.isBlind()).toBe(true);
    expect(store.selectedPaperIds()).toEqual([]);
    expect(card('quarter').classList.contains('active')).toBe(true);
  });

  it('Progressive Disclosure: «Настроить вручную» раскрывается/сворачивается и авто-раскрывается при ошибке или custom', async () => {
    const fixture = TestBed.createComponent(LaunchPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const store = fixture.debugElement.injector.get(LaunchStore);
    const toggle = root.querySelector<HTMLButtonElement>('#launch-advanced-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle?.textContent ?? '').toContain('Настроить вручную');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('#launch-advanced-panels')).toBeNull();

    toggle!.click();
    fixture.detectChanges();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('#launch-advanced-panels')).not.toBeNull();

    toggle!.click();
    fixture.detectChanges();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('#launch-advanced-panels')).toBeNull();

    // Ошибка капитала автоматически раскрывает ручные настройки.
    store.setInitialCapital(5_000);
    fixture.detectChanges();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('#launch-capital')).not.toBeNull();
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
    const customText = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(customText).toContain('03.06.2024');
    expect(customText).toContain('Доступный архив: 03.01.2020 — 31.12.2025');
    expect(customText).toContain('Должен совпадать с категорией выбранного отрезка');

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
    root.querySelector<HTMLButtonElement>('#launch-advanced-toggle')!.click();
    fixture.detectChanges();

    const input = root.querySelector<HTMLInputElement>('#launch-capital');
    expect(input).not.toBeNull();
    const capitalLabel = root.querySelector('label[for="launch-capital"]');
    expect(capitalLabel).not.toBeNull();
    expect(capitalLabel?.closest('tui-textfield')).toBeNull();
    expect(capitalLabel?.querySelector('tui-textfield')).not.toBeNull();

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

  it('выключает пары шаг × длительность сверх лимита свечей и подсказывает «больше 5 000 свечей»', async () => {
    const fixture = TestBed.createComponent(LaunchPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const store = fixture.debugElement.injector.get(LaunchStore);
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#launch-advanced-toggle')!.click();
    fixture.detectChanges();

    const button = (label: string): HTMLButtonElement => {
      const btn = Array.from(root.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === label,
      );
      if (!btn) {
        throw new Error(`Нет кнопки ${label}`);
      }
      return btn;
    };
    const launchBtn = (): HTMLButtonElement => button('Запустить');

    // 60 дн. при шаге 1 д: максимум шагов 1 мин и 5 мин меньше 60 дней — выключены.
    expect(button('1 мин').disabled).toBe(true);
    expect(button('5 мин').disabled).toBe(true);
    expect(button('10 мин').disabled).toBe(false);
    expect(button('1 д').disabled).toBe(false);
    expect(button('1 мин').title.replace(/\u00a0/g, ' ')).toBe('больше 5 000 свечей');
    expect(button('1 д').title).toBe('');
    // Причина выключения видна без наведения и связана с кнопкой через aria-describedby.
    const note = root.querySelector('#launch-timeframe-note');
    expect(note?.textContent).toContain('1 мин, 5 мин');
    expect(button('1 мин').getAttribute('aria-describedby')).toBe('launch-timeframe-note');

    // Шаг 5 мин (максимум 30 дн.) при 20 дн.: длительности больше 30 выключены.
    store.setDuration(20);
    store.setTimeframe('5m');
    fixture.detectChanges();
    expect(button('20 дн.').disabled).toBe(false);
    expect(button('60 дн.').disabled).toBe(true);
    expect(button('250 дн.').disabled).toBe(true);
    expect(launchBtn().disabled).toBe(false);

    // Своя дата: лимит 5 000 свечей действует для всех ручных сессий (и RANDOM, и CUSTOM).
    await store.setStartMode('custom');
    fixture.detectChanges();
    expect(button('60 дн.').disabled).toBe(true);
    expect(button('1 мин').disabled).toBe(true);

    // Недопустимая пара (программно): запуск заблокирован и в custom, и при возврате в random.
    store.setDuration(250);
    store.setTimeframe('1m');
    fixture.detectChanges();
    expect(store.pairExceedsLimit()).toBe(true);
    expect(launchBtn().disabled).toBe(true);
    expect(root.textContent ?? '').toContain('Выбранная пара шаг × длительность');

    await store.setStartMode('random');
    fixture.detectChanges();
    expect(store.pairExceedsLimit()).toBe(true);
    expect(launchBtn().disabled).toBe(true);
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
    expect(root.textContent ?? '').toContain('Быстрый старт');
    root.querySelector<HTMLButtonElement>('#launch-advanced-toggle')!.click();
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
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('#launch-advanced-panels'),
    ).not.toBeNull();

    vi.spyOn(stubApi, 'startSession').mockResolvedValueOnce({
      accepted: true,
      sessionId: 'S-0105',
    });

    launchBtn!.click();
    await fixture.whenStable();

    expect(navSpy).toHaveBeenCalledWith(['/arena', 'S-0105']);
  });

  it('отображает селектор фонового алгоритма без черновиков/дубля эталона и передаёт выбор в startSession', async () => {
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const startSpy = vi.spyOn(stubApi, 'startSession');
    vi.spyOn(stubWorkshopApi, 'list').mockResolvedValueOnce({
      items: [
        {
          id: 'A-0001',
          name: 'Эталон платформы',
          description: '',
          authorId: 'platform',
          author: 'Эталон платформы',
          isMine: false,
          isSystem: true,
          visibility: 'public',
          latestVersion: 2,
          latestVersionId: 'A-0001-v2',
          publishedAt: '2026-11-18T14:00:00+03:00',
          license: 'MIT',
          linterWarnings: [],
        },
        {
          id: 'A-DRAFT',
          name: 'Черновик',
          description: '',
          authorId: 'user',
          author: 'Вы',
          isMine: true,
          isSystem: false,
          visibility: 'hidden',
          latestVersion: 0,
          latestVersionId: null,
          publishedAt: null,
          license: 'MIT',
          linterWarnings: [],
        },
        {
          id: 'A-0002',
          name: 'Momentum RSI',
          description: '',
          authorId: 'user',
          author: 'Вы',
          isMine: true,
          isSystem: false,
          visibility: 'public',
          latestVersion: 2,
          latestVersionId: 'A-0002-v2',
          publishedAt: '2026-11-18T12:30:00+03:00',
          license: 'MIT',
          linterWarnings: [],
        },
      ],
      authors: [],
      total: 3,
      page: 1,
      pageSize: 100,
      totalPages: 1,
    });

    const fixture = TestBed.createComponent(LaunchPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const store = fixture.debugElement.injector.get(LaunchStore);
    expect(root.textContent ?? '').not.toContain('Выбор алгоритма из каталога пока недоступен');

    root.querySelector<HTMLButtonElement>('#launch-advanced-toggle')!.click();
    fixture.detectChanges();
    const select = root.querySelector<HTMLSelectElement>('#launch-background-algorithm');
    expect(select).not.toBeNull();
    expect(store.backgroundAlgorithmId()).toBeNull();
    expect(store.backgroundAlgorithms().map((item) => item.id)).toEqual(['A-0002']);

    store.setBackgroundAlgorithm('A-0002');
    fixture.detectChanges();
    expect(root.querySelector('aside.summary-col')?.textContent ?? '').toContain(
      'Momentum RSI · v2 · Вы',
    );

    expect(await store.launch()).toBe(true);
    expect(startSpy).toHaveBeenCalledWith(
      expect.objectContaining({ backgroundAlgorithmId: 'A-0002' }),
    );
  });

  it('сохраняет запуск с эталоном по умолчанию при ошибке загрузки каталога алгоритмов', async () => {
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const startSpy = vi.spyOn(stubApi, 'startSession');
    vi.spyOn(stubWorkshopApi, 'list').mockRejectedValueOnce(new Error('Network error'));

    const fixture = TestBed.createComponent(LaunchPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const store = fixture.debugElement.injector.get(LaunchStore);
    expect(store.error()).toBeNull();
    expect(store.backgroundAlgorithmsError()).toBe(true);
    root.querySelector<HTMLButtonElement>('#launch-advanced-toggle')!.click();
    fixture.detectChanges();
    expect(root.textContent ?? '').toContain(
      'Не удалось загрузить каталог алгоритмов — доступен эталон платформы по умолчанию.',
    );

    const launchBtn = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Запустить'),
    );
    expect(launchBtn?.disabled).toBe(false);
    launchBtn!.click();
    await fixture.whenStable();

    expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({ backgroundAlgorithmId: null }));
  });

  it('в блоке «Бумаги» не показывает «N из 5» в слепом режиме, но показывает «выбрано N из 5» в неслепом', async () => {
    const fixture = TestBed.createComponent(LaunchPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const store = fixture.debugElement.injector.get(LaunchStore);
    root.querySelector<HTMLButtonElement>('#launch-advanced-toggle')!.click();
    fixture.detectChanges();

    const findPapersHeader = (): string => {
      const panel = Array.from(root.querySelectorAll('section.panel')).find(
        (s) => s.querySelector('h2')?.textContent?.trim() === 'Бумаги',
      );
      return panel?.querySelector('.panel-header')?.textContent?.trim() ?? '';
    };

    expect(findPapersHeader()).toBe('Бумаги');

    await store.setStartMode('custom');
    fixture.detectChanges();
    expect(findPapersHeader()).toContain('выбрано 3 из 5');
  });
});

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { HISTORY_API, HistoryApi, HistoryPage as HistoryPageData } from './data/history.models';
import { StubHistoryApi } from './data/stub-history.api';
import { HistoryPage } from './history-page';
import { HistoryStore } from './history.store';

describe('HistoryPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryPage],
      providers: [provideRouter([]), provideTaiga()],
    }).compileComponents();
  });

  it('загружает первую страницу из 20 записей и показывает S-0104, S-0105 и S-0103', async () => {
    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const rows = Array.from(el.querySelectorAll('tbody tr'));
    expect(rows.length).toBe(20);
    expect(rows[0].getAttribute('data-session-id')).toBe('S-0104');

    const text = el.textContent ?? '';
    expect(text).toContain('Слепая сессия от 18.11.2026');
    expect(text).toContain('Неслепая');
    expect(text).toContain('S-0103');
  });

  it('INV-7: незавершённая слепая сессия S-0104 отображается без бумаг, периода и итога', async () => {
    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const row = el.querySelector('tr[data-session-id="S-0104"]');
    expect(row).not.toBeNull();
    const rowText = row?.textContent ?? '';

    expect(rowText).toContain('Слепая сессия от 18.11.2026');
    expect(rowText).toContain('Идёт');
    expect(rowText).toContain('—');
    expect(rowText).not.toMatch(/\b(SBER|GAZP|YDEX|GMKN|MGNT)\b/);
    expect(rowText).not.toContain('26.02.2020');

    const continueLink = row?.querySelector('a[href="/arena"]');
    expect(continueLink?.textContent?.trim()).toBe('Продолжить');
  });

  it('показывает ссылки «Открыть отчёт» и «Воспроизвести» для завершённой сессии S-0103', async () => {
    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const row = el.querySelector('tr[data-session-id="S-0103"]');
    expect(row).not.toBeNull();

    const reportLink = row?.querySelector('a[href="/report/S-0103"]');
    const replayLink = row?.querySelector('a[href="/replay/S-0103"]');
    expect(reportLink?.textContent?.trim()).toBe('Открыть отчёт');
    expect(replayLink?.textContent?.trim()).toBe('Воспроизвести');
  });

  it('фильтр «Только слепые» скрывает неслепые сессии и прогоны', async () => {
    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('tr[data-session-id="S-0105"]')).not.toBeNull();

    const blindBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Только слепые'),
    );
    expect(blindBtn).toBeDefined();
    blindBtn?.click();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('tr[data-session-id="S-0105"]')).toBeNull();
    expect(el.querySelector('tr[data-session-id="S-0104"]')).not.toBeNull();
    expect(el.querySelector('tr[data-session-id="S-0103"]')).not.toBeNull();
  });

  it('переключает страницы пагинации (страница 1 → страница 2)', async () => {
    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('tbody tr').length).toBe(20);
    expect(el.textContent).toContain('Страница 1 из 2');

    const nextBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Вперёд',
    );
    expect(nextBtn).toBeDefined();
    nextBtn?.click();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Страница 2 из 2');
    expect(el.querySelectorAll('tbody tr').length).toBe(5);
  });
});

describe('HistoryStore', () => {
  it('защищён от гонок: устаревший запрос не перезаписывает более свежий', async () => {
    let resolveFirst!: (page: HistoryPageData) => void;
    let resolveSecond!: (page: HistoryPageData) => void;
    let callCount = 0;

    const realStub = new StubHistoryApi();
    const firstData = await realStub.list({ page: 1 });
    const secondData = await realStub.list({ blindOnly: true, page: 1 });

    const deferredApi: HistoryApi = {
      list(): Promise<HistoryPageData> {
        callCount += 1;
        if (callCount === 1) {
          return new Promise((resolve) => {
            resolveFirst = resolve;
          });
        }
        return new Promise((resolve) => {
          resolveSecond = resolve;
        });
      },
    };

    TestBed.configureTestingModule({
      providers: [{ provide: HISTORY_API, useValue: deferredApi }, HistoryStore],
    });
    const store = TestBed.inject(HistoryStore);

    const firstLoad = store.load();
    store.toggleBlindOnly();

    resolveSecond(secondData);
    await Promise.resolve();
    expect(store.items().every((item) => item.blind)).toBe(true);

    resolveFirst(firstData);
    await firstLoad;

    expect(store.items().every((item) => item.blind)).toBe(true);
    expect(store.loading()).toBe(false);
  });
});

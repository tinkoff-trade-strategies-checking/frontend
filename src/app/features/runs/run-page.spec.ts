import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { vi } from 'vitest';
import { RUNS_API, RunInfo, RunStreamEvent } from './data/runs.models';
import { StubRunsApi } from './data/stub-runs.api';
import { RunPage } from './run-page';

describe('RunPage', () => {
  let stubApi: StubRunsApi;
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    stubApi = new StubRunsApi();
    paramMap$ = new BehaviorSubject(convertToParamMap({ id: 'R-0205' }));

    await TestBed.configureTestingModule({
      imports: [RunPage],
      providers: [
        provideTaiga(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$.asObservable() } },
      ],
    })
      .overrideComponent(RunPage, {
        remove: { providers: [{ provide: RUNS_API, useClass: StubRunsApi }] },
        add: { providers: [{ provide: RUNS_API, useValue: stubApi }] },
      })
      .compileComponents();
  });

  it('показывает завершённый прогон, раскрытый период и активирует кнопку отчёта', async () => {
    const fixture = TestBed.createComponent(RunPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    expect(text).toContain('Momentum RSI v2');
    expect(text).toContain('Завершён');
    expect(text).toContain('10.04.2023 — 05.07.2023');

    const reportBtn = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Открыть отчёт'),
    );
    expect(reportBtn?.disabled).toBe(false);

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    reportBtn?.click();
    expect(navSpy).toHaveBeenCalledWith(['/runs', 'R-0205', 'report']);
  });

  it('INV-7: для активного слепого прогона скрывает период/бумаги и блокирует отчёт до завершения', async () => {
    const events$ = new Subject<RunStreamEvent>();
    const running: RunInfo = {
      runId: 'R-BLIND',
      strategyVersionId: 'v1',
      algoName: 'Blind Strat',
      blind: true,
      status: 'running',
      doneSteps: 10,
      totalSteps: 60,
      repeatOfRunId: 'R-0205',
      repeatMatch: null,
      lastEventId: '1',
      createdAt: '2026-11-18T11:30:00+03:00',
      finishedAt: null,
      errorCode: null,
      diagnostics: [],
      period: null,
      papers: null,
    };
    vi.spyOn(stubApi, 'getRun').mockResolvedValueOnce(running);
    vi.spyOn(stubApi, 'events').mockReturnValue(events$.asObservable());

    paramMap$.next(convertToParamMap({ id: 'R-BLIND' }));
    const fixture = TestBed.createComponent(RunPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    expect(text).toContain('Blind Strat');
    expect(text).toContain('Сравнение выполняется');
    expect(text).toContain('В слепом режиме период и бумаги скрыты до завершения прогона.');
    expect(text).not.toContain('SBER');

    const reportBtn = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Открыть отчёт'),
    );
    expect(reportBtn?.disabled).toBe(true);
  });

  it('показывает диагностики и ошибку при invalid/failed и переходит на повтор по кнопке', async () => {
    const invalidRun: RunInfo = {
      runId: 'R-INV',
      strategyVersionId: 'v1',
      algoName: 'Broken Strat',
      blind: false,
      status: 'invalid',
      doneSteps: 3,
      totalSteps: 60,
      repeatOfRunId: 'R-0205',
      repeatMatch: false,
      lastEventId: '2',
      createdAt: '2026-11-18T11:30:00+03:00',
      finishedAt: '2026-11-18T11:30:05+03:00',
      errorCode: 'E-RT01',
      diagnostics: [
        {
          code: 'E-RT01',
          level: 'ERROR',
          startLine: 4,
          startColumn: 2,
          endLine: 4,
          endColumn: 10,
          message: 'Деление на ноль',
          fixes: [],
        },
      ],
      period: null,
      papers: null,
    };
    vi.spyOn(stubApi, 'getRun').mockResolvedValueOnce(invalidRun);
    vi.spyOn(stubApi, 'repeatRun').mockResolvedValueOnce({ runId: 'R-NEW' });

    paramMap$.next(convertToParamMap({ id: 'R-INV' }));
    const fixture = TestBed.createComponent(RunPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    expect(text).toContain('Повтор не совпал (расхождение INV-4)');
    expect(text).toContain('E-RT01');
    expect(text).toContain('Деление на ноль');

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const repeatBtn = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Повторить прогон'),
    );
    repeatBtn?.click();
    await fixture.whenStable();
    expect(navSpy).toHaveBeenCalledWith(['/runs', 'R-NEW']);
  });
});

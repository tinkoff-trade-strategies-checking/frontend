import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core';
import { LAUNCH_API, LaunchApi, LaunchOptions } from '../../launch/data/launch.models';
import { RUNS_API, RunsApi } from '../../runs/data/runs.models';
import { WorkshopAlgorithmDetail } from '../data/workshop.models';
import { WorkshopCompareLaunch } from './workshop-compare-launch';
import { WorkshopRunForm } from './workshop-run-form';

const BASE_OPTIONS: LaunchOptions = {
  durations: [20, 60, 120, 250],
  defaultDuration: 60,
  availableTimeframes: ['1m', '5m', '10m', '15m', '1h', '1d'],
  maxDurationDaysByTimeframe: {
    '1m': 30,
    '5m': 150,
    '10m': 300,
    '15m': 450,
    '1h': 1785,
    '1d': 25_000,
  },
  runMaxDurationDaysByTimeframe: {
    '1m': 300,
    '5m': 1500,
    '10m': 3000,
    '15m': 4500,
    '1h': 17_857,
    '1d': 250_000,
  },
  defaultTimeframe: '1d',
  regimes: ['calm', 'medium', 'stress'],
  defaultRegime: 'medium',
  capitalPresetsRub: [100_000, 1_000_000],
  defaultCapitalRub: 1_000_000,
  backgroundAlgorithmName: 'Эталон платформы',
  minPapers: 1,
  maxPapers: 10,
  defaultPaperCount: 3,
  executionRules: {
    commissionPct: 0.3,
    exchangeFeePct: 0.01,
    spreadPct: 0.1,
    slippageKappa: 0.1,
    liquidityLimitPct: 10,
    maxBars: 25_000,
    runMaxBars: 250_000,
  },
  archiveFrom: '2020-01-03',
  archiveTo: '2025-12-31',
};

const ALGORITHM: WorkshopAlgorithmDetail = {
  id: 'A-1',
  name: 'Momentum',
  description: 'desc',
  authorId: 'u-1',
  author: 'Вы',
  isMine: true,
  isSystem: false,
  visibility: 'public',
  latestVersion: 1,
  latestVersionId: 'A-1-v1',
  publishedAt: '2026-11-18T12:00:00Z',
  license: 'MIT',
  linterWarnings: [],
  versions: [
    {
      id: 'A-1-v1',
      version: 1,
      publishedAt: '2026-11-18T12:00:00Z',
      summary: 'Первая версия',
      immutable: true,
      source: 'buy()',
      params: [],
    },
  ],
};

function makeLaunchApi(options: LaunchOptions): LaunchApi {
  return {
    getLaunchOptions: () => Promise.resolve(options),
    getAvailablePapers: () => Promise.resolve([]),
    startSession: () => Promise.reject(new Error('not used')),
  };
}

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const btn = Array.from(root.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === label,
  );
  if (!btn) {
    throw new Error(`Нет кнопки ${label}`);
  }
  return btn;
}

describe('Раздельные лимиты свечей в Мастерской (runMaxDurationDaysByTimeframe / runMaxBars)', () => {
  it('WorkshopRunForm использует runMaxDurationDaysByTimeframe (1m × 250д доступен) и runMaxBars в подсказке', async () => {
    await TestBed.configureTestingModule({
      imports: [WorkshopRunForm],
      providers: [
        provideTaiga(),
        provideRouter([]),
        { provide: LAUNCH_API, useValue: makeLaunchApi(BASE_OPTIONS) },
        { provide: RUNS_API, useValue: {} as RunsApi },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkshopRunForm);
    fixture.componentRef.setInput('algorithm', ALGORITHM);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    findButton(root, '250 дн.').click();
    fixture.detectChanges();

    // При ручном лимите 25 000 (1m: 30д) кнопка 1 мин была бы выключена, но в Мастерской лимит 250 000 (1m: 300д).
    expect(findButton(root, '1 мин').disabled).toBe(false);
    expect(findButton(root, '5 мин').disabled).toBe(false);
  });

  it('WorkshopRunForm выключает пару сверх runMaxDurationDaysByTimeframe и подсказывает runMaxBars', async () => {
    const tightOptions: LaunchOptions = {
      ...BASE_OPTIONS,
      runMaxDurationDaysByTimeframe: {
        ...BASE_OPTIONS.runMaxDurationDaysByTimeframe!,
        '1m': 100,
      },
      executionRules: {
        ...BASE_OPTIONS.executionRules,
        runMaxBars: 100_000,
      },
    };
    await TestBed.configureTestingModule({
      imports: [WorkshopRunForm],
      providers: [
        provideTaiga(),
        provideRouter([]),
        { provide: LAUNCH_API, useValue: makeLaunchApi(tightOptions) },
        { provide: RUNS_API, useValue: {} as RunsApi },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkshopRunForm);
    fixture.componentRef.setInput('algorithm', ALGORITHM);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    findButton(root, '250 дн.').click();
    fixture.detectChanges();

    const oneMinute = findButton(root, '1 мин');
    expect(oneMinute.disabled).toBe(true);
    expect(oneMinute.title.replace(/\u00a0/g, ' ')).toBe('больше 100 000 свечей');
  });

  it('WorkshopCompareLaunch использует runMaxDurationDaysByTimeframe и откатывается на maxDurationDaysByTimeframe', async () => {
    await TestBed.configureTestingModule({
      imports: [WorkshopCompareLaunch],
      providers: [provideTaiga(), { provide: LAUNCH_API, useValue: makeLaunchApi(BASE_OPTIONS) }],
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkshopCompareLaunch);
    fixture.componentRef.setInput('algorithmCount', 2);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    findButton(root, '250 дн.').click();
    fixture.detectChanges();

    expect(findButton(root, '1 мин').disabled).toBe(false);
    expect(findButton(root, '5 мин').disabled).toBe(false);
  });

  it('WorkshopCompareLaunch откатывается на maxDurationDaysByTimeframe и maxBars, если run-поля отсутствуют', async () => {
    const legacyOptions: LaunchOptions = {
      ...BASE_OPTIONS,
      runMaxDurationDaysByTimeframe: undefined,
      executionRules: {
        ...BASE_OPTIONS.executionRules,
        runMaxBars: undefined,
      },
    };
    await TestBed.configureTestingModule({
      imports: [WorkshopCompareLaunch],
      providers: [provideTaiga(), { provide: LAUNCH_API, useValue: makeLaunchApi(legacyOptions) }],
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkshopCompareLaunch);
    fixture.componentRef.setInput('algorithmCount', 2);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const oneMinute = findButton(root, '1 мин');
    expect(oneMinute.disabled).toBe(true);
    expect(oneMinute.title.replace(/\u00a0/g, ' ')).toBe('больше 25 000 свечей');
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpLaunchApi } from './http-launch.api';
import { StartSessionCommand } from './launch.models';

const COMMAND: StartSessionCommand = {
  traderKind: 'human',
  durationDays: 60,
  timeframe: '1d',
  regime: 'medium',
  startMode: 'custom',
  customStartDate: '2020-02-26',
  paperCount: null,
  paperIds: ['0190-aaa', '0190-bbb'],
  initialCapital: '1000000.00',
};

describe('HttpLaunchApi', () => {
  let api: HttpLaunchApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpLaunchApi],
    });
    api = TestBed.inject(HttpLaunchApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('параметры запуска: деньги и проценты из строк контракта, словарь лимитов по шагам', async () => {
    const pending = api.getLaunchOptions();
    controller.expectOne('/api/v1/launch/options').flush({
      durations: [20, 60],
      defaultDuration: 60,
      availableTimeframes: ['1h', '1d'],
      maxDurationDaysByTimeframe: { '1h': 357, '1d': 5000 },
      defaultTimeframe: '1d',
      regimes: ['calm', 'medium', 'stress'],
      defaultRegime: 'medium',
      capitalPresets: ['100000.00', '1000000.00'],
      defaultCapital: '1000000.00',
      backgroundAlgorithmName: 'Эталон',
      minPapers: 1,
      maxPapers: 5,
      defaultPaperCount: 3,
      executionRules: {
        commissionPct: '0.3',
        exchangeFeePct: '0.01',
        spreadPct: '0.1',
        slippageKappa: '0.1',
        liquidityLimitPct: '10',
        maxBars: 5000,
      },
    });
    const options = await pending;
    expect(options.capitalPresetsRub).toEqual([100000, 1000000]);
    expect(options.defaultCapitalRub).toBe(1000000);
    expect(options.maxDurationDaysByTimeframe['1h']).toBe(357);
    expect(options.executionRules).toMatchObject({ commissionPct: 0.3, maxBars: 5000 });
  });

  it('каталог бумаг для своей даты', async () => {
    const pending = api.getAvailablePapers();
    const papers = [{ id: 'p1', sector: 'IT', ticker: 'YDEX', name: 'Яндекс' }];
    controller.expectOne('/api/v1/papers').flush(papers);
    expect(await pending).toEqual(papers);
  });

  it('запуск: 201 — id сессии, тело без изменений и деньги строкой', async () => {
    const pending = api.startSession(COMMAND);
    const req = controller.expectOne('/api/v1/sessions');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({
      initialCapital: '1000000.00',
      paperIds: ['0190-aaa', '0190-bbb'],
      startMode: 'custom',
    });
    req.flush({ sessionId: '0190-sess' }, { status: 201, statusText: 'Created' });
    expect(await pending).toEqual({ accepted: true, sessionId: '0190-sess' });
  });

  it('запуск: 422 с кодом отказа — это ответ пользователю, а не сбой', async () => {
    const pending = api.startSession(COMMAND);
    controller.expectOne('/api/v1/sessions').flush(
      {
        type: 'about:blank',
        title: 'x',
        status: 422,
        code: 'TOO_MANY_BARS',
        field: null,
        barsCount: 9000,
        maxBars: 5000,
      },
      { status: 422, statusText: 'Unprocessable' },
    );
    expect(await pending).toEqual({
      accepted: false,
      reason: 'TOO_MANY_BARS',
      field: null,
      barsCount: 9000,
      maxBars: 5000,
    });
  });

  it('запуск: 503 воркера — ошибка, а не отказ', async () => {
    const pending = api.startSession(COMMAND);
    controller
      .expectOne('/api/v1/sessions')
      .flush({ code: 'SERVICE_UNAVAILABLE' }, { status: 503, statusText: 'Unavailable' });
    await expect(pending).rejects.toBeTruthy();
  });
});

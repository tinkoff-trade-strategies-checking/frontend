import { StubLaunchApi } from './stub-launch.api';

describe('StubLaunchApi', () => {
  it('INV-7: getLaunchOptions возвращает параметры по умолчанию без тикеров и названий бумаг', async () => {
    const api = new StubLaunchApi();
    const opts = await api.getLaunchOptions();

    expect(opts.durations).toEqual([20, 60, 120, 250]);
    expect(opts.defaultDuration).toBe(60);
    expect(opts.defaultTimeframe).toBe('1d');
    expect(opts.availableTimeframes).toEqual(['1m', '5m', '10m', '15m', '1h', '1d']);
    expect(opts.maxDurationDaysByTimeframe).toEqual({
      '1m': 30,
      '5m': 150,
      '10m': 300,
      '15m': 450,
      '1h': 1785,
      '1d': 25000,
    });
    expect(opts.runMaxDurationDaysByTimeframe).toEqual({
      '1m': 300,
      '5m': 1500,
      '10m': 3000,
      '15m': 4500,
      '1h': 17857,
      '1d': 250000,
    });
    expect(opts.regimes).toEqual(['calm', 'medium', 'stress']);
    expect(opts.capitalPresetsRub.length).toBeGreaterThan(0);
    expect(opts.backgroundAlgorithmName).toBe('Эталон платформы');
    expect(opts.minPapers).toBe(1);
    expect(opts.maxPapers).toBeGreaterThanOrEqual(50);
    expect(opts.defaultPaperCount).toBe(3);
    expect(opts.executionRules.maxBars).toBe(25_000);
    expect(opts.executionRules.runMaxBars).toBe(250_000);
    expect(opts.executionRules.slippageKappa).toBe(0.1);

    const serialized = JSON.stringify(opts);
    for (const forbidden of ['SBER', 'GAZP', 'YDEX', 'GMKN', 'MGNT', 'Сбербанк', 'Газпром']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('принимает корректные параметры в слепом и неслепом режиме', async () => {
    const api = new StubLaunchApi();

    const blindRes = await api.startSession({
      traderKind: 'human',
      durationDays: 60,
      timeframe: '1d',
      regime: 'medium',
      startMode: 'random',
      customStartDate: null,
      paperCount: 3,
      paperIds: null,
      initialCapital: '1000000.00',
      backgroundAlgorithmId: null,
    });
    expect(blindRes.accepted).toBe(true);

    const papers = await api.getAvailablePapers();
    expect(papers.length).toBeGreaterThanOrEqual(50);

    const customRes = await api.startSession({
      traderKind: 'human',
      durationDays: 120,
      timeframe: '1h',
      regime: 'calm',
      startMode: 'custom',
      customStartDate: '2020-02-26',
      paperCount: null,
      paperIds: papers.slice(0, 12).map((p) => p.id),
      initialCapital: '500000.00',
      backgroundAlgorithmId: 'A-0002',
    });
    expect(customRes.accepted).toBe(true);
  });

  it('отклоняет начальный капитал вне 10 000 – 100 000 000 ₽ и с более чем двумя знаками', async () => {
    const api = new StubLaunchApi();
    const base = {
      traderKind: 'human',
      durationDays: 60,
      timeframe: '1d',
      regime: 'medium',
      startMode: 'random',
      customStartDate: null,
      paperCount: 3,
      paperIds: null,
      backgroundAlgorithmId: null,
    } as const;

    for (const initialCapital of ['9999.99', '100000000.01', '1000.123', 'abc', '']) {
      const res = await api.startSession({ ...base, initialCapital });
      expect(res).toMatchObject({
        accepted: false,
        reason: 'INVALID_PARAMS',
        field: 'initialCapital',
      });
    }
    for (const initialCapital of ['10000.00', '12345.67', '100000000']) {
      const res = await api.startSession({ ...base, initialCapital });
      expect(res.accepted).toBe(true);
    }
  });

  it('отклоняет запуск с TOO_MANY_BARS при превышении 25 000 свечей', async () => {
    const api = new StubLaunchApi();
    const res = await api.startSession({
      traderKind: 'human',
      durationDays: 60,
      timeframe: '1m',
      regime: 'medium',
      startMode: 'random',
      customStartDate: null,
      paperCount: 2,
      paperIds: null,
      initialCapital: '1000000.00',
      backgroundAlgorithmId: null,
    });

    expect(res.accepted).toBe(false);
    if (!res.accepted) {
      expect(res.reason).toBe('TOO_MANY_BARS');
      expect(res.barsCount).toBeGreaterThan(25_000);
      expect(res.maxBars).toBe(25_000);
    }
  });

  it('отклоняет запуск с NO_MATCHING_PERIOD, CORPORATE_ACTION_ON_PERIOD и INVALID_PARAMS', async () => {
    const api = new StubLaunchApi();

    const noPeriod = await api.startSession({
      traderKind: 'human',
      durationDays: 250,
      timeframe: '1d',
      regime: 'stress',
      startMode: 'random',
      customStartDate: null,
      paperCount: 4,
      paperIds: null,
      initialCapital: '1000000.00',
      backgroundAlgorithmId: null,
    });
    expect(noPeriod).toEqual({
      accepted: false,
      reason: 'NO_MATCHING_PERIOD',
      field: null,
      barsCount: null,
      maxBars: null,
    });

    const corpAction = await api.startSession({
      traderKind: 'human',
      durationDays: 60,
      timeframe: '1d',
      regime: 'medium',
      startMode: 'custom',
      customStartDate: '2020-07-10',
      paperCount: null,
      paperIds: ['SBER'],
      initialCapital: '1000000.00',
      backgroundAlgorithmId: null,
    });
    expect(corpAction).toEqual({
      accepted: false,
      reason: 'CORPORATE_ACTION_ON_PERIOD',
      field: 'customStartDate',
      barsCount: null,
      maxBars: null,
    });

    const badCount = await api.startSession({
      traderKind: 'human',
      durationDays: 60,
      timeframe: '1d',
      regime: 'medium',
      startMode: 'random',
      customStartDate: null,
      paperCount: 0,
      paperIds: null,
      initialCapital: '1000000.00',
      backgroundAlgorithmId: null,
    });
    expect(badCount).toEqual({
      accepted: false,
      reason: 'INVALID_PARAMS',
      field: 'paperCount',
      barsCount: null,
      maxBars: null,
    });
  });
});

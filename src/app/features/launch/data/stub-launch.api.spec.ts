import { StubLaunchApi } from './stub-launch.api';

describe('StubLaunchApi', () => {
  it('возвращает доступные параметры запуска и значения по умолчанию', async () => {
    const api = new StubLaunchApi();
    const opts = await api.getLaunchOptions();

    expect(opts.durations).toEqual([20, 60, 120, 250]);
    expect(opts.defaultDuration).toBe(60);
    expect(opts.defaultTimeframe).toBe('1d');
    expect(opts.availableTimeframes).toEqual(['1m', '5m', '10m', '15m', '1h', '1d']);
    expect(opts.regimes).toEqual(['calm', 'medium', 'stress']);
    expect(opts.capitalPresetsRub.length).toBeGreaterThan(0);
    expect(opts.backgroundAlgorithmName).toBe('Эталон платформы');
    expect(opts.papers.length).toBe(5);
    expect(opts.executionRules.maxBars).toBe(5000);
  });

  it('принимает корректные параметры в слепом и неслепом режиме', async () => {
    const api = new StubLaunchApi();

    const blindRes = await api.startSession({
      traderKind: 'human',
      durationDays: 60,
      timeframe: '1d',
      regime: 'medium',
      startMode: 'random',
      paperIds: ['A', 'B', 'C'],
      initialCapitalRub: 1_000_000,
    });
    expect(blindRes.accepted).toBe(true);

    const customRes = await api.startSession({
      traderKind: 'human',
      durationDays: 120,
      timeframe: '1h',
      regime: 'calm',
      startMode: 'custom',
      customStartDate: '2020-02-26',
      paperIds: ['A'],
      initialCapitalRub: 500_000,
    });
    expect(customRes.accepted).toBe(true);
  });

  it('отклоняет запуск с TOO_MANY_BARS при превышении 5000 свечей', async () => {
    const api = new StubLaunchApi();
    const res = await api.startSession({
      traderKind: 'human',
      durationDays: 60,
      timeframe: '5m',
      regime: 'medium',
      startMode: 'random',
      paperIds: ['A', 'B'],
      initialCapitalRub: 1_000_000,
    });

    expect(res.accepted).toBe(false);
    if (!res.accepted) {
      expect(res.reason).toBe('TOO_MANY_BARS');
      expect(res.barsCount).toBeGreaterThan(5000);
      expect(res.maxBars).toBe(5000);
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
      paperIds: ['A', 'B', 'C', 'D'],
      initialCapitalRub: 1_000_000,
    });
    expect(noPeriod).toEqual({ accepted: false, reason: 'NO_MATCHING_PERIOD' });

    const corpAction = await api.startSession({
      traderKind: 'human',
      durationDays: 60,
      timeframe: '1d',
      regime: 'medium',
      startMode: 'custom',
      customStartDate: '2020-07-10',
      paperIds: ['A'],
      initialCapitalRub: 1_000_000,
    });
    expect(corpAction).toEqual({
      accepted: false,
      reason: 'CORPORATE_ACTION_ON_PERIOD',
      field: 'customStartDate',
    });

    const emptyPapers = await api.startSession({
      traderKind: 'human',
      durationDays: 60,
      timeframe: '1d',
      regime: 'medium',
      startMode: 'random',
      paperIds: [],
      initialCapitalRub: 1_000_000,
    });
    expect(emptyPapers).toEqual({
      accepted: false,
      reason: 'INVALID_PARAMS',
      field: 'paperIds',
    });
  });
});

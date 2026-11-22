import { firstValueFrom, toArray } from 'rxjs';
import { StubRunsApi } from './stub-runs.api';

describe('StubRunsApi', () => {
  it('createRun создаёт прогон и отклоняет невалидную стратегию', async () => {
    const api = new StubRunsApi();
    const rejected = await api.createRun({
      strategyVersionId: 'invalid-version',
      blind: true,
      durationDays: 60,
      timeframe: '1d',
      regime: 'calm',
      startMode: 'random',
      customStartDate: null,
      paperCount: 2,
      paperIds: null,
      initialCapital: '1000000.00',
    });
    expect(rejected).toMatchObject({ accepted: false, reason: 'STRATEGY_INVALID' });

    const created = await api.createRun({
      strategyVersionId: 'A-0001-v2',
      blind: true,
      durationDays: 60,
      timeframe: '1d',
      regime: 'stress',
      startMode: 'random',
      customStartDate: null,
      paperCount: 3,
      paperIds: null,
      initialCapital: '1000000.00',
    });
    expect(created.accepted).toBe(true);
    if (!created.accepted) {
      return;
    }

    const running = await api.getRun(created.runId);
    expect(running.blind).toBe(true);
    expect(running.period).toBeNull();
    expect(running.papers).toBeNull();

    const events = await firstValueFrom(api.events(created.runId, null).pipe(toArray()));
    expect(events.map((e) => e.type)).toEqual([
      'run_progress',
      'run_progress',
      'run_finished',
      'report_ready',
    ]);

    const finished = await api.getRun(created.runId);
    expect(finished.status).toBe('completed');
    expect(finished.period).not.toBeNull();
    expect(finished.papers).not.toBeNull();

    const report = await api.getRunReport(created.runId);
    expect(report.status).toBe('READY');
  });

  it('repeatRun создаёт повтор с repeatOfRunId и repeatMatch = true (INV-4)', async () => {
    const api = new StubRunsApi();
    const repeated = await api.repeatRun('R-0205');
    const events = await firstValueFrom(api.events(repeated.runId, null).pipe(toArray()));
    expect(events.at(-1)).toMatchObject({ type: 'report_ready', runId: repeated.runId });

    const info = await api.getRun(repeated.runId);
    expect(info.repeatOfRunId).toBe('R-0205');
    expect(info.repeatMatch).toBe(true);

    const report = await api.getRunReport(repeated.runId);
    expect(report.status).toBe('READY');
    if (report.status === 'READY') {
      expect(report.report.repeatMatch).toBe(true);
    }
  });

  it('getRunReport возвращает NOT_FINISHED для R-0203 и NOT_FOUND для неизвестного id', async () => {
    const api = new StubRunsApi();
    expect(await api.getRunReport('R-0203')).toEqual({ status: 'NOT_FINISHED', runId: 'R-0203' });
    expect(await api.getRunReport('R-NONE')).toEqual({ status: 'NOT_FOUND', runId: 'R-NONE' });
  });
});

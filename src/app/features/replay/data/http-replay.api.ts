import { inject, Injectable } from '@angular/core';
import { Api } from '../../../api/api';
import { getReplay } from '../../../api/fn/sessions/get-replay';
import { ArenaStepResult } from '../../arena/data/arena.models';
import { mapSnapshot, mapStepResult } from '../../arena/data/arena.mappers';
import { formatPeriod } from '../../history/data/http-history.api';
import { formatMoscowDateTime } from '../../../shared/stub-session-registry';
import { ReplayApi, ReplaySessionResult } from './replay.models';

/**
 * Воспроизведение без серверного состояния (INV-8): курсор хранит клиент и передаёт явный `step`.
 * Первый запрос — снимок на шаге, дальше — приращения `(fromStep; step]`.
 */
@Injectable()
export class HttpReplayApi implements ReplayApi {
  private readonly api = inject(Api);
  private cursors = new Map<string, { step: number; lastStep: number }>();

  async loadSession(sessionId: string, initialStep?: number): Promise<ReplaySessionResult> {
    const requested =
      initialStep !== undefined && Number.isFinite(initialStep)
        ? Math.max(0, Math.trunc(initialStep))
        : 0;
    const result = await this.api.invoke(getReplay, { sessionId, step: requested });
    switch (result.status) {
      case 'NOT_FOUND':
        return { status: 'NOT_FOUND', sessionId: result.sessionId };
      case 'NOT_FINISHED':
        return {
          status: 'NOT_FINISHED',
          sessionId: result.sessionId,
          blind: result.blind,
          title: result.title,
          createdAt: formatMoscowDateTime(result.createdAt),
          playedDays: result.playedDays,
          totalDays: result.totalDays,
          regime: result.regime,
        };
      case 'READY': {
        if (result.kind !== 'SNAPSHOT') {
          throw new Error('Сервер вернул приращение вместо снимка воспроизведения.');
        }
        const meta = result.session;
        // Дальше последнего шага воспроизведение не идёт: у досрочно завершённой сессии он меньше totalSteps.
        const snapshot = mapSnapshot(result.snapshot);
        this.cursors.set(sessionId, { step: snapshot.step, lastStep: meta.lastStep });
        return {
          status: 'READY',
          session: {
            sessionId: meta.sessionId,
            blind: meta.blind,
            periodLabel: formatPeriod(meta.period),
            regime: meta.regime,
            totalSteps: meta.lastStep,
            totalDays: meta.totalDays,
          },
          snapshot: { ...snapshot, blind: meta.blind, totalSteps: meta.lastStep },
        };
      }
    }
  }

  async step(sessionId: string): Promise<ArenaStepResult> {
    const cursor = this.cursors.get(sessionId);
    if (!cursor) {
      throw new Error('Воспроизведение не загружено.');
    }
    const next = Math.min(cursor.step + 1, cursor.lastStep);
    const result = await this.api.invoke(getReplay, {
      sessionId,
      step: next,
      fromStep: cursor.step,
    });
    if (result.status !== 'READY' || result.kind !== 'INCREMENT') {
      throw new Error('Не удалось получить следующий шаг воспроизведения.');
    }
    const step = mapStepResult(result.increment);
    // Курсор двигаем по фактическому шагу ответа (сервер может ограничить его последним).
    this.cursors.set(sessionId, { ...cursor, step: result.increment.step });
    return step;
  }
}

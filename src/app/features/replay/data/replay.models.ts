import { InjectionToken } from '@angular/core';
import { ArenaSnapshot, ArenaStepResult } from '../../arena/data/arena.models';

export type ReplayRegime = 'calm' | 'medium' | 'stress';

export interface ReplaySessionMeta {
  readonly sessionId: string;
  readonly blind: boolean;
  readonly periodLabel: string;
  readonly regime: ReplayRegime;
  readonly totalSteps: number;
  readonly totalDays: number;
}

export type ReplaySessionResult =
  | {
      readonly status: 'READY';
      readonly session: ReplaySessionMeta;
      readonly snapshot: ArenaSnapshot;
    }
  | {
      readonly status: 'BLIND_UNFINISHED';
      readonly sessionId: string;
      readonly title: string;
      readonly createdAt: string;
      readonly playedDays: number;
      readonly totalDays: number;
      readonly regime: ReplayRegime;
    }
  | {
      readonly status: 'NOT_FOUND';
      readonly sessionId: string;
    };

export interface ReplayApi {
  loadSession(sessionId: string): Promise<ReplaySessionResult>;
  step(sessionId: string): Promise<ArenaStepResult>;
}

export const REPLAY_API = new InjectionToken<ReplayApi>('REPLAY_API');

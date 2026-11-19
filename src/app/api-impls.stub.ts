import { Type } from '@angular/core';
import { ArenaApi } from './features/arena/data/arena.models';
import { StubArenaApi } from './features/arena/data/stub-arena.api';
import { HistoryApi } from './features/history/data/history.models';
import { StubHistoryApi } from './features/history/data/stub-history.api';
import { LaunchApi } from './features/launch/data/launch.models';
import { StubLaunchApi } from './features/launch/data/stub-launch.api';
import { ReplayApi } from './features/replay/data/replay.models';
import { StubReplayApi } from './features/replay/data/stub-replay.api';
import { ReportApi } from './features/report/data/report.models';
import { StubReportApi } from './features/report/data/stub-report.api';

// Реализации портов данных на заглушках: подставляется вместо `api-impls.ts` в сборках `stub` и `development-stub`.
export const LAUNCH_API_IMPL: Type<LaunchApi> = StubLaunchApi;
export const HISTORY_API_IMPL: Type<HistoryApi> = StubHistoryApi;
export const ARENA_API_IMPL: Type<ArenaApi> = StubArenaApi;
export const REPORT_API_IMPL: Type<ReportApi> = StubReportApi;
export const REPLAY_API_IMPL: Type<ReplayApi> = StubReplayApi;

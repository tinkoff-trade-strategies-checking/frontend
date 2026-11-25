import { Type } from '@angular/core';
import { FundamentalsApi } from './core/api/fundamentals.models';
import { HttpFundamentalsApi } from './core/api/http-fundamentals.api';
import { ArenaApi } from './features/arena/data/arena.models';
import { HttpArenaApi } from './features/arena/data/http-arena.api';
import { HistoryApi } from './features/history/data/history.models';
import { HttpHistoryApi } from './features/history/data/http-history.api';
import { HttpLaunchApi } from './features/launch/data/http-launch.api';
import { LaunchApi } from './features/launch/data/launch.models';
import { ReplayApi } from './features/replay/data/replay.models';
import { HttpReplayApi } from './features/replay/data/http-replay.api';
import { ReportApi } from './features/report/data/report.models';
import { HttpReportApi } from './features/report/data/http-report.api';
import { HttpRunsApi } from './features/runs/data/http-runs.api';
import { RunsApi } from './features/runs/data/runs.models';
import { HttpWorkshopApi } from './features/workshop/data/http-workshop.api';
import { WorkshopApi } from './features/workshop/data/workshop.models';

// Реализации портов данных для настоящей сборки. В сборках `stub` и `development-stub` файл заменяется
// на `api-impls.stub.ts` (angular.json), поэтому заглушки запуска и истории в боевой бандл не попадают.
export const LAUNCH_API_IMPL: Type<LaunchApi> = HttpLaunchApi;
export const HISTORY_API_IMPL: Type<HistoryApi> = HttpHistoryApi;
export const ARENA_API_IMPL: Type<ArenaApi> = HttpArenaApi;
export const REPORT_API_IMPL: Type<ReportApi> = HttpReportApi;
export const REPLAY_API_IMPL: Type<ReplayApi> = HttpReplayApi;
export const WORKSHOP_API_IMPL: Type<WorkshopApi> = HttpWorkshopApi;
export const RUNS_API_IMPL: Type<RunsApi> = HttpRunsApi;
export const FUNDAMENTALS_API_IMPL: Type<FundamentalsApi> = HttpFundamentalsApi;

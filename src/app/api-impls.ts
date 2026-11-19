import { Type } from '@angular/core';
import { ArenaApi } from './features/arena/data/arena.models';
import { StubArenaApi } from './features/arena/data/stub-arena.api';
import { HistoryApi } from './features/history/data/history.models';
import { HttpHistoryApi } from './features/history/data/http-history.api';
import { HttpLaunchApi } from './features/launch/data/http-launch.api';
import { LaunchApi } from './features/launch/data/launch.models';
import { ReplayApi } from './features/replay/data/replay.models';
import { StubReplayApi } from './features/replay/data/stub-replay.api';
import { ReportApi } from './features/report/data/report.models';
import { StubReportApi } from './features/report/data/stub-report.api';

// Реализации портов данных для настоящей сборки. В сборках `stub` и `development-stub` файл заменяется
// на `api-impls.stub.ts` (angular.json), поэтому заглушки запуска и истории в боевой бандл не попадают.
// Арена, отчёт и воспроизведение подключаются к API следующими частями frontend#8.
export const LAUNCH_API_IMPL: Type<LaunchApi> = HttpLaunchApi;
export const HISTORY_API_IMPL: Type<HistoryApi> = HttpHistoryApi;
export const ARENA_API_IMPL: Type<ArenaApi> = StubArenaApi;
export const REPORT_API_IMPL: Type<ReportApi> = StubReportApi;
export const REPLAY_API_IMPL: Type<ReplayApi> = StubReplayApi;

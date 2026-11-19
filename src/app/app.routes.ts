import { Routes } from '@angular/router';
import { DEFAULT_REPORT_SESSION_ID } from './shared/default-report-session';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'arena' },
  {
    path: 'new',
    title: 'Новая сессия',
    loadComponent: () => import('./features/launch/launch-page').then((m) => m.LaunchPage),
  },
  {
    path: 'arena',
    title: 'Арена',
    loadComponent: () => import('./features/arena/arena-page').then((m) => m.ArenaPage),
  },
  {
    path: 'arena/:id',
    title: 'Арена',
    loadComponent: () => import('./features/arena/arena-page').then((m) => m.ArenaPage),
  },
  {
    path: 'workshop',
    title: 'Мастерская',
    loadComponent: () => import('./features/workshop/workshop-page').then((m) => m.WorkshopPage),
  },
  { path: 'report', pathMatch: 'full', redirectTo: `report/${DEFAULT_REPORT_SESSION_ID}` },
  {
    path: 'report/:id',
    title: 'Отчёт',
    loadComponent: () => import('./features/report/report-page').then((m) => m.ReportPage),
  },
  {
    path: 'history',
    title: 'История',
    loadComponent: () => import('./features/history/history-page').then((m) => m.HistoryPage),
  },
  {
    path: 'replay/:id',
    title: 'Воспроизведение',
    loadComponent: () => import('./features/replay/replay-page').then((m) => m.ReplayPage),
  },
  { path: '**', redirectTo: 'arena' },
];

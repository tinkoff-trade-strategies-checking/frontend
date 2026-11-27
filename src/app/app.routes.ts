import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { STUB_MODE } from './core/api-mode';
import { featureGuard } from './core/real-features';
import { DEFAULT_REPORT_SESSION_ID } from './shared/default-report-session';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: () => (inject(STUB_MODE) ? 'arena' : 'new') },
  {
    path: 'login',
    title: 'Вход',
    loadComponent: () => import('./features/login/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'new',
    title: 'Новая сессия',
    canActivate: [authGuard],
    loadComponent: () => import('./features/launch/launch-page').then((m) => m.LaunchPage),
  },
  {
    path: 'arena',
    title: 'Арена',
    canActivate: [authGuard, featureGuard('arena')],
    loadComponent: () => import('./features/arena/arena-page').then((m) => m.ArenaPage),
  },
  {
    path: 'arena/:id',
    title: 'Арена',
    canActivate: [authGuard, featureGuard('arena')],
    loadComponent: () => import('./features/arena/arena-page').then((m) => m.ArenaPage),
  },
  {
    path: 'instruments',
    title: 'Инструменты',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/instruments/instruments-page').then((m) => m.InstrumentsPage),
  },
  {
    path: 'workshop',
    title: 'Мастерская',
    canActivate: [authGuard],
    loadComponent: () => import('./features/workshop/workshop-page').then((m) => m.WorkshopPage),
  },
  {
    path: 'workshop/compare',
    title: 'Сравнение алгоритмов',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/workshop/workshop-compare-page').then((m) => m.WorkshopComparePage),
  },
  {
    path: 'runs/:id',
    title: 'Прогон алгоритма',
    canActivate: [authGuard],
    loadComponent: () => import('./features/runs/run-page').then((m) => m.RunPage),
  },
  {
    path: 'runs/:id/report',
    title: 'Отчёт прогона',
    canActivate: [authGuard],
    loadComponent: () => import('./features/runs/run-report-page').then((m) => m.RunReportPage),
  },
  {
    path: 'report',
    pathMatch: 'full',
    redirectTo: () => (inject(STUB_MODE) ? `report/${DEFAULT_REPORT_SESSION_ID}` : 'history'),
  },
  {
    path: 'report/:id',
    title: 'Отчёт',
    canActivate: [authGuard, featureGuard('report')],
    loadComponent: () => import('./features/report/report-page').then((m) => m.ReportPage),
  },
  {
    path: 'history',
    title: 'История',
    canActivate: [authGuard],
    loadComponent: () => import('./features/history/history-page').then((m) => m.HistoryPage),
  },
  {
    path: 'replay/:id',
    title: 'Воспроизведение',
    canActivate: [authGuard, featureGuard('replay')],
    loadComponent: () => import('./features/replay/replay-page').then((m) => m.ReplayPage),
  },
  { path: '**', redirectTo: () => (inject(STUB_MODE) ? 'arena' : 'new') },
];

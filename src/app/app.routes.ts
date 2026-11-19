import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { DEFAULT_REPORT_SESSION_ID } from './shared/default-report-session';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'arena' },
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
    canActivate: [authGuard],
    loadComponent: () => import('./features/arena/arena-page').then((m) => m.ArenaPage),
  },
  {
    path: 'arena/:id',
    title: 'Арена',
    canActivate: [authGuard],
    loadComponent: () => import('./features/arena/arena-page').then((m) => m.ArenaPage),
  },
  {
    path: 'workshop',
    title: 'Мастерская',
    canActivate: [authGuard],
    loadComponent: () => import('./features/workshop/workshop-page').then((m) => m.WorkshopPage),
  },
  { path: 'report', pathMatch: 'full', redirectTo: `report/${DEFAULT_REPORT_SESSION_ID}` },
  {
    path: 'report/:id',
    title: 'Отчёт',
    canActivate: [authGuard],
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
    canActivate: [authGuard],
    loadComponent: () => import('./features/replay/replay-page').then((m) => m.ReplayPage),
  },
  { path: '**', redirectTo: 'arena' },
];

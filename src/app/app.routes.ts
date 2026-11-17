import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'arena' },
  {
    path: 'arena',
    title: 'Арена',
    loadComponent: () => import('./features/arena/arena-page').then((m) => m.ArenaPage),
  },
  {
    path: 'workshop',
    title: 'Мастерская',
    loadComponent: () => import('./features/workshop/workshop-page').then((m) => m.WorkshopPage),
  },
  {
    path: 'report',
    title: 'Отчёт',
    loadComponent: () => import('./features/report/report-page').then((m) => m.ReportPage),
  },
  { path: '**', redirectTo: 'arena' },
];

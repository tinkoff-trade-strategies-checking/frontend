import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { STUB_MODE } from './api-mode';

/**
 * Разделы, уже подключённые к настоящему API. Остальные в настоящем режиме закрыты: иначе вместо
 * реальных данных пользователь видел бы демонстрационные из заглушек. Каждая часть frontend#8
 * включает свои разделы.
 */
export const REAL_FEATURES: Record<'arena' | 'report' | 'replay', boolean> = {
  arena: false,
  report: false,
  replay: false,
};

export function isFeatureOpen(feature: keyof typeof REAL_FEATURES, stubMode: boolean): boolean {
  return stubMode || REAL_FEATURES[feature];
}

/** Закрытый раздел ведёт на историю. */
export function featureGuard(feature: keyof typeof REAL_FEATURES): CanActivateFn {
  return () =>
    isFeatureOpen(feature, inject(STUB_MODE)) || inject(Router).createUrlTree(['/history']);
}

import { InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';

/** Заглушки вместо backend: конфигурации `stub` и `development-stub` (angular.json). */
export function isStubMode(): boolean {
  return environment.apiMode === 'stub';
}

/** То же, что `isStubMode()`, но подменяемое в тестах. */
export const STUB_MODE = new InjectionToken<boolean>('STUB_MODE', {
  providedIn: 'root',
  factory: isStubMode,
});

import { InjectionToken, Type } from '@angular/core';
import { environment } from '../../environments/environment';

/** Заглушки вместо backend: конфигурации `stub` и `development-stub` (angular.json). */
export function isStubMode(): boolean {
  return environment.apiMode === 'stub';
}

/** Выбор реализации порта данных: заглушка или клиент настоящего API. */
export function apiImpl(stub: Type<unknown>, real: Type<unknown>): Type<unknown> {
  return isStubMode() ? stub : real;
}

/** То же, что `isStubMode()`, но подменяемое в тестах. */
export const STUB_MODE = new InjectionToken<boolean>('STUB_MODE', {
  providedIn: 'root',
  factory: isStubMode,
});

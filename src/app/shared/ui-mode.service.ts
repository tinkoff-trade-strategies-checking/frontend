import { computed, Injectable, signal } from '@angular/core';

export type UiMode = 'basic' | 'pro';

export const UI_MODE_STORAGE_KEY = 'ttsc.uiMode';

@Injectable({ providedIn: 'root' })
export class UiModeService {
  readonly mode = signal<UiMode>(this.readStoredMode());
  readonly isBasic = computed(() => this.mode() === 'basic');
  readonly isPro = computed(() => this.mode() === 'pro');

  setMode(mode: UiMode): void {
    this.mode.set(mode);
    this.writeStoredMode(mode);
  }

  toggle(): void {
    this.setMode(this.mode() === 'basic' ? 'pro' : 'basic');
  }

  private readStoredMode(): UiMode {
    try {
      const saved = globalThis.localStorage?.getItem(UI_MODE_STORAGE_KEY);
      return saved === 'pro' || saved === 'basic' ? saved : 'basic';
    } catch {
      return 'basic';
    }
  }

  private writeStoredMode(mode: UiMode): void {
    try {
      globalThis.localStorage?.setItem(UI_MODE_STORAGE_KEY, mode);
    } catch {
      // В SSR или при запрете storage игнорируем ошибку записи.
    }
  }
}

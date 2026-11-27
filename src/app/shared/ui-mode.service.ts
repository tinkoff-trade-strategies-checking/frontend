import { Injectable, computed, signal } from '@angular/core';

export type UiMode = 'beginner' | 'pro';

const STORAGE_KEY = 'ttsc_ui_mode';

function readStoredMode(): UiMode {
  try {
    if (typeof localStorage === 'undefined') {
      return 'beginner';
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'pro' || raw === 'beginner' ? raw : 'beginner';
  } catch {
    return 'beginner';
  }
}

function writeStoredMode(mode: UiMode): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  } catch {
    // ignore storage errors in restricted environments
  }
}

@Injectable({ providedIn: 'root' })
export class UiModeService {
  readonly mode = signal<UiMode>(readStoredMode());
  readonly isBeginner = computed(() => this.mode() === 'beginner');
  readonly isPro = computed(() => this.mode() === 'pro');

  setMode(mode: UiMode): void {
    this.mode.set(mode);
    writeStoredMode(mode);
  }

  toggle(): void {
    this.setMode(this.mode() === 'beginner' ? 'pro' : 'beginner');
  }
}

import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'ttsc.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly theme = signal<ThemeMode>(this.readStoredTheme());

  constructor() {
    this.applyToDocument(this.theme());
  }

  setTheme(mode: ThemeMode): void {
    this.theme.set(mode);
    this.applyToDocument(mode);
    this.writeStoredTheme(mode);
  }

  toggle(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private applyToDocument(mode: ThemeMode): void {
    const root = this.document?.documentElement;
    if (!root) {
      return;
    }
    root.dataset['theme'] = mode;
    root.style.colorScheme = mode;
  }

  private readStoredTheme(): ThemeMode {
    try {
      const saved = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
      return saved === 'light' || saved === 'dark' ? saved : 'dark';
    } catch {
      return 'dark';
    }
  }

  private writeStoredTheme(mode: ThemeMode): void {
    try {
      globalThis.localStorage?.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // В SSR или при запрете storage игнорируем ошибку записи.
    }
  }
}

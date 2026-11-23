import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
    document.documentElement.style.colorScheme = '';
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('по умолчанию выбирает тёмную тему и применяет её к документу', () => {
    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('читает сохранённую тему из localStorage', () => {
    localStorage.setItem('ttsc.theme', 'light');
    TestBed.resetTestingModule();

    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('переключает тему и сохраняет выбор в localStorage', () => {
    const service = TestBed.inject(ThemeService);

    service.toggle();
    expect(service.theme()).toBe('light');
    expect(localStorage.getItem('ttsc.theme')).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');

    service.setTheme('dark');
    expect(service.theme()).toBe('dark');
    expect(localStorage.getItem('ttsc.theme')).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
});

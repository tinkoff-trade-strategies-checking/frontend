import { TestBed } from '@angular/core/testing';
import { UI_MODE_STORAGE_KEY, UiModeService } from './ui-mode.service';

describe('UiModeService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('по умолчанию включает режим basic', () => {
    const service = TestBed.inject(UiModeService);
    expect(service.mode()).toBe('basic');
    expect(service.isBasic()).toBe(true);
    expect(service.isPro()).toBe(false);
  });

  it('восстанавливает сохранённый режим pro из localStorage', () => {
    localStorage.setItem(UI_MODE_STORAGE_KEY, 'pro');
    const service = TestBed.inject(UiModeService);
    expect(service.mode()).toBe('pro');
    expect(service.isPro()).toBe(true);
    expect(service.isBasic()).toBe(false);
  });

  it('игнорирует неизвестное значение в localStorage и откатывается на basic', () => {
    localStorage.setItem(UI_MODE_STORAGE_KEY, 'unknown');
    const service = TestBed.inject(UiModeService);
    expect(service.mode()).toBe('basic');
  });

  it('сохраняет изменения через setMode и toggle в localStorage', () => {
    const service = TestBed.inject(UiModeService);

    service.setMode('pro');
    expect(service.mode()).toBe('pro');
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('pro');

    service.toggle();
    expect(service.mode()).toBe('basic');
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('basic');

    service.toggle();
    expect(service.mode()).toBe('pro');
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('pro');
  });
});

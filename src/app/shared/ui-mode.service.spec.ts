import { TestBed } from '@angular/core/testing';
import { UiModeService } from './ui-mode.service';

describe('UiModeService', () => {
  beforeEach(() => {
    localStorage.removeItem('ttsc_ui_mode');
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    localStorage.removeItem('ttsc_ui_mode');
  });

  it('defaults to beginner mode when storage is empty', () => {
    const service = TestBed.inject(UiModeService);
    expect(service.mode()).toBe('beginner');
    expect(service.isBeginner()).toBe(true);
    expect(service.isPro()).toBe(false);
  });

  it('reads stored pro mode from localStorage on init', () => {
    localStorage.setItem('ttsc_ui_mode', 'pro');
    const service = TestBed.inject(UiModeService);
    expect(service.mode()).toBe('pro');
    expect(service.isBeginner()).toBe(false);
    expect(service.isPro()).toBe(true);
  });

  it('falls back to beginner when localStorage has invalid value', () => {
    localStorage.setItem('ttsc_ui_mode', 'unknown');
    const service = TestBed.inject(UiModeService);
    expect(service.mode()).toBe('beginner');
  });

  it('persists mode changes via setMode and toggle', () => {
    const service = TestBed.inject(UiModeService);
    service.setMode('pro');
    expect(service.mode()).toBe('pro');
    expect(localStorage.getItem('ttsc_ui_mode')).toBe('pro');

    service.toggle();
    expect(service.mode()).toBe('beginner');
    expect(localStorage.getItem('ttsc_ui_mode')).toBe('beginner');

    service.toggle();
    expect(service.mode()).toBe('pro');
    expect(localStorage.getItem('ttsc_ui_mode')).toBe('pro');
  });
});

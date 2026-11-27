import { TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
import { vi } from 'vitest';
import { BeginnerGlossary } from './beginner-glossary';
import { BEGINNER_GLOSSARY_TERMS } from './glossary.terms';

describe('BeginnerGlossary', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BeginnerGlossary],
      providers: [provideTaiga()],
    }).compileComponents();
  });

  it('содержит не менее 25 базовых терминов и скрыт при open = false', () => {
    expect(BEGINNER_GLOSSARY_TERMS.length).toBeGreaterThanOrEqual(25);
    const fixture = TestBed.createComponent(BeginnerGlossary);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="dialog"]')).toBeNull();
  });

  it('открывается, ищет по термину, фильтрует по категории и сбрасывает пустой поиск', () => {
    const fixture = TestBed.createComponent(BeginnerGlossary);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="dialog"]')).not.toBeNull();
    expect(root.querySelectorAll('.term-card').length).toBe(BEGINNER_GLOSSARY_TERMS.length);

    const search = root.querySelector<HTMLInputElement>('#glossary-search')!;
    search.value = 'стоп-лосс';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const matched = Array.from(root.querySelectorAll('.term-card'));
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched.some((card) => card.getAttribute('data-term-id') === 'stop-loss')).toBe(true);

    search.value = 'несуществующийтермин123';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(root.textContent).toContain('ничего не найдено');

    const resetBtn = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Сбросить поиск'),
    );
    resetBtn?.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.term-card').length).toBe(BEGINNER_GLOSSARY_TERMS.length);

    const riskPill = Array.from(root.querySelectorAll<HTMLButtonElement>('.category-pill')).find(
      (b) => b.textContent?.trim() === 'Риск и защита',
    );
    riskPill?.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.term-card').length).toBeLessThan(BEGINNER_GLOSSARY_TERMS.length);
    expect(root.querySelector('[data-term-id="stop-loss"]')).not.toBeNull();
  });

  it('эмитит closed по кнопке закрытия, клику на фон и Escape', () => {
    const fixture = TestBed.createComponent(BeginnerGlossary);
    fixture.componentRef.setInput('open', true);
    const closedSpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button[aria-label="Закрыть словарь"]')?.click();
    expect(closedSpy).toHaveBeenCalledTimes(1);

    root.querySelector<HTMLElement>('.modal-backdrop')?.click();
    expect(closedSpy).toHaveBeenCalledTimes(2);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closedSpy).toHaveBeenCalledTimes(3);
  });
});

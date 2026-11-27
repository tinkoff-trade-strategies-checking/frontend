import { TestBed } from '@angular/core/testing';
import { TermHint } from './term-hint';

describe('TermHint', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TermHint],
    }).compileComponents();
  });

  it('открывает и закрывает подсказку по клику, Escape и клику снаружи', () => {
    const fixture = TestBed.createComponent(TermHint);
    fixture.componentRef.setInput('term', 'Спред');
    fixture.componentRef.setInput(
      'text',
      'Разница между ценой покупки и продажи акции в один момент времени.',
    );
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const btn = root.querySelector<HTMLButtonElement>('button.hint-btn')!;
    expect(btn.getAttribute('aria-label')).toBe('Подсказка: Спред');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('[role="tooltip"]')).toBeNull();

    btn.click();
    fixture.detectChanges();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    const popover = root.querySelector('[role="tooltip"]');
    expect(popover?.textContent).toContain('Спред');
    expect(popover?.textContent).toContain('Разница между ценой покупки и продажи');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(root.querySelector('[role="tooltip"]')).toBeNull();

    btn.click();
    fixture.detectChanges();
    expect(root.querySelector('[role="tooltip"]')).not.toBeNull();

    document.body.click();
    fixture.detectChanges();
    expect(root.querySelector('[role="tooltip"]')).toBeNull();
  });
});

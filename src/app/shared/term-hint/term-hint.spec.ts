import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TermHint } from './term-hint';

function makeRect(partial: Partial<DOMRect>): DOMRect {
  const left = partial.left ?? 0;
  const top = partial.top ?? 0;
  const width = partial.width ?? 16;
  const height = partial.height ?? 16;
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: partial.right ?? left + width,
    bottom: partial.bottom ?? top + height,
    toJSON: () => ({}),
  };
}

describe('TermHint', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TermHint],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('прижимает поповер к левому краю viewport с отступом >= 12px', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(768);

    const fixture = TestBed.createComponent(TermHint);
    fixture.componentRef.setInput('term', 'НКД');
    fixture.componentRef.setInput('text', 'Накопленный купонный доход по облигации.');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const btn = root.querySelector<HTMLButtonElement>('button.hint-btn')!;
    vi.spyOn(btn, 'getBoundingClientRect').mockReturnValue(
      makeRect({ left: 10, top: 120, width: 16, height: 16 }),
    );

    btn.click();
    fixture.detectChanges();

    const popover = root.querySelector<HTMLElement>('[role="tooltip"]')!;
    expect(Number.parseFloat(popover.style.left)).toBeGreaterThanOrEqual(12);
    expect(popover.getAttribute('data-placement')).toBe('bottom');
  });

  it('не даёт поповеру выйти за правый край viewport', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(768);

    const fixture = TestBed.createComponent(TermHint);
    fixture.componentRef.setInput('term', 'Спред');
    fixture.componentRef.setInput('text', 'Разница между ценой покупки и продажи.');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const btn = root.querySelector<HTMLButtonElement>('button.hint-btn')!;
    vi.spyOn(btn, 'getBoundingClientRect').mockReturnValue(
      makeRect({ left: 1000, top: 120, width: 16, height: 16 }),
    );

    btn.click();
    fixture.detectChanges();

    const popover = root.querySelector<HTMLElement>('[role="tooltip"]')!;
    const left = Number.parseFloat(popover.style.left);
    expect(left).toBeLessThanOrEqual(1024 - 272 - 12);
    expect(left).toBeGreaterThanOrEqual(12);
  });

  it('переворачивает поповер вверх, если снизу недостаточно места', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(768);

    const fixture = TestBed.createComponent(TermHint);
    fixture.componentRef.setInput('term', 'Лоты');
    fixture.componentRef.setInput('text', 'Минимальное количество бумаг в одной сделке.');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const btn = root.querySelector<HTMLButtonElement>('button.hint-btn')!;
    vi.spyOn(btn, 'getBoundingClientRect').mockReturnValue(
      makeRect({ left: 300, top: 730, width: 16, height: 16 }),
    );

    btn.click();
    fixture.detectChanges();

    const popover = root.querySelector<HTMLElement>('[role="tooltip"]')!;
    expect(popover.getAttribute('data-placement')).toBe('top');
    expect(Number.parseFloat(popover.style.top)).toBeLessThan(730);
  });

  it('закрывает поповер при прокрутке страницы', () => {
    const fixture = TestBed.createComponent(TermHint);
    fixture.componentRef.setInput('term', 'НКД');
    fixture.componentRef.setInput('text', 'Накопленный купонный доход.');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const btn = root.querySelector<HTMLButtonElement>('button.hint-btn')!;
    btn.click();
    fixture.detectChanges();
    expect(root.querySelector('[role="tooltip"]')).not.toBeNull();

    window.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(root.querySelector('[role="tooltip"]')).toBeNull();
  });
});

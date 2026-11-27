import { TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
import { BeginnerGlossary } from './beginner-glossary';

describe('BeginnerGlossary', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BeginnerGlossary],
      providers: [provideTaiga()],
    }).compileComponents();
  });

  it('показывает 3 вкладки и переключает содержимое между «График», «Заявки» и «Отчёт»', () => {
    const fixture = TestBed.createComponent(BeginnerGlossary);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Свеча');

    const tabBtn = (label: string): HTMLButtonElement => {
      const btn = Array.from(root.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === label,
      );
      if (!btn) {
        throw new Error(`Нет вкладки ${label}`);
      }
      return btn;
    };

    tabBtn('Заявки').click();
    fixture.detectChanges();
    expect(root.textContent).toContain('Рыночная заявка');

    tabBtn('Отчёт').click();
    fixture.detectChanges();
    expect(root.textContent).toContain('Максимальная просадка');
  });

  it('эмитит closed при клике на «Закрыть» и по клавише Escape', () => {
    const fixture = TestBed.createComponent(BeginnerGlossary);
    let closedCount = 0;
    fixture.componentInstance.closed.subscribe(() => {
      closedCount++;
    });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const closeBtn = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Закрыть',
    );
    closeBtn?.click();
    expect(closedCount).toBe(1);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closedCount).toBe(2);
  });
});

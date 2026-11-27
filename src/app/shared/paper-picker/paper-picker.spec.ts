import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
import { COLLAPSED_CHIPS_LIMIT, PaperPicker, SelectablePaper } from './paper-picker';

function makePapers(count: number): readonly SelectablePaper[] {
  const sectors = ['Финансы', 'Нефть и газ', 'IT', 'Металлы и добыча', 'Потребсектор'];
  const base: SelectablePaper[] = [
    { id: 'SBER', ticker: 'SBER', name: 'Сбербанк', sector: 'Финансы' },
    { id: 'GAZP', ticker: 'GAZP', name: 'Газпром', sector: 'Нефть и газ' },
    { id: 'YDEX', ticker: 'YDEX', name: 'Яндекс', sector: 'IT' },
    { id: 'LKOH', ticker: 'LKOH', name: 'ЛУКОЙЛ', sector: 'Нефть и газ' },
    { id: 'T', ticker: 'T', name: 'Т-Технологии', sector: 'Финансы' },
  ];
  for (let i = base.length; i < count; i++) {
    const code = `MOEX${String(i + 1).padStart(3, '0')}`;
    base.push({
      id: code,
      ticker: code,
      name: `Компания ${i + 1}`,
      sector: sectors[i % sectors.length],
    });
  }
  return base.slice(0, count);
}

@Component({
  imports: [PaperPicker],
  template: `
    <app-paper-picker
      [papers]="papers()"
      [selectedIds]="selectedIds()"
      [loading]="loading()"
      (selectedIdsChange)="selectedIds.set($event)"
    />
  `,
})
class HostComponent {
  readonly papers = signal<readonly SelectablePaper[]>(makePapers(60));
  readonly selectedIds = signal<readonly string[]>(['SBER', 'GAZP']);
  readonly loading = signal(false);
}

describe('PaperPicker', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideTaiga()],
    }).compileComponents();
  });

  function findButton(root: HTMLElement, label: string): HTMLButtonElement {
    const btn = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === label,
    );
    if (!btn) {
      throw new Error(`Кнопка «${label}» не найдена`);
    }
    return btn;
  }

  it('фильтрует бумаги по тикеру, названию и сектору без учёта регистра', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const search = root.querySelector<HTMLInputElement>('input[type="search"]');
    expect(search).not.toBeNull();

    // По тикеру в нижнем регистре.
    search!.value = 'ydex';
    search!.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    let rows = root.querySelectorAll('.picker-row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Яндекс');

    // По названию в верхнем регистре.
    search!.value = 'СБЕР';
    search!.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    rows = root.querySelectorAll('.picker-row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('SBER');

    // По несуществующему запросу — пустое состояние и кнопка сброса.
    search!.value = 'ZZZZZ';
    search!.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelectorAll('.picker-row').length).toBe(0);
    expect(root.textContent).toContain('ничего не найдено');
    findButton(root, 'Сбросить поиск').click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.picker-row').length).toBe(60);
  });

  it('поддерживает массовые действия: Выбрать все (без лимита), Выбрать найденные и Сбросить', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Выбрано: 2 из 60');

    // Выбрать все — выбирает все 60 бумаг без ограничений.
    findButton(root, 'Выбрать все').click();
    fixture.detectChanges();
    expect(host.selectedIds().length).toBe(60);
    expect(root.textContent).toContain('Выбрано: 60 из 60');

    // Сбросить — очищает выбор полностью.
    findButton(root, 'Сбросить').click();
    fixture.detectChanges();
    expect(host.selectedIds()).toEqual([]);
    expect(root.textContent).toContain('Выбрано: 0 из 60');

    // Выбрать найденные — добавляет только отфильтрованные бумаги.
    const search = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'Нефть и газ';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    const filteredCount = root.querySelectorAll('.picker-row').length;
    expect(filteredCount).toBeGreaterThan(1);

    findButton(root, 'Выбрать найденные').click();
    fixture.detectChanges();
    expect(host.selectedIds().length).toBe(filteredCount);
    expect(host.selectedIds()).toContain('GAZP');
    expect(host.selectedIds()).toContain('LKOH');
  });

  it('компактно сворачивает чипы при большом количестве выбранных бумаг (200+) и позволяет удалять по одной', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    host.papers.set(makePapers(250));
    host.selectedIds.set(host.papers().map((p) => p.id));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Выбрано: 250 из 250');

    // Отображается не больше COLLAPSED_CHIPS_LIMIT чипов + кнопка «+ ещё N».
    expect(root.querySelectorAll('.selected-chip').length).toBe(COLLAPSED_CHIPS_LIMIT);
    const expandBtn = root.querySelector<HTMLButtonElement>('.selected-chip-toggle');
    expect(expandBtn?.textContent).toContain(`+ ещё ${250 - COLLAPSED_CHIPS_LIMIT}`);

    // Удаление одного чипа уменьшает выбор на 1.
    root.querySelector<HTMLButtonElement>('button[aria-label="Убрать SBER"]')!.click();
    fixture.detectChanges();
    expect(host.selectedIds().length).toBe(249);
    expect(host.selectedIds()).not.toContain('SBER');

    // Раскрытие и сворачивание чипов работает корректно.
    root.querySelector<HTMLButtonElement>('.selected-chip-toggle')!.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.selected-chip').length).toBe(249);
    expect(root.querySelector('.selected-chip-toggle')?.textContent?.trim()).toBe('Свернуть');
  });

  it('фильтрует бумаги по категориям/секторам (включая «Выбранные» и «Без сектора») и позволяет выбрать категорию', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    host.papers.set([
      ...makePapers(12),
      { id: 'UNSEC1', ticker: 'UNSEC1', name: 'Без сектора 1', sector: '' },
      { id: 'UNSEC2', ticker: 'UNSEC2', name: 'Без сектора 2', sector: '—' },
    ]);
    host.selectedIds.set(['SBER']);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const catChips = Array.from(root.querySelectorAll<HTMLButtonElement>('.category-chip'));
    const labels = catChips.map((c) => c.textContent?.replace(/\s+/g, ' ').trim());
    expect(labels.some((l) => l?.startsWith('Все'))).toBe(true);
    expect(labels.some((l) => l?.startsWith('Выбранные'))).toBe(true);
    expect(labels.some((l) => l?.startsWith('Без сектора'))).toBe(true);

    // Фильтр «Выбранные» показывает только выбранные бумаги.
    root.querySelector<HTMLButtonElement>('.category-chip[data-category="__selected__"]')!.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.picker-row').length).toBe(1);
    expect(root.querySelector('.picker-row')?.textContent).toContain('SBER');

    // Фильтр «Без сектора» показывает 2 бумаги без сектора и кнопку «Выбрать в категории».
    root.querySelector<HTMLButtonElement>('.category-chip[data-category="__no_sector__"]')!.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.picker-row').length).toBe(2);
    findButton(root, 'Выбрать в категории').click();
    fixture.detectChanges();
    expect(host.selectedIds()).toContain('UNSEC1');
    expect(host.selectedIds()).toContain('UNSEC2');
    expect(host.selectedIds()).toContain('SBER');
  });

  it('группирует бумаги по секторам со сворачиванием и массовым выбором сектора', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    host.selectedIds.set([]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const groups = root.querySelectorAll('.picker-group');
    expect(groups.length).toBe(5);

    // Кнопка «Выбрать» на заголовке сектора выбирает все бумаги этого сектора.
    const financeGroup = root.querySelector('.picker-group[data-sector-group="Финансы"]')!;
    const financeRowsCount = financeGroup.querySelectorAll('.picker-row').length;
    expect(financeRowsCount).toBeGreaterThan(1);
    financeGroup.querySelector<HTMLButtonElement>('.picker-group-select')!.click();
    fixture.detectChanges();
    expect(host.selectedIds().length).toBe(financeRowsCount);

    // Сворачивание сектора скрывает его строки.
    financeGroup.querySelector<HTMLButtonElement>('.picker-group-toggle')!.click();
    fixture.detectChanges();
    expect(financeGroup.querySelectorAll('.picker-row').length).toBe(0);

    // Переключение «По секторам» переводит список в плоский вид.
    findButton(root, 'По секторам').click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.picker-group').length).toBe(0);
    expect(root.querySelectorAll('.picker-row').length).toBe(60);
  });

  it('рендерит не более 60 строк за раз и подгружает остальные по кнопке «Показать ещё»', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    const many = Array.from({ length: 130 }, (_, i) => ({
      id: `P${i}`,
      ticker: `T${i}`,
      name: `Компания ${i}`,
      sector: 'Финансы',
    }));
    host.papers.set(many);
    host.selectedIds.set([]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.picker-row').length).toBe(60);
    const moreBtn = root.querySelector<HTMLButtonElement>('[data-picker-show-more]');
    expect(moreBtn?.textContent).toContain('осталось 70');

    moreBtn!.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.picker-row').length).toBe(120);
  });
});

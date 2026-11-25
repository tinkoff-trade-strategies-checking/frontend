import { TestBed } from '@angular/core/testing';
import { provideTaiga } from '@taiga-ui/core';
import { vi } from 'vitest';
import { DSL_MAX_FILE_BYTES } from '../data/dsl-file';
import { WORKSHOP_API, WorkshopApi } from '../data/workshop.models';
import { WorkshopStore } from '../workshop.store';
import { WorkshopDraftEditor } from './workshop-draft-editor';

function findButton(el: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => b.textContent?.trim() === label,
  );
}

function dispatchFileInputChange(input: HTMLInputElement, file: File): void {
  Object.defineProperty(input, 'files', {
    value: [file],
    configurable: true,
  });
  input.dispatchEvent(new Event('change'));
}

function createDragEvent(type: string, files?: readonly File[]): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
  const dataTransfer = {
    types: files ? ['Files'] : [],
    files: files ?? [],
    dropEffect: 'none',
  };
  Object.defineProperty(event, 'dataTransfer', {
    value: dataTransfer,
    configurable: true,
  });
  return event;
}

describe('WorkshopDraftEditor', () => {
  let checkMock: ReturnType<typeof vi.fn>;
  let store: WorkshopStore;

  beforeEach(async () => {
    checkMock = vi.fn().mockResolvedValue({
      lookaheadLevel: 'OK',
      diagnostics: [],
      params: [{ name: 'fast', defaultValue: 20 }],
    });

    const apiStub: WorkshopApi = {
      list: () => Promise.reject(new Error('not used')),
      getById: () => Promise.reject(new Error('not used')),
      createAlgorithm: () => Promise.reject(new Error('not used')),
      getDraft: () => Promise.reject(new Error('not used')),
      saveDraft: () => Promise.reject(new Error('not used')),
      check: checkMock as WorkshopApi['check'],
      publish: () => Promise.reject(new Error('not used')),
      fork: () => Promise.reject(new Error('not used')),
      setVisibility: () => Promise.reject(new Error('not used')),
      deleteAlgorithm: () => Promise.reject(new Error('not used')),
    };

    await TestBed.configureTestingModule({
      imports: [WorkshopDraftEditor],
      providers: [provideTaiga(), { provide: WORKSHOP_API, useValue: apiStub }, WorkshopStore],
    }).compileComponents();

    store = TestBed.inject(WorkshopStore);
    store.openCreateDraft();
  });

  it('загружает валидный .dsl файл, убирает BOM, нормализует CRLF, автозаполняет название и запускает проверку', async () => {
    const fixture = TestBed.createComponent(WorkshopDraftEditor);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const fileInput = el.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    expect(fileInput?.getAttribute('accept')).toBe('.dsl,.txt,text/plain');

    const raw =
      '\uFEFFparam fast = 20\r\nrule "вход"\r\n  when close > sma(close, fast)\r\n  then buy 50 % cash\r\n  because "Тест"';
    const file = new File([raw], 'SMA Crossover.dsl', { type: 'text/plain' });

    dispatchFileInputChange(fileInput!, file);
    await vi.waitFor(() => {
      expect(store.draftSource()).toContain('param fast = 20\nrule "вход"');
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(store.draftSource()).not.toContain('\uFEFF');
    expect(store.draftSource()).not.toContain('\r');
    expect(store.draftName()).toBe('SMA Crossover');
    expect(checkMock).toHaveBeenCalledWith({ source: store.draftSource() });
    expect(el.textContent).toContain('Файл «SMA Crossover.dsl» загружен в редактор.');
  });

  it('загружает .txt файл и не перезаписывает уже заполненное название алгоритма', async () => {
    store.setDraftName('Моё название');
    const fixture = TestBed.createComponent(WorkshopDraftEditor);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const fileInput = el.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(['param n = 10\n'], 'other_name.txt', { type: 'text/plain' });

    dispatchFileInputChange(fileInput, file);
    await vi.waitFor(() => {
      expect(store.draftSource()).toBe('param n = 10\n');
    });
    fixture.detectChanges();

    expect(store.draftName()).toBe('Моё название');
  });

  it('отклоняет файл больше 64 КиБ с понятной ошибкой и не меняет код редактора', async () => {
    store.setDraftSource('param keep = 1');
    const fixture = TestBed.createComponent(WorkshopDraftEditor);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const fileInput = el.querySelector<HTMLInputElement>('input[type="file"]')!;
    const oversized = new File(['x'.repeat(DSL_MAX_FILE_BYTES + 1)], 'huge.dsl', {
      type: 'text/plain',
    });

    dispatchFileInputChange(fileInput, oversized);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.textContent).toContain('64 КиБ');
    });

    expect(store.draftSource()).toBe('param keep = 1');
    expect(checkMock).not.toHaveBeenCalled();
  });

  it('отклоняет пустой и бинарный файлы с сообщением об ошибке', async () => {
    const fixture = TestBed.createComponent(WorkshopDraftEditor);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const fileInput = el.querySelector<HTMLInputElement>('input[type="file"]')!;

    dispatchFileInputChange(fileInput, new File([], 'empty.dsl', { type: 'text/plain' }));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.textContent).toContain('Файл пустой');
    });

    const binary = new File([new Uint8Array([0x50, 0x4b, 0x00, 0x04])], 'archive.dsl');
    dispatchFileInputChange(fileInput, binary);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.textContent).toContain('бинарные данные');
    });

    expect(store.draftSource()).toBe('');
    expect(checkMock).not.toHaveBeenCalled();
  });

  it('поддерживает drag-and-drop на области редактора с подсветкой рамки', async () => {
    const fixture = TestBed.createComponent(WorkshopDraftEditor);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const wrap = el.querySelector<HTMLElement>('.dsl-editor-wrap')!;
    const file = new File(['param slow = 50\n'], 'Dropped Strategy.dsl', { type: 'text/plain' });

    wrap.dispatchEvent(createDragEvent('dragenter', [file]));
    fixture.detectChanges();
    expect(wrap.classList.contains('dsl-editor-wrap_dragging')).toBe(true);

    wrap.dispatchEvent(createDragEvent('dragleave', [file]));
    fixture.detectChanges();
    expect(wrap.classList.contains('dsl-editor-wrap_dragging')).toBe(false);

    wrap.dispatchEvent(createDragEvent('dragover', [file]));
    fixture.detectChanges();
    expect(wrap.classList.contains('dsl-editor-wrap_dragging')).toBe(true);

    wrap.dispatchEvent(createDragEvent('drop', [file]));
    await vi.waitFor(() => {
      expect(store.draftSource()).toBe('param slow = 50\n');
    });
    fixture.detectChanges();

    expect(wrap.classList.contains('dsl-editor-wrap_dragging')).toBe(false);
    expect(store.draftName()).toBe('Dropped Strategy');
    expect(checkMock).toHaveBeenCalledWith({ source: 'param slow = 50\n' });
  });

  it('управляет состоянием кнопки «Скачать .dsl» и экспортирует файл стратегии', () => {
    const fixture = TestBed.createComponent(WorkshopDraftEditor);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const downloadBtn = findButton(el, 'Скачать .dsl');
    expect(downloadBtn).toBeDefined();
    expect(downloadBtn?.disabled).toBe(true);

    store.setDraftName('Donchian Breakout');
    store.setDraftSource('param period = 20\n');
    fixture.detectChanges();
    expect(downloadBtn?.disabled).toBe(false);

    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-dsl');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    let capturedDownload = '';
    const origAppend = document.body.appendChild.bind(document.body);
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => {
      if (node instanceof HTMLAnchorElement) {
        capturedDownload = node.download;
      }
      return origAppend(node);
    });

    downloadBtn?.click();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(capturedDownload).toBe('Donchian-Breakout.dsl');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-dsl');

    appendSpy.mockRestore();
    clickSpy.mockRestore();
    revokeObjectURL.mockRestore();
    createObjectURL.mockRestore();
  });

  it('отображает 3-уровневый переключатель видимости (Публичный / Закрытый код / Приватный) при создании алгоритма', () => {
    const fixture = TestBed.createComponent(WorkshopDraftEditor);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const visibilityGroup = el.querySelector('.visibility-field');
    expect(visibilityGroup).not.toBeNull();

    const buttons = Array.from(
      visibilityGroup?.querySelectorAll<HTMLButtonElement>('button') ?? [],
    );
    expect(buttons.map((b) => b.textContent?.trim())).toEqual([
      'Публичный',
      'Закрытый код',
      'Приватный',
    ]);
    expect(store.draftVisibility()).toBe('public');

    buttons[1].click();
    fixture.detectChanges();
    expect(store.draftVisibility()).toBe('closed');
    expect(visibilityGroup?.textContent).toContain('код скрыт от других');

    buttons[2].click();
    fixture.detectChanges();
    expect(store.draftVisibility()).toBe('hidden');
    expect(visibilityGroup?.textContent).toContain('Видит и запускает только автор');
  });
});

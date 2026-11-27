import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiInput, TuiNotification, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge, TuiSegmented } from '@taiga-ui/kit';
import {
  buildDslDownloadFilename,
  DSL_FILE_ACCEPT,
  readAndValidateDslFile,
} from '../data/dsl-file';
import { DSL_GUIDE_EXAMPLES } from '../data/dsl-guide.data';
import { WorkshopVisibility } from '../data/workshop.models';

export interface StarterTemplateOption {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
  readonly code: string;
}

const STARTER_TEMPLATE_DEFS: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'platform-baseline', label: 'Пересечение средних' },
  { id: 'rsi-mean-reversion', label: 'Отскок по RSI' },
  { id: 'donchian-atr', label: 'Пробой канала' },
];

const STARTER_TEMPLATES: readonly StarterTemplateOption[] = STARTER_TEMPLATE_DEFS.flatMap((def) => {
  const found = DSL_GUIDE_EXAMPLES.find((ex) => ex.id === def.id);
  return found ? [{ id: def.id, label: def.label, summary: found.summary, code: found.code }] : [];
});
import {
  CHECK_LEVEL_LABELS,
  formatCheckLevelAppearance,
  formatDiagnosticLocation,
  formatVisibilityDescription,
  formatWorkshopDateTime,
  WORKSHOP_VISIBILITY_OPTIONS,
} from '../workshop.format';
import { WorkshopStore } from '../workshop.store';

@Component({
  selector: 'app-workshop-draft-editor',
  imports: [
    FormsModule,
    TuiBadge,
    TuiButton,
    TuiInput,
    TuiNotification,
    TuiSegmented,
    TuiTextfield,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workshop-draft-editor.html',
  styleUrl: './workshop-draft-editor.less',
})
export class WorkshopDraftEditor {
  protected readonly store = inject(WorkshopStore);
  private readonly document = inject(DOCUMENT);
  private readonly gutterRef = viewChild<ElementRef<HTMLDivElement>>('gutter');
  private readonly fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private dragDepth = 0;

  readonly openDslGuide = output<void>();

  protected readonly fileAccept = DSL_FILE_ACCEPT;
  protected readonly starterTemplates = STARTER_TEMPLATES;
  protected readonly isDraggingFile = signal(false);
  protected readonly fileError = signal<string | null>(null);
  protected readonly fileSuccess = signal<string | null>(null);

  protected readonly canDownload = computed(() => this.store.draftSource().trim().length > 0);
  protected readonly lineNumbers = computed<readonly number[]>(() => {
    const count = Math.max(16, this.store.draftSource().split(/\r?\n/).length);
    return Array.from({ length: count }, (_, idx) => idx + 1);
  });

  protected readonly levelLabels = CHECK_LEVEL_LABELS;
  protected readonly levelAppearance = formatCheckLevelAppearance;
  protected readonly formatLocation = formatDiagnosticLocation;
  protected readonly formatDateTime = formatWorkshopDateTime;
  protected readonly visibilityOptions = WORKSHOP_VISIBILITY_OPTIONS;
  protected readonly visibilityDescription = formatVisibilityDescription;

  protected visibilityIndex(current: WorkshopVisibility): number {
    return Math.max(
      0,
      this.visibilityOptions.findIndex((opt) => opt.id === current),
    );
  }

  protected onVisibilityIndexChange(index: number): void {
    const next = this.visibilityOptions[index];
    if (next) {
      this.store.setDraftVisibility(next.id);
    }
  }

  protected syncGutterScroll(textarea: HTMLTextAreaElement): void {
    const gutter = this.gutterRef()?.nativeElement;
    if (gutter) {
      gutter.scrollTop = textarea.scrollTop;
    }
  }

  protected onSourceChange(value: string): void {
    this.fileError.set(null);
    this.fileSuccess.set(null);
    this.store.setDraftSource(value);
  }

  protected applyStarterTemplate(template: StarterTemplateOption): void {
    this.fileError.set(null);
    this.fileSuccess.set(null);
    if (!this.store.draftName().trim()) {
      this.store.setDraftName(template.label);
    }
    if (!this.store.draftDescription().trim()) {
      this.store.setDraftDescription(template.summary);
    }
    this.store.setDraftSource(template.code);
    void this.store.checkDraft();
  }

  protected openFilePicker(): void {
    this.fileInputRef()?.nativeElement.click();
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (input) {
      input.value = '';
    }
    if (file) {
      void this.loadFile(file);
    }
  }

  protected onDragEnter(event: DragEvent): void {
    if (!this.hasFileTransfer(event)) {
      return;
    }
    event.preventDefault();
    this.dragDepth += 1;
    this.isDraggingFile.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    if (!this.hasFileTransfer(event)) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    if (this.dragDepth === 0) {
      this.dragDepth = 1;
    }
    this.isDraggingFile.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    const currentTarget = event.currentTarget as HTMLElement | null;
    const relatedTarget = event.relatedTarget as Node | null;
    if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) {
      this.isDraggingFile.set(false);
    }
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth = 0;
    this.isDraggingFile.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      void this.loadFile(file);
    }
  }

  protected downloadDsl(): void {
    const source = this.store.draftSource();
    if (!source.trim()) {
      return;
    }
    const blob = new Blob([source], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = buildDslDownloadFilename(this.store.draftName());
    link.style.display = 'none';
    this.document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  private async loadFile(file: File): Promise<void> {
    this.fileError.set(null);
    this.fileSuccess.set(null);

    const result = await readAndValidateDslFile(file);
    if (!result.ok) {
      this.fileError.set(result.error);
      return;
    }

    if (!this.store.draftName().trim() && result.suggestedName) {
      this.store.setDraftName(result.suggestedName);
    }
    this.store.setDraftSource(result.source);
    this.fileSuccess.set(`Файл «${result.fileName}» загружен в редактор.`);
    void this.store.checkDraft();
  }

  private hasFileTransfer(event: DragEvent): boolean {
    const dt = event.dataTransfer;
    if (!dt) {
      return false;
    }
    const types = Array.from(dt.types ?? []);
    return types.includes('Files') || (dt.files?.length ?? 0) > 0;
  }
}

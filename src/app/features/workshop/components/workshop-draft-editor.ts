import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiInput, TuiNotification, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import {
  CHECK_LEVEL_LABELS,
  formatCheckLevelAppearance,
  formatDiagnosticLocation,
  formatWorkshopDateTime,
} from '../workshop.format';
import { WorkshopStore } from '../workshop.store';

@Component({
  selector: 'app-workshop-draft-editor',
  imports: [FormsModule, TuiBadge, TuiButton, TuiInput, TuiNotification, TuiTextfield],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workshop-draft-editor.html',
  styleUrl: './workshop-draft-editor.less',
})
export class WorkshopDraftEditor {
  protected readonly store = inject(WorkshopStore);
  private readonly gutterRef = viewChild<ElementRef<HTMLDivElement>>('gutter');

  protected readonly lineNumbers = computed<readonly number[]>(() => {
    const count = Math.max(16, this.store.draftSource().split(/\r?\n/).length);
    return Array.from({ length: count }, (_, idx) => idx + 1);
  });

  protected readonly levelLabels = CHECK_LEVEL_LABELS;
  protected readonly levelAppearance = formatCheckLevelAppearance;
  protected readonly formatLocation = formatDiagnosticLocation;
  protected readonly formatDateTime = formatWorkshopDateTime;

  protected syncGutterScroll(textarea: HTMLTextAreaElement): void {
    const gutter = this.gutterRef()?.nativeElement;
    if (gutter) {
      gutter.scrollTop = textarea.scrollTop;
    }
  }
}

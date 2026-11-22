import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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

  protected readonly levelLabels = CHECK_LEVEL_LABELS;
  protected readonly levelAppearance = formatCheckLevelAppearance;
  protected readonly formatLocation = formatDiagnosticLocation;
  protected readonly formatDateTime = formatWorkshopDateTime;
}

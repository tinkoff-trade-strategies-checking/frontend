import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TermHint } from '../../../shared/term-hint/term-hint';
import { SessionReport } from '../data/report.models';
import { formatPct, formatRatio } from '../report.format';
import {
  computePaperCorrelationMatrix,
  computePortfolioRisk,
  MAX_CORRELATION_PAPERS,
  PaperCorrelationMatrix,
  PortfolioRiskMetrics,
} from '../report-risk';

@Component({
  selector: 'app-report-risk-panel',
  imports: [TermHint],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-risk-panel.html',
  styleUrl: './report-risk-panel.less',
})
export class ReportRiskPanel {
  readonly report = input.required<SessionReport>();

  protected readonly maxPapers = MAX_CORRELATION_PAPERS;
  protected readonly formatPct = formatPct;
  protected readonly formatRatio = formatRatio;

  protected readonly risk = computed<PortfolioRiskMetrics>(() =>
    computePortfolioRisk(this.report().equityCurve),
  );

  protected readonly correlationMatrix = computed<PaperCorrelationMatrix | null>(() => {
    const rep = this.report();
    return computePaperCorrelationMatrix(rep.papers, rep.paperCandles, {
      hideTickers: false,
      maxPapers: MAX_CORRELATION_PAPERS,
    });
  });

  protected cellBackground(value: number | null, isDiagonal: boolean): string {
    if (isDiagonal) {
      return 'var(--tui-background-neutral-2, rgba(128, 128, 128, 0.14))';
    }
    if (value === null) {
      return 'transparent';
    }
    const clamped = Math.max(-1, Math.min(1, value));
    const alpha = Math.round(Math.abs(clamped) * 42) / 100;
    if (clamped >= 0) {
      return `rgba(22, 163, 74, ${alpha.toFixed(2)})`;
    }
    return `rgba(220, 38, 38, ${alpha.toFixed(2)})`;
  }
}

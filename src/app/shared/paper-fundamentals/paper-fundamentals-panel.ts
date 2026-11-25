import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TuiNotification } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { PaperFundamentals } from '../../core/api/fundamentals.models';
import {
  FUNDAMENTAL_CATEGORIES,
  formatFundamentalValue,
  formatReportDate,
  FundamentalCategorySpec,
  FundamentalFieldKey,
  fundamentalValueTone,
} from './paper-fundamentals.format';

interface RenderedMetric {
  readonly key: FundamentalFieldKey;
  readonly label: string;
  readonly formatted: string;
  readonly hint: string;
  readonly tone: 'positive' | 'negative' | 'neutral';
  readonly empty: boolean;
}

interface RenderedCategory {
  readonly id: FundamentalCategorySpec['id'];
  readonly title: string;
  readonly metrics: readonly RenderedMetric[];
}

@Component({
  selector: 'app-paper-fundamentals-panel',
  imports: [TuiBadge, TuiNotification],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './paper-fundamentals-panel.html',
  styleUrl: './paper-fundamentals-panel.less',
})
export class PaperFundamentalsPanel {
  readonly fundamentals = input<PaperFundamentals | null>(null);
  readonly ticker = input<string | null>(null);
  readonly paperName = input<string | null>(null);
  readonly sector = input<string | null>(null);
  readonly asOfDate = input<string | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly hiddenByBlindMode = input(false);
  readonly compact = input(false);

  protected readonly expandedHintKey = signal<FundamentalFieldKey | null>(null);

  protected readonly displayTicker = computed(
    () => this.fundamentals()?.ticker ?? this.ticker() ?? null,
  );

  protected readonly formattedReportDate = computed(() =>
    formatReportDate(this.fundamentals()?.reportDate),
  );

  protected readonly formattedAsOfDate = computed(() => {
    const raw = this.asOfDate();
    return raw ? formatReportDate(raw) : null;
  });

  protected readonly categories = computed<readonly RenderedCategory[]>(() => {
    // INV-7: в слепом режиме не вычисляем и не отдаём значения в шаблон.
    if (this.hiddenByBlindMode()) {
      return [];
    }
    const data = this.fundamentals();
    if (!data) {
      return [];
    }

    return FUNDAMENTAL_CATEGORIES.map((category) => ({
      id: category.id,
      title: category.title,
      metrics: category.metrics.map((metric) => {
        const raw = data[metric.key];
        const formatted = formatFundamentalValue(raw, metric.format);
        return {
          key: metric.key,
          label: metric.label,
          formatted,
          hint: metric.hint,
          tone: fundamentalValueTone(raw, metric.format),
          empty: formatted === '—',
        };
      }),
    }));
  });

  protected toggleHint(key: FundamentalFieldKey): void {
    this.expandedHintKey.update((current) => (current === key ? null : key));
  }
}

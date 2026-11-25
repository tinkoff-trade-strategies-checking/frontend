import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import {
  computeTaSummary,
  TA_ACTION_LABELS,
  TA_RATING_LABELS,
  TaIndicatorAction,
  TaSummaryRating,
  TaVote,
} from '../arena-ta';
import { ArenaCandle } from '../data/arena.models';

export type TaPanelTab = 'indicators' | 'moving_averages' | 'pivots';

@Component({
  selector: 'app-arena-ta-summary',
  imports: [TuiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './arena-ta-summary.html',
  styleUrl: './arena-ta-summary.less',
})
export class ArenaTaSummary {
  readonly candles = input.required<readonly ArenaCandle[]>();
  readonly paperLabel = input<string>('');
  readonly closePanel = output<void>();

  protected readonly activeTab = signal<TaPanelTab>('indicators');
  protected readonly summary = computed(() => computeTaSummary(this.candles()));

  protected ratingLabel(rating: TaSummaryRating): string {
    return TA_RATING_LABELS[rating];
  }

  protected actionLabel(action: TaIndicatorAction | null): string {
    return action ? TA_ACTION_LABELS[action] : '—';
  }

  protected voteLabel(vote: TaVote | null): string {
    if (vote === 'buy') return 'Покупать';
    if (vote === 'sell') return 'Продавать';
    if (vote === 'neutral') return 'Нейтрально';
    return '—';
  }

  protected formatNum(value: number | null, digits = 2): string {
    if (value === null || !Number.isFinite(value)) {
      return '—';
    }
    return value.toLocaleString('ru-RU', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  protected ratingTone(rating: TaSummaryRating): 'pos' | 'neg' | 'neutral' {
    if (rating === 'strong_buy' || rating === 'buy') return 'pos';
    if (rating === 'strong_sell' || rating === 'sell') return 'neg';
    return 'neutral';
  }

  protected actionTone(action: TaIndicatorAction | null): 'pos' | 'neg' | 'warn' | 'neutral' {
    if (action === 'buy' || action === 'oversold') return 'pos';
    if (action === 'sell' || action === 'overbought') return 'neg';
    if (action === 'high_volatility' || action === 'low_volatility') return 'warn';
    return 'neutral';
  }
}

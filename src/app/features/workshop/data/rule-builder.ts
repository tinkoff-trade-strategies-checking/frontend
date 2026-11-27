export type BuilderIndicator = 'rsi' | 'sma_price' | 'sma_cross';
export type BuilderComparator = 'below' | 'above';
export type BuilderAction = 'buy' | 'sell';

export interface BuilderRule {
  readonly indicator: BuilderIndicator;
  readonly comparator: BuilderComparator;
  readonly action: BuilderAction;
  /** Доля от свободных денег (покупка) или от позиции (продажа), %. */
  readonly sizePct: number;
  /** Период RSI или SMA. */
  readonly period: number;
  /** Уровень RSI. */
  readonly level: number;
  readonly fastPeriod: number;
  readonly slowPeriod: number;
}

export const MAX_BUILDER_RULES = 4;

export const BUILDER_INDICATOR_LABELS: Readonly<Record<BuilderIndicator, string>> = {
  rsi: 'RSI',
  sma_price: 'Цена и скользящая средняя',
  sma_cross: 'Пересечение двух скользящих средних',
};

export const BUILDER_ACTION_LABELS: Readonly<Record<BuilderAction, string>> = {
  buy: 'Купить',
  sell: 'Продать',
};

export function comparatorLabel(
  indicator: BuilderIndicator,
  comparator: BuilderComparator,
): string {
  if (indicator === 'sma_cross') {
    return comparator === 'above'
      ? 'быстрая пересекает медленную снизу вверх'
      : 'быстрая пересекает медленную сверху вниз';
  }
  if (indicator === 'sma_price') {
    return comparator === 'above' ? 'цена выше средней' : 'цена ниже средней';
  }
  return comparator === 'above' ? 'RSI выше уровня' : 'RSI ниже уровня';
}

export function defaultBuilderRule(action: BuilderAction = 'buy'): BuilderRule {
  return action === 'buy'
    ? {
        indicator: 'rsi',
        comparator: 'below',
        action: 'buy',
        sizePct: 50,
        period: 14,
        level: 30,
        fastPeriod: 20,
        slowPeriod: 50,
      }
    : {
        indicator: 'rsi',
        comparator: 'above',
        action: 'sell',
        sizePct: 100,
        period: 14,
        level: 70,
        fastPeriod: 20,
        slowPeriod: 50,
      };
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/**
 * Генерирует DSL: все числа выносятся в param, чтобы код проходил проверку без L001
 * (числа внутри rule, кроме 0, 1 и 100, дают предупреждение), а условие входа/выхода
 * защищено проверкой позиции (position == 0 / position > 0).
 */
export function generateDsl(rules: readonly BuilderRule[]): string {
  const params: string[] = [];
  const blocks: string[] = [];

  rules.slice(0, MAX_BUILDER_RULES).forEach((rule, index) => {
    const n = index + 1;
    const size = clampInt(rule.sizePct, 1, 100, 50);
    let condition: string;
    let because: string;

    if (rule.indicator === 'rsi') {
      const period = clampInt(rule.period, 2, 100, 14);
      const level = clampInt(rule.level, 1, 99, rule.comparator === 'below' ? 30 : 70);
      params.push(`param rsi_n_${n} = ${period}`, `param rsi_level_${n} = ${level}`);
      const op = rule.comparator === 'below' ? '<' : '>';
      condition = `rsi(close, rsi_n_${n}) ${op} rsi_level_${n}`;
      because = `RSI ${rule.comparator === 'below' ? 'ниже' : 'выше'} заданного уровня`;
    } else if (rule.indicator === 'sma_price') {
      const period = clampInt(rule.period, 2, 250, 20);
      params.push(`param sma_n_${n} = ${period}`);
      const op = rule.comparator === 'below' ? '<' : '>';
      condition = `close ${op} sma(close, sma_n_${n})`;
      because = `Цена ${rule.comparator === 'below' ? 'ниже' : 'выше'} скользящей средней`;
    } else {
      const fast = clampInt(rule.fastPeriod, 2, 250, 20);
      const slowRaw = clampInt(rule.slowPeriod, 2, 250, 50);
      const slow = slowRaw <= fast ? fast + 1 : slowRaw;
      params.push(`param fast_n_${n} = ${fast}`, `param slow_n_${n} = ${slow}`);
      const fn = rule.comparator === 'above' ? 'crossover' : 'crossunder';
      condition = `${fn}(sma(close, fast_n_${n}), sma(close, slow_n_${n}))`;
      because = `Быстрая средняя пересекла медленную ${
        rule.comparator === 'above' ? 'снизу вверх' : 'сверху вниз'
      }`;
    }

    let then: string;
    if (rule.action === 'buy') {
      params.push(`param size_pct_${n} = ${size}`);
      then = `buy size_pct_${n} % cash`;
    } else if (size >= 100) {
      then = 'sell all';
    } else {
      params.push(`param size_pct_${n} = ${size}`);
      then = `sell size_pct_${n} % position`;
    }
    const guard = rule.action === 'buy' ? 'position == 0' : 'position > 0';
    const title = `правило ${n}: ${rule.action === 'buy' ? 'купить' : 'продать'}`;

    blocks.push(
      [
        `rule "${title}"`,
        `  when ${guard} and ${condition}`,
        `  then ${then}`,
        `  because "${because}"`,
      ].join('\n'),
    );
  });

  if (blocks.length === 0) {
    return '';
  }
  return `# Стратегия из конструктора «Если → То»\n${params.join('\n')}\n\n${blocks.join('\n\n')}\n`;
}

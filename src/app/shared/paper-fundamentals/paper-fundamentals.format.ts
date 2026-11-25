import { PaperFundamentals } from '../../core/api/fundamentals.models';

export type FundamentalFormatKind =
  'marketCap' | 'multiple' | 'percent' | 'signedPercent' | 'rub' | 'ratio' | 'beta';

export type FundamentalFieldKey = keyof Omit<
  PaperFundamentals,
  'ticker' | 'reportDate' | 'availableAt' | 'periodType' | 'currency'
>;

export interface FundamentalMetricSpec {
  readonly key: FundamentalFieldKey;
  readonly label: string;
  readonly format: FundamentalFormatKind;
  readonly hint: string;
}

export interface FundamentalCategorySpec {
  readonly id: 'valuation' | 'profitability' | 'strength' | 'perShare';
  readonly title: string;
  readonly metrics: readonly FundamentalMetricSpec[];
}

export const FUNDAMENTAL_CATEGORIES: readonly FundamentalCategorySpec[] = [
  {
    id: 'valuation',
    title: 'Оценка',
    metrics: [
      {
        key: 'marketCapRub',
        label: 'Капитализация',
        format: 'marketCap',
        hint: 'Рыночная стоимость всех акций компании. Крупные «голубые фишки» обычно менее волатильны.',
      },
      {
        key: 'peRatio',
        label: 'P/E',
        format: 'multiple',
        hint: 'Цена / Прибыль: за сколько лет бизнес окупится при текущей прибыли. Чем ниже, тем дешевле оценка.',
      },
      {
        key: 'pbRatio',
        label: 'P/B',
        format: 'multiple',
        hint: 'Цена / Балансовая стоимость: сколько рынок платит за 1 ₽ собственных активов компании.',
      },
      {
        key: 'psRatio',
        label: 'P/S',
        format: 'multiple',
        hint: 'Цена / Выручка: полезен для быстрорастущих или временно убыточных компаний.',
      },
      {
        key: 'evEbitda',
        label: 'EV/EBITDA',
        format: 'multiple',
        hint: 'Стоимость бизнеса с учётом долга к операционной прибыли до амортизации. Удобен для сравнения компаний с разным долгом.',
      },
    ],
  },
  {
    id: 'profitability',
    title: 'Рентабельность и рост',
    metrics: [
      {
        key: 'roe',
        label: 'ROE',
        format: 'percent',
        hint: 'Рентабельность собственного капитала: сколько процентов прибыли приносит каждый рубль капитала акционеров.',
      },
      {
        key: 'roa',
        label: 'ROA',
        format: 'percent',
        hint: 'Рентабельность активов: насколько эффективно компания использует все свои активы (включая заёмные).',
      },
      {
        key: 'grossMargin',
        label: 'Валовая маржа',
        format: 'percent',
        hint: 'Доля выручки после вычета прямой себестоимости продукции или услуг.',
      },
      {
        key: 'operatingMargin',
        label: 'Операц. маржа',
        format: 'percent',
        hint: 'Доля операционной прибыли в выручке — показывает эффективность основного бизнеса без учёта налогов и процентов.',
      },
      {
        key: 'netMargin',
        label: 'Чистая маржа',
        format: 'percent',
        hint: 'Сколько копеек чистой прибыли остаётся компании с каждого рубля выручки.',
      },
      {
        key: 'revenueGrowthYoy',
        label: 'Рост выручки (YoY)',
        format: 'signedPercent',
        hint: 'Изменение выручки за последний год по сравнению с предыдущим годом.',
      },
      {
        key: 'epsGrowthYoy',
        label: 'Рост EPS (YoY)',
        format: 'signedPercent',
        hint: 'Изменение чистой прибыли на акцию год к году — ключевой драйвер долгосрочного роста котировок.',
      },
    ],
  },
  {
    id: 'strength',
    title: 'Устойчивость',
    metrics: [
      {
        key: 'debtToEquity',
        label: 'Долг / Капитал',
        format: 'ratio',
        hint: 'Соотношение долга к собственному капиталу (Debt/Equity). Значение ниже 1,0x обычно говорит о комфортной долговой нагрузке.',
      },
      {
        key: 'currentRatio',
        label: 'Текущая ликвидность',
        format: 'multiple',
        hint: 'Отношение оборотных активов к краткосрочным обязательствам. Значение выше 1,0x — запас на покрытие ближайших долгов.',
      },
      {
        key: 'beta',
        label: 'Бета',
        format: 'beta',
        hint: 'Чувствительность акции к движению индекса МосБиржи: 1,0 — движется с рынком, выше 1,0 — более волатильна.',
      },
      {
        key: 'freeFloat',
        label: 'Free Float',
        format: 'percent',
        hint: 'Доля акций в свободном обращении на бирже. Высокий Free Float обычно означает лучшую ликвидность.',
      },
    ],
  },
  {
    id: 'perShare',
    title: 'На акцию и дивиденды',
    metrics: [
      {
        key: 'eps',
        label: 'EPS',
        format: 'rub',
        hint: 'Чистая прибыль компании в расчёте на одну обыкновенную акцию за последние 12 месяцев.',
      },
      {
        key: 'bookValuePerShare',
        label: 'Бал. стоимость / акцию',
        format: 'rub',
        hint: 'Собственный капитал компании на одну акцию (BVPS) — ориентир стоимости чистых активов.',
      },
      {
        key: 'dividendYield',
        label: 'Див. доходность',
        format: 'percent',
        hint: 'Годовые дивиденды в процентах от текущей цены акции.',
      },
      {
        key: 'payoutRatio',
        label: 'Payout Ratio',
        format: 'percent',
        hint: 'Какую долю чистой прибыли компания направляет на выплату дивидендов.',
      },
    ],
  },
];

const DASH = '—';

function isValidNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatRuNumber(value: number, minFrac: number, maxFrac: number): string {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac,
  });
}

export function formatMarketCapRub(value: number | null | undefined): string {
  if (!isValidNumber(value)) {
    return DASH;
  }
  const abs = Math.abs(value);
  if (abs >= 1e12) {
    return `${formatRuNumber(value / 1e12, 2, 2)} трлн ₽`;
  }
  if (abs >= 1e9) {
    return `${formatRuNumber(value / 1e9, 1, 1)} млрд ₽`;
  }
  if (abs >= 1e6) {
    return `${formatRuNumber(value / 1e6, 1, 1)} млн ₽`;
  }
  return `${formatRuNumber(value, 0, 0)} ₽`;
}

export function formatMultiple(value: number | null | undefined): string {
  if (!isValidNumber(value)) {
    return DASH;
  }
  return `${formatRuNumber(value, 2, 2)}x`;
}

export function formatPercent(value: number | null | undefined, signed = false): string {
  if (!isValidNumber(value)) {
    return DASH;
  }
  const sign = signed && value > 0 ? '+' : '';
  return `${sign}${formatRuNumber(value, 1, 1)}%`;
}

export function formatRubPerShare(value: number | null | undefined): string {
  if (!isValidNumber(value)) {
    return DASH;
  }
  const decimals = Math.abs(value) >= 1000 ? 0 : 2;
  return `${formatRuNumber(value, decimals, decimals)} ₽`;
}

export function formatBeta(value: number | null | undefined): string {
  if (!isValidNumber(value)) {
    return DASH;
  }
  return formatRuNumber(value, 2, 2);
}

export function formatReportDate(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return DASH;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) {
    return isoDate;
  }
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function formatFundamentalValue(
  value: number | null | undefined,
  kind: FundamentalFormatKind,
): string {
  switch (kind) {
    case 'marketCap':
      return formatMarketCapRub(value);
    case 'multiple':
    case 'ratio':
      return formatMultiple(value);
    case 'percent':
      return formatPercent(value, false);
    case 'signedPercent':
      return formatPercent(value, true);
    case 'rub':
      return formatRubPerShare(value);
    case 'beta':
      return formatBeta(value);
  }
}

export function fundamentalValueTone(
  value: number | null | undefined,
  kind: FundamentalFormatKind,
): 'positive' | 'negative' | 'neutral' {
  if (!isValidNumber(value) || kind !== 'signedPercent') {
    return 'neutral';
  }
  if (value > 0) {
    return 'positive';
  }
  if (value < 0) {
    return 'negative';
  }
  return 'neutral';
}

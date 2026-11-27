const RUB_FORMATTER = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PCT_FORMATTER = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DURATION_FORMATTER = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

const NUMBER_FORMATTER = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

const GREEK_FORMATTER = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const RATIO_FORMATTER = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COMPACT_CAP_FORMATTER = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatRub(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return `${RUB_FORMATTER.format(value)} ₽`;
}

export function formatSignedRub(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${RUB_FORMATTER.format(value)} ₽`;
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return `${PCT_FORMATTER.format(value)} %`;
}

export function formatSignedPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${PCT_FORMATTER.format(value)} %`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return NUMBER_FORMATTER.format(value);
}

export function formatGreek(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return GREEK_FORMATTER.format(value);
}

export function formatLeverage(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return `${DURATION_FORMATTER.format(value)}×`;
}

export function formatDurationYears(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return `${DURATION_FORMATTER.format(value)} г.`;
}

export function formatDateRu(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return '—';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) {
    return isoDate;
  }
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function formatRatio(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return RATIO_FORMATTER.format(value);
}

export function formatMarketCapRub(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return '—';
  }
  if (value >= 1e12) {
    return `${COMPACT_CAP_FORMATTER.format(value / 1e12)} трлн ₽`;
  }
  if (value >= 1e9) {
    return `${COMPACT_CAP_FORMATTER.format(value / 1e9)} млрд ₽`;
  }
  if (value >= 1e6) {
    return `${COMPACT_CAP_FORMATTER.format(value / 1e6)} млн ₽`;
  }
  return `${RUB_FORMATTER.format(value)} ₽`;
}

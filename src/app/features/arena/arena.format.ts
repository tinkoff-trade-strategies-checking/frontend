export function formatPrice(value: number): string {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPct(value: number, signed = false): string {
  const formatted = Math.abs(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (signed) {
    if (value > 0) {
      return `+${formatted} %`;
    }
    if (value < 0) {
      return `−${formatted} %`;
    }
    return `${formatted} %`;
  }
  return `${value < 0 ? '−' : ''}${formatted} %`;
}

export function formatLots(lots: number): string {
  return `${lots.toLocaleString('ru-RU')} лот.`;
}

export function formatBlindCandleLabel(day: number, candleInDay: number): string {
  if (day <= 0) {
    return `прогрев, свеча ${candleInDay}`;
  }
  return `день ${day}, свеча ${candleInDay}`;
}

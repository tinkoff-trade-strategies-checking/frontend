export const CATEGORY_ALL = '__all__';
export const CATEGORY_SELECTED = '__selected__';
export const CATEGORY_NO_SECTOR = '__no_sector__';
export const NO_SECTOR_LABEL = 'Без сектора';

export function normalizePaperSector(sector: string | null | undefined): string {
  const trimmed = (sector ?? '').trim();
  return !trimmed || trimmed === '—' || trimmed === '-' ? CATEGORY_NO_SECTOR : trimmed;
}

export function sectorDisplayLabel(sectorKey: string): string {
  return sectorKey === CATEGORY_NO_SECTOR ? NO_SECTOR_LABEL : sectorKey;
}

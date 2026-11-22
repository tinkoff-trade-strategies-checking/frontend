import { formatLinterSummary, formatWorkshopDateTime } from './workshop.format';

describe('workshop.format', () => {
  it('форматирует дату публикации в часовом поясе Москвы (Europe/Moscow)', () => {
    expect(formatWorkshopDateTime('2026-11-18T14:00:00+03:00')).toBe('18.11.2026 14:00');
    expect(formatWorkshopDateTime('2026-11-18T11:30:00Z')).toBe('18.11.2026 14:30');
  });

  it('форматирует сводку предупреждений линтера с дедупликацией кодов', () => {
    expect(formatLinterSummary([])).toBe('Чисто');

    expect(formatLinterSummary([{ code: 'L001', line: 10, message: 'Константа 70' }])).toBe(
      '1 пред. (L001)',
    );

    expect(
      formatLinterSummary([
        { code: 'L001', line: 5, message: 'Первая' },
        { code: 'L001', line: 9, message: 'Вторая' },
        { code: 'W-LA01', line: 2, message: 'Сравнение с уровнем' },
      ]),
    ).toBe('3 пред. (L001, W-LA01)');
  });
});

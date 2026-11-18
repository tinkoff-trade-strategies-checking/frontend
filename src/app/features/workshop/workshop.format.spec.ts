import { formatLinterSummary, formatWorkshopDateTime } from './workshop.format';

describe('workshop.format', () => {
  it('форматирует дату публикации в часовом поясе Москвы (Europe/Moscow)', () => {
    expect(formatWorkshopDateTime('2026-11-18T14:00:00+03:00')).toBe('18.11.2026 14:00');
    expect(formatWorkshopDateTime('2026-11-18T11:30:00Z')).toBe('18.11.2026 14:30');
  });

  it('форматирует сводку предупреждений линтера с дедупликацией кодов', () => {
    expect(formatLinterSummary([])).toBe('Чисто');

    expect(formatLinterSummary([{ code: 'MAGIC_CONST', line: 10, message: 'Константа 70' }])).toBe(
      '1 пред. (MAGIC_CONST)',
    );

    expect(
      formatLinterSummary([
        { code: 'MAGIC_CONST', line: 5, message: 'Первая' },
        { code: 'MAGIC_CONST', line: 9, message: 'Вторая' },
        { code: 'UNUSED_PARAM', line: 2, message: 'Не используется' },
      ]),
    ).toBe('3 пред. (MAGIC_CONST, UNUSED_PARAM)');
  });
});

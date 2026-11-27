import { DivergenceType, ReportDivergence } from './data/report.models';

export interface SessionLesson {
  readonly id: string;
  readonly type: DivergenceType;
  readonly title: string;
  readonly what: string;
  readonly advice: string;
  /** Цена ошибки приходит с сервера как есть — на клиенте деньги не считаются (INV-6). */
  readonly errorCostRub: number;
  readonly dateLabel: string;
}

const ADVICE: Readonly<Record<DivergenceType, { title: string; advice: string }>> = {
  extra: {
    title: 'Лишняя сделка',
    advice:
      'Прежде чем входить в сделку, спросите себя: какой конкретный сигнал у меня есть? Если ответа нет — лучше подождать.',
  },
  missed: {
    title: 'Упущенная возможность',
    advice:
      'Заранее запишите условия входа и выхода: так проще не пропускать сигнал и не сомневаться в момент решения.',
  },
  size: {
    title: 'Неудачный размер позиции',
    advice:
      'Определите долю капитала на одну сделку заранее (например, не больше 25 %) и придерживайтесь её.',
  },
  timing: {
    title: 'Неудачный момент',
    advice:
      'Не спешите и не опаздывайте: используйте лимитные заявки и заранее выставленные стоп-лосс и тейк-профит.',
  },
};

/** До трёх самых «дорогих» расхождений (только те, где алгоритм поступил выгоднее вас). */
export function buildTopLessons(
  divergences: readonly ReportDivergence[] | null,
  limit = 3,
): readonly SessionLesson[] {
  if (!divergences || divergences.length === 0) {
    return [];
  }
  const costly = divergences
    .filter((d) => d.errorCostRub > 0)
    .sort((a, b) => b.errorCostRub - a.errorCostRub);

  const picked: ReportDivergence[] = [];
  const seenTypes = new Set<DivergenceType>();
  for (const d of costly) {
    if (picked.length >= limit) {
      break;
    }
    if (!seenTypes.has(d.type)) {
      seenTypes.add(d.type);
      picked.push(d);
    }
  }
  for (const d of costly) {
    if (picked.length >= limit) {
      break;
    }
    if (!picked.includes(d)) {
      picked.push(d);
    }
  }

  return picked
    .sort((a, b) => b.errorCostRub - a.errorCostRub)
    .map((d) => ({
      id: d.id,
      type: d.type,
      title: ADVICE[d.type].title,
      what: `Вы: ${d.humanAction}. Алгоритм: ${d.algoAction}.${d.because ? ` Причина: ${d.because}` : ''}`,
      advice: ADVICE[d.type].advice,
      errorCostRub: d.errorCostRub,
      dateLabel: d.dateLabel,
    }));
}

import { ChangeDetectionStrategy, Component, HostListener, output, signal } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { TuiSegmented } from '@taiga-ui/kit';

export type GlossaryTab = 'chart' | 'orders' | 'report';

interface GlossaryItem {
  readonly term: string;
  readonly meaning: string;
}

const GLOSSARY_TABS: readonly { readonly id: GlossaryTab; readonly label: string }[] = [
  { id: 'chart', label: 'График' },
  { id: 'orders', label: 'Заявки' },
  { id: 'report', label: 'Отчёт' },
];

const GLOSSARY_CONTENT: Readonly<Record<GlossaryTab, readonly GlossaryItem[]>> = {
  chart: [
    {
      term: 'Свеча',
      meaning:
        'Один шаг времени на графике (например, один торговый день). Зелёная свеча — цена выросла за этот период, красная — упала. Тонкие «хвосты» сверху и снизу показывают максимум и минимум цены.',
    },
    {
      term: 'Шаг свечей (таймфрейм)',
      meaning:
        'Сколько реального времени помещается в одну свечу. Чем крупнее шаг (например, 1 день), тем спокойнее и нагляднее общая картина.',
    },
    {
      term: 'Слепой режим',
      meaning:
        'Названия компаний и даты скрыты до конца тренировки, а стартовая цена приведена к 100. Так вы учитесь смотреть на само движение графика, не подглядывая в известную историю.',
    },
    {
      term: 'Цена открытия следующей свечи',
      meaning:
        'Ваша заявка не может сработать «задним числом» по уже прошедшей цене — она исполняется на следующем шаге, как на настоящей бирже.',
    },
  ],
  orders: [
    {
      term: 'Рыночная заявка',
      meaning:
        'Купить или продать сразу на следующем шаге по текущей цене рынка. Самый простой способ совершить сделку.',
    },
    {
      term: 'Лимитная заявка',
      meaning:
        'Заявка с указанием желаемой цены: «купить не дороже» или «продать не дешевле». Сработает, только если цена дойдёт до вашего уровня.',
    },
    {
      term: 'Стоп-заявка (защита от убытка)',
      meaning:
        'Автоматическая продажа, если цена пошла против вас и опустилась до выбранного порога. Помогает ограничить потери.',
    },
    {
      term: 'Комиссия и спред',
      meaning:
        'Небольшая плата за сделку и разница между ценой покупки и продажи. В тренажёре они учитываются автоматически, чтобы результат был честным.',
    },
  ],
  report: [
    {
      term: 'Итог чистыми',
      meaning:
        'На сколько процентов вырос или уменьшился ваш виртуальный счёт за тренировку уже после вычета всех комиссий.',
    },
    {
      term: 'Сравнение с рынком',
      meaning:
        'Показывает, удалось ли обогнать средний результат российского рынка за тот же отрезок времени или проще было просто держать индекс.',
    },
    {
      term: 'Максимальная просадка',
      meaning:
        'Самое глубокое падение вашего счёта от его лучшего результата за время тренировки. Чем она меньше, тем спокойнее вела себя стратегия.',
    },
    {
      term: 'Воспроизведение',
      meaning:
        'Режим просмотра завершённой сессии шаг за шагом, чтобы спокойно разобрать свои решения и увидеть, что произошло дальше.',
    },
  ],
};

@Component({
  selector: 'app-beginner-glossary',
  imports: [TuiButton, TuiSegmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './beginner-glossary.html',
  styleUrl: './beginner-glossary.less',
})
export class BeginnerGlossary {
  readonly closed = output<void>();

  protected readonly tabs = GLOSSARY_TABS;
  protected readonly activeTab = signal<GlossaryTab>('chart');

  protected activeTabIndex(): number {
    return Math.max(
      0,
      this.tabs.findIndex((tab) => tab.id === this.activeTab()),
    );
  }

  protected onTabIndexChange(index: number): void {
    const next = this.tabs[index];
    if (next) {
      this.activeTab.set(next.id);
    }
  }

  protected itemsForActiveTab(): readonly GlossaryItem[] {
    return GLOSSARY_CONTENT[this.activeTab()];
  }

  protected close(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }
}

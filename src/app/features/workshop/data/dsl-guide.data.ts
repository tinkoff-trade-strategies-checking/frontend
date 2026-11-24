export type DslGuideTabId = 'start' | 'syntax' | 'reference' | 'examples' | 'errors';

export interface DslGuideTab {
  readonly id: DslGuideTabId;
  readonly label: string;
}

export interface DslGuideBreakdownItem {
  readonly token: string;
  readonly summary: string;
}

export interface DslGuideRow {
  readonly name: string;
  readonly detail: string;
  readonly note?: string;
}

export interface DslGuideFunctionItem {
  readonly signature: string;
  readonly returns: string;
  readonly description: string;
}

export interface DslGuideExample {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly highlights: readonly string[];
  readonly code: string;
}

export interface DslGuideMistake {
  readonly code: string;
  readonly level: 'ERROR' | 'WARNING';
  readonly title: string;
  readonly wrong: string;
  readonly right: string;
  readonly explanation: string;
}

export interface DslGuideDiagnostic {
  readonly code: string;
  readonly level: 'ERROR' | 'WARNING';
  readonly blocksPublish: boolean;
  readonly description: string;
}

export const DSL_GUIDE_TABS: readonly DslGuideTab[] = [
  { id: 'start', label: 'Быстрый старт' },
  { id: 'syntax', label: 'Синтаксис' },
  { id: 'reference', label: 'Индикаторы и данные' },
  { id: 'examples', label: 'Примеры стратегий' },
  { id: 'errors', label: 'Частые ошибки' },
];

export const DSL_QUICKSTART_CODE = `# Простая стратегия на пересечении скользящих средних
param fast = 20 range 5..50 step 5
param slow = 50 range 20..200 step 10
param size_pct = 95 range 10..100 step 5

rule "вход"
  when crossover(sma(close, fast), sma(close, slow)) and position == 0
  then buy size_pct % cash
  because "SMA({fast}) пересекла SMA({slow}) снизу вверх"

rule "выход"
  when position > 0 and crossunder(sma(close, fast), sma(close, slow))
  then sell all
  because "SMA({fast}) опустилась ниже SMA({slow})"`;

export const DSL_QUICKSTART_BREAKDOWN: readonly DslGuideBreakdownItem[] = [
  {
    token: '# комментарий',
    summary: 'Всё от символа # до конца строки игнорируется и помогает документировать идею.',
  },
  {
    token: 'param fast = 20 range 5..50 step 5',
    summary:
      'Объявление настраиваемого параметра. Значение по умолчанию обязательно, а range и step можно опустить.',
  },
  {
    token: 'rule "вход"',
    summary:
      'Начало торгового правила. Имя всегда пишется в двойных кавычках, должно быть непустым и уникальным.',
  },
  {
    token: 'when ...',
    summary:
      'Логическое условие (bool), которое проверяется на закрытии каждой свечи. Если оно истинно — срабатывает действие.',
  },
  {
    token: 'then buy size_pct % cash',
    summary:
      'Действие: покупка, продажа или отмена заявок (cancel). Точка с запятой в конце строки не ставится.',
  },
  {
    token: 'because "SMA({fast})..."',
    summary:
      'Обязательное объяснение решения для отчёта и разбора расхождений. Внутри {…} можно подставлять любые выражения.',
  },
];

export const DSL_EXECUTION_RULES: readonly string[] = [
  'Стратегия описывает правила для одной бумаги. В прогоне по нескольким бумагам правила выполняются для каждой отдельно, а свободные деньги (cash) общие.',
  'Условия проверяются на закрытии каждого бара t, а созданные заявки исполняются не раньше открытия (open) следующего бара t + 1 — заглянуть в будущее нельзя.',
  'На барах прогрева (по умолчанию 200 баров до старта) индикаторы накапливают историю, но правила ещё не срабатывают и заявки не создаются.',
  'Правила проверяются сверху вниз в порядке текста. Все видят одно состояние портфеля на закрытии бара t; у одного правила может быть не более одной активной заявки на бумагу.',
  'Когда позиция по бумаге становится равной 0, система автоматически снимает все активные заявки на продажу по этой бумаге.',
];

export const DSL_ACTION_ROWS: readonly DslGuideRow[] = [
  {
    name: 'buy N lots / sell N lots',
    detail: 'Купить или продать floor(N) лотов.',
    note: 'Если расчётное количество меньше 1 лота, заявка не создаётся.',
  },
  {
    name: 'buy X % cash / buy X % equity',
    detail: 'Покупка на X % от свободных денег или от стоимости портфеля.',
    note: 'sell X % cash и sell X % equity запрещены (E-TYPE).',
  },
  {
    name: 'buy X % position / sell X % position',
    detail: 'Докупить или продать X % от текущей позиции по бумаге.',
  },
  {
    name: 'sell all',
    detail: 'Продать всю текущую позицию по бумаге.',
    note: 'buy all запрещено (E-TYPE).',
  },
  {
    name: 'market (по умолчанию)',
    detail: 'Рыночная заявка — исполняется по open следующего бара.',
  },
  {
    name: 'limit P / stop P / take_profit P',
    detail: 'Лимитная, стоп-заявка или тейк-профит по расчётной цене P.',
    note: 'take_profit разрешён только для sell (buy ... take_profit → E-TYPE).',
  },
  {
    name: 'gtc (по умолчанию) / day',
    detail: 'Срок действия заявки: до отмены (gtc) или до конца торгового дня (day).',
  },
  {
    name: 'cancel',
    detail: 'Снять все активные заявки стратегии по текущей бумаге.',
    note: 'Если активных заявок нет, cancel просто ничего не делает.',
  },
];

export const DSL_OPERATOR_ROWS: readonly DslGuideRow[] = [
  {
    name: '(expr), f(...), x[k]',
    detail: 'Приоритет 1 — скобки, вызов функции, смещение на k баров назад.',
    note: 'Двойная индексация x[1][2] запрещена.',
  },
  {
    name: '-x',
    detail: 'Приоритет 2 — унарный минус.',
    note: '--x запрещено, пишите -(-x).',
  },
  {
    name: '*, /',
    detail: 'Приоритет 3 — умножение и деление (слева направо).',
    note: 'Деление на 0 даёт na.',
  },
  {
    name: '+, -',
    detail: 'Приоритет 4 — сложение и вычитание (слева направо).',
  },
  {
    name: '<, <=, >, >=, ==, !=',
    detail: 'Приоритет 5 — сравнения (возвращают bool).',
    note: 'Цепочки a < b < c запрещены — используйте and. Любое сравнение с na даёт false.',
  },
  {
    name: 'not',
    detail: 'Приоритет 6 — логическое отрицание (только для bool).',
    note: 'not not x запрещено — пишите not (not x).',
  },
  {
    name: 'and',
    detail: 'Приоритет 7 — логическое «И» (оба операнда bool).',
  },
  {
    name: 'or',
    detail: 'Приоритет 8 — логическое «ИЛИ» (оба операнда bool).',
  },
];

export const DSL_LIMIT_ROWS: readonly DslGuideRow[] = [
  { name: 'Идентификаторы', detail: 'Латиница в нижнем регистре, цифры и _: [a-z_][a-z0-9_]*.' },
  { name: 'Размер и структура', detail: 'До 64 КиБ, до 50 параметров, до 100 правил.' },
  {
    name: 'Сложность выражений',
    detail: 'Высота дерева ≤ 100, до 2000 узлов AST, до 256 уникальных индикаторов.',
  },
  { name: 'Период и смещение', detail: 'Период n: 1..5000, смещение [k]: 0..5000 баров.' },
  {
    name: 'Чего нет намеренно',
    detail: 'Дат и времени, новостей, случайных чисел, обращений к другим бумагам.',
  },
];

export const DSL_SERIES_ROWS: readonly DslGuideRow[] = [
  { name: 'open, high, low, close', detail: 'Цены открытия, максимума, минимума и закрытия бара.' },
  { name: 'volume', detail: 'Объём торгов бара в лотах.' },
  {
    name: 'x[k]',
    detail: 'Значение ряда или индикатора k баров назад (x[0] = x, k от 0 до 5000).',
    note: 'Отрицательное смещение x[-1] запрещено (E-LA01).',
  },
];

export const DSL_PORTFOLIO_ROWS: readonly DslGuideRow[] = [
  { name: 'position', detail: 'Текущая позиция по бумаге в лотах (≥ 0).' },
  {
    name: 'entry_price',
    detail: 'Средневзвешенная цена покупки текущей позиции; na, если позиции нет.',
  },
  { name: 'cash', detail: 'Свободные деньги портфеля, ₽.' },
  { name: 'equity', detail: 'Общая стоимость портфеля по ценам close, ₽.' },
  {
    name: 'bars_in_position',
    detail: 'Сколько баров удерживается позиция (0 — открыта на этом баре); na, если позиции нет.',
  },
];

export const DSL_STATEFUL_FUNCTIONS: readonly DslGuideFunctionItem[] = [
  {
    signature: 'sma(x, n)',
    returns: 'number',
    description: 'Простое скользящее среднее последних n валидных значений x.',
  },
  {
    signature: 'ema(x, n)',
    returns: 'number',
    description: 'Экспоненциальное скользящее среднее с коэффициентом α = 2 / (n + 1).',
  },
  {
    signature: 'rsi(x, n)',
    returns: 'number',
    description: 'Индекс относительной силы по Уайлдеру (0..100). Требует n + 1 валидных баров.',
  },
  {
    signature: 'atr(n)',
    returns: 'number',
    description: 'Средний истинный диапазон (волатильность) по Уайлдеру за период n.',
  },
  {
    signature: 'stdev(x, n)',
    returns: 'number',
    description: 'Стандартное отклонение последних n валидных значений x.',
  },
  {
    signature: 'highest(x, n)',
    returns: 'number',
    description: 'Максимум среди последних n валидных значений x (включая текущий бар).',
  },
  {
    signature: 'lowest(x, n)',
    returns: 'number',
    description: 'Минимум среди последних n валидных значений x (включая текущий бар).',
  },
];

export const DSL_CROSSBAR_FUNCTIONS: readonly DslGuideFunctionItem[] = [
  {
    signature: 'change(x, n)',
    returns: 'number',
    description: 'Изменение x за n баров (x − x[n]). Допускает смещение [k].',
  },
  {
    signature: 'crossover(a, b)',
    returns: 'bool',
    description: 'Истина, если a пересекло b снизу вверх: a[1] <= b[1] и a > b.',
  },
  {
    signature: 'crossunder(a, b)',
    returns: 'bool',
    description: 'Истина, если a пересекло b сверху вниз: a[1] >= b[1] и a < b.',
  },
];

export const DSL_STATELESS_FUNCTIONS: readonly DslGuideFunctionItem[] = [
  {
    signature: 'abs(x)',
    returns: 'number',
    description: 'Модуль числа x.',
  },
  {
    signature: 'min(a, b)',
    returns: 'number',
    description: 'Меньшее из двух чисел (если любой аргумент na → na).',
  },
  {
    signature: 'max(a, b)',
    returns: 'number',
    description: 'Большее из двух чисел (если любой аргумент na → na).',
  },
  {
    signature: 'sqrt(x)',
    returns: 'number',
    description: 'Квадратный корень (для x < 0 возвращает na).',
  },
  {
    signature: 'is_na(x)',
    returns: 'bool',
    description: 'Возвращает true, если x не определено (na), иначе false.',
  },
];

export const DSL_GUIDE_EXAMPLES: readonly DslGuideExample[] = [
  {
    id: 'platform-baseline',
    title: 'Эталон платформы: SMA + RSI + защитный стоп',
    summary:
      'Классическая трендовая стратегия из спецификации: вход по пересечению скользящих, стоп-лосс в процентах от цены входа, фиксация по перекупленности RSI и выход по обратному пересечению.',
    highlights: ['crossover / crossunder', 'stop от entry_price', 'rsi', 'без L001'],
    code: `# Эталон платформы: пересечение скользящих средних
param fast = 20 range 5..50 step 5
param slow = 50 range 20..200 step 10
param rsi_n = 14
param rsi_high = 70 range 60..85 step 5
param stop_pct = 5 range 2..10 step 1
param size_pct = 95

rule "вход"
  when crossover(sma(close, fast), sma(close, slow)) and position == 0
  then buy size_pct % cash
  because "SMA({fast}) пересекла SMA({slow}) снизу вверх"

rule "стоп"
  when position > 0
  then sell all stop entry_price * (1 - stop_pct / 100)
  because "защитный стоп {stop_pct}% от цены входа {entry_price}"

rule "перекупленность"
  when position > 0 and rsi(close, rsi_n) > rsi_high
  then sell all
  because "перекупленность, RSI = {rsi(close, rsi_n)}"

rule "выход"
  when position > 0 and crossunder(sma(close, fast), sma(close, slow))
  then sell all
  because "SMA({fast}) опустилась ниже SMA({slow})"`,
  },
  {
    id: 'rsi-mean-reversion',
    title: 'Возврат к среднему по RSI с тейк-профитом и лимитом удержания',
    summary:
      'Покупает на локальной перепроданности RSI, сразу выставляет тейк-профит и закрывает позицию по рынку, если цена не отскочила за max_bars свечей.',
    highlights: ['rsi', 'take_profit', 'bars_in_position', 'day'],
    code: `# Возврат к среднему по RSI
param rsi_n = 14 range 5..30 step 1
param rsi_low = 30 range 15..40 step 5
param tp_pct = 4 range 2..12 step 1
param max_bars = 15 range 5..40 step 5
param size_pct = 50 range 10..100 step 10

rule "вход по перепроданности"
  when position == 0 and rsi(close, rsi_n) < rsi_low
  then buy size_pct % cash market day
  because "RSI({rsi_n}) = {rsi(close, rsi_n)} ниже {rsi_low}"

rule "тейк-профит"
  when position > 0
  then sell all take_profit entry_price * (1 + tp_pct / 100)
  because "фиксация прибыли +{tp_pct}% от {entry_price}"

rule "выход по времени"
  when position > 0 and bars_in_position >= max_bars
  then sell all
  because "позиция удерживается {bars_in_position} баров"`,
  },
  {
    id: 'donchian-atr',
    title: 'Пробой канала Дончиана со стопом по ATR',
    summary:
      'Входит при пробое максимума прошлых channel_n баров (со смещением [1], чтобы не сравнивать цену с текущим high) и защищает сделку стопом по волатильности ATR.',
    highlights: ['highest / lowest', 'смещение [1]', 'atr', 'not is_na'],
    code: `# Пробой канала Дончиана с защитой по ATR
param channel_n = 20 range 10..60 step 5
param exit_n = 10 range 5..30 step 5
param atr_n = 14 range 5..30 step 1
param atr_mult = 2 range 1..4 step 0.5
param size_pct = 80 range 10..100 step 10

rule "пробой вверх"
  when position == 0 and not is_na(highest(high, channel_n)[1]) and close > highest(high, channel_n)[1]
  then buy size_pct % cash
  because "пробой максимума {channel_n} баров: close={close}"

rule "стоп по ATR"
  when position > 0 and not is_na(atr(atr_n))
  then sell all stop entry_price - atr_mult * atr(atr_n)
  because "стоп по волатильности: ATR({atr_n})={atr(atr_n)}"

rule "выход по каналу"
  when position > 0 and close < lowest(low, exit_n)[1]
  then sell all
  because "пробой минимума {exit_n} баров вниз"`,
  },
];

export const DSL_COMMON_MISTAKES: readonly DslGuideMistake[] = [
  {
    code: 'E-SYN',
    level: 'ERROR',
    title: 'Точка с запятой, имя правила без кавычек или пропуск then',
    wrong: `param fast = 20;
rule enter when close > sma(close, fast)
  buy 50% market because "Вход";`,
    right: `param fast = 20
param size_pct = 50

rule "вход"
  when close > sma(close, fast)
  then buy size_pct % cash
  because "Цена выше SMA({fast})"`,
    explanation:
      'В DSL нет точек с запятой, имя правила обязательно в двойных кавычках, перед действием нужно ключевое слово then, а после % указывается база: cash, equity или position.',
  },
  {
    code: 'E-BEC',
    level: 'ERROR',
    title: 'Отсутствует или пустая секция because',
    wrong: `rule "выход"
  when position > 0 and close < sma(close, slow)
  then sell all`,
    right: `rule "выход"
  when position > 0 and close < sma(close, slow)
  then sell all
  because "Цена опустилась ниже SMA({slow})"`,
    explanation:
      'Каждое правило обязано объяснять своё действие непустой строкой because — она попадает в отчёт и разбор расхождений.',
  },
  {
    code: 'E-LA01',
    level: 'ERROR',
    title: 'Отрицательное смещение — попытка заглянуть в будущее',
    wrong: `rule "инсайд"
  when close[-1] > close
  then buy 10 lots
  because "завтра вырастет"`,
    right: `rule "рост к прошлому бару"
  when close > close[1]
  then buy lots_n lots
  because "текущий close выше предыдущего"`,
    explanation:
      'Смещение x[k] читает k баров НАЗАД. Отрицательное смещение x[-1] (или параметр с отрицательным range — E-LA02) блокирует публикацию и прогон.',
  },
  {
    code: 'E-TYPE',
    level: 'ERROR',
    title: 'Запрещённая комбинация действия или портфель внутри индикатора',
    wrong: `rule "ошибка"
  when position == 0 and sma(equity, slow) > 0
  then buy all take_profit close * 1.05
  because "тест"`,
    right: `rule "вход"
  when position == 0 and close > sma(close, slow)
  then buy size_pct % cash
  because "тренд вверх"`,
    explanation:
      'buy all, sell X % cash/equity и buy ... take_profit запрещены. Переменные портфеля (position, entry_price, cash, equity, bars_in_position) нельзя передавать в индикаторы и индексировать через [k].',
  },
  {
    code: 'L001',
    level: 'WARNING',
    title: 'Магические числа внутри правил',
    wrong: `rule "перекупленность"
  when position > 0 and rsi(close, 14) > 70
  then sell all
  because "RSI выше 70"`,
    right: `param rsi_n = 14
param rsi_high = 70 range 60..85 step 5

rule "перекупленность"
  when position > 0 and rsi(close, rsi_n) > rsi_high
  then sell all
  because "RSI = {rsi(close, rsi_n)} выше {rsi_high}"`,
    explanation:
      'Любые числа внутри rule (кроме 0, 1 и 100) дают предупреждение L001. Выносите их в param — редактор умеет делать это автоматически кнопкой «Исправить».',
  },
  {
    code: 'W-LA01',
    level: 'WARNING',
    title: 'Сравнение цены с абсолютным уровнем',
    wrong: `param target = 270
rule "уровень"
  when close > target
  then buy size_pct % cash
  because "пробили 270"`,
    right: `param channel_n = 20
rule "пробой"
  when close > highest(high, channel_n)[1]
  then buy size_pct % cash
  because "пробили максимум {channel_n} баров"`,
    explanation:
      'Жёсткие ценовые уровни часто оказываются подгонкой под историю конкретной бумаги. Используйте скользящие средние, каналы или entry_price.',
  },
];

export const DSL_DIAGNOSTICS_TABLE: readonly DslGuideDiagnostic[] = [
  {
    code: 'E-SYN',
    level: 'ERROR',
    blocksPublish: true,
    description: 'Ошибка синтаксиса, кавычек, подстановки {…} в because или превышение лимитов.',
  },
  {
    code: 'E-TYPE',
    level: 'ERROR',
    blocksPublish: true,
    description:
      'Неверный тип, неизвестное имя, нецелый период, запрещённое действие или портфель в индикаторе.',
  },
  {
    code: 'E-BEC',
    level: 'ERROR',
    blocksPublish: true,
    description: 'У правила отсутствует секция because или её строка пустая.',
  },
  {
    code: 'E-LA01',
    level: 'ERROR',
    blocksPublish: true,
    description: 'Чтение будущего: отрицательное смещение x[-k].',
  },
  {
    code: 'E-LA02',
    level: 'ERROR',
    blocksPublish: true,
    description:
      'Чтение будущего: диапазон range параметра в смещении допускает отрицательные числа.',
  },
  {
    code: 'W-LA01',
    level: 'WARNING',
    blocksPublish: false,
    description: 'Предупреждение: цена или ценовой индикатор сравнивается с абсолютным числом.',
  },
  {
    code: 'L001',
    level: 'WARNING',
    blocksPublish: false,
    description: 'Линтер: магическая константа в правиле (кроме 0, 1, 100); есть автоисправление.',
  },
];

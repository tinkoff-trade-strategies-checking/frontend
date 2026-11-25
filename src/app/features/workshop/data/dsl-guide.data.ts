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
  {
    signature: 'wma(x, n)',
    returns: 'number',
    description: 'Линейно взвешенная скользящая средняя (веса 1..n).',
  },
  {
    signature: 'bb_mid(x, n)',
    returns: 'number',
    description: 'Средняя линия полос Боллинджера (эквивалент sma(x, n)).',
  },
  {
    signature: 'bb_upper(x, n, k)',
    returns: 'number',
    description: 'Верхняя граница полос Боллинджера: sma(x, n) + k * stdev(x, n).',
  },
  {
    signature: 'bb_lower(x, n, k)',
    returns: 'number',
    description: 'Нижняя граница полос Боллинджера: sma(x, n) - k * stdev(x, n).',
  },
  {
    signature: 'vwap(n)',
    returns: 'number',
    description:
      'Скользящая средневзвешенная по объёму цена за n баров: Σ(tp * volume) / Σ(volume).',
  },
  {
    signature: 'macd(x, fast, slow)',
    returns: 'number',
    description: 'Линия MACD: ema(x, fast) - ema(x, slow) (классически 12 и 26).',
  },
  {
    signature: 'macd_signal(x, fast, slow, sig)',
    returns: 'number',
    description: 'Сигнальная линия MACD: ema(macd(x, fast, slow), sig) (классически sig = 9).',
  },
  {
    signature: 'macd_hist(x, fast, slow, sig)',
    returns: 'number',
    description: 'Гистограмма MACD: macd - macd_signal.',
  },
  {
    signature: 'stoch_k(n)',
    returns: 'number',
    description: 'Стохастический осциллятор %K(n) в диапазоне 0..100.',
  },
  {
    signature: 'stoch_d(n, d)',
    returns: 'number',
    description: 'Сигнальная линия стохастика %D(n, d): sma(stoch_k(n), d).',
  },
  {
    signature: 'stoch_rsi(n)',
    returns: 'number',
    description:
      'Стохастический RSI (0..100) — положение rsi(close, n) в диапазоне последних n баров.',
  },
  {
    signature: 'adx(n)',
    returns: 'number',
    description: 'Индекс направленного движения ADX по Уайлдеру (0..100).',
  },
  {
    signature: 'plus_di(n)',
    returns: 'number',
    description: 'Положительный направленный индикатор +DI(n) (0..100).',
  },
  {
    signature: 'minus_di(n)',
    returns: 'number',
    description: 'Отрицательный направленный индикатор −DI(n) (0..100).',
  },
  {
    signature: 'cci(n)',
    returns: 'number',
    description: 'Индекс товарного канала CCI: (tp - sma(tp, n)) / (0.015 * mad).',
  },
  {
    signature: 'willr(n)',
    returns: 'number',
    description: 'Индикатор Williams %R(n) в диапазоне −100..0.',
  },
  {
    signature: 'roc(x, n)',
    returns: 'number',
    description: 'Скорость изменения Rate of Change в процентах: 100 * (x - x[n]) / x[n].',
  },
  {
    signature: 'ult_osc(s1, s2, s3)',
    returns: 'number',
    description: 'Ultimate Oscillator (0..100), классические периоды: ult_osc(7, 14, 28).',
  },
  {
    signature: 'bull_power(n)',
    returns: 'number',
    description: 'Сила быков Элдера (Elder-Ray Bull Power): high - ema(close, n).',
  },
  {
    signature: 'bear_power(n)',
    returns: 'number',
    description: 'Сила медведей Элдера (Elder-Ray Bear Power): low - ema(close, n).',
  },
  {
    signature: 'obv()',
    returns: 'number',
    description:
      'Балансовый объём (On-Balance Volume) — накопленная сумма объёмов по направлению цены.',
  },
  {
    signature: 'mfi(n)',
    returns: 'number',
    description: 'Индекс денежного потока Money Flow Index (0..100) за n баров.',
  },
];

export const DSL_LEVEL_TREND_FUNCTIONS: readonly DslGuideFunctionItem[] = [
  {
    signature: 'pivot(n)',
    returns: 'number',
    description:
      'Классический уровень разворота (H + L + C) / 3 по завершённому окну из n предыдущих баров без заглядывания в будущее (прогрев n + 1 бар).',
  },
  {
    signature: 'pivot_r1(n)',
    returns: 'number',
    description: 'Первое сопротивление Pivot Points: 2 * P − L по завершённому окну из n баров.',
  },
  {
    signature: 'pivot_r2(n)',
    returns: 'number',
    description: 'Второе сопротивление Pivot Points: P + (H − L) по завершённому окну из n баров.',
  },
  {
    signature: 'pivot_s1(n)',
    returns: 'number',
    description: 'Первая поддержка Pivot Points: 2 * P − H по завершённому окну из n баров.',
  },
  {
    signature: 'pivot_s2(n)',
    returns: 'number',
    description: 'Вторая поддержка Pivot Points: P − (H − L) по завершённому окну из n баров.',
  },
  {
    signature: 'supertrend(n, k)',
    returns: 'number',
    description:
      'Линия SuperTrend на базе atr(n) и множителя k (прогрев n баров): в восходящем тренде идёт ниже цены как поддержка, в нисходящем — выше как сопротивление.',
  },
  {
    signature: 'keltner_upper(n, k)',
    returns: 'number',
    description: 'Верхняя граница канала Кельтнера: ema(close, n) + k * atr(n) (прогрев n баров).',
  },
  {
    signature: 'keltner_lower(n, k)',
    returns: 'number',
    description: 'Нижняя граница канала Кельтнера: ema(close, n) − k * atr(n) (прогрев n баров).',
  },
  {
    signature: 'linreg(x, n)',
    returns: 'number',
    description: 'Значение линейной регрессии (линии тренда) ряда x на текущем баре за n баров.',
  },
  {
    signature: 'slope(x, n)',
    returns: 'number',
    description:
      'Наклон линейной регрессии ряда x за n баров (приращение за 1 бар): > 0 — рост, < 0 — снижение.',
  },
];

export const DSL_CANDLE_PATTERN_FUNCTIONS: readonly DslGuideFunctionItem[] = [
  {
    signature: 'is_doji()',
    returns: 'bool',
    description:
      'Свеча Доджи: узкое тело (abs(close − open) <= 0.1 * (high − low) при high > low) — признак нерешительности рынка.',
  },
  {
    signature: 'is_hammer()',
    returns: 'bool',
    description:
      'Молот: длинная нижняя тень (>= 2 * тело) и короткая верхняя (<= 0.5 * тело) при high > low — возможный разворот вверх.',
  },
  {
    signature: 'is_shooting_star()',
    returns: 'bool',
    description:
      'Падающая звезда: длинная верхняя тень (>= 2 * тело) и короткая нижняя (<= 0.5 * тело) при high > low — возможный разворот вниз.',
  },
  {
    signature: 'is_bullish_engulfing()',
    returns: 'bool',
    description:
      'Бычье поглощение: предыдущая свеча медвежья, текущая бычья и перекрывает её тело (open <= close[1] и close >= open[1]).',
  },
  {
    signature: 'is_bearish_engulfing()',
    returns: 'bool',
    description:
      'Медвежье поглощение: предыдущая свеча бычья, текущая медвежья и перекрывает её тело (open >= close[1] и close <= open[1]).',
  },
  {
    signature: 'is_inside_bar()',
    returns: 'bool',
    description:
      'Внутренний бар: текущая свеча целиком внутри диапазона предыдущей (high <= high[1] и low >= low[1]) — сжатие перед импульсом.',
  },
  {
    signature: 'is_pin_bar()',
    returns: 'bool',
    description:
      'Пин-бар: доминирующая тень >= 2 * тело и занимает не менее 60% всего диапазона свечи (high − low).',
  },
];

export const DSL_STRUCTURE_FUNCTIONS: readonly DslGuideFunctionItem[] = [
  {
    signature: 'swing_high(left, right)',
    returns: 'number',
    description:
      'Цена последнего подтверждённого локального максимума (поддерживает [k]): бар t − right выше left баров слева и right баров справа; подтверждается на баре t (na до первого подтверждения).',
  },
  {
    signature: 'swing_low(left, right)',
    returns: 'number',
    description:
      'Цена последнего подтверждённого локального минимума (поддерживает [k]): бар t − right ниже left баров слева и right баров справа; подтверждается на баре t (na до первого подтверждения).',
  },
  {
    signature: 'rising(x, n)',
    returns: 'bool',
    description:
      'Истина, если ряд x строго растёт последние n переходов подряд (x > x[1] > … > x[n]); без [k].',
  },
  {
    signature: 'falling(x, n)',
    returns: 'bool',
    description:
      'Истина, если ряд x строго падает последние n переходов подряд (x < x[1] < … < x[n]); без [k].',
  },
  {
    signature: 'bars_since(cond)',
    returns: 'number',
    description:
      'Число баров с последнего момента, когда условие cond было истинно (0 — сейчас, na — ещё не было); поддерживает [k], переменные портфеля внутри cond запрещены.',
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
  {
    id: 'supertrend-price-action',
    title: 'SuperTrend и свечной паттерн Price Action',
    summary:
      'Входит в лонг по восходящему тренду (цена выше SuperTrend и положительный наклон линейной регрессии) при появлении бычьего поглощения или молота; защищает сделку стопом по SuperTrend и выходит при развороте или падающей звезде.',
    highlights: ['supertrend', 'slope', 'is_bullish_engulfing / is_hammer', 'без L001'],
    code: `# Трендовый вход по SuperTrend и паттернам Price Action
param st_n = 10 range 5..30 step 1
param st_mult = 3 range 1.5..5 step 0.5
param slope_n = 14 range 5..40 step 1
param size_pct = 80 range 10..100 step 10

rule "вход по тренду и паттерну"
  when position == 0 and close > supertrend(st_n, st_mult) and slope(close, slope_n) > 0 and (is_bullish_engulfing() or is_hammer())
  then buy size_pct % cash
  because "цена выше SuperTrend({st_n}, {st_mult}), наклон > 0 и бычий паттерн"

rule "трейлинг-стоп по SuperTrend"
  when position > 0 and not is_na(supertrend(st_n, st_mult)) and supertrend(st_n, st_mult) < close
  then sell all stop supertrend(st_n, st_mult)
  because "защитный стоп по линии SuperTrend = {supertrend(st_n, st_mult)}"

rule "выход по развороту"
  when position > 0 and (close < supertrend(st_n, st_mult) or is_shooting_star())
  then sell all
  because "разворот: цена ниже SuperTrend или падающая звезда"`,
  },
  {
    id: 'pivot-swing-keltner',
    title: 'Пробой Pivot R1 с каналом Кельтнера и свингами',
    summary:
      'Покупает на пробое первого сопротивления Pivot R1 при росте линии регрессии и недавнем сжатии (внутренний бар), ставит стоп под последний подтверждённый свинг-минимум и фиксирует прибыль у верхней границы канала Кельтнера.',
    highlights: ['pivot_r1', 'swing_low', 'keltner_upper', 'bars_since / rising'],
    code: `# Пробой сопротивления Pivot R1 с подтверждением структуры графика
param piv_n = 20 range 10..60 step 5
param kc_n = 20 range 10..50 step 5
param kc_mult = 2 range 1..4 step 0.5
param sw_left = 3 range 2..10 step 1
param sw_right = 3 range 2..10 step 1
param rise_n = 3 range 2..10 step 1
param inside_max_age = 5 range 1..15 step 1
param size_pct = 75 range 10..100 step 5

rule "пробой Pivot R1"
  when position == 0 and crossover(close, pivot_r1(piv_n)) and rising(linreg(close, piv_n), rise_n) and bars_since(is_inside_bar()) <= inside_max_age
  then buy size_pct % cash
  because "пробой Pivot R1({piv_n}) = {pivot_r1(piv_n)} после сжатия"

rule "стоп под свингом"
  when position > 0 and not is_na(swing_low(sw_left, sw_right)) and swing_low(sw_left, sw_right) < close
  then sell all stop swing_low(sw_left, sw_right)
  because "стоп под подтверждённым свингом {swing_low(sw_left, sw_right)}"

rule "фиксация у канала Кельтнера"
  when position > 0 and close >= keltner_upper(kc_n, kc_mult)
  then sell all
  because "цена достигла верхней границы Кельтнера {keltner_upper(kc_n, kc_mult)}"`,
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

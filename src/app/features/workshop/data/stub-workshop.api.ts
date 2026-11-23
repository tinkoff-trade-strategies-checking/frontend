import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  CheckLevel,
  CheckStrategyResult,
  CheckWorkshopStrategyCommand,
  CreateWorkshopAlgorithmCommand,
  ForkWorkshopAlgorithmCommand,
  PublishWorkshopAlgorithmCommand,
  PublishWorkshopResult,
  SaveWorkshopDraftCommand,
  StrategyDiagnostic,
  StrategyParamDecl,
  WORKSHOP_DEFAULT_PAGE_SIZE,
  WORKSHOP_MAX_PAGE_SIZE,
  WORKSHOP_SYSTEM_AUTHOR,
  WorkshopAlgorithmDetail,
  WorkshopAlgorithmSummary,
  WorkshopAlgorithmVersion,
  WorkshopApi,
  WorkshopAuthorOption,
  WorkshopDetailResult,
  WorkshopDraft,
  WorkshopLinterWarning,
  WorkshopPage,
  WorkshopQuery,
  WorkshopSortField,
  WorkshopVisibility,
} from './workshop.models';

const AUTHOR_IDS: Readonly<Record<string, string>> = {
  [WORKSHOP_SYSTEM_AUTHOR]: 'platform',
  Вы: 'user',
  'Алексей Смирнов': 'alexey-smirnov',
  'Иван Петров': 'ivan-petrov',
  'Мария Волкова': 'maria-volkova',
  'Ольга Кузнецова': 'olga-kuznetsova',
  'Дмитрий Соколов': 'dmitry-sokolov',
};

// Канонические коды диагностик из documentation/dsl.md v1 (documentation#34, #85):
// - статические предупреждения (допускаются в каталоге): L001 (магическая константа),
//   W-LA01 (сравнение цены или прямого ценового индикатора с абсолютным уровнем);
// - статические ошибки (запрещают публикацию и прогон): E-SYN, E-TYPE, E-BEC, E-LA01, E-LA02;
// - рантайм-диагностики core (формируются при прогоне): E-RT01, W-RT01, W-RT02.
const RAW_STUB_ALGORITHMS: readonly Omit<WorkshopAlgorithmDetail, 'authorId'>[] = [
  {
    id: 'A-0001',
    name: 'Эталон платформы',
    description:
      'Эталонная стратегия пересечения SMA(fast, slow) с фильтром RSI, стопом stop_pct и прогревом 200 баров. Для N бумаг размер позиции size_pct = floor(95 / N).',
    author: WORKSHOP_SYSTEM_AUTHOR,
    isMine: false,
    isSystem: true,
    visibility: 'public',
    latestVersion: 2,
    publishedAt: '2026-11-18T14:00:00+03:00',
    license: 'MIT',
    linterWarnings: [],
    versions: [
      {
        version: 2,
        publishedAt: '2026-11-18T14:00:00+03:00',
        summary:
          'Параметры fast=20, slow=50 (20..200), rsi_n=14, rsi_high=70, stop_pct=5, size_pct=95 и прогрев 200 баров без L001.',
        immutable: true,
      },
      {
        version: 1,
        publishedAt: '2026-10-01T10:00:00+03:00',
        summary: 'Первая публикация эталона платформы.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0002',
    name: 'Momentum RSI',
    description:
      'Импульсная стратегия по индексу относительной силы с подтверждением объёма и защитой от перекупленности.',
    author: 'Вы',
    isMine: true,
    isSystem: false,
    visibility: 'public',
    latestVersion: 2,
    publishedAt: '2026-11-18T12:30:00+03:00',
    license: 'MIT',
    linterWarnings: [
      {
        code: 'L001',
        line: 14,
        message: 'Магическая константа 70 в сравнении с rsi(...) — вынесите в параметр rsi_level.',
      },
    ],
    versions: [
      {
        version: 2,
        publishedAt: '2026-11-18T12:30:00+03:00',
        summary: 'Добавлено условие выхода по обратному пересечению RSI.',
        immutable: true,
      },
      {
        version: 1,
        publishedAt: '2026-11-10T09:15:00+03:00',
        summary: 'Базовый вход по RSI ниже 30.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0003',
    name: 'Breakout ATR',
    description:
      'Пробой ценового канала Дончиана с расчётом стоп-дистанции по среднему истинному диапазону ATR.',
    author: 'Алексей Смирнов',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 3,
    publishedAt: '2026-11-18T11:10:00+03:00',
    license: 'MIT',
    linterWarnings: [
      {
        code: 'L001',
        line: 9,
        message: 'Магическая константа 1.5 в множителе ATR — вынесите в параметр p1.',
      },
      {
        code: 'W-LA01',
        line: 12,
        message:
          'Сравнение highest(high, channel_n) с константным уровнем — проверьте риск подгонки по истории.',
      },
    ],
    versions: [
      {
        version: 3,
        publishedAt: '2026-11-18T11:10:00+03:00',
        summary: 'Ограничена доля капитала на одну бумагу.',
        immutable: true,
      },
      {
        version: 2,
        publishedAt: '2026-11-12T16:40:00+03:00',
        summary: 'Переход на 20-барный канал пробоя.',
        immutable: true,
      },
      {
        version: 1,
        publishedAt: '2026-11-02T14:00:00+03:00',
        summary: 'Первая публикация пробойного алгоритма.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0004',
    name: 'Mean Reversion Bands (черновик)',
    description:
      'Возврат к среднему от границ Боллинджера на спокойном рынке. Временно скрыт автором из общего каталога.',
    author: 'Вы',
    isMine: true,
    isSystem: false,
    visibility: 'hidden',
    latestVersion: 1,
    publishedAt: '2026-11-18T09:45:00+03:00',
    license: 'MIT',
    linterWarnings: [],
    versions: [
      {
        version: 1,
        publishedAt: '2026-11-18T09:45:00+03:00',
        summary:
          'Первая публикация без магических констант (L001) с проверкой неполного прогрева через is_na.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0005',
    name: 'Hidden Alpha Secret',
    description: 'Приватная экспериментальная стратегия другого автора, скрытая из каталога.',
    author: 'Иван Петров',
    isMine: false,
    isSystem: false,
    visibility: 'hidden',
    latestVersion: 1,
    publishedAt: '2026-11-18T09:00:00+03:00',
    license: 'MIT',
    linterWarnings: [],
    versions: [
      {
        version: 1,
        publishedAt: '2026-11-18T09:00:00+03:00',
        summary: 'Скрытая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0006',
    name: 'SMA Cross 20/50',
    description:
      'Классическое пересечение быстрой и медленной простых скользящих средних с пояснениями because.',
    author: 'Мария Волкова',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 1,
    publishedAt: '2026-11-17T20:15:00+03:00',
    license: 'MIT',
    linterWarnings: [],
    versions: [
      {
        version: 1,
        publishedAt: '2026-11-17T20:15:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0007',
    name: 'Aggressive Martingale',
    description:
      'Удвоение позиции после убыточной сделки. Используется как антипример управления риском.',
    author: 'Иван Петров',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 1,
    publishedAt: '2026-11-17T18:00:00+03:00',
    license: 'MIT',
    linterWarnings: [
      {
        code: 'L001',
        line: 7,
        message: 'Магическая константа 2 в коэффициенте усреднения — вынесите в параметр p1.',
      },
      {
        code: 'W-LA01',
        line: 18,
        message: 'Сравнение close с абсолютным ценовым уровнем — возможна подгонка по истории.',
      },
    ],
    versions: [
      {
        version: 1,
        publishedAt: '2026-11-17T18:00:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0008',
    name: 'EMA Trend Filter',
    description:
      'Следование за трендом по экспоненциальной средней с фильтром наклона и запретом входа в боковике.',
    author: 'Вы',
    isMine: true,
    isSystem: false,
    visibility: 'public',
    latestVersion: 3,
    publishedAt: '2026-11-17T15:20:00+03:00',
    license: 'MIT',
    linterWarnings: [],
    versions: [
      {
        version: 3,
        publishedAt: '2026-11-17T15:20:00+03:00',
        summary: 'Убран жёсткий порог угла наклона, вынесен в param slope_min.',
        immutable: true,
      },
      {
        version: 2,
        publishedAt: '2026-11-14T10:00:00+03:00',
        summary: 'Добавлен фильтр минимальной ликвидности.',
        immutable: true,
      },
      {
        version: 1,
        publishedAt: '2026-11-05T11:30:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0009',
    name: 'VWAP Intraday Pullback',
    description:
      'Возврат цены к средневзвешенной по объёму цене внутри торговой сессии с подтверждением свечного разворота.',
    author: 'Ольга Кузнецова',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 2,
    publishedAt: '2026-11-16T19:40:00+03:00',
    license: 'MIT',
    linterWarnings: [],
    versions: [
      {
        version: 2,
        publishedAt: '2026-11-16T19:40:00+03:00',
        summary: 'Добавлено ограничение числа входов за день.',
        immutable: true,
      },
      {
        version: 1,
        publishedAt: '2026-11-08T13:00:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0010',
    name: 'Donchian Turtle Lite',
    description:
      'Облегчённая версия стратегии черепах на 20-дневном максимуме с выходом по 10-дневному минимуму.',
    author: 'Дмитрий Соколов',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 1,
    publishedAt: '2026-11-16T14:10:00+03:00',
    license: 'MIT',
    linterWarnings: [
      {
        code: 'L001',
        line: 11,
        message: 'Магическая константа 10 в периоде lowest(...) — вынесите в параметр lowest_n.',
      },
    ],
    versions: [
      {
        version: 1,
        publishedAt: '2026-11-16T14:10:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0011',
    name: 'Bollinger Squeeze',
    description:
      'Поиск сжатия полос Боллинджера и вход в сторону первого импульсного расширения волатильности.',
    author: 'Мария Волкова',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 2,
    publishedAt: '2026-11-15T17:50:00+03:00',
    license: 'MIT',
    linterWarnings: [],
    versions: [
      {
        version: 2,
        publishedAt: '2026-11-15T17:50:00+03:00',
        summary: 'Уточнён порог ширины канала.',
        immutable: true,
      },
      {
        version: 1,
        publishedAt: '2026-11-01T12:00:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0012',
    name: 'Stochastic Swing',
    description:
      'Свинговая торговля по пересечению линий %K и %D осциллятора Стохастик в зонах экстремума.',
    author: 'Алексей Смирнов',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 1,
    publishedAt: '2026-11-15T10:30:00+03:00',
    license: 'MIT',
    linterWarnings: [
      {
        code: 'L001',
        line: 12,
        message: 'Магическая константа 20 в нижней зоне — вынесите в параметр p1.',
      },
    ],
    versions: [
      {
        version: 1,
        publishedAt: '2026-11-15T10:30:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0013',
    name: 'MACD Histogram Turn',
    description:
      'Ранний вход по смене знака производной гистограммы MACD при наличии старшего тренда.',
    author: 'Ольга Кузнецова',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 1,
    publishedAt: '2026-11-14T16:00:00+03:00',
    license: 'MIT',
    linterWarnings: [],
    versions: [
      {
        version: 1,
        publishedAt: '2026-11-14T16:00:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0014',
    name: 'Volume Spike Reversal',
    description:
      'Контртрендовый вход после кульминации объёма и длинной тени свечи против основного движения.',
    author: 'Иван Петров',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 2,
    publishedAt: '2026-11-14T09:20:00+03:00',
    license: 'MIT',
    linterWarnings: [
      {
        code: 'L001',
        line: 8,
        message: 'Магическая константа 2.5 во всплеске объёма — вынесите в параметр p1.',
      },
    ],
    versions: [
      {
        version: 2,
        publishedAt: '2026-11-14T09:20:00+03:00',
        summary: 'Добавлен фильтр минимального спрэда.',
        immutable: true,
      },
      {
        version: 1,
        publishedAt: '2026-11-04T15:00:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0015',
    name: 'Opening Range Breakout',
    description:
      'Пробой диапазона первых свечей сессии с фиксацией цели по коэффициенту риск/прибыль.',
    author: 'Дмитрий Соколов',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 1,
    publishedAt: '2026-11-13T18:10:00+03:00',
    license: 'MIT',
    linterWarnings: [],
    versions: [
      {
        version: 1,
        publishedAt: '2026-11-13T18:10:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0016',
    name: 'Triple Screen Classic',
    description:
      'Трёхэкранная система: направление по старшему периоду, откат по осциллятору и пробой локального пика.',
    author: 'Мария Волкова',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 1,
    publishedAt: '2026-11-12T21:00:00+03:00',
    license: 'MIT',
    linterWarnings: [],
    versions: [
      {
        version: 1,
        publishedAt: '2026-11-12T21:00:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0017',
    name: 'Keltner Channel Trend',
    description:
      'Трендовый алгоритм на базе каналов Кельтнера с удержанием позиции до обратного пересечения средней.',
    author: 'Вы',
    isMine: true,
    isSystem: false,
    visibility: 'public',
    latestVersion: 1,
    publishedAt: '2026-11-12T12:45:00+03:00',
    license: 'MIT',
    linterWarnings: [],
    versions: [
      {
        version: 1,
        publishedAt: '2026-11-12T12:45:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0018',
    name: 'CCI Overextension',
    description:
      'Отработка экстремальных отклонений индекса товарного канала CCI выше +150 и ниже −150.',
    author: 'Алексей Смирнов',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 1,
    publishedAt: '2026-11-11T17:15:00+03:00',
    license: 'MIT',
    linterWarnings: [
      {
        code: 'L001',
        line: 10,
        message: 'Магическая константа 150 в пороге CCI — вынесите в параметр p1.',
      },
    ],
    versions: [
      {
        version: 1,
        publishedAt: '2026-11-11T17:15:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0019',
    name: 'Adaptive Volatility Sizing',
    description:
      'Алгоритм выравнивания риска на сделку обратно пропорционально текущей волатильности бумаги.',
    author: 'Ольга Кузнецова',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 2,
    publishedAt: '2026-11-10T14:25:00+03:00',
    license: 'MIT',
    linterWarnings: [],
    versions: [
      {
        version: 2,
        publishedAt: '2026-11-10T14:25:00+03:00',
        summary: 'Добавлено ограничение максимальной доли в одной бумаге.',
        immutable: true,
      },
      {
        version: 1,
        publishedAt: '2026-10-28T11:00:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0020',
    name: 'Gap Fade Defensive',
    description:
      'Осторожная торговля закрытия утреннего гэпа с жёстким лимитом удержания по времени.',
    author: 'Иван Петров',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 1,
    publishedAt: '2026-11-09T16:50:00+03:00',
    license: 'MIT',
    linterWarnings: [],
    versions: [
      {
        version: 1,
        publishedAt: '2026-11-09T16:50:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0021',
    name: 'Parabolic SAR Trailing',
    description: 'Сопровождение трендовой позиции параболическим стопом без ручного вмешательства.',
    author: 'Дмитрий Соколов',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 1,
    publishedAt: '2026-11-08T11:20:00+03:00',
    license: 'MIT',
    linterWarnings: [
      {
        code: 'L001',
        line: 6,
        message: 'Магическая константа 0.02 в шаге ускорения — вынесите в параметр p1.',
      },
    ],
    versions: [
      {
        version: 1,
        publishedAt: '2026-11-08T11:20:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0022',
    name: 'Dual Moving Average Safe',
    description:
      'Две скользящие средние с фильтром минимального расхождения для снижения числа ложных входов.',
    author: 'Мария Волкова',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 1,
    publishedAt: '2026-11-07T15:05:00+03:00',
    license: 'MIT',
    linterWarnings: [],
    versions: [
      {
        version: 1,
        publishedAt: '2026-11-07T15:05:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0023',
    name: 'Liquidity Sweep Guard',
    description: 'Вход на возврате после ложного пробоя локального уровня при нормализации спрэда.',
    author: 'Алексей Смирнов',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 1,
    publishedAt: '2026-11-06T13:30:00+03:00',
    license: 'MIT',
    linterWarnings: [],
    versions: [
      {
        version: 1,
        publishedAt: '2026-11-06T13:30:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0024',
    name: 'ADX Trend Strength',
    description:
      'Фильтрация флэта по индексу направленного движения ADX с открытием только при выраженном тренде.',
    author: 'Ольга Кузнецова',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 1,
    publishedAt: '2026-11-05T10:15:00+03:00',
    license: 'MIT',
    linterWarnings: [
      {
        code: 'L001',
        line: 9,
        message: 'Магическая константа 25 в пороге силы тренда ADX — вынесите в параметр p1.',
      },
    ],
    versions: [
      {
        version: 1,
        publishedAt: '2026-11-05T10:15:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0025',
    name: 'Z-Score Mean Return',
    description:
      'Статистический возврат к скользящему среднему по стандартизованному отклонению цены.',
    author: 'Дмитрий Соколов',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 1,
    publishedAt: '2026-11-04T18:40:00+03:00',
    license: 'MIT',
    linterWarnings: [],
    versions: [
      {
        version: 1,
        publishedAt: '2026-11-04T18:40:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
  {
    id: 'A-0026',
    name: 'Weekend Flat Guard',
    description:
      'Закрытие краткосрочных позиций перед выходными и повторный вход при сохранении импульса в понедельник.',
    author: 'Иван Петров',
    isMine: false,
    isSystem: false,
    visibility: 'public',
    latestVersion: 1,
    publishedAt: '2026-11-03T12:00:00+03:00',
    license: 'MIT',
    linterWarnings: [],
    versions: [
      {
        version: 1,
        publishedAt: '2026-11-03T12:00:00+03:00',
        summary: 'Первая публикация.',
        immutable: true,
      },
    ],
  },
];

const DEFAULT_DSL_SOURCE = [
  'param fast = 20 range 5..50 step 1;',
  'param slow = 50 range 20..200 step 5;',
  'param size_pct = 95 range 10..100 step 5;',
  '',
  'rule enter when !is_na(sma(close, slow)) and sma(close, fast) > sma(close, slow)',
  '  buy size_pct% market because "Пересечение быстрой и медленной SMA";',
  'rule exit when position > 0 and sma(close, fast) < sma(close, slow)',
  '  sell position market because "Обратное пересечение SMA";',
].join('\n');

function seedParams(algoId: string): readonly StrategyParamDecl[] {
  if (algoId === 'A-0001') {
    return [
      { name: 'fast', defaultValue: 20, rangeMin: 5, rangeMax: 50, step: '1', integer: true },
      { name: 'slow', defaultValue: 50, rangeMin: 20, rangeMax: 200, step: '5', integer: true },
      { name: 'rsi_n', defaultValue: 14, rangeMin: 5, rangeMax: 30, step: '1', integer: true },
      { name: 'rsi_high', defaultValue: 70, rangeMin: 55, rangeMax: 85, step: '1', integer: true },
      { name: 'stop_pct', defaultValue: 5, rangeMin: 1, rangeMax: 15, step: '0.5', integer: false },
      { name: 'size_pct', defaultValue: 95, rangeMin: 10, rangeMax: 100, step: '5', integer: true },
    ];
  }
  return [
    { name: 'fast', defaultValue: 20, rangeMin: 5, rangeMax: 50, step: '1', integer: true },
    { name: 'slow', defaultValue: 50, rangeMin: 20, rangeMax: 200, step: '5', integer: true },
    { name: 'size_pct', defaultValue: 95, rangeMin: 10, rangeMax: 100, step: '5', integer: true },
  ];
}

function seedAlgorithms(): WorkshopAlgorithmDetail[] {
  return RAW_STUB_ALGORITHMS.map((item) => {
    const warnings: readonly StrategyDiagnostic[] = item.linterWarnings.map((w) => ({
      code: w.code,
      level: 'WARNING',
      startLine: w.line,
      startColumn: 1,
      endLine: w.line,
      endColumn: 20,
      message: w.message,
      fixes: [],
    }));
    const lookaheadLevel: CheckLevel = warnings.length > 0 ? 'WARNING' : 'OK';
    const params = seedParams(item.id);
    const versions: WorkshopAlgorithmVersion[] = item.versions.map((v) => ({
      ...v,
      id: `${item.id}-v${v.version}`,
      source: DEFAULT_DSL_SOURCE,
      lookaheadLevel,
      diagnostics: warnings,
      params,
    }));
    return {
      ...item,
      authorId: AUTHOR_IDS[item.author] ?? item.author.toLowerCase().replace(/\s+/g, '-'),
      latestVersionId: item.latestVersion > 0 ? `${item.id}-v${item.latestVersion}` : null,
      versions,
    };
  });
}

function toSummary(detail: WorkshopAlgorithmDetail): WorkshopAlgorithmSummary {
  return {
    id: detail.id,
    name: detail.name,
    description: detail.description,
    authorId: detail.authorId,
    author: detail.author,
    isMine: detail.isMine,
    isSystem: detail.isSystem,
    visibility: detail.visibility,
    latestVersion: detail.latestVersion,
    latestVersionId: detail.latestVersionId ?? null,
    publishedAt: detail.publishedAt,
    license: detail.license,
    linterWarnings: detail.linterWarnings,
  };
}

function isVisibleToViewer(item: WorkshopAlgorithmSummary): boolean {
  return item.visibility === 'public' || item.isMine;
}

function compareAlgorithms(
  a: WorkshopAlgorithmSummary,
  b: WorkshopAlgorithmSummary,
  sort: WorkshopSortField,
): number {
  switch (sort) {
    case 'published_desc': {
      const aTime = a.publishedAt === null ? Number.MAX_SAFE_INTEGER : Date.parse(a.publishedAt);
      const bTime = b.publishedAt === null ? Number.MAX_SAFE_INTEGER : Date.parse(b.publishedAt);
      const diff = bTime - aTime;
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    }
    case 'name_asc': {
      const diff = a.name.localeCompare(b.name, 'ru');
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    }
    case 'author_asc': {
      const diff = a.author.localeCompare(b.author, 'ru');
      return diff !== 0 ? diff : a.name.localeCompare(b.name, 'ru');
    }
  }
}

function problemError(status: number, code: string, detail: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { code, detail } });
}

function analyzeStubSource(source: string): CheckStrategyResult {
  const diagnostics: StrategyDiagnostic[] = [];
  const params: StrategyParamDecl[] = [];
  const lines = source.replaceAll('\r\n', '\n').split('\n');

  if (source.trim().length === 0) {
    diagnostics.push({
      code: 'E-SYN',
      level: 'ERROR',
      startLine: 0,
      startColumn: 0,
      endLine: 0,
      endColumn: 0,
      message: 'Исходный код стратегии не может быть пустым.',
      fixes: [],
    });
  }

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const paramMatch = /^\s*param\s+([a-zA-Z_]\w*)\s*=\s*(-?\d+(?:\.\d+)?)/.exec(line);
    if (paramMatch) {
      const defaultValue = Number(paramMatch[2]);
      const isInt = !paramMatch[2].includes('.');
      params.push({
        name: paramMatch[1],
        defaultValue,
        rangeMin: null,
        rangeMax: null,
        step: isInt ? '1' : '0.1',
        integer: isInt,
      });
      return;
    }

    if (/\b(lookahead|future|close\[\s*\+\d+\s*\])/.test(line)) {
      diagnostics.push({
        code: 'E-LA01',
        level: 'ERROR',
        startLine: lineNo,
        startColumn: 1,
        endLine: lineNo,
        endColumn: Math.max(1, line.length + 1),
        message: 'Заглядывание в будущее (E-LA01): обращение к будущему бару запрещено.',
        fixes: [],
      });
    }

    const magicMatch = />\s*(70|30)\b/.exec(line);
    if (magicMatch) {
      const numCol = magicMatch.index + magicMatch[0].indexOf(magicMatch[1]) + 1;
      diagnostics.push({
        code: 'L001',
        level: 'WARNING',
        startLine: lineNo,
        startColumn: numCol,
        endLine: lineNo,
        endColumn: numCol + magicMatch[1].length,
        message: `Магическая константа ${magicMatch[1]} — вынесите в параметр threshold.`,
        fixes: [
          {
            description: `Вынести ${magicMatch[1]} в параметр threshold`,
            edits: [
              {
                startLine: 1,
                startColumn: 1,
                endLine: 1,
                endColumn: 1,
                replacement: `param threshold = ${magicMatch[1]};\n`,
              },
              {
                startLine: lineNo,
                startColumn: numCol,
                endLine: lineNo,
                endColumn: numCol + magicMatch[1].length,
                replacement: 'threshold',
              },
            ],
          },
        ],
      });
    }
  });

  const lookaheadLevel: CheckLevel = diagnostics.some((d) => d.level === 'ERROR')
    ? 'ERROR'
    : diagnostics.some((d) => d.level === 'WARNING')
      ? 'WARNING'
      : 'OK';

  return { lookaheadLevel, diagnostics, params };
}

@Injectable()
export class StubWorkshopApi implements WorkshopApi {
  private readonly algorithms: WorkshopAlgorithmDetail[] = seedAlgorithms();
  private readonly drafts = new Map<string, WorkshopDraft>();
  private nextIdSeq = 26;

  async list(query: WorkshopQuery = {}): Promise<WorkshopPage> {
    const sort: WorkshopSortField = query.sort ?? 'published_desc';
    const pageSize = Math.min(
      WORKSHOP_MAX_PAGE_SIZE,
      Math.max(1, query.pageSize ?? WORKSHOP_DEFAULT_PAGE_SIZE),
    );
    const searchNorm = query.search?.trim().toLowerCase() ?? '';

    const visible = this.algorithms.filter(isVisibleToViewer);
    const authorMap = new Map<string, WorkshopAuthorOption>();
    for (const item of visible) {
      if (!authorMap.has(item.authorId)) {
        authorMap.set(item.authorId, { id: item.authorId, name: item.author });
      }
    }
    const authors = Array.from(authorMap.values()).sort((a, b) => {
      if (a.name === WORKSHOP_SYSTEM_AUTHOR) {
        return -1;
      }
      if (b.name === WORKSHOP_SYSTEM_AUTHOR) {
        return 1;
      }
      return a.name.localeCompare(b.name, 'ru');
    });

    const filtered = visible
      .filter((item) => {
        if (query.mineOnly && !item.isMine) {
          return false;
        }
        if (query.cleanOnly && item.linterWarnings.length > 0) {
          return false;
        }
        if (query.authorId != null && item.authorId !== query.authorId) {
          return false;
        }
        if (searchNorm) {
          const haystack = `${item.name}\n${item.description}`.toLowerCase();
          if (!haystack.includes(searchNorm)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => compareAlgorithms(a, b, sort));

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(totalPages, Math.max(1, query.page ?? 1));
    const start = (page - 1) * pageSize;

    return {
      items: filtered.slice(start, start + pageSize).map(toSummary),
      authors,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getById(id: string): Promise<WorkshopDetailResult> {
    const found = this.algorithms.find((item) => item.id === id);
    if (!found || !isVisibleToViewer(found)) {
      return { status: 'NOT_FOUND' };
    }
    return { status: 'READY', algorithm: found };
  }

  async createAlgorithm(command: CreateWorkshopAlgorithmCommand): Promise<WorkshopDraft> {
    const id = `A-${String(this.nextIdSeq++).padStart(4, '0')}`;
    const check = analyzeStubSource(command.source);
    const now = new Date().toISOString();
    const detail: WorkshopAlgorithmDetail = {
      id,
      name: command.name,
      description: command.description ?? '',
      authorId: 'user',
      author: 'Вы',
      isMine: true,
      isSystem: false,
      visibility: 'hidden',
      latestVersion: 0,
      latestVersionId: null,
      publishedAt: null,
      license: 'MIT',
      linterWarnings: [],
      versions: [],
    };
    this.algorithms.unshift(detail);
    const draft: WorkshopDraft = {
      strategyId: id,
      name: detail.name,
      description: detail.description,
      source: command.source,
      updatedAt: now,
      check,
    };
    this.drafts.set(id, draft);
    return draft;
  }

  async getDraft(id: string): Promise<WorkshopDraft> {
    const algo = this.requireOwned(id);
    const existing = this.drafts.get(id);
    if (existing) {
      return existing;
    }
    const source = algo.versions[0]?.source ?? DEFAULT_DSL_SOURCE;
    const draft: WorkshopDraft = {
      strategyId: id,
      name: algo.name,
      description: algo.description,
      source,
      updatedAt: algo.publishedAt ?? new Date().toISOString(),
      check: analyzeStubSource(source),
    };
    this.drafts.set(id, draft);
    return draft;
  }

  async saveDraft(id: string, command: SaveWorkshopDraftCommand): Promise<WorkshopDraft> {
    const idx = this.algorithms.findIndex((item) => item.id === id);
    const algo = this.requireOwned(id);
    const current = await this.getDraft(id);
    const name = command.name ?? current.name;
    const description = command.description ?? current.description;
    const source = command.source ?? current.source;
    const check = analyzeStubSource(source);
    const draft: WorkshopDraft = {
      strategyId: id,
      name,
      description,
      source,
      updatedAt: new Date().toISOString(),
      check,
    };
    this.drafts.set(id, draft);
    if (idx !== -1 && algo.latestVersion === 0) {
      this.algorithms[idx] = { ...algo, name, description };
    }
    return draft;
  }

  async check(command: CheckWorkshopStrategyCommand): Promise<CheckStrategyResult> {
    return analyzeStubSource(command.source);
  }

  async publish(
    id: string,
    command: PublishWorkshopAlgorithmCommand = {},
  ): Promise<PublishWorkshopResult> {
    const idx = this.algorithms.findIndex((item) => item.id === id);
    const algo = this.requireOwned(id);
    const draft = await this.getDraft(id);
    const source = command.source ?? draft.source;
    const check = analyzeStubSource(source);
    if (check.lookaheadLevel === 'ERROR') {
      return {
        ok: false,
        code: 'STRATEGY_INVALID',
        lookaheadLevel: check.lookaheadLevel,
        diagnostics: check.diagnostics,
      };
    }

    const nextVer = algo.latestVersion + 1;
    const now = new Date().toISOString();
    const version: WorkshopAlgorithmVersion = {
      id: `${id}-v${nextVer}`,
      version: nextVer,
      publishedAt: now,
      summary: command.summary?.trim() || `Версия v${nextVer}`,
      immutable: true,
      source,
      lookaheadLevel: check.lookaheadLevel,
      diagnostics: check.diagnostics,
      params: check.params,
    };
    const linterWarnings: readonly WorkshopLinterWarning[] = check.diagnostics
      .filter((d) => d.level === 'WARNING')
      .map((d) => ({ code: d.code, line: d.startLine, message: d.message }));

    this.algorithms[idx] = {
      ...algo,
      visibility: algo.latestVersion === 0 ? 'public' : algo.visibility,
      latestVersion: nextVer,
      latestVersionId: version.id,
      publishedAt: now,
      linterWarnings,
      versions: [version, ...algo.versions],
    };
    this.drafts.set(id, { ...draft, source, updatedAt: now, check });
    return { ok: true, version };
  }

  async fork(id: string, command: ForkWorkshopAlgorithmCommand = {}): Promise<WorkshopDraft> {
    const sourceAlgo = this.algorithms.find((item) => item.id === id);
    if (!sourceAlgo || !isVisibleToViewer(sourceAlgo)) {
      throw problemError(404, 'NOT_FOUND', 'Алгоритм не найден.');
    }
    const ver = command.version
      ? sourceAlgo.versions.find((v) => v.version === command.version)
      : sourceAlgo.versions[0];
    const source = ver?.source ?? DEFAULT_DSL_SOURCE;
    return this.createAlgorithm({
      name: command.name?.trim() || `${sourceAlgo.name} (форк)`,
      description: command.description ?? sourceAlgo.description,
      source,
    });
  }

  async setVisibility(
    id: string,
    visibility: WorkshopVisibility,
  ): Promise<WorkshopAlgorithmSummary> {
    const idx = this.algorithms.findIndex((item) => item.id === id);
    const algo = this.requireOwned(id);
    if (algo.isSystem) {
      throw problemError(403, 'FORBIDDEN', 'Системный алгоритм нельзя скрыть.');
    }
    const updated = { ...algo, visibility };
    this.algorithms[idx] = updated;
    return toSummary(updated);
  }

  async deleteAlgorithm(id: string): Promise<void> {
    const algo = this.requireOwned(id);
    if (algo.isSystem) {
      throw problemError(403, 'FORBIDDEN', 'Системный алгоритм нельзя удалить.');
    }
    const idx = this.algorithms.findIndex((item) => item.id === id);
    if (idx !== -1) {
      this.algorithms.splice(idx, 1);
    }
    this.drafts.delete(id);
  }

  private requireOwned(id: string): WorkshopAlgorithmDetail {
    const algo = this.algorithms.find((item) => item.id === id);
    if (!algo || !isVisibleToViewer(algo)) {
      throw problemError(404, 'NOT_FOUND', 'Алгоритм не найден.');
    }
    if (!algo.isMine) {
      throw problemError(403, 'FORBIDDEN', 'Нет прав на изменение чужого алгоритма.');
    }
    return algo;
  }
}

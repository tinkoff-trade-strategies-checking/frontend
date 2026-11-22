import { Injectable } from '@angular/core';
import {
  WORKSHOP_DEFAULT_PAGE_SIZE,
  WORKSHOP_MAX_PAGE_SIZE,
  WORKSHOP_SYSTEM_AUTHOR,
  WorkshopAlgorithmDetail,
  WorkshopAlgorithmSummary,
  WorkshopApi,
  WorkshopAuthorOption,
  WorkshopDetailResult,
  WorkshopPage,
  WorkshopQuery,
  WorkshopSortField,
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

const STUB_ALGORITHMS: readonly WorkshopAlgorithmDetail[] = RAW_STUB_ALGORITHMS.map((item) => ({
  ...item,
  authorId: AUTHOR_IDS[item.author] ?? item.author.toLowerCase().replace(/\s+/g, '-'),
}));

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
      const diff = Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
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

@Injectable()
export class StubWorkshopApi implements WorkshopApi {
  async list(query: WorkshopQuery = {}): Promise<WorkshopPage> {
    const sort: WorkshopSortField = query.sort ?? 'published_desc';
    const pageSize = Math.min(
      WORKSHOP_MAX_PAGE_SIZE,
      Math.max(1, query.pageSize ?? WORKSHOP_DEFAULT_PAGE_SIZE),
    );
    const searchNorm = query.search?.trim().toLowerCase() ?? '';

    const visible = STUB_ALGORITHMS.filter(isVisibleToViewer);
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
    const found = STUB_ALGORITHMS.find((item) => item.id === id);
    if (!found || !isVisibleToViewer(found)) {
      return { status: 'NOT_FOUND' };
    }
    return { status: 'READY', algorithm: found };
  }
}

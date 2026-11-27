import { expect, Page, test } from '@playwright/test';

const TICKERS_RE = /\b(SBER|GAZP|YDEX|GMKN|MGNT)\b/;
const COMPANY_NAMES_RE = /(Сбербанк|Газпром|Яндекс|Норникель|Магнит)/i;
const SHORT_OR_FULL_DATE_RE = /\b\d{2}\.\d{2}\.\d{2,4}\b/;
const ISO_DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/;
const RU_MONTH_DATE_RE =
  /\b\d{1,2}\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+\d{4}\b/i;
const TIME_OF_DAY_RE = /\b\d{1,2}:\d{2}\b/;

// Синтетический ключ времени графика из src/app/features/arena/components/arena-chart.ts (toChartTime).
function expectedChartTime(step: number): number {
  return step + 1000;
}

interface ArenaChartState {
  readonly storeStep: number;
  readonly candlesCount: number;
  readonly maxCandleStep: number;
  readonly seriesPointsCount: number;
  readonly lastSeriesTime: number | null;
  readonly formattedAxisLabels: readonly string[];
}

interface NgDebugApi {
  getComponent(element: Element): unknown;
}

interface ArenaPageDebug {
  store: {
    step(): number;
  };
}

interface ArenaChartDebug {
  candles(): readonly { readonly step: number }[];
  candleSeries?: {
    data(): readonly { readonly time: number }[];
  };
  chart?: {
    timeScale(): {
      options(): {
        tickMarkFormatter?: (time: number, tickMarkType: number, locale: string) => string;
      };
    };
    options(): {
      localization?: {
        timeFormatter?: (time: number) => string;
      };
    };
  };
}

async function readArenaChartState(page: Page): Promise<ArenaChartState> {
  return page.evaluate(() => {
    const ng = (window as unknown as { ng?: NgDebugApi }).ng;
    if (!ng) {
      throw new Error('Angular debug API (window.ng) недоступен');
    }
    const pageEl = document.querySelector('app-arena-page');
    const chartEl = document.querySelector('app-arena-chart');
    if (!pageEl || !chartEl) {
      throw new Error('Компоненты арены не найдены в DOM');
    }
    const arenaPage = ng.getComponent(pageEl) as ArenaPageDebug;
    const arenaChart = ng.getComponent(chartEl) as ArenaChartDebug;
    const candles = arenaChart.candles();
    const seriesData = arenaChart.candleSeries?.data() ?? [];
    const maxCandleStep = candles.reduce((max, c) => Math.max(max, c.step), -Infinity);
    const lastSeriesTime = seriesData.length > 0 ? seriesData[seriesData.length - 1].time : null;

    const tickFormatter = arenaChart.chart?.timeScale().options().tickMarkFormatter;
    const tooltipFormatter = arenaChart.chart?.options().localization?.timeFormatter;
    const formattedAxisLabels: string[] = [];
    for (const point of seriesData) {
      if (tickFormatter) {
        formattedAxisLabels.push(tickFormatter(point.time, 0, 'ru-RU'));
      }
      if (tooltipFormatter) {
        formattedAxisLabels.push(tooltipFormatter(point.time));
      }
    }

    return {
      storeStep: arenaPage.store.step(),
      candlesCount: candles.length,
      maxCandleStep,
      seriesPointsCount: seriesData.length,
      lastSeriesTime,
      formattedAxisLabels,
    };
  });
}

function assertTextHasNoBlindLeaks(text: string, forbidRub: boolean): void {
  expect(text).not.toMatch(TICKERS_RE);
  expect(text).not.toMatch(COMPANY_NAMES_RE);
  expect(text).not.toMatch(SHORT_OR_FULL_DATE_RE);
  expect(text).not.toMatch(ISO_DATE_RE);
  expect(text).not.toMatch(RU_MONTH_DATE_RE);
  expect(text).not.toMatch(TIME_OF_DAY_RE);
  if (forbidRub) {
    expect(text).not.toContain('₽');
  }
}

async function assertNoBlindLeaks(
  page: Page,
  options: { readonly forbidRub: boolean; readonly ignoreSessionCreatedTitle?: boolean },
): Promise<void> {
  let text = await page.evaluate(() => document.body.innerText);
  if (options.ignoreSessionCreatedTitle) {
    // invariants.md (INV-7): в заголовке допустима дата создания самой сессии, исторический период запрещён.
    text = text.replace(/Слепая сессия от \d{2}\.\d{2}\.\d{4}/g, 'Слепая сессия');
  }
  assertTextHasNoBlindLeaks(text, options.forbidRub);
}

test('запуск слепой сессии на «Новая сессия» → «Запустить» → арена', async ({ page }) => {
  await page.goto('/new');

  await expect(page.getByRole('heading', { name: 'Новая сессия' })).toBeVisible();
  await page.getByRole('button', { name: 'Настроить вручную' }).click();
  await expect(page.getByText('Случайная закрытая дата').first()).toBeVisible();

  await page.getByRole('button', { name: 'Запустить' }).click();

  await expect(page).toHaveURL(/\/arena\/S-\d+$/);
  await expect(page.getByRole('heading', { name: 'Арена' })).toBeVisible();
  await expect(page.getByText('Слепая сессия')).toBeVisible();
});

test('плеер: «Следующая свеча» добавляет одну свечу, день растёт', async ({ page }) => {
  await page.goto('/arena');

  const dayCounter = page.locator('.day-counter');
  await expect(dayCounter).toHaveText('День 1 из 60');

  const before = await readArenaChartState(page);
  expect(before.storeStep).toBe(0);

  await page.getByRole('button', { name: 'Следующая свеча' }).click();

  await expect(dayCounter).toHaveText('День 2 из 60');
  const after = await readArenaChartState(page);
  expect(after.storeStep).toBe(1);
  expect(after.candlesCount).toBe(before.candlesCount + 1);
  expect(after.seriesPointsCount).toBe(before.seriesPointsCount + 1);
});

test('рыночная заявка → после следующей свечи появляется в «Сделки», портфель меняется', async ({
  page,
}) => {
  await page.goto('/arena');

  const portfolio = page.locator('app-arena-portfolio-panel');
  const cashValue = portfolio.locator('.kv', { hasText: 'Свободные деньги' }).locator('.num');
  const investedValue = portfolio.locator('.kv', { hasText: 'В бумагах' }).locator('.num');

  await expect(cashValue).toHaveText('100,00 %');
  await expect(investedValue).toHaveText('0,00 %');

  const ordersPanel = page.locator('app-arena-orders-panel');
  const activeTab = ordersPanel.locator('button', { hasText: 'Активные заявки' });
  const fillsTab = ordersPanel.locator('button', { hasText: 'Сделки' });
  const activeBadge = activeTab.locator('.tab-badge');
  const fillsBadge = fillsTab.locator('.tab-badge');

  await expect(activeBadge).toHaveText('0');
  await expect(fillsBadge).toHaveText('0');

  await page.getByRole('button', { name: 'Купить (на след. шаге)' }).click();
  await expect(activeBadge).toHaveText('1');

  await page.getByRole('button', { name: 'Следующая свеча' }).click();

  await expect(activeBadge).toHaveText('0');
  await expect(fillsBadge).toHaveText('1');

  await fillsTab.click();
  await expect(ordersPanel.locator('tbody tr')).toHaveCount(1);
  await expect(ordersPanel.locator('tbody')).toContainText('Покупка');
  await expect(ordersPanel.locator('tbody')).toContainText('Бумага A');

  await expect(cashValue).not.toHaveText('100,00 %');
  await expect(investedValue).not.toHaveText('0,00 %');
  await expect(portfolio.locator('tbody tr').first()).toContainText('5 лот.');
});

test('INV-7: в DOM экрана запуска (слепой режим), арены и оси графика нет тикеров, названий, дат и «₽»', async ({
  page,
}) => {
  await page.goto('/new');
  await expect(page.getByRole('heading', { name: 'Новая сессия' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Первая тренировка (1 клик)' })).toBeVisible();
  // На /new символ «₽» разрешён (пользователь выбирает начальный капитал сессии).
  await assertNoBlindLeaks(page, { forbidRub: false });

  await page.getByRole('button', { name: 'Настроить вручную' }).click();
  // Ждём загрузки опций формы запуска перед проверкой DOM.
  await expect(page.getByText('Случайная закрытая дата').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Запустить' })).toBeEnabled();
  await assertNoBlindLeaks(page, { forbidRub: false });

  await page.getByRole('button', { name: 'Запустить' }).click();
  await expect(page).toHaveURL(/\/arena\/S-\d+$/);
  await expect(page.getByText('Слепая сессия')).toBeVisible();
  // Ждём загрузки снимка арены перед проверкой DOM.
  await expect(page.locator('.day-counter')).toHaveText('День 1 из 60');
  await assertNoBlindLeaks(page, { forbidRub: true });

  const chartAtStart = await readArenaChartState(page);
  expect(chartAtStart.formattedAxisLabels.length).toBeGreaterThan(0);
  for (const label of chartAtStart.formattedAxisLabels) {
    assertTextHasNoBlindLeaks(label, true);
  }

  await page.getByRole('button', { name: 'Следующая свеча' }).click();
  await expect(page.locator('.day-counter')).toHaveText('День 2 из 60');
  await assertNoBlindLeaks(page, { forbidRub: true });
});

test('INV-7: отчёт /report/S-0104 (активная сессия) не раскрывает тикеры и даты', async ({
  page,
}) => {
  await page.goto('/report/S-0104');

  await expect(page.getByText('Отчёт недоступен до завершения слепой сессии')).toBeVisible();
  await assertNoBlindLeaks(page, { forbidRub: true, ignoreSessionCreatedTitle: true });
});

test('отчёт /report/S-0103 раскрывает период и тикеры', async ({ page }) => {
  await page.goto('/report/S-0103');

  await expect(page.getByText('Период раскрыт')).toBeVisible();
  await expect(page.locator('.reveal-card').getByText('26.02.2020 — 21.05.2020')).toBeVisible();
  await expect(page.getByText('SBER', { exact: true })).toBeVisible();
  await expect(page.getByText('GAZP', { exact: true })).toBeVisible();
  await expect(page.getByText('YDEX', { exact: true })).toBeVisible();
});

test('INV-1: график не содержит свечей дальше текущего шага (включая переключение бумаги)', async ({
  page,
}) => {
  await page.goto('/arena');
  await expect(page.locator('.day-counter')).toHaveText('День 1 из 60');

  const initial = await readArenaChartState(page);
  expect(initial.storeStep).toBe(0);
  expect(initial.maxCandleStep).toBe(initial.storeStep);
  expect(initial.seriesPointsCount).toBe(initial.candlesCount);
  expect(initial.lastSeriesTime).toBe(expectedChartTime(initial.storeStep));

  await page.getByRole('button', { name: 'Следующая свеча' }).click();
  await page.getByRole('button', { name: 'Следующая свеча' }).click();
  await expect(page.locator('.day-counter')).toHaveText('День 3 из 60');

  const stepped = await readArenaChartState(page);
  expect(stepped.storeStep).toBe(2);
  expect(stepped.maxCandleStep).toBe(stepped.storeStep);
  expect(stepped.candlesCount).toBe(initial.candlesCount + 2);
  expect(stepped.seriesPointsCount).toBe(stepped.candlesCount);
  expect(stepped.lastSeriesTime).toBe(expectedChartTime(stepped.storeStep));

  await page.getByRole('tab', { name: /Бумага B/ }).click();
  const switched = await readArenaChartState(page);
  expect(switched.storeStep).toBe(2);
  expect(switched.maxCandleStep).toBe(switched.storeStep);
  expect(switched.seriesPointsCount).toBe(switched.candlesCount);
  expect(switched.lastSeriesTime).toBe(expectedChartTime(switched.storeStep));
});

test.fixme('INV-8: восстановление состояния арены после F5 — заглушка живёт в памяти, требуется API (frontend#8)', async ({
  page,
}) => {
  await page.goto('/arena');
  await page.getByRole('button', { name: 'Следующая свеча' }).click();
  await expect(page.locator('.day-counter')).toHaveText('День 2 из 60');

  await page.reload();
  await expect(page.locator('.day-counter')).toHaveText('День 2 из 60');
});

test('F1: Новая сессия → Запустить → /arena/:id → Завершить → Открыть отчёт этой сессии', async ({
  page,
}) => {
  await page.goto('/new');
  await expect(page.getByRole('heading', { name: 'Новая сессия' })).toBeVisible();
  await page.getByRole('button', { name: 'Настроить вручную' }).click();
  await expect(page.getByRole('button', { name: 'Запустить' })).toBeEnabled();

  await page.getByRole('button', { name: 'Запустить' }).click();
  await expect(page).toHaveURL(/\/arena\/S-\d+$/);

  const match = /\/arena\/(S-\d+)$/.exec(page.url());
  expect(match).not.toBeNull();
  const sessionId = match![1];

  await expect(page.getByText(sessionId)).toBeVisible();
  await expect(page.locator('.day-counter')).toHaveText('День 1 из 60');

  await page.getByRole('button', { name: 'Следующая свеча' }).click();
  await expect(page.locator('.day-counter')).toHaveText('День 2 из 60');

  await page.getByRole('button', { name: 'Завершить сессию' }).click();
  await page.locator('tui-dialog').getByRole('button', { name: 'Завершить сессию' }).click();

  await expect(page.getByText('Завершена', { exact: true })).toBeVisible();
  await expect(page.locator('nav').getByRole('link', { name: 'Отчёт' })).toHaveAttribute(
    'href',
    `/report/${sessionId}`,
  );

  await page.locator('main').getByRole('link', { name: 'Открыть отчёт' }).click();
  await expect(page).toHaveURL(new RegExp(`/report/${sessionId}$`));
  await expect(page.locator('.report-header').getByText(sessionId, { exact: true })).toBeVisible();
  await expect(page.getByText('Период раскрыт')).toBeVisible();
});

test('Арена в навигации (S-0104) → Завершить → Открыть отчёт этой сессии', async ({ page }) => {
  await page.goto('/new');
  await page.locator('nav').getByRole('link', { name: 'Арена' }).click();

  await expect(page).toHaveURL(/\/arena$/);
  await expect(page.getByText('S-0104')).toBeVisible();

  await page.getByRole('button', { name: 'Завершить сессию' }).click();
  await page.locator('tui-dialog').getByRole('button', { name: 'Завершить сессию' }).click();

  await expect(page.getByText('Завершена', { exact: true })).toBeVisible();
  await page.locator('main').getByRole('link', { name: 'Открыть отчёт' }).click();

  await expect(page).toHaveURL(/\/report\/S-0104$/);
  await expect(page.locator('.report-header').getByText('S-0104', { exact: true })).toBeVisible();
  await expect(page.getByText('Период раскрыт')).toBeVisible();
});

test('путь новичка: Словарь → Первая тренировка (1 клик) → заявка на паузе → Сделать шаг вперёд → Главный итог', async ({
  page,
}) => {
  await page.goto('/new');

  await expect(page.getByText('Учебный счёт · Виртуальные деньги')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Новая сессия' })).toBeVisible();

  // Открываем и закрываем мини-глоссарий «Словарь».
  await page.getByRole('button', { name: 'Словарь' }).click();
  const glossary = page.getByRole('dialog', { name: 'Словарь терминов' });
  await expect(glossary).toBeVisible();
  await expect(glossary).toContainText('Свеча');
  await glossary.getByRole('button', { name: 'Заявки' }).click();
  await expect(glossary).toContainText('Рыночная заявка');
  await glossary.getByRole('button', { name: 'Отчёт' }).click();
  await expect(glossary).toContainText('Итог чистыми');
  await page.keyboard.press('Escape');
  await expect(glossary).toHaveCount(0);

  // Запускаем тренировку в 1 клик.
  await page.getByRole('button', { name: 'Первая тренировка (1 клик)' }).click();
  await expect(page).toHaveURL(/\/arena\/S-\d+$/);
  await expect(page.getByText('Слепая сессия')).toBeVisible();
  await expect(page.locator('.day-counter')).toHaveText('День 1 из 20');

  // Проверяем, что микро-подсказка видна и закрывается, а INV-7 соблюдён даже с открытым словарём.
  const onboarding = page.locator('.onboarding-card');
  await expect(onboarding).toBeVisible();
  await page.getByRole('button', { name: 'Словарь' }).click();
  await expect(glossary).toBeVisible();
  await assertNoBlindLeaks(page, { forbidRub: true });
  await glossary.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await expect(glossary).toHaveCount(0);

  await onboarding.getByRole('button', { name: 'Понятно' }).click();
  await expect(onboarding).toHaveCount(0);

  // Заявка на паузе → баннер «Сделать шаг вперёд» → исполнение на следующем шаге.
  await page.getByRole('button', { name: 'Купить (на след. шаге)' }).click();
  const pausedBanner = page.locator('.paused-order-banner');
  await expect(pausedBanner).toBeVisible();
  await expect(pausedBanner).toContainText('Заявка принята и сработает на следующем шаге.');

  await pausedBanner.getByRole('button', { name: 'Сделать шаг вперёд' }).click();
  await expect(pausedBanner).toHaveCount(0);
  await expect(page.locator('.day-counter')).toHaveText('День 2 из 20');

  const fillsTab = page.locator('app-arena-orders-panel button', { hasText: 'Сделки' });
  await expect(fillsTab.locator('.tab-badge')).toHaveText('1');

  // Завершаем сессию и проверяем карточку «Главный итог» в отчёте.
  await page.getByRole('button', { name: 'Завершить сессию' }).click();
  await page.locator('tui-dialog').getByRole('button', { name: 'Завершить сессию' }).click();
  await page.locator('main').getByRole('link', { name: 'Открыть отчёт' }).click();

  await expect(page).toHaveURL(/\/report\/S-\d+$/);
  const summaryCard = page.locator('section.executive-summary');
  await expect(summaryCard).toBeVisible();
  await expect(summaryCard).toContainText('Главный итог');
  await expect(summaryCard).toContainText('До комиссий → Чистыми');

  const proToggle = page.locator('button.pro-details-toggle');
  await expect(proToggle).toHaveAttribute('aria-expanded', 'false');
  await proToggle.click();
  await expect(proToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Показатели эффективности')).toBeVisible();
});

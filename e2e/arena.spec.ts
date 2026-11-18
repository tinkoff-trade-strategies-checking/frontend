import { expect, Page, test } from '@playwright/test';

const TICKERS_RE = /\b(SBER|GAZP|YDEX|GMKN|MGNT)\b/;
const RU_DATE_RE = /\b\d{2}\.\d{2}\.\d{4}\b/;
const ISO_DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/;

interface ArenaChartState {
  readonly storeStep: number;
  readonly candlesCount: number;
  readonly maxCandleStep: number;
  readonly seriesPointsCount: number;
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
    data(): readonly unknown[];
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

    return {
      storeStep: arenaPage.store.step(),
      candlesCount: candles.length,
      maxCandleStep,
      seriesPointsCount: seriesData.length,
    };
  });
}

async function assertNoBlindLeaks(
  page: Page,
  options: { readonly forbidRub: boolean; readonly ignoreSessionCreatedTitle?: boolean },
): Promise<void> {
  let text = await page.evaluate(() => document.body.innerText);
  if (options.ignoreSessionCreatedTitle) {
    // Заголовок активной сессии содержит дату запуска самой сессии, а не исторического периода.
    text = text.replace(/Слепая сессия от \d{2}\.\d{2}\.\d{4}/g, 'Слепая сессия');
  }
  expect(text).not.toMatch(TICKERS_RE);
  expect(text).not.toMatch(RU_DATE_RE);
  expect(text).not.toMatch(ISO_DATE_RE);
  if (options.forbidRub) {
    expect(text).not.toContain('₽');
  }
}

test('запуск слепой сессии на «Новая сессия» → «Запустить» → арена', async ({ page }) => {
  await page.goto('/new');

  await expect(page.getByRole('heading', { name: 'Новая сессия' })).toBeVisible();
  await expect(page.getByText('Случайная закрытая дата').first()).toBeVisible();

  await page.getByRole('button', { name: 'Запустить' }).click();

  await expect(page).toHaveURL(/\/arena$/);
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

  await expect(activeTab).toContainText('0');
  await expect(fillsTab).toContainText('0');

  await page.getByRole('button', { name: 'Выставить заявку' }).click();
  await expect(activeTab).toContainText('1');

  await page.getByRole('button', { name: 'Следующая свеча' }).click();

  await expect(activeTab).toContainText('0');
  await expect(fillsTab).toContainText('1');

  await fillsTab.click();
  await expect(ordersPanel.locator('tbody tr')).toHaveCount(1);
  await expect(ordersPanel.locator('tbody')).toContainText('Покупка');
  await expect(ordersPanel.locator('tbody')).toContainText('Бумага A');

  await expect(cashValue).not.toHaveText('100,00 %');
  await expect(investedValue).not.toHaveText('0,00 %');
  await expect(portfolio.locator('tbody tr').first()).toContainText('5 лот.');
});

test('INV-7: в DOM экрана запуска (слепой режим) и арены нет тикеров, дат и «₽»', async ({
  page,
}) => {
  await page.goto('/new');
  await expect(page.getByRole('heading', { name: 'Новая сессия' })).toBeVisible();
  await assertNoBlindLeaks(page, { forbidRub: false });

  await page.getByRole('button', { name: 'Запустить' }).click();
  await expect(page).toHaveURL(/\/arena$/);
  await expect(page.getByText('Слепая сессия')).toBeVisible();
  await assertNoBlindLeaks(page, { forbidRub: true });

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
  await expect(page.getByText('26.02.2020 — 21.05.2020')).toBeVisible();
  await expect(page.getByText('SBER', { exact: true })).toBeVisible();
  await expect(page.getByText('GAZP', { exact: true })).toBeVisible();
  await expect(page.getByText('YDEX', { exact: true })).toBeVisible();
});

test('INV-1: график не содержит свечей дальше текущего шага', async ({ page }) => {
  await page.goto('/arena');
  await expect(page.locator('.day-counter')).toHaveText('День 1 из 60');

  const initial = await readArenaChartState(page);
  expect(initial.storeStep).toBe(0);
  expect(initial.maxCandleStep).toBe(initial.storeStep);
  expect(initial.seriesPointsCount).toBe(initial.candlesCount);

  await page.getByRole('button', { name: 'Следующая свеча' }).click();
  await page.getByRole('button', { name: 'Следующая свеча' }).click();
  await expect(page.locator('.day-counter')).toHaveText('День 3 из 60');

  const stepped = await readArenaChartState(page);
  expect(stepped.storeStep).toBe(2);
  expect(stepped.maxCandleStep).toBe(stepped.storeStep);
  expect(stepped.candlesCount).toBe(initial.candlesCount + 2);
  expect(stepped.seriesPointsCount).toBe(stepped.candlesCount);
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

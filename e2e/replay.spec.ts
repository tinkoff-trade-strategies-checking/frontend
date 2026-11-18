import { expect, Page, test } from '@playwright/test';

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
  };
}

async function readReplayChartState(page: Page) {
  return page.evaluate(() => {
    const ng = (window as unknown as { ng?: NgDebugApi }).ng;
    if (!ng) {
      throw new Error('Angular debug API (window.ng) недоступен');
    }
    const pageEl = document.querySelector('app-arena-page');
    const chartEl = document.querySelector('app-arena-chart');
    if (!pageEl || !chartEl) {
      throw new Error('Компоненты воспроизведения не найдены в DOM');
    }
    const arenaPage = ng.getComponent(pageEl) as ArenaPageDebug;
    const arenaChart = ng.getComponent(chartEl) as ArenaChartDebug;
    const candles = arenaChart.candles();
    const seriesData = arenaChart.candleSeries?.data() ?? [];
    const tickFormatter = arenaChart.chart?.timeScale().options().tickMarkFormatter;
    const lastPoint = seriesData[seriesData.length - 1];
    const lastAxisLabel =
      lastPoint && tickFormatter ? tickFormatter(lastPoint.time, 0, 'ru-RU') : '';

    return {
      storeStep: arenaPage.store.step(),
      maxCandleStep: candles.reduce((max, c) => Math.max(max, c.step), -Infinity),
      seriesPointsCount: seriesData.length,
      lastAxisLabel,
    };
  });
}

test('replay/S-0103: проигрывает сессию в режиме только чтения, сделки на своих свечах, итог = отчёту', async ({
  page,
}) => {
  await page.goto('/replay/S-0103');

  await expect(page.getByRole('heading', { name: 'Воспроизведение S-0103' })).toBeVisible();
  await expect(page.getByText('Только просмотр: заявки из журнала')).toBeVisible();
  await expect(page.getByText('26.02.2020 — 21.05.2020')).toBeVisible();
  await expect(page.getByRole('tab', { name: /SBER/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /GAZP/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /YDEX/ })).toBeVisible();
  await expect(page.getByText('День 1 из 60')).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Выставить заявку' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Завершить сессию' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Открыть отчёт' })).toBeVisible();

  // INV-1 и раскрытые даты: на старте шаг 0, на оси дата 26.02.
  const initialState = await readReplayChartState(page);
  expect(initialState.storeStep).toBe(0);
  expect(initialState.maxCandleStep).toBe(0);
  expect(initialState.lastAxisLabel).toBe('26.02');

  // Переходим на вкладку «Сделки» — на дне 1 сделок ещё нет.
  await page.locator('app-arena-orders-panel button', { hasText: 'Сделки' }).click();
  await expect(page.getByText('Сделок пока нет.')).toBeVisible();

  // Делаем 3 шага до дня 4 (02.03), когда исполняется первая сделка SBER.
  const stepBtn = page.getByRole('button', { name: 'Следующая свеча' });
  await stepBtn.click();
  await stepBtn.click();
  await stepBtn.click();
  await expect(page.getByText('День 4 из 60')).toBeVisible();
  await expect(page.getByText('02.03 (д4)')).toBeVisible();

  const day4State = await readReplayChartState(page);
  expect(day4State.storeStep).toBe(3);
  expect(day4State.maxCandleStep).toBe(3);

  // Проигрываем до конца на скорости ×100.
  await page.getByRole('button', { name: '×100' }).click();
  await page.getByRole('button', { name: 'Пуск' }).click();
  await expect(page.getByText('День 60 из 60')).toBeVisible({ timeout: 15_000 });

  // Все 4 сделки журнала отображаются на своих датах.
  await expect(page.getByText('02.03 (д4)')).toBeVisible();
  await expect(page.getByText('23.03 (д19)')).toBeVisible();
  await expect(page.getByText('09.04 (д31)')).toBeVisible();
  await expect(page.getByText('28.04 (д44)')).toBeVisible();

  // Итоговый капитал и доходность совпадают с отчётом S-0103.
  const finalPortfolioText = (
    (await page.locator('app-arena-portfolio-panel').textContent()) ?? ''
  ).replace(/\u00a0/g, ' ');
  expect(finalPortfolioText).toContain('1 064 250 ₽');
  expect(finalPortfolioText).toContain('+6,43 %');

  await page.getByRole('link', { name: 'Открыть отчёт' }).click();
  await expect(page).toHaveURL(/\/report\/S-0103$/);
  await expect(page.getByRole('heading', { name: 'Отчёт сессии S-0103' })).toBeVisible();
  const reportText = ((await page.locator('main').textContent()) ?? '').replace(/\u00a0/g, ' ');
  expect(reportText).toContain('1 064 250 ₽');
  expect(reportText).toContain('+6,43 %');
});

test('INV-7: replay/S-0104 недоступен для активной слепой сессии и не раскрывает данные', async ({
  page,
}) => {
  await page.goto('/replay/S-0104');

  await expect(
    page.getByText('Воспроизведение недоступно до завершения слепой сессии'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Вернуться на арену' })).toBeVisible();

  const text = (await page.locator('main').textContent()) ?? '';
  expect(text).not.toMatch(/\b(SBER|GAZP|YDEX)\b/);
  expect(text).not.toMatch(/(Сбербанк|Газпром|Яндекс)/i);
  expect(text).not.toMatch(/(26\.02\.2020|21\.05\.2020)/);
});

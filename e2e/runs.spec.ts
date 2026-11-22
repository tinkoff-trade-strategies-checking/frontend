import { expect, test } from '@playwright/test';

test('runs/R-0203: прогресс прогона по SSE, отчёт с findings/orders и повтор прогона (INV-4)', async ({
  page,
}) => {
  await page.goto('/runs/R-0203');

  await expect(page.getByRole('heading', { name: 'Breakout ATR v3' })).toBeVisible();

  // StubRunsApi завершает R-0203 за 30 мс и раскрывает период/бумаги после завершения.
  await expect(page.getByText('Отчёт сформирован и готов к просмотру.')).toBeVisible();
  await expect(page.getByText('10.04.2023 — 05.07.2023')).toBeVisible();

  const openReportBtn = page.getByRole('button', { name: 'Открыть отчёт' });
  await expect(openReportBtn).toBeEnabled();
  await openReportBtn.click();

  await expect(page).toHaveURL(/\/runs\/R-0203\/report$/);
  await expect(page.locator('.report-header').getByText('R-0203', { exact: true })).toBeVisible();
  await expect(page.getByText('W-RT01')).toBeVisible();
  await expect(
    page.getByText('Первые 14 баров пропущены на прогрев индикатора RSI.'),
  ).toBeVisible();

  // Проверяем вкладку «Сделки» и переходим на «Заявки алгоритма» (ruleName + because).
  await expect(page.locator('.tab-body tbody tr').first()).toContainText('SBER');
  await page.getByRole('button', { name: 'Заявки алгоритма' }).click();
  await expect(page.getByText('enter_rsi')).toBeVisible();
  await expect(page.getByText('RSI(14) опустился ниже порога 30.')).toBeVisible();

  // Запускаем повтор прогона и проверяем переход на новый /runs/:newId с бейджем repeatMatch.
  await page.getByRole('button', { name: 'Повторить прогон' }).click();
  await expect(page).toHaveURL(/\/runs\/R-\d{4}$/);
  await expect(page.getByText('Повтор совпал')).toBeVisible();
  await page.getByRole('button', { name: 'Открыть отчёт' }).click();
  await expect(page).toHaveURL(/\/runs\/R-\d{4}\/report$/);
  await expect(page.getByText('Повтор совпал')).toBeVisible();
});

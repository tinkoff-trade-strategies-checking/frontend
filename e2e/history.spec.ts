import { expect, test } from '@playwright/test';

const TICKERS_RE = /\b(SBER|GAZP|YDEX|GMKN|MGNT)\b/;

test('навигация в историю: незавершённая слепая сессия без бумаг и итога (INV-7)', async ({
  page,
}) => {
  await page.goto('/arena');
  await page.getByRole('link', { name: 'История' }).click();

  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole('heading', { name: 'История сессий и прогонов' })).toBeVisible();

  const rowS0104 = page.locator('tr[data-session-id="S-0104"]');
  await expect(rowS0104).toBeVisible();

  const rowText = await rowS0104.innerText();
  expect(rowText).toContain('Слепая сессия от 18.11.2026');
  expect(rowText).toContain('Идёт');
  expect(rowText).toContain('—');
  expect(rowText).not.toMatch(TICKERS_RE);
  expect(rowText).not.toContain('26.02.2020');
  expect(rowText).not.toMatch(/[+\-\u2212]\d+,\d{2}\s*%/);

  await expect(rowS0104.getByRole('link', { name: 'Продолжить' })).toHaveAttribute(
    'href',
    '/arena',
  );
});

test('фильтр «Только слепые», пагинация и переход в отчёт', async ({ page }) => {
  await page.goto('/history');

  await expect(page.locator('tbody tr')).toHaveCount(20);
  await expect(page.locator('tr[data-session-id="S-0105"]')).toBeVisible();

  await page.getByRole('button', { name: 'Вперёд' }).click();
  await expect(page.getByText('Страница 2 из 2')).toBeVisible();

  await page.getByRole('button', { name: 'Назад' }).click();
  await expect(page.getByText('Страница 1 из 2')).toBeVisible();

  await page.getByRole('button', { name: 'Только слепые' }).click();

  await expect(page.locator('tr[data-session-id="S-0105"]')).toHaveCount(0);
  await expect(page.locator('tr[data-session-id="S-0104"]')).toBeVisible();
  await expect(page.locator('tr[data-session-id="S-0103"]')).toBeVisible();

  const rowS0103 = page.locator('tr[data-session-id="S-0103"]');
  await expect(rowS0103.getByRole('link', { name: 'Воспроизвести' })).toHaveAttribute(
    'href',
    '/replay/S-0103',
  );
  await rowS0103.getByRole('link', { name: 'Открыть отчёт' }).click();

  await expect(page).toHaveURL(/\/report\/S-0103$/);
  await expect(page.getByRole('heading', { name: 'Отчёт сессии S-0103' })).toBeVisible();
});

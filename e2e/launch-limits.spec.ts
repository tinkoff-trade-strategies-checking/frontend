import { expect, test } from '@playwright/test';

test('launch: пары шаг × длительность сверх лимита свечей выключены с подсказкой и в случайной, и в своей дате', async ({
  page,
}) => {
  await page.goto('/new');
  await expect(page.getByRole('heading', { name: 'Новая сессия' })).toBeVisible();
  await page.locator('#launch-advanced-toggle').click();

  // По умолчанию 60 дн.: шаг 1 мин (до 30 дн.) превышает лимит 25 000 свечей, 5 мин (до 150 дн.) доступен.
  const oneMinute = page.getByRole('button', { name: '1 мин', exact: true });
  await expect(oneMinute).toBeDisabled();
  await expect(oneMinute).toHaveAttribute('title', /больше 25\s000 свечей/);
  await expect(page.getByRole('button', { name: '5 мин', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '10 мин', exact: true })).toBeEnabled();

  // Шаг 5 мин (максимум 150 дн.): длительность 250 дн. выключена, 20 и 120 дн. доступны.
  await page.getByRole('button', { name: '5 мин', exact: true }).click();
  await expect(page.getByRole('button', { name: '120 дн.', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '250 дн.', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '20 дн.', exact: true })).toBeEnabled();

  // Своя дата: лимит 25 000 свечей действует и для CUSTOM — пары сверх лимита остаются выключены.
  await page.getByRole('button', { name: 'Своя дата', exact: true }).click();
  await expect(page.getByRole('button', { name: '250 дн.', exact: true })).toBeDisabled();
  await expect(oneMinute).toBeDisabled();
});

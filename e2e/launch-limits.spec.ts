import { expect, test } from '@playwright/test';

test('launch: пары шаг × длительность сверх лимита свечей выключены с подсказкой, для своей даты — нет', async ({
  page,
}) => {
  await page.goto('/new');
  await expect(page.getByRole('heading', { name: 'Новая сессия' })).toBeVisible();

  // По умолчанию 60 дн.: шаги 1 мин и 5 мин превышают лимит.
  const oneMinute = page.getByRole('button', { name: '1 мин', exact: true });
  await expect(oneMinute).toBeDisabled();
  await expect(oneMinute).toHaveAttribute('title', /больше 5\s000 свечей/);
  await expect(page.getByRole('button', { name: '5 мин', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '10 мин', exact: true })).toBeEnabled();

  // Шаг 10 мин (максимум 60 дн.): длительность 120 и 250 выключены.
  await page.getByRole('button', { name: '10 мин', exact: true }).click();
  await expect(page.getByRole('button', { name: '120 дн.', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '250 дн.', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '20 дн.', exact: true })).toBeEnabled();

  // Своя дата: варианты не выключаем.
  await page.getByRole('button', { name: 'Своя дата' }).click();
  await expect(page.getByRole('button', { name: '250 дн.', exact: true })).toBeEnabled();
  await expect(oneMinute).toBeEnabled();
});

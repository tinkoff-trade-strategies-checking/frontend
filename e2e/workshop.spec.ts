import { expect, test } from '@playwright/test';

test('каталог мастерской: навигация, пагинация и скрытые алгоритмы', async ({ page }) => {
  await page.goto('/arena');
  await page.getByRole('link', { name: 'Мастерская' }).click();

  await expect(page).toHaveURL(/\/workshop$/);
  await expect(page.getByRole('heading', { name: 'Мастерская' })).toBeVisible();

  await expect(page.locator('tbody tr')).toHaveCount(20);
  await expect(page.getByText('Страница 1 из 2')).toBeVisible();

  const ownHiddenRow = page.locator('tr[data-algo-id="A-0004"]');
  await expect(ownHiddenRow).toBeVisible();
  await expect(ownHiddenRow).toContainText('Скрыт');
  await expect(page.locator('tr[data-algo-id="A-0005"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Вперёд' }).click();
  await expect(page.getByText('Страница 2 из 2')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(5);

  await page.getByRole('button', { name: 'Назад' }).click();
  await expect(page.getByText('Страница 1 из 2')).toBeVisible();
});

test('фильтры, карточка алгоритма, неизменяемые версии и сравнение', async ({ page }) => {
  await page.goto('/workshop');

  await page.getByLabel('Поиск по названию и описанию').fill('Breakout ATR');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const rowBreakout = page.locator('tr[data-algo-id="A-0003"]');
  await expect(rowBreakout).toBeVisible();

  await rowBreakout.getByRole('button', { name: 'Открыть' }).click();

  const detail = page.getByRole('complementary', { name: 'Карточка алгоритма' });
  await expect(detail).toBeVisible();
  await expect(detail).toContainText('Breakout ATR');
  await expect(detail).toContainText('MAGIC_CONST');
  await expect(detail).toContainText('неизменяема');
  await expect(detail).toContainText('пока недоступны');

  await expect(detail.getByRole('button', { name: 'Форк' })).toBeDisabled();
  await expect(detail.getByRole('button', { name: 'Запустить прогон' })).toBeDisabled();

  await detail.getByRole('button', { name: 'Добавить в сравнение' }).click();
  await expect(page.getByText('В сравнении: 1 из 5')).toBeVisible();

  await detail.getByRole('button', { name: 'Закрыть' }).click();
  await expect(detail).toHaveCount(0);

  await page.getByLabel('Поиск по названию и описанию').fill('');
  await page.getByRole('button', { name: 'Мои' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(4);

  await page.getByRole('button', { name: 'Без предупреждений линтера' }).click();
  await expect(page.locator('tr[data-algo-id="A-0002"]')).toHaveCount(0);
  await expect(page.locator('tr[data-algo-id="A-0004"]')).toBeVisible();
});

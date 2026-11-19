import { expect, test } from '@playwright/test';

test('launch: своё значение начального капитала попадает в сводку, вне диапазона запуск заблокирован', async ({
  page,
}) => {
  await page.goto('/new');
  await expect(page.getByRole('heading', { name: 'Новая сессия' })).toBeVisible();

  const capital = page.getByLabel('Своё значение, ₽');
  await expect(capital).toBeVisible();
  await expect(page.getByRole('button', { name: 'Запустить' })).toBeEnabled();

  await capital.fill('2500000');
  await capital.blur();
  const summary = page.locator('aside.summary-col');
  await expect(summary).toContainText(/2\s500\s000\s₽/);
  await expect(page.getByRole('button', { name: 'Запустить' })).toBeEnabled();

  // Поле само поджимает значение до границы диапазона.
  await capital.fill('5000');
  await capital.blur();
  await expect(summary).toContainText(/10\s000\s₽/);
  await capital.fill('999999999');
  await capital.blur();
  await expect(summary).toContainText(/100\s000\s000\s₽/);
  await expect(page.getByRole('button', { name: 'Запустить' })).toBeEnabled();

  await page.getByRole('button', { name: /5\s000\s000\s₽/ }).click();
  await expect(summary).toContainText(/5\s000\s000\s₽/);
  await expect(page.getByRole('button', { name: 'Запустить' })).toBeEnabled();
});

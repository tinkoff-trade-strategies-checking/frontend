import { expect, test } from '@playwright/test';

test('launch: своё значение начального капитала попадает в сводку и поджимается до границ диапазона', async ({
  page,
}) => {
  await page.goto('/new');
  await expect(page.getByRole('heading', { name: 'Новая сессия' })).toBeVisible();
  await page.locator('#launch-advanced-toggle').click();

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

test('launch: выбор фонового алгоритма из каталога мастерской обновляет сводку и запускает сессию', async ({
  page,
}) => {
  await page.goto('/new');
  await expect(page.getByRole('heading', { name: 'Новая сессия' })).toBeVisible();
  await page.locator('#launch-advanced-toggle').click();

  const summary = page.locator('aside.summary-col');
  await expect(summary).toContainText('Эталон платформы');

  const select = page.locator('#launch-background-algorithm');
  await expect(select).toBeVisible();

  // Выбираем опубликованный алгоритм из каталога (Momentum RSI · v2 · Вы).
  const optionLabel = 'Momentum RSI · v2 · Вы';
  await select.selectOption({ label: optionLabel });

  await expect(summary).toContainText(optionLabel);
  await page.getByRole('button', { name: 'Запустить' }).click();
  await expect(page).toHaveURL(/\/arena\/S-\d+$/);
});

test('launch: пикер бумаг поддерживает поиск, массовый выбор без лимита, сброс и компактную сводку', async ({
  page,
}) => {
  await page.goto('/new');
  await expect(page.getByRole('heading', { name: 'Новая сессия' })).toBeVisible();
  await page.locator('#launch-advanced-toggle').click();
  await page.getByRole('button', { name: 'Своя дата', exact: true }).click();

  const picker = page.locator('app-paper-picker');
  await expect(picker).toBeVisible();
  await expect(picker).toContainText('Выбрано: 3 из 60');

  // Массовый выбор всех бумаг без лимита 5.
  await picker.getByRole('button', { name: 'Выбрать все' }).click();
  await expect(picker).toContainText('Выбрано: 60 из 60');
  await expect(picker.locator('.selected-chip-toggle')).toContainText('+ ещё 36');
  await expect(page.locator('aside.summary-col')).toContainText('и ещё 55');
  await expect(page.getByRole('button', { name: 'Запустить' })).toBeEnabled();

  // Сброс всех бумаг блокирует запуск.
  await picker.getByRole('button', { name: 'Сбросить' }).click();
  await expect(picker).toContainText('Выбрано: 0 из 60');
  await expect(page.getByRole('button', { name: 'Запустить' })).toBeDisabled();

  // Фильтрация по категории сектора и выбор внутри категории.
  await picker.locator('.category-chip[data-category="Финансы"]').click();
  await expect(picker.getByRole('button', { name: 'Выбрать в категории' })).toBeEnabled();
  await picker.getByRole('button', { name: 'Выбрать в категории' }).click();
  await expect(page.getByRole('button', { name: 'Запустить' })).toBeEnabled();
  await picker.locator('.category-chip[data-category="__all__"]').click();
  await picker.getByRole('button', { name: 'Сбросить' }).click();

  // Поиск по тикеру/названию + «Выбрать найденные».
  const search = page.locator('#launch-papers-search');
  await search.fill('газ');
  await expect(picker.locator('.picker-row').first()).toBeVisible();
  await picker.getByRole('button', { name: 'Выбрать найденные' }).click();
  await expect(page.getByRole('button', { name: 'Запустить' })).toBeEnabled();

  await page.getByRole('button', { name: 'Запустить' }).click();
  await expect(page).toHaveURL(/\/arena\/S-\d+$/);
});

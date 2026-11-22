import { expect, test } from '@playwright/test';

test('report/S-0103: разбор расхождений, обратная проверка и переход в воспроизведение на шаг расхождения', async ({
  page,
}) => {
  await page.goto('/report/S-0103');

  await expect(page.locator('.report-header').getByText('S-0103', { exact: true })).toBeVisible();

  // Открываем вкладку «Расхождения».
  await page.getByRole('button', { name: 'Расхождения' }).click();
  await expect(page.locator('main')).toContainText('Расхождения обошлись вам в');

  const mainText = ((await page.locator('main').textContent()) ?? '').replace(/\u00a0/g, ' ');
  expect(mainText).toContain('Расхождения обошлись вам в 24 819,38 ₽');
  expect(mainText).toContain('самое дорогое — размер на дне 4');
  expect(mainText).toContain('алгоритм здесь не действовал бы');
  expect(mainText).toContain('Δt = +2 бар.');

  // Фильтр по типу «Лишнее действие» оставляет 1 строку (GAZP на дне 19, шаг 18).
  await page.getByRole('button', { name: /Лишнее действие/ }).click();
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('GAZP');
  await expect(rows.first()).toContainText('День 19 (23.03)');

  // Проверяем вкладку «Обратная проверка» и активную кнопку «Написать правило».
  await page.getByRole('button', { name: 'Обратная проверка' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr').first()).toContainText('GAZP');
  await expect(page.locator('tbody tr').first()).toContainText('+7 470,00 ₽');
  await expect(page.getByRole('button', { name: 'Написать правило' })).toBeEnabled();

  // Возвращаемся на «Расхождения» и переходим в воспроизведение на шаг расхождения (шаг 18 -> День 19).
  await page.getByRole('button', { name: 'Расхождения' }).click();
  await page.getByRole('button', { name: /Лишнее действие/ }).click();
  await page.getByRole('link', { name: 'Посмотреть в воспроизведении' }).click();

  await expect(page).toHaveURL(/\/replay\/S-0103\?step=18$/);
  await expect(page.getByRole('heading', { name: 'Воспроизведение' })).toBeVisible();
  await expect(page.getByText('День 19 из 60')).toBeVisible();
});

test('report/S-0103: «Написать правило» открывает создание черновика в мастерской', async ({
  page,
}) => {
  await page.goto('/report/S-0103');
  await page.getByRole('button', { name: 'Обратная проверка' }).click();
  await page.getByRole('button', { name: 'Написать правило' }).click();

  await expect(page).toHaveURL(/\/workshop\?create=1$/);
  await expect(page.getByRole('heading', { name: 'Новый алгоритм' })).toBeVisible();
});

test('report/S-NO-ALGO: поля null не роняют страницу', async ({ page }) => {
  await page.goto('/report/S-NO-ALGO');

  await expect(
    page.locator('.report-header').getByText('S-NO-ALGO', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Сравнение с алгоритмом недоступно')).toBeVisible();

  await page.getByRole('button', { name: 'Расхождения' }).click();
  await expect(page.getByText('Разбор расхождений недоступен')).toBeVisible();

  await page.getByRole('button', { name: 'Обратная проверка' }).click();
  await expect(page.getByText('Обратная проверка недоступна')).toBeVisible();

  await page.getByRole('button', { name: 'Сделки' }).click();
  await expect(page.locator('tbody tr').first()).toBeVisible();
});

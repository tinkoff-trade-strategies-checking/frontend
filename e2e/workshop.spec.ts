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
  await expect(detail).toContainText('L001');
  await expect(detail).toContainText('W-LA01');
  await expect(detail).toContainText('неизменяема');

  await expect(detail.getByRole('button', { name: 'Форк' })).toBeEnabled();
  await expect(detail.getByRole('button', { name: 'Запустить прогон' })).toBeEnabled();

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

test('форк, проверка DSL с автоисправлением, публикация, видимость и запуск прогона', async ({
  page,
}) => {
  await page.goto('/workshop');

  await page.locator('tr[data-algo-id="A-0001"]').getByRole('button', { name: 'Открыть' }).click();
  const detail = page.getByRole('complementary', { name: 'Карточка алгоритма' });
  await expect(detail).toBeVisible();

  // Форк эталона открывает редактор черновика.
  await detail.getByRole('button', { name: 'Форк' }).click();
  await expect(detail.getByRole('heading', { name: 'Редактор черновика' })).toBeVisible();
  await expect(page.locator('#workshop-draft-name')).toHaveValue('Эталон платформы (форк)');

  // Проверяем DSL с магической константой (L001) и применяем автоисправление.
  await page
    .locator('#workshop-draft-source')
    .fill('rule enter when rsi(close, 14) > 70 buy 50% market because "Перекупленность";');
  await detail.getByRole('button', { name: 'Проверить' }).click();

  const checkSection = detail.getByRole('region', { name: 'Результаты проверки DSL' });
  await expect(checkSection).toContainText('L001');
  await detail.getByRole('button', { name: 'Исправить: Вынести 70 в параметр threshold' }).click();

  await expect(checkSection).toContainText('OK · Без ошибок');
  await expect(checkSection).toContainText('Ошибок и предупреждений не обнаружено.');
  await expect(checkSection).toContainText('threshold=70');

  // Публикуем версию v1 и возвращаемся в карточку алгоритма.
  await page.locator('#workshop-publish-summary').fill('Вынес порог в параметр');
  await detail.getByRole('button', { name: 'Опубликовать версию' }).click();
  await expect(detail).toContainText('Опубликована версия v1.');

  await detail.getByRole('button', { name: 'К карточке' }).click();
  await expect(detail).toContainText('v1');
  await expect(detail).toContainText('неизменяема');

  // Скрываем свой алгоритм и возвращаем обратно в каталог.
  await detail.getByRole('button', { name: 'Скрыть' }).click();
  await expect(detail).toContainText('Скрыт');
  await detail.getByRole('button', { name: 'Вернуть в каталог' }).click();
  await expect(detail.getByRole('button', { name: 'Скрыть' })).toBeVisible();

  // Открываем форму запуска прогона и запускаем прогон.
  await detail.getByRole('button', { name: 'Запустить прогон' }).click();
  await expect(
    detail.getByRole('heading', { name: 'Запуск прогона: Эталон платформы (форк)' }),
  ).toBeVisible();

  await detail.getByRole('button', { name: 'Запустить' }).click();
  await expect(page).toHaveURL(/\/runs\/R-\d{4}$/);
  await expect(page.getByText('Отчёт сформирован и готов к просмотру.')).toBeVisible();
});

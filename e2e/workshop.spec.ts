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
  await expect(ownHiddenRow).toContainText('Приватный');
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

  const table = page.locator('.workshop-table');
  const widthBefore = (await table.boundingBox())?.width ?? 0;

  await rowBreakout.getByRole('button', { name: 'Открыть' }).click();

  const detail = page.getByRole('complementary', { name: 'Карточка алгоритма' });
  await expect(detail).toBeVisible();
  // Выезжающая панель идёт оверлеем поверх страницы и не сужает таблицу.
  const widthAfter = (await table.boundingBox())?.width ?? 0;
  expect(widthAfter).toBe(widthBefore);
  await expect(table.locator('th', { hasText: 'Автор' })).toBeVisible();
  await expect(table.locator('th', { hasText: 'Версия' })).toBeVisible();
  await expect(table.locator('th', { hasText: 'Публикация' })).toBeVisible();
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
  await page.getByRole('tab', { name: 'Мои алгоритмы' }).click();
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

  // Переключаем 3-уровневую видимость: Закрытый код -> Приватный -> Публичный.
  const visGroup = detail.getByRole('group', { name: 'Уровень видимости алгоритма' });
  await visGroup.getByRole('button', { name: 'Закрытый код' }).click();
  await expect(detail).toContainText('Код скрыт от других пользователей');
  await visGroup.getByRole('button', { name: 'Приватный' }).click();
  await expect(detail).toContainText('Приватный');
  await visGroup.getByRole('button', { name: 'Публичный' }).click();
  await expect(detail).toContainText('Публичный');

  // Открываем форму запуска прогона и запускаем прогон.
  await detail.getByRole('button', { name: 'Запустить прогон' }).click();
  await expect(
    detail.getByRole('heading', { name: 'Запуск прогона: Эталон платформы (форк)' }),
  ).toBeVisible();

  await detail.getByRole('button', { name: 'Запустить' }).click();
  await expect(page).toHaveURL(/\/runs\/R-\d{4}$/);
  await expect(page.getByText('Отчёт сформирован и готов к просмотру.')).toBeVisible();
});

test('сравнение выбранных алгоритмов (UC-22): переход из compareList, метрики, наложение кривых и снятие алгоритма', async ({
  page,
}) => {
  await page.goto('/workshop');

  const addToCompare = async (id: string) => {
    await page.locator(`tr[data-algo-id="${id}"]`).getByRole('button', { name: 'Открыть' }).click();
    const detail = page.getByRole('complementary', { name: 'Карточка алгоритма' });
    await detail.getByRole('button', { name: 'Добавить в сравнение' }).click();
    await detail.getByRole('button', { name: 'Закрыть' }).click();
    await expect(detail).toHaveCount(0);
  };

  // При 1 алгоритме кнопка «Сравнить (1)» отключена и видна подсказка.
  await addToCompare('A-0002');
  await expect(page.getByText('Выберите ещё минимум один алгоритм')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Сравнить (1)' })).toBeDisabled();

  // Добавляем ещё 2 алгоритма (один с прогоном, один без прогона) и переходим к сравнению.
  await addToCompare('A-0003');
  await addToCompare('A-0001');

  const compareLink = page.getByRole('link', { name: 'Сравнить (3)' });
  await expect(compareLink).toBeVisible();
  await compareLink.click();

  await expect(page).toHaveURL(/\/workshop\/compare\?ids=A-0002,A-0003,A-0001/);
  await expect(page.getByRole('heading', { name: 'Сравнение алгоритмов' })).toBeVisible();

  // Сравнительная таблица метрик, выделение лучшего значения, предупреждение о разных периодах и «Нет прогона».
  await expect(page.locator('.compare-table')).toContainText('Momentum RSI');
  await expect(page.locator('.compare-table')).toContainText('Breakout ATR');
  await expect(page.locator('.compare-table')).toContainText('Эталон платформы');
  await expect(page.locator('.compare-table')).toContainText('+8,15 %');
  await expect(page.locator('.compare-table')).toContainText('+3,74 %');
  await expect(page.locator('.compare-table')).toContainText('Нет прогона');
  await expect(page.locator('.compare-table .best-cell').first()).toBeVisible();
  await expect(page.getByText('разных периодах, таймфреймах или наборах бумаг')).toBeVisible();

  // Наложение кривых доходности (canvas), переключение режима и скрытие серии без сдвига оси X.
  const chart = page.locator('app-workshop-compare-chart');
  await expect(chart.locator('canvas').first()).toBeVisible();
  const legendBtn = chart.getByRole('button', { name: 'Momentum RSI' });
  await expect(legendBtn).toHaveAttribute('aria-pressed', 'true');
  const getTimeAxisDataUrl = () =>
    chart.locator('canvas').evaluateAll((els) => {
      const timeAxis = els.find(
        (el): el is HTMLCanvasElement =>
          el instanceof HTMLCanvasElement && el.height > 0 && el.height <= 40 && el.width > 200,
      );
      return timeAxis ? timeAxis.toDataURL() : null;
    });
  const axisBefore = await getTimeAxisDataUrl();
  expect(axisBefore).not.toBeNull();
  for (let i = 0; i < 3; i++) {
    await legendBtn.click();
    await expect(legendBtn).toHaveAttribute('aria-pressed', 'false');
    await legendBtn.click();
    await expect(legendBtn).toHaveAttribute('aria-pressed', 'true');
  }
  expect(await getTimeAxisDataUrl()).toBe(axisBefore);
  await legendBtn.click();
  await expect(legendBtn).toHaveAttribute('aria-pressed', 'false');
  await chart.getByRole('button', { name: 'Капитал, ₽' }).click();

  // Убираем алгоритм без прогона прямо на экране сравнения: состояние графика сохраняется.
  await page.getByRole('button', { name: 'Убрать Эталон платформы из сравнения' }).click();
  await expect(page.locator('th[data-compare-algo="A-0001"]')).toHaveCount(0);
  await expect(page).toHaveURL(/\/workshop\/compare\?ids=A-0002,A-0003/);
  await expect(legendBtn).toHaveAttribute('aria-pressed', 'false');

  await page.getByRole('link', { name: 'Назад в Мастерскую' }).click();
  await expect(page).toHaveURL(/\/workshop\?compare=A-0002,A-0003/);
  await expect(page.getByText('В сравнении: 2 из 5')).toBeVisible();
});

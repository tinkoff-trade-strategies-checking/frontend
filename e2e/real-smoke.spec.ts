import { expect, test } from '@playwright/test';

const E2E_EMAIL = process.env['E2E_EMAIL'] ?? 'trader@example.com';
const E2E_PASSWORD = process.env['E2E_PASSWORD'] ?? '';

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

test('real-smoke: вход, арена и INV-8 F5, отчёт сессии, мастерская, прогон и отчёт прогона', async ({
  page,
}) => {
  expect(
    E2E_PASSWORD,
    'Задайте переменную E2E_PASSWORD (см. backend/deploy/dev-up.sh → deploy/.env.dev)',
  ).toBeTruthy();

  // 1. Вход (UC-1).
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
  await page.locator('#login-email').fill(E2E_EMAIL);
  await page.locator('#login-password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();

  await expect(page).toHaveURL(/\/new$/);
  await expect(page.getByRole('heading', { name: 'Новая сессия' })).toBeVisible();

  // 2. Запуск ручной сессии + проверка селектора фонового алгоритма + Арена + F5 (INV-8).
  const bgSelect = page.locator('#launch-background-algorithm');
  await expect(bgSelect).toBeVisible();
  await expect(bgSelect).toContainText('Эталон платформы (по умолчанию)');
  await expect(page.locator('aside.summary-col')).toContainText('Эталон платформы');

  await page.getByRole('button', { name: '20 дн.', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Запустить' })).toBeEnabled();
  await page.getByRole('button', { name: 'Запустить' }).click();

  await expect(page).toHaveURL(/\/arena\/[0-9a-f-]+$/i);
  const sessionMatch = /\/arena\/([0-9a-f-]+)$/i.exec(page.url());
  expect(sessionMatch).not.toBeNull();
  const sessionId = sessionMatch![1];

  const dayCounter = page.locator('.day-counter');
  await expect(dayCounter).toHaveText('День 1 из 20');

  const portfolio = page.locator('app-arena-portfolio-panel');
  const cashValue = portfolio.locator('.kv', { hasText: 'Свободные деньги' }).locator('.num');
  const investedValue = portfolio.locator('.kv', { hasText: 'В бумагах' }).locator('.num');
  const equityValue = portfolio
    .locator('.metric-item', { hasText: 'Стоимость портфеля' })
    .locator('.num')
    .first();

  const ordersPanel = page.locator('app-arena-orders-panel');
  const activeTab = ordersPanel.locator('button', { hasText: 'Активные заявки' });
  const fillsTab = ordersPanel.locator('button', { hasText: 'Сделки' });
  const activeBadge = activeTab.locator('.tab-badge');
  const fillsBadge = fillsTab.locator('.tab-badge');

  // Шаг 1 -> выставляем рыночную заявку -> Шаг 2 (исполнение).
  await page.getByRole('button', { name: 'Следующая свеча' }).click();
  await expect(dayCounter).toHaveText('День 2 из 20');

  await page.getByRole('button', { name: 'Выставить заявку' }).click();
  await expect(activeBadge).toHaveText('1');

  await page.getByRole('button', { name: 'Следующая свеча' }).click();
  await expect(dayCounter).toHaveText('День 3 из 20');
  await expect(activeBadge).toHaveText('0');
  await expect(fillsBadge).toHaveText('1');

  await expect(cashValue).not.toHaveText('100,00 %');
  await expect(investedValue).not.toHaveText('0,00 %');

  // Выставляем лимитную GTC-заявку, чтобы проверить восстановление и активных заявок, и сделок после F5.
  await page.locator('#arena-order-type').selectOption({ label: 'Лимитная' });
  await page.getByRole('button', { name: 'До отмены' }).click();
  await page.getByRole('button', { name: 'Выставить заявку' }).click();
  await expect(activeBadge).toHaveText('1');

  const activeOrdersBeforeReload = (await ordersPanel.locator('tbody tr').allInnerTexts()).map(
    normalizeSpaces,
  );
  await fillsTab.click();
  await expect(ordersPanel.locator('tbody tr')).toHaveCount(1);
  const fillsBeforeReload = (await ordersPanel.locator('tbody tr').allInnerTexts()).map(
    normalizeSpaces,
  );
  await activeTab.click();

  const snapshotBeforeReload = {
    day: normalizeSpaces(await dayCounter.innerText()),
    equity: normalizeSpaces(await equityValue.innerText()),
    cash: normalizeSpaces(await cashValue.innerText()),
    invested: normalizeSpaces(await investedValue.innerText()),
    positions: (await portfolio.locator('tbody tr').allInnerTexts()).map(normalizeSpaces),
    activeOrders: activeOrdersBeforeReload,
    fills: fillsBeforeReload,
  };

  // INV-8: F5 восстанавливает шаг, деньги, позиции, активные заявки и сделки из журнала backend.
  await page.reload();

  await expect(dayCounter).toHaveText(snapshotBeforeReload.day);
  await expect(equityValue).toHaveText(snapshotBeforeReload.equity);
  await expect(cashValue).toHaveText(snapshotBeforeReload.cash);
  await expect(investedValue).toHaveText(snapshotBeforeReload.invested);
  await expect(activeBadge).toHaveText('1');
  await expect(fillsBadge).toHaveText('1');

  const restoredPositions = (await portfolio.locator('tbody tr').allInnerTexts()).map(
    normalizeSpaces,
  );
  expect(restoredPositions).toEqual(snapshotBeforeReload.positions);

  const restoredActiveOrders = (await ordersPanel.locator('tbody tr').allInnerTexts()).map(
    normalizeSpaces,
  );
  expect(restoredActiveOrders).toEqual(snapshotBeforeReload.activeOrders);

  await fillsTab.click();
  await expect(ordersPanel.locator('tbody tr')).toHaveCount(1);
  const restoredFills = (await ordersPanel.locator('tbody tr').allInnerTexts()).map(
    normalizeSpaces,
  );
  expect(restoredFills).toEqual(snapshotBeforeReload.fills);

  // Досрочное завершение сессии.
  await page.getByRole('button', { name: 'Завершить сессию' }).click();
  await page.locator('tui-dialog').getByRole('button', { name: 'Завершить сессию' }).click();
  await expect(page.getByText('Завершена', { exact: true })).toBeVisible();

  // 3. Отчёт сессии (метрики и расхождения).
  await page.locator('main').getByRole('link', { name: 'Открыть отчёт' }).click();
  await expect(page).toHaveURL(new RegExp(`/report/${sessionId}$`));
  await expect(page.getByText('Период раскрыт')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Показатели эффективности' })).toBeVisible();

  await page.getByRole('button', { name: 'Расхождения' }).click();
  await expect(page.getByRole('button', { name: /^Все \([1-9]\d*\)$/ })).toBeVisible();

  // 4. Мастерская -> Проверка (L001) -> Автоисправление -> Публикация -> Прогон -> Отчёт прогона.
  await page.locator('nav').getByRole('link', { name: 'Мастерская' }).click();
  await expect(page).toHaveURL(/\/workshop$/);
  await expect(page.getByRole('heading', { name: 'Мастерская' })).toBeVisible();

  const strategyName = `Smoke Strategy ${Date.now()}`;
  const becauseText = 'Вход в позицию';
  await page.getByRole('button', { name: 'Новый алгоритм' }).click();
  const detail = page.getByRole('complementary', { name: 'Карточка алгоритма' });
  await expect(detail.getByRole('heading', { name: 'Новый алгоритм' })).toBeVisible();

  await page.locator('#workshop-draft-name').fill(strategyName);
  await page.locator('#workshop-draft-description').fill('Сквозной тест реального стека');
  await page
    .locator('#workshop-draft-source')
    .fill(
      `rule "вход" when position == 0 and close >= low then buy 10 % cash because "${becauseText}"`,
    );

  await detail.getByRole('button', { name: 'Создать черновик' }).click();
  await expect(
    detail.getByRole('heading', { name: 'Публикация новой неизменяемой версии' }),
  ).toBeVisible();

  await detail.getByRole('button', { name: 'Проверить' }).click();
  const checkSection = detail.getByRole('region', { name: 'Результаты проверки DSL' });
  await expect(checkSection).toContainText('L001');

  await detail
    .getByRole('button', { name: /^Исправить:/ })
    .first()
    .click();
  await expect(checkSection).toContainText('OK · Без ошибок');
  await expect(checkSection).toContainText('Ошибок и предупреждений не обнаружено.');

  await page.locator('#workshop-publish-summary').fill('Вынес константу в параметр');
  await detail.getByRole('button', { name: 'Опубликовать версию' }).click();
  await expect(detail).toContainText('Опубликована версия v1.');

  await detail.getByRole('button', { name: 'К карточке' }).click();
  await expect(detail).toContainText('v1');
  await expect(detail).toContainText('неизменяема');

  await detail.getByRole('button', { name: 'Запустить прогон' }).click();
  await expect(
    detail.getByRole('heading', { name: `Запуск прогона: ${strategyName}` }),
  ).toBeVisible();
  await detail.getByRole('button', { name: '20 дн.', exact: true }).click();
  await detail.getByRole('button', { name: 'Запустить' }).click();

  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]+$/i);
  await expect(page.getByText('Отчёт сформирован и готов к просмотру.')).toBeVisible({
    timeout: 60_000,
  });

  await page.getByRole('button', { name: 'Открыть отчёт' }).click();
  await expect(page).toHaveURL(/\/runs\/[0-9a-f-]+\/report$/i);
  await expect(page.getByRole('heading', { name: 'Метрики и издержки' })).toBeVisible();

  await page.getByRole('button', { name: 'Заявки алгоритма' }).click();
  await expect(page.locator('.tab-body tbody')).toContainText(becauseText);
});

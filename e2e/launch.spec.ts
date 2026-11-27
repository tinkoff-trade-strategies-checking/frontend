import { expect, test } from '@playwright/test';

test('launch: своё значение начального капитала попадает в сводку и поджимается до границ диапазона', async ({
  page,
}) => {
  await page.goto('/new');
  await expect(page.getByRole('heading', { name: 'Новая сессия' })).toBeVisible();
  await page.getByRole('button', { name: 'Настроить вручную' }).click();

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

test('launch: карточки сценариев в Базовом режиме и автоматическое раскрытие полной формы в Профи', async ({
  page,
}) => {
  await page.goto('/new');
  await expect(page.getByRole('heading', { name: 'Новая сессия' })).toBeVisible();

  const scenarios = page.locator('article.scenario-card');
  await expect(scenarios).toHaveCount(3);
  await expect(page.locator('aside.summary-col')).toHaveCount(0);

  // Переключаемся в «Профи» — карточки скрываются, полная форма с «Кто торгует» открыта сразу.
  await page.locator('header').getByRole('button', { name: 'Профи', exact: true }).click();
  await expect(scenarios).toHaveCount(0);
  await expect(page.locator('aside.summary-col')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Кто торгует' })).toBeVisible();

  // Возвращаемся в «Базовый» и запускаем карточку «Собери портфель».
  await page.locator('header').getByRole('button', { name: 'Базовый', exact: true }).click();
  const portfolioCard = page.locator('article.scenario-card[data-scenario-id="portfolio"]');
  await expect(portfolioCard).toBeVisible();
  await portfolioCard.getByRole('button', { name: 'Начать сценарий' }).click();

  await expect(page).toHaveURL(/\/arena\/S-\d+$/);
  await expect(page.locator('.day-counter')).toHaveText('День 1 из 60');
  await expect(page.getByRole('tab')).toHaveCount(3);
});

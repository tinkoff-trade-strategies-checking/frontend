import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env['E2E_REAL_BASE_URL'] ?? 'http://localhost:4200';
const IS_CI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './e2e',
  testMatch: /real-smoke\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  forbidOnly: IS_CI,
  reporter: IS_CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Локально используем системный Chrome без скачивания браузеров Playwright.
        ...(IS_CI ? {} : { channel: 'chrome' }),
      },
    },
  ],
});

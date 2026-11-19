import { defineConfig, devices } from '@playwright/test';

const PORT = 4301;
const BASE_URL = `http://localhost:${PORT}`;
const IS_CI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: 0,
  reporter: IS_CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
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
  webServer: {
    command: `npm run start:stub -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

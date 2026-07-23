import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5174';

export default defineConfig({
  testDir: './tests',
  testIgnore: ['full-stack/**', 'feishu-live/**'],
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  workers: process.env.CI ? 2 : 4,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  // 本地/CI 未手动起服时自动拉起 Vite，避免 ERR_CONNECTION_REFUSED
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npx vite --port 5174 --host 127.0.0.1',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

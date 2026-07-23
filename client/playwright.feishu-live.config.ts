import { defineConfig, devices } from '@playwright/test';

const clientPort = 5186;
const serverPort = 3016;

/**
 * 真实飞书公开文档认证：强制关闭本地 fixture，必须能访问外网。
 * 运行：FEISHU_LIVE_CORPUS=1 npm run test:e2e:feishu-live
 */
export default defineConfig({
  testDir: './tests/feishu-live',
  globalSetup: './tests/feishu-live/globalSetup.ts',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${clientPort}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `vite --port ${clientPort} --host 127.0.0.1`,
    env: {
      VITE_API_PROXY_TARGET: `http://127.0.0.1:${serverPort}`,
      VITE_CACHE_DIR: 'test-results/.vite-feishu-live',
      FEISHU_IMPORT_FIXTURE_MODE: '0',
    },
    url: `http://127.0.0.1:${clientPort}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

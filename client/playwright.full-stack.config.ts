import { defineConfig, devices } from '@playwright/test';

const clientPort = 5184;
const serverPort = 3014;

export default defineConfig({
  testDir: './tests/full-stack',
  globalSetup: './tests/full-stack/globalSetup.ts',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${clientPort}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `vite --port ${clientPort} --host 127.0.0.1`,
    env: {
      VITE_API_PROXY_TARGET: `http://127.0.0.1:${serverPort}`,
      // 单次运行独占预构建目录，避免异常退出后的 esbuild 文件锁污染下一轮。
      VITE_CACHE_DIR: `test-results/.vite-full-stack-${process.pid}-${Date.now()}`,
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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { FullConfig } from '@playwright/test';

const serverPort = 3016;

export default async function globalSetup(_config: FullConfig) {
  if (process.env.FEISHU_LIVE_CORPUS !== '1') {
    throw new Error(
      '拒绝启动：真实飞书认证需要 FEISHU_LIVE_CORPUS=1。示例：FEISHU_LIVE_CORPUS=1 npm run test:e2e:feishu-live',
    );
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feishu-doc-live-'));
  process.env.FEISHU_DOC_DB_PATH = path.join(tempDir, 'db.json');
  // 禁止本地样例伪装成功；live 必须真实抓取
  process.env.FEISHU_IMPORT_FIXTURE_MODE = '0';
  process.env.NODE_ENV = 'test';

  const appModule = await import('../../../server/src/app');
  const app = appModule.default;
  const server = await new Promise<Server>((resolve, reject) => {
    const listeningServer = app.listen(serverPort, '127.0.0.1', () => resolve(listeningServer));
    listeningServer.once('error', reject);
  });

  return async () => {
    await new Promise<void>((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
    });
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.FEISHU_DOC_DB_PATH;
    delete process.env.FEISHU_IMPORT_FIXTURE_MODE;
  };
}

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { FullConfig } from '@playwright/test';

const serverPort = 3014;

export default async function globalSetup(_config: FullConfig) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feishu-doc-full-stack-'));
  process.env.FEISHU_DOC_DB_PATH = path.join(tempDir, 'db.json');
  process.env.NODE_ENV = 'test';

  const appModule = await import('../../../server/src/app');
  const app = appModule.default;
  const server = await new Promise<Server>((resolve, reject) => {
    const listeningServer = app.listen(serverPort, '127.0.0.1', () => resolve(listeningServer));
    listeningServer.once('error', reject);
  });

  return async () => {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.FEISHU_DOC_DB_PATH;
  };
}
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcess } from 'node:child_process';
import type { FullConfig } from '@playwright/test';

const serverPort = 3014;
const currentDir = path.dirname(fileURLToPath(import.meta.url));

async function waitForServer(server: ChildProcess) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`全栈测试服务提前退出，exit code: ${server.exitCode}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${serverPort}/api/health`);
      if (response.ok) return;
    } catch {
      // 服务仍在启动，继续短暂轮询。
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`全栈测试服务未在 15 秒内监听端口 ${serverPort}`);
}

export default async function globalSetup(_config: FullConfig) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feishu-doc-full-stack-'));
  process.env.FEISHU_DOC_DB_PATH = path.join(tempDir, 'db.json');
  process.env.NODE_ENV = 'test';
  process.env.FEISHU_TEST_SERVER = '1';

  const serverRoot = path.resolve(currentDir, '../../../server');
  const tsxCli = path.join(serverRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const server = spawn(
    process.execPath,
    [tsxCli, 'src/index.ts'],
    {
      cwd: serverRoot,
      env: {
        ...process.env,
        PORT: String(serverPort),
      },
      stdio: 'pipe',
      windowsHide: true,
    },
  );
  let startupOutput = '';
  server.stdout?.on('data', chunk => { startupOutput += String(chunk); });
  server.stderr?.on('data', chunk => { startupOutput += String(chunk); });

  try {
    await waitForServer(server);
  } catch (error) {
    server.kill();
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw new Error(`${error instanceof Error ? error.message : '全栈测试服务启动失败'}\n${startupOutput}`);
  }

  return async () => {
    server.kill();
    await new Promise<void>(resolve => {
      if (server.exitCode !== null) {
        resolve();
        return;
      }
      server.once('exit', () => resolve());
      setTimeout(resolve, 1_000).unref();
    });
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.FEISHU_DOC_DB_PATH;
    delete process.env.FEISHU_TEST_SERVER;
  };
}
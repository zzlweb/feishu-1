import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {
  assertHighFrequencyBlockCoverage,
  lookupBlockSupport,
} from '../src/import/blockMap';
import { createFeishuApiClient, FeishuApiError, isFeishuApiError } from '../src/import/feishuApiClient';
import { mirrorRemoteAsset } from '../src/import/assetPipeline';
import { emitLocalHtml } from '../src/import/localHtmlEmitter';
import { importFeishuPublicUrl } from '../src/feishuPublicImporter';
import type { ImportWarning } from '../src/import/types';

const QUALITY_RANK = { full: 3, partial: 2, fallback: 1 } as const;

test('BLOCK_MAP covers high-frequency blocks as full or partial', () => {
  assert.doesNotThrow(() => assertHighFrequencyBlockCoverage());
  assert.equal(lookupBlockSupport('equation'), 'full');
  assert.equal(lookupBlockSupport('image'), 'partial');
  assert.equal(lookupBlockSupport('sheet'), 'unsupported');
});

test('emitLocalHtml renders formula blocks for KaTeX', () => {
  const emitted = emitLocalHtml({
    title: '公式',
    sourceName: 'test',
    blocks: [{ type: 'formula', formula: 'E=mc^2' }],
    assets: [],
    warnings: [],
    importQuality: 'full',
  });
  assert.match(emitted.content, /data-local-block="formula"/);
  assert.match(emitted.content, /data-formula="E=mc\^2"/);
  assert.match(emitted.content, /feishu-formula-block/);
});

test('mirrorRemoteAsset downloads to /static/uploads and records failures as warnings', async () => {
  const body = Buffer.from('png-bytes');
  const server = http.createServer((req, res) => {
    if (req.url === '/ok.png') {
      res.setHeader('Content-Type', 'image/png');
      res.end(body);
      return;
    }
    res.statusCode = 500;
    res.end('fail');
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const warnings: ImportWarning[] = [];

  try {
    const ok = await mirrorRemoteAsset(`${baseUrl}/ok.png`, {}, warnings);
    assert.equal(ok.status, 'downloaded');
    assert.match(ok.localUrl || '', /^\/static\/uploads\//);
    const filePath = path.resolve(__dirname, '..', 'public', ok.localUrl!.replace('/static/', ''));
    assert.ok(fs.existsSync(filePath));
    fs.unlinkSync(filePath);

    const failed = await mirrorRemoteAsset(`${baseUrl}/missing.png`, {}, warnings);
    assert.equal(failed.status, 'failed');
    assert.ok(warnings.some(item => item.type === 'asset'));
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('FeishuApiError exposes FEISHU_AUTH_FAILED when tenant token fails', async () => {
  const server = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ code: 99991663, msg: 'app id or secret invalid' }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  try {
    const client = createFeishuApiClient({
      appId: 'bad',
      appSecret: 'bad',
      baseUrl: `http://127.0.0.1:${address.port}`,
    });
    await assert.rejects(
      () => client.getTenantAccessToken(),
      (error: unknown) => {
        assert.ok(isFeishuApiError(error));
        assert.equal((error as FeishuApiError).code, 'FEISHU_AUTH_FAILED');
        assert.match((error as FeishuApiError).message, /app id or secret invalid|FEISHU_APP/i);
        return true;
      },
    );
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('importFeishuPublicUrl surfaces FEISHU_AUTH_FAILED in warnings then falls back to HTML', async () => {
  const server = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ code: 99991663, msg: 'invalid app credentials' }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const previousAppId = process.env.FEISHU_APP_ID;
  const previousSecret = process.env.FEISHU_APP_SECRET;
  const previousBaseUrl = process.env.FEISHU_OPEN_API_BASE_URL;
  process.env.FEISHU_APP_ID = 'test-app';
  process.env.FEISHU_APP_SECRET = 'test-secret';
  process.env.FEISHU_OPEN_API_BASE_URL = `http://127.0.0.1:${address.port}`;

  try {
    const imported = await importFeishuPublicUrl(
      'https://qcntpn5n60jv.feishu.cn/wiki/mockDocToken',
      async () => '<html><body><h1>公开页回退</h1><p>可见正文</p></body></html>',
    );
    assert.ok(imported.warnings.some(item => item.includes('FEISHU_AUTH_FAILED')));
    assert.match(imported.content, /公开页回退|可见正文/);
    assert.ok(QUALITY_RANK[imported.importQuality] >= QUALITY_RANK.fallback);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (previousAppId === undefined) delete process.env.FEISHU_APP_ID;
    else process.env.FEISHU_APP_ID = previousAppId;
    if (previousSecret === undefined) delete process.env.FEISHU_APP_SECRET;
    else process.env.FEISHU_APP_SECRET = previousSecret;
    if (previousBaseUrl === undefined) delete process.env.FEISHU_OPEN_API_BASE_URL;
    else process.env.FEISHU_OPEN_API_BASE_URL = previousBaseUrl;
  }
});

test('Open API import quality ranks above same-URL HTML fallback', async () => {
  const blocks = [
    {
      block_id: 'page',
      block_type: 1,
      children: ['heading', 'para', 'equation'],
      page: { elements: [{ text_run: { content: '质量对比样例' } }] },
    },
    {
      block_id: 'heading',
      block_type: 3,
      heading1: { elements: [{ text_run: { content: '质量对比样例' } }] },
    },
    {
      block_id: 'para',
      block_type: 2,
      text: { elements: [{ text_run: { content: '结构化段落' } }] },
    },
    {
      block_id: 'equation',
      block_type: 40,
      equation: { content: 'a^2+b^2=c^2' },
    },
  ];

  const server = http.createServer((req, res) => {
    if (req.url === '/open-apis/auth/v3/tenant_access_token/internal') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ code: 0, tenant_access_token: 'test-token' }));
      return;
    }
    if (req.url?.startsWith('/open-apis/wiki/v2/spaces/get_node')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        code: 0,
        data: { node: { obj_token: 'mockDocToken', obj_type: 'docx', title: '质量对比样例' } },
      }));
      return;
    }
    if (req.url?.startsWith('/open-apis/docx/v1/documents/mockDocToken/blocks')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ code: 0, data: { items: blocks, has_more: false } }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ code: 404, msg: 'not found' }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const previousAppId = process.env.FEISHU_APP_ID;
  const previousSecret = process.env.FEISHU_APP_SECRET;
  const previousBaseUrl = process.env.FEISHU_OPEN_API_BASE_URL;
  const fallbackHtml = '<html><body><p>仅公开页可见片段</p></body></html>';

  try {
    process.env.FEISHU_APP_ID = 'test-app';
    process.env.FEISHU_APP_SECRET = 'test-secret';
    process.env.FEISHU_OPEN_API_BASE_URL = baseUrl;
    const apiImported = await importFeishuPublicUrl(
      'https://qcntpn5n60jv.feishu.cn/wiki/mockDocToken',
      async () => fallbackHtml,
    );

    delete process.env.FEISHU_APP_ID;
    delete process.env.FEISHU_APP_SECRET;
    delete process.env.FEISHU_OPEN_API_BASE_URL;
    const htmlImported = await importFeishuPublicUrl(
      'https://qcntpn5n60jv.feishu.cn/wiki/mockDocToken',
      async () => fallbackHtml,
    );

    assert.match(apiImported.content, /data-local-block="formula"/);
    assert.match(apiImported.content, /a\^2\+b\^2=c\^2/);
    assert.ok(
      QUALITY_RANK[apiImported.importQuality] >= QUALITY_RANK[htmlImported.importQuality],
      `expected API quality ${apiImported.importQuality} >= HTML ${htmlImported.importQuality}`,
    );
    assert.ok(QUALITY_RANK[apiImported.importQuality] >= QUALITY_RANK.partial);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (previousAppId === undefined) delete process.env.FEISHU_APP_ID;
    else process.env.FEISHU_APP_ID = previousAppId;
    if (previousSecret === undefined) delete process.env.FEISHU_APP_SECRET;
    else process.env.FEISHU_APP_SECRET = previousSecret;
    if (previousBaseUrl === undefined) delete process.env.FEISHU_OPEN_API_BASE_URL;
    else process.env.FEISHU_OPEN_API_BASE_URL = previousBaseUrl;
  }
});

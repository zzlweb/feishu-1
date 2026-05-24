import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import appModule from '../src/app';

process.env.NODE_ENV = 'test';

const app = (appModule as any).default ?? appModule;

async function withApi<T>(fn: (api: <R>(url: string, init?: RequestInit) => Promise<{ status: number; body: R }>) => Promise<T>) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feishu-doc-api-'));
  process.env.FEISHU_DOC_DB_PATH = path.join(tempDir, 'db.json');

  let server!: Server;
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function api<R>(url: string, init?: RequestInit): Promise<{ status: number; body: R }> {
    const res = await fetch(`${baseUrl}${url}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    return { status: res.status, body: await res.json() as R };
  }

  try {
    return await fn(api);
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.FEISHU_DOC_DB_PATH;
  }
}

test('document lifecycle APIs create, update, list, duplicate, template and delete', async () => {
  await withApi(async (api) => {
    const created = await api<any>('/api/documents', {
      method: 'POST',
      body: JSON.stringify({ title: '自动化功能测试', content: '<p>hello</p>', author: '测试员' }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.code, 0);
    assert.equal(created.body.data.title, '自动化功能测试');
    const id = created.body.data.id;

    const updated = await api<any>(`/api/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: '已自动保存',
        content: '<h1>标题</h1><p>正文</p>',
        cover_url: '/static/01.gif',
        icon: '📘',
        parent_id: 'parent-doc',
        collapsed_heading_ids: ['heading-a', 'heading-b', 'heading-a'],
      }),
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.title, '已自动保存');
    assert.match(updated.body.data.content, /<h1>标题<\/h1>/);
    assert.deepEqual(updated.body.data.collapsed_heading_ids, ['heading-a', 'heading-b']);

    const list = await api<any>('/api/documents');
    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.data[0].id, id);

    const comment = await api<any>(`/api/documents/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: '评论内容', author: '测试员', position_from: 1, position_to: 3 }),
    });
    assert.equal(comment.status, 201);
    assert.equal(comment.body.data.content, '评论内容');

    const duplicated = await api<any>(`/api/documents/${id}/duplicate`, { method: 'POST' });
    assert.equal(duplicated.status, 201);
    assert.equal(duplicated.body.data.title, '已自动保存 (副本)');
    assert.equal(duplicated.body.data.cover_url, '/static/01.gif');
    assert.equal(duplicated.body.data.icon, '📘');
    assert.equal(duplicated.body.data.parent_id, 'parent-doc');
    assert.deepEqual(duplicated.body.data.collapsed_heading_ids, ['heading-a', 'heading-b']);

    const child = await api<any>(`/api/documents/${id}/children`, {
      method: 'POST',
      body: JSON.stringify({ title: '子文档标题', content: '<p>迁移内容</p>' }),
    });
    assert.equal(child.status, 201);
    assert.equal(child.body.data.parent_id, id);
    assert.equal(child.body.data.title, '子文档标题');
    assert.equal(child.body.data.content, '<p>迁移内容</p>');

    const template = await api<any>(`/api/documents/${id}/save-as-template`, { method: 'POST' });
    assert.equal(template.status, 201);
    assert.equal(template.body.data.title, '已自动保存');

    const blockTemplate = await api<any>('/api/documents/templates', {
      method: 'POST',
      body: JSON.stringify({ title: '标题块模板', content: '<h1>标题</h1>', author: '测试员' }),
    });
    assert.equal(blockTemplate.status, 201);
    assert.equal(blockTemplate.body.data.title, '标题块模板');
    assert.equal(blockTemplate.body.data.content, '<h1>标题</h1>');

    const templates = await api<any>('/api/documents/templates/list');
    assert.equal(templates.status, 200);
    assert.equal(templates.body.data.length, 7);

    const removed = await api<any>(`/api/documents/${id}`, { method: 'DELETE' });
    assert.equal(removed.status, 200);

    const missing = await api<any>(`/api/documents/${id}`);
    assert.equal(missing.status, 404);
  });
});

test('health API returns ok', async () => {
  await withApi(async (api) => {
    const health = await api<any>('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'ok');
  });
});

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

process.env.NODE_ENV = 'test';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feishu-doc-api-'));
process.env.FEISHU_DOC_DB_PATH = path.join(tempDir, 'db.json');

let baseUrl = '';
let server: Server;

async function api<T>(url: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(`${baseUrl}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  return { status: res.status, body: await res.json() as T };
}

before(async () => {
  const { default: app } = await import('../src/index');
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('document lifecycle APIs create, update, list, duplicate, template and delete', async () => {
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
    body: JSON.stringify({ title: '已自动保存', content: '<h1>标题</h1><p>正文</p>' }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.title, '已自动保存');
  assert.match(updated.body.data.content, /<h1>标题<\/h1>/);

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

  const template = await api<any>(`/api/documents/${id}/save-as-template`, { method: 'POST' });
  assert.equal(template.status, 201);
  assert.equal(template.body.data.title, '已自动保存');

  const templates = await api<any>('/api/documents/templates/list');
  assert.equal(templates.status, 200);
  assert.equal(templates.body.data.length, 1);

  const removed = await api<any>(`/api/documents/${id}`, { method: 'DELETE' });
  assert.equal(removed.status, 200);

  const missing = await api<any>(`/api/documents/${id}`);
  assert.equal(missing.status, 404);
});

test('health API returns ok', async () => {
  const health = await api<any>('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');
});

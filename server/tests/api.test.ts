import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import JSZip from 'jszip';
import appModule from '../src/app';

process.env.NODE_ENV = 'test';

const app = (appModule as any).default ?? appModule;

interface ApiTestContext {
  dbPath: string;
  tempDir: string;
}

async function withApi<T>(fn: (
  api: <R>(url: string, init?: RequestInit) => Promise<{ status: number; body: R }>,
  context: ApiTestContext,
) => Promise<T>) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feishu-doc-api-'));
  const dbPath = path.join(tempDir, 'db.json');
  process.env.FEISHU_DOC_DB_PATH = dbPath;

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
    return await fn(api, { dbPath, tempDir });
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
    assert.equal(templates.body.data.length, 8);

    const deletedTemplate = await api<any>(`/api/documents/templates/${blockTemplate.body.data.id}`, { method: 'DELETE' });
    assert.equal(deletedTemplate.status, 200);

    const templatesAfterDelete = await api<any>('/api/documents/templates/list');
    assert.equal(templatesAfterDelete.status, 200);
    assert.equal(templatesAfterDelete.body.data.some((item: any) => item.id === blockTemplate.body.data.id), false);

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

test('document updates use version checks and reject stale writers', async () => {
  await withApi(async (api) => {
    const created = await api<any>('/api/documents', {
      method: 'POST',
      body: JSON.stringify({ title: '版本测试', content: '<p>v1</p>' }),
    });
    const document = created.body.data;
    assert.equal(document.version, 1);
    assert.equal(document.schema_version, 1);

    const first = await api<any>(`/api/documents/${document.id}`, {
      method: 'PUT',
      body: JSON.stringify({ title: '第一个写入者', base_version: 1 }),
    });
    assert.equal(first.status, 200);
    assert.equal(first.body.data.version, 2);

    const stale = await api<any>(`/api/documents/${document.id}`, {
      method: 'PUT',
      body: JSON.stringify({ title: '陈旧写入者', base_version: 1 }),
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, 409);
    assert.equal(stale.body.data.version, 2);
    assert.equal(stale.body.data.title, '第一个写入者');

    const restored = await api<any>(`/api/documents/${document.id}`);
    assert.equal(restored.body.data.title, '第一个写入者');
    assert.equal(restored.body.data.version, 2);
  });
});

test('legacy comments are normalized and restored from the database', async () => {
  await withApi(async (api, { dbPath }) => {
    const createdAt = '2026-01-02T03:04:05.000Z';
    fs.writeFileSync(dbPath, JSON.stringify({
      documents: [{
        id: 'legacy-document',
        title: '旧文档',
        content: '<p>legacy</p>',
        author: '旧用户',
        created_at: createdAt,
        updated_at: createdAt,
        is_template: 0,
      }],
      comments: [{
        id: 'legacy-comment',
        document_id: 'legacy-document',
        block_id: 'legacy-block',
        content: '旧评论',
        author: '旧用户',
        position_from: 1,
        position_to: 3,
        created_at: createdAt,
        resolved: 0,
      }],
      templates: [],
    }), 'utf-8');

    const comments = await api<any>('/api/documents/legacy-document/comments');
    assert.equal(comments.status, 200);
    assert.equal(comments.body.data[0].thread_id, 'legacy-block');
    assert.equal(comments.body.data[0].message_id, 'legacy-comment');
    assert.equal(comments.body.data[0].status, 'open');
    assert.equal(comments.body.data[0].visibility, 'public');
    assert.equal(comments.body.data[0].updated_at, createdAt);

    const persisted = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    assert.deepEqual(persisted.documents[0].collapsed_heading_ids, []);
    assert.equal(persisted.comments[0].thread_id, 'legacy-block');
    assert.equal(persisted.comments[0].visibility, 'public');
    assert.ok(persisted.templates.length > 0);
  });
});

test('comment creation validates its target and persists client comment fields', async () => {
  await withApi(async (api, { dbPath }) => {
    const missing = await api<any>('/api/documents/missing-document/comments', {
      method: 'POST',
      body: JSON.stringify({ content: '不能写入' }),
    });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.message, '文档不存在');

    const document = await api<any>('/api/documents', {
      method: 'POST',
      body: JSON.stringify({ title: '评论字段测试' }),
    });
    const documentId = document.body.data.id;
    const payload = {
      id: 'client-comment-id',
      thread_id: 'client-thread-id',
      parent_id: 'parent-comment-id',
      message_id: 'client-message-id',
      block_id: 'paragraph-1',
      content: '字段完整的评论',
      author: '测试员',
      position_from: 4,
      position_to: 9,
      quote: '引用文字',
      anchor_type: 'text-range',
      anchor_json: '{"from":4,"to":9}',
      visibility: 'private',
      mentioned_user_ids: '["user-1"]',
      private_visible_user_ids: '["user-2"]',
    };
    const created = await api<any>(`/api/documents/${documentId}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    assert.equal(created.status, 201);
    for (const [field, value] of Object.entries(payload)) {
      assert.equal(created.body.data[field], value);
    }
    assert.equal(created.body.data.document_id, documentId);
    assert.equal(created.body.data.status, 'open');

    const persisted = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    const savedComment = persisted.comments.find((item: any) => item.id === payload.id);
    assert.ok(savedComment);
    for (const [field, value] of Object.entries(payload)) {
      assert.equal(savedComment[field], value);
    }

    const invalid = await api<any>(`/api/documents/${documentId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: 'bad', anchor_type: 'unknown' }),
    });
    assert.equal(invalid.status, 400);
  });
});

test('a corrupt database is backed up and never overwritten', async () => {
  await withApi(async (api, { dbPath, tempDir }) => {
    const corruptContents = '{"documents": [';
    fs.writeFileSync(dbPath, corruptContents, 'utf-8');

    const response = await api<any>('/api/documents');
    assert.equal(response.status, 500);
    assert.match(response.body.message, /数据库文件损坏/);
    assert.match(response.body.message, /原文件未被覆盖/);
    assert.equal(fs.readFileSync(dbPath, 'utf-8'), corruptContents);

    const backups = fs.readdirSync(tempDir).filter(name => /^db\.json\.corrupt-\d+T\d+Z(?:-\d+)?\.bak$/.test(name));
    assert.equal(backups.length, 1);
    assert.equal(fs.readFileSync(path.join(tempDir, backups[0]), 'utf-8'), corruptContents);
  });
});

test('document import API restores zip html content and bundled assets', async () => {
  await withApi(async (api) => {
    const zip = new JSZip();
    zip.file('assets/chart.png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    zip.file('index.html', [
      '<!doctype html><html><head><title>飞书导出文档</title><script>bad()</script></head><body>',
      '<h1>业务经营周报</h1>',
      '<p onclick="bad()">门店销售概况</p>',
      '<img src="./assets/chart.png">',
      '<table><tr><th>门店</th><th>销售额</th></tr><tr><td>A</td><td>75640</td></tr></table>',
      '</body></html>',
    ].join(''));
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const form = new FormData();
    form.append('author', '测试员');
    form.append('file', new Blob([buffer], { type: 'application/zip' }), 'feishu-export.zip');

    const imported = await api<any>('/api/documents/import', {
      method: 'POST',
      headers: {},
      body: form as any,
    });

    assert.equal(imported.status, 201);
    assert.equal(imported.body.code, 0);
    assert.equal(imported.body.data.document.title, '业务经营周报');
    assert.equal(imported.body.data.asset_count, 1);
    assert.match(imported.body.data.document.content, /<img[^>]+\/static\/uploads\//);
    assert.match(imported.body.data.document.content, /class="feishu-table/);
    assert.doesNotMatch(imported.body.data.document.content, /onclick|script/);

    const uploaded = imported.body.data.document.content.match(/\/static\/uploads\/([^"']+)/)?.[1];
    if (uploaded) {
      fs.rmSync(path.resolve(__dirname, '..', 'public', 'uploads', uploaded), { force: true });
    }
  });
});

test('document import-url API rejects invalid domains', async () => {
  await withApi(async (api) => {
    const invalid = await api<any>('/api/documents/import-url', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/wiki/test' }),
    });
    assert.equal(invalid.status, 400);
    assert.match(invalid.body.message, /feishu\.cn|larksuite\.com/);
  });
});

test('document import-url API imports public feishu wiki and optional template', async () => {
  await withApi(async (api) => {
    const imported = await api<any>('/api/documents/import-url', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://qcntpn5n60jv.feishu.cn/wiki/H58uwRchYi7889k6dnJcVoMMnO5',
        author: '测试员',
        save_as_template: true,
      }),
    });

    assert.equal(imported.status, 201);
    assert.equal(imported.body.code, 0);
    assert.equal(imported.body.data.document.title, '业务经营周报');
    assert.match(imported.body.data.document.content, /data-local-block="bitable"/);
    assert.match(imported.body.data.document.content, /data-model="/);
    assert.ok(Array.isArray(imported.body.data.warnings));
    assert.equal(imported.body.data.import_quality, 'partial');
    assert.ok(Array.isArray(imported.body.data.unsupported_blocks));
    assert.ok(imported.body.data.template);
    assert.equal(imported.body.data.template.title, '业务经营周报');

    const templates = await api<any>('/api/documents/templates/list');
    assert.equal(templates.status, 200);
    assert.ok(templates.body.data.some((item: any) => item.id === imported.body.data.template.id));
  });
});

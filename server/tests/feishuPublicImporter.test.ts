import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  importFeishuPublicHtml,
  importFeishuPublicUrl,
  isAllowedFeishuPublicUrl,
} from '../src/feishuPublicImporter';
import { BUSINESS_REPORT_FIXTURE_HTML } from '../src/fixtures/feishuBusinessReport';
import { FEISHU_PUBLIC_SAMPLE_FIXTURES } from '../src/fixtures/feishuPublicSamples';
import { getSampleCapabilityRow } from '../src/fixtures/feishuSampleCapabilityMatrix';

function startMockFeishuApi(
  blocks: unknown[],
  media: Record<string, { body: string; contentType: string }> = {},
  bitable: Record<string, unknown[]> = {},
  options: { wikiObjType?: string; wikiTitle?: string; appName?: string } = {},
) {
  const server = http.createServer((req, res) => {
    if (req.url === '/open-apis/auth/v3/tenant_access_token/internal') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ code: 0, tenant_access_token: 'test-token' }));
      return;
    }
    if (req.url?.startsWith('/open-apis/wiki/v2/spaces/get_node')) {
      assert.equal(req.headers.authorization, 'Bearer test-token');
      const token = new URL(req.url, 'http://localhost').searchParams.get('token') || '';
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        code: 0,
        data: { node: { obj_token: token, obj_type: options.wikiObjType || 'docx', title: options.wikiTitle || '' } },
      }));
      return;
    }
    const appMetaMatch = req.url?.match(/^\/open-apis\/bitable\/v1\/apps\/([^/?]+)(?:\?.*)?$/);
    if (appMetaMatch) {
      assert.equal(req.headers.authorization, 'Bearer test-token');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ code: 0, data: { app: { name: options.appName || '' } } }));
      return;
    }
    if (req.url?.startsWith('/open-apis/docx/v1/documents/mockDocToken/blocks')) {
      assert.equal(req.headers.authorization, 'Bearer test-token');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ code: 0, data: { items: blocks, has_more: false } }));
      return;
    }
    const bitableMatch = req.url?.match(/^\/open-apis\/bitable\/v1\/apps\/([^/]+)\/tables(?:\/([^/?]+))?(?:\/([^/?]+))?/);
    if (bitableMatch) {
      assert.equal(req.headers.authorization, 'Bearer test-token');
      const [, appToken, tableId, collection] = bitableMatch;
      const key = collection
        ? `${decodeURIComponent(appToken)}/${decodeURIComponent(tableId || '')}/${collection}`
        : `${decodeURIComponent(appToken)}/tables`;
      if (key in bitable) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ code: 0, data: { items: bitable[key], has_more: false } }));
        return;
      }
    }
    const mediaMatch = req.url?.match(/^\/open-apis\/drive\/v1\/medias\/([^/]+)\/download$/);
    if (mediaMatch) {
      assert.equal(req.headers.authorization, 'Bearer test-token');
      const item = media[decodeURIComponent(mediaMatch[1])];
      if (item) {
        res.setHeader('Content-Type', item.contentType);
        res.end(item.body);
        return;
      }
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = 404;
    res.end(JSON.stringify({ code: 404, msg: 'not found' }));
  });

  return new Promise<{ server: http.Server; baseUrl: string }>(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      assert.ok(address && typeof address === 'object');
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

test('isAllowedFeishuPublicUrl accepts feishu wiki links and rejects others', () => {
  assert.equal(
    isAllowedFeishuPublicUrl('https://qcntpn5n60jv.feishu.cn/wiki/H58uwRchYi7889k6dnJcVoMMnO5'),
    true,
  );
  assert.equal(isAllowedFeishuPublicUrl('https://example.com/wiki/test'), false);
  assert.equal(isAllowedFeishuPublicUrl('ftp://qcntpn5n60jv.feishu.cn/wiki/test'), false);
});

test('importFeishuPublicHtml converts business report into editable bitable blocks', () => {
  const imported = importFeishuPublicHtml(
    BUSINESS_REPORT_FIXTURE_HTML,
    'https://qcntpn5n60jv.feishu.cn/wiki/H58uwRchYi7889k6dnJcVoMMnO5',
  );

  assert.equal(imported.title, '业务经营周报');
  assert.match(imported.content, /data-local-block="bitable"/);
  assert.match(imported.content, /data-model="/);
  assert.match(imported.content, /data-view="grid"/);
  assert.match(imported.content, /data-view="gallery"/);
  assert.match(imported.content, /data-view="kanban"/);
  assert.match(imported.content, /data-local-block="dashboard"/);
  assert.match(imported.content, /data-source-table-id="/);
  assert.match(imported.content, /labelFieldName&quot;:&quot;门店/);
  assert.match(imported.content, /data-type="highlight-block"/);
  assert.match(imported.content, /data-type="taskList"/);
  assert.match(imported.content, /门店销售概况/);
  assert.match(imported.content, /商品销售概括/);
  assert.match(imported.content, /新业务开展进度/);
  assert.equal(imported.importQuality, 'partial');
  assert.ok(imported.unsupportedBlocks?.some(block => block.type === 'bitable'));
  assert.ok(imported.warnings.length > 0);
});

test('importFeishuPublicUrl uses injected fetch html provider', async () => {
  const imported = await importFeishuPublicUrl(
    'https://qcntpn5n60jv.feishu.cn/wiki/H58uwRchYi7889k6dnJcVoMMnO5',
    async () => BUSINESS_REPORT_FIXTURE_HTML,
  );
  assert.equal(imported.title, '业务经营周报');
  assert.match(imported.content, /4972/);
  assert.equal(imported.importQuality, 'partial');
  assert.match(imported.warnings.join('\n'), /FEISHU_APP_ID|高保真 fixture/);
});

test('importFeishuPublicUrl falls back to public html when Open API fails', async () => {
  const sample = FEISHU_PUBLIC_SAMPLE_FIXTURES.find(item => item.id === 'bitable-quickstart');
  assert.ok(sample);
  const previousAppId = process.env.FEISHU_APP_ID;
  const previousSecret = process.env.FEISHU_APP_SECRET;
  const previousBaseUrl = process.env.FEISHU_OPEN_API_BASE_URL;
  process.env.FEISHU_APP_ID = 'test-app';
  process.env.FEISHU_APP_SECRET = 'test-secret';
  process.env.FEISHU_OPEN_API_BASE_URL = 'http://127.0.0.1:1';
  try {
    const imported = await importFeishuPublicUrl(sample.url, async () => sample.rawHtml);
    assert.equal(imported.title, sample.title);
    assert.equal(imported.importQuality, 'fallback');
    assert.doesNotMatch(imported.content, /飞书 API 导入失败|invalid param/);
    assert.match(imported.content, /data-type="highlight-block"/);
  } finally {
    if (previousAppId === undefined) delete process.env.FEISHU_APP_ID;
    else process.env.FEISHU_APP_ID = previousAppId;
    if (previousSecret === undefined) delete process.env.FEISHU_APP_SECRET;
    else process.env.FEISHU_APP_SECRET = previousSecret;
    if (previousBaseUrl === undefined) delete process.env.FEISHU_OPEN_API_BASE_URL;
    else process.env.FEISHU_OPEN_API_BASE_URL = previousBaseUrl;
  }
});

test('importFeishuPublicUrl maps common Open API blocks into local editable HTML', async () => {
  const blocks = [
    {
      block_id: 'heading',
      block_type: 3,
      heading1: { elements: [{ text_run: { content: '结构化导入测试' } }] },
    },
    {
      block_id: 'bullet',
      block_type: 12,
      bullet: { elements: [{ text_run: { content: '无序列表项' } }] },
    },
    {
      block_id: 'ordered',
      block_type: 13,
      ordered: { elements: [{ text_run: { content: '有序列表项' } }] },
    },
    {
      block_id: 'todo',
      block_type: 17,
      todo: { checked: true, elements: [{ text_run: { content: '已完成待办' } }] },
    },
    {
      block_id: 'code',
      block_type: 14,
      code: { language: 22, elements: [{ text_run: { content: 'const ok = true;' } }] },
    },
    {
      block_id: 'divider',
      block_type: 22,
      divider: {},
    },
  ];
  const { server, baseUrl } = await startMockFeishuApi(blocks);
  const previousAppId = process.env.FEISHU_APP_ID;
  const previousSecret = process.env.FEISHU_APP_SECRET;
  const previousBaseUrl = process.env.FEISHU_OPEN_API_BASE_URL;
  process.env.FEISHU_APP_ID = 'test-app';
  process.env.FEISHU_APP_SECRET = 'test-secret';
  process.env.FEISHU_OPEN_API_BASE_URL = baseUrl;

  try {
    const imported = await importFeishuPublicUrl(
      'https://qcntpn5n60jv.feishu.cn/wiki/mockDocToken',
      async () => '<html><body>fallback should not be used</body></html>',
    );

    assert.equal(imported.title, '结构化导入测试');
    assert.equal(imported.importQuality, 'full');
    assert.match(imported.content, /<ul><li><p>无序列表项<\/p><\/li><\/ul>/);
    assert.match(imported.content, /<ol><li><p>有序列表项<\/p><\/li><\/ol>/);
    assert.match(imported.content, /data-type="taskList"/);
    assert.match(imported.content, /data-checked="true"/);
    assert.match(imported.content, /<pre><code class="language-javascript">const ok = true;<\/code><\/pre>/);
    assert.match(imported.content, /<hr>/);
    assert.equal(imported.unsupportedBlocks, undefined);
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

test('importFeishuPublicUrl maps Open API container and media blocks', async () => {
  const blocks = [
    {
      block_id: 'page',
      block_type: 1,
      children: ['heading', 'callout', 'grid', 'table', 'image', 'iframe', 'file'],
    },
    {
      block_id: 'heading',
      block_type: 3,
      heading1: { elements: [{ text_run: { content: '容器与媒体块测试' } }] },
    },
    {
      block_id: 'callout',
      block_type: 19,
      children: ['calloutText'],
      callout: { emoji_id: 'bulb', background_color: 3, border_color: 3 },
    },
    {
      block_id: 'calloutText',
      parent_id: 'callout',
      block_type: 2,
      text: { elements: [{ text_run: { content: '高亮块内容' } }] },
    },
    {
      block_id: 'grid',
      block_type: 24,
      children: ['col1', 'col2'],
      grid: {},
    },
    {
      block_id: 'col1',
      parent_id: 'grid',
      block_type: 25,
      children: ['col1Text'],
      grid_column: { width_ratio: 40 },
    },
    {
      block_id: 'col1Text',
      parent_id: 'col1',
      block_type: 2,
      text: { elements: [{ text_run: { content: '左侧分栏' } }] },
    },
    {
      block_id: 'col2',
      parent_id: 'grid',
      block_type: 25,
      children: ['col2Text'],
      grid_column: { width_ratio: 60 },
    },
    {
      block_id: 'col2Text',
      parent_id: 'col2',
      block_type: 2,
      text: { elements: [{ text_run: { content: '右侧分栏' } }] },
    },
    {
      block_id: 'table',
      block_type: 31,
      children: ['cell1', 'cell2', 'cell3', 'cell4'],
      table: {
        cells: ['cell1', 'cell2', 'cell3', 'cell4'],
        property: { row_size: 2, column_size: 2 },
      },
    },
    {
      block_id: 'cell1',
      parent_id: 'table',
      block_type: 32,
      children: ['cell1Text'],
      table_cell: {},
    },
    {
      block_id: 'cell1Text',
      parent_id: 'cell1',
      block_type: 2,
      text: { elements: [{ text_run: { content: '表头 A' } }] },
    },
    {
      block_id: 'cell2',
      parent_id: 'table',
      block_type: 32,
      children: ['cell2Text'],
      table_cell: {},
    },
    {
      block_id: 'cell2Text',
      parent_id: 'cell2',
      block_type: 2,
      text: { elements: [{ text_run: { content: '表头 B' } }] },
    },
    {
      block_id: 'cell3',
      parent_id: 'table',
      block_type: 32,
      children: ['cell3Text'],
      table_cell: {},
    },
    {
      block_id: 'cell3Text',
      parent_id: 'cell3',
      block_type: 2,
      text: { elements: [{ text_run: { content: '数据 A' } }] },
    },
    {
      block_id: 'cell4',
      parent_id: 'table',
      block_type: 32,
      children: ['cell4Text'],
      table_cell: {},
    },
    {
      block_id: 'cell4Text',
      parent_id: 'cell4',
      block_type: 2,
      text: { elements: [{ text_run: { content: '数据 B' } }] },
    },
    {
      block_id: 'image',
      block_type: 27,
      image: { token: 'image-token' },
    },
    {
      block_id: 'iframe',
      block_type: 26,
      iframe: { component: { type: 12, url: encodeURIComponent('https://example.com/embed') } },
    },
    {
      block_id: 'file',
      block_type: 23,
      file: { file_token: 'file-token', name: '需求文档.pdf', mime_type: 'application/pdf' },
    },
  ];
  const { server, baseUrl } = await startMockFeishuApi(blocks, {
    'image-token': { body: 'fake-image', contentType: 'image/png' },
    'file-token': { body: 'fake-pdf', contentType: 'application/pdf' },
  });
  const previousAppId = process.env.FEISHU_APP_ID;
  const previousSecret = process.env.FEISHU_APP_SECRET;
  const previousBaseUrl = process.env.FEISHU_OPEN_API_BASE_URL;
  process.env.FEISHU_APP_ID = 'test-app';
  process.env.FEISHU_APP_SECRET = 'test-secret';
  process.env.FEISHU_OPEN_API_BASE_URL = baseUrl;

  try {
    const imported = await importFeishuPublicUrl(
      'https://qcntpn5n60jv.feishu.cn/wiki/mockDocToken',
      async () => '<html><body>fallback should not be used</body></html>',
    );

    assert.equal(imported.title, '容器与媒体块测试');
    assert.equal(imported.importQuality, 'full');
    assert.equal(imported.assetCount, 2);
    assert.match(imported.content, /data-type="highlight-block"/);
    assert.match(imported.content, /高亮块内容/);
    assert.match(imported.content, /data-local-block="columns"/);
    assert.match(imported.content, /data-width-ratio="40"/);
    assert.match(imported.content, /左侧分栏/);
    assert.match(imported.content, /右侧分栏/);
    assert.match(imported.content, /class="feishu-table"/);
    assert.match(imported.content, /<th class="feishu-table__header-cell" data-table-cell="true"><p>表头 A<\/p><\/th>/);
    assert.match(imported.content, /<td class="feishu-table__cell" data-table-cell="true"><p>数据 B<\/p><\/td>/);
    assert.match(imported.content, /<img class="feishu-image" data-align="center" src="\/static\/uploads\//);
    assert.match(imported.content, /data-local-block="embed" data-kind="iframe" data-href="https:\/\/example.com\/embed"/);
    assert.match(imported.content, /data-local-block="embed" data-kind="file" data-href="\/static\/uploads\//);
    assert.match(imported.content, /需求文档.pdf/);
    assert.equal(imported.warnings.some(warning => /文件二进制下载/.test(warning)), false);
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

test('importFeishuPublicUrl maps Open API bitable data when records are present', async () => {
  const blocks = [
    {
      block_id: 'title',
      block_type: 3,
      heading1: { elements: [{ text_run: { content: '多维表格导入测试' } }] },
    },
    {
      block_id: 'bitable',
      block_type: 18,
      bitable: {
        table_id: 'tbl_test',
        table_name: '任务表',
        fields: [
          { field_id: 'fld_name', field_name: '任务', type: 1 },
          { field_id: 'fld_status', field_name: '状态', type: 3, property: { options: [{ id: 'todo', name: '待处理' }] } },
        ],
        records: [
          { record_id: 'rec_1', fields: { 任务: '修复导入', 状态: '待处理' } },
        ],
        views: [
          { view_id: 'view_grid', view_name: '表格', view_type: 'grid' },
        ],
      },
    },
  ];
  const { server, baseUrl } = await startMockFeishuApi(blocks);
  const previousAppId = process.env.FEISHU_APP_ID;
  const previousSecret = process.env.FEISHU_APP_SECRET;
  const previousBaseUrl = process.env.FEISHU_OPEN_API_BASE_URL;
  process.env.FEISHU_APP_ID = 'test-app';
  process.env.FEISHU_APP_SECRET = 'test-secret';
  process.env.FEISHU_OPEN_API_BASE_URL = baseUrl;

  try {
    const imported = await importFeishuPublicUrl(
      'https://qcntpn5n60jv.feishu.cn/wiki/mockDocToken',
      async () => '<html><body>fallback should not be used</body></html>',
    );

    assert.equal(imported.importQuality, 'full');
    assert.equal(imported.importMetadata?.readonly, false);
    assert.equal(imported.importMetadata?.comments, 'not_supported');
    assert.match(imported.content, /data-local-block="bitable"/);
    assert.match(imported.content, /data-model="/);
    assert.match(imported.content, /任务表/);
    assert.match(imported.content, /修复导入/);
    assert.equal(imported.unsupportedBlocks, undefined);
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

test('importFeishuPublicUrl preserves advanced bitable fields and view config', async () => {
  const blocks = [
    {
      block_id: 'title',
      block_type: 3,
      heading1: { elements: [{ text_run: { content: '高级字段测试' } }] },
    },
    {
      block_id: 'bitable',
      block_type: 18,
      bitable: {
        table_id: 'tbl_advanced',
        table_name: '高级字段表',
        fields: [
          { field_id: 'fld_name', field_name: '标题', type: 1, is_primary: true },
          { field_id: 'fld_owner', field_name: '负责人', type: 11 },
          { field_id: 'fld_due', field_name: '截止日期', type: 5 },
          { field_id: 'fld_files', field_name: '附件', type: 17 },
          { field_id: 'fld_formula', field_name: '公式', type: 20 },
          { field_id: 'fld_lookup', field_name: '查找引用', type: 22 },
        ],
        records: [
          {
            record_id: 'rec_advanced',
            fields: {
              标题: '高级记录',
              负责人: [{ name: '张三', user_id: 'u1' }],
              截止日期: 1717200000000,
              附件: [{ file_token: 'file_1', name: '截图.png', tmp_url: 'https://example.com/screenshot.png', mime_type: 'image/png' }],
              公式: { text: '42' },
              查找引用: [{ text: '关联值' }],
            },
          },
        ],
        views: [
          {
            view_id: 'view_gallery',
            view_name: '画册',
            view_type: 'gallery',
            property: {
              title_field_id: 'fld_name',
              cover_field_id: 'fld_files',
              visible_fields: ['fld_owner', 'fld_due', 'fld_formula'],
              card_size: 'large',
            },
          },
        ],
      },
    },
  ];
  const { server, baseUrl } = await startMockFeishuApi(blocks);
  const previousAppId = process.env.FEISHU_APP_ID;
  const previousSecret = process.env.FEISHU_APP_SECRET;
  const previousBaseUrl = process.env.FEISHU_OPEN_API_BASE_URL;
  process.env.FEISHU_APP_ID = 'test-app';
  process.env.FEISHU_APP_SECRET = 'test-secret';
  process.env.FEISHU_OPEN_API_BASE_URL = baseUrl;

  try {
    const imported = await importFeishuPublicUrl(
      'https://qcntpn5n60jv.feishu.cn/wiki/mockDocToken',
      async () => '<html><body>fallback should not be used</body></html>',
    );

    assert.equal(imported.importQuality, 'full');
    assert.equal(imported.importMetadata?.permission, 'readable');
    assert.match(imported.content, /data-local-block="bitable"/);
    assert.match(imported.content, /高级字段表/);
    assert.match(imported.content, /张三/);
    assert.match(imported.content, /截图.png/);
    assert.match(imported.content, /coverFieldId&quot;:&quot;fld_files/);
    assert.match(imported.content, /cardSize&quot;:&quot;large/);
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

test('importFeishuPublicUrl renders advanced doc blocks and table cell attributes', async () => {
  const blocks = [
    {
      block_id: 'title',
      block_type: 3,
      heading1: { elements: [{ text_run: { content: '高级文档块测试' } }] },
    },
    {
      block_id: 'mention',
      block_type: 2,
      text: {
        elements: [
          { mention_user: { user_name: '李四' } },
          { text_run: { content: ' 查看 ' } },
          { mention_doc: { title: '关联文档', url: 'https://example.com/doc' } },
          { equation: { content: 'E=mc^2' } },
        ],
      },
    },
    {
      block_id: 'table',
      block_type: 31,
      children: ['cell1', 'cell2'],
      table: { row_size: 1, column_size: 2 },
    },
    {
      block_id: 'cell1',
      parent_id: 'table',
      block_type: 32,
      children: ['cell1Text'],
      table_cell: { col_span: 2, background_color: 5 },
    },
    {
      block_id: 'cell1Text',
      parent_id: 'cell1',
      block_type: 2,
      text: { elements: [{ text_run: { content: '合并单元格' } }] },
    },
    {
      block_id: 'cell2',
      parent_id: 'table',
      block_type: 32,
      children: ['cell2Text'],
      table_cell: {},
    },
    {
      block_id: 'cell2Text',
      parent_id: 'cell2',
      block_type: 2,
      text: { elements: [{ text_run: { content: '普通单元格' } }] },
    },
    {
      block_id: 'sheet',
      block_type: 30,
      sheet: { name: '预算表', spreadsheet_token: 'sht_token' },
    },
    {
      block_id: 'diagram',
      block_type: 21,
      diagram: { name: '流程图', diagram_type: 'uml' },
    },
  ];
  const { server, baseUrl } = await startMockFeishuApi(blocks);
  const previousAppId = process.env.FEISHU_APP_ID;
  const previousSecret = process.env.FEISHU_APP_SECRET;
  const previousBaseUrl = process.env.FEISHU_OPEN_API_BASE_URL;
  process.env.FEISHU_APP_ID = 'test-app';
  process.env.FEISHU_APP_SECRET = 'test-secret';
  process.env.FEISHU_OPEN_API_BASE_URL = baseUrl;

  try {
    const imported = await importFeishuPublicUrl(
      'https://qcntpn5n60jv.feishu.cn/wiki/mockDocToken',
      async () => '<html><body>fallback should not be used</body></html>',
    );

    assert.equal(imported.importQuality, 'partial');
    assert.equal(imported.importMetadata?.comments, 'not_supported');
    assert.match(imported.content, /@李四/);
    assert.match(imported.content, /href="https:\/\/example.com\/doc"/);
    assert.match(imported.content, /\$E=mc\^2\$/);
    assert.match(imported.content, /colspan="2"/);
    assert.match(imported.content, /background-color:#e1eaff/);
    assert.match(imported.content, /<th class="feishu-table__header-cell" data-table-cell="true" colspan="2".*><p>合并单元格<\/p><\/th>/);
    assert.match(imported.content, /data-kind="sheet"/);
    assert.match(imported.content, /预算表/);
    assert.match(imported.content, /data-kind="diagram"/);
    assert.ok(imported.unsupportedBlocks?.some(block => block.type === 'sheet'));
    assert.ok(imported.unsupportedBlocks?.some(block => block.type === 'diagram'));
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

test('importFeishuPublicUrl keeps quote container and unknown blocks visible', async () => {
  const blocks = [
    {
      block_id: 'page',
      block_type: 1,
      children: ['title', 'quoteContainer', 'unknown53', 'unsupported999'],
    },
    {
      block_id: 'title',
      block_type: 3,
      heading1: { elements: [{ text_run: { content: '未知块导入测试' } }] },
    },
    {
      block_id: 'quoteContainer',
      block_type: 34,
      children: ['quoteText'],
      quote_container: {},
    },
    {
      block_id: 'quoteText',
      parent_id: 'quoteContainer',
      block_type: 2,
      text: { elements: [{ text_run: { content: '引用容器正文' } }] },
    },
    {
      block_id: 'unknown53',
      block_type: 53,
      children: ['unknown53Text'],
    },
    {
      block_id: 'unknown53Text',
      parent_id: 'unknown53',
      block_type: 2,
      text: { elements: [{ text_run: { content: '新版扩展块正文' } }] },
    },
    {
      block_id: 'unsupported999',
      block_type: 999,
    },
  ];
  const { server, baseUrl } = await startMockFeishuApi(blocks);
  const previousAppId = process.env.FEISHU_APP_ID;
  const previousSecret = process.env.FEISHU_APP_SECRET;
  const previousBaseUrl = process.env.FEISHU_OPEN_API_BASE_URL;
  process.env.FEISHU_APP_ID = 'test-app';
  process.env.FEISHU_APP_SECRET = 'test-secret';
  process.env.FEISHU_OPEN_API_BASE_URL = baseUrl;

  try {
    const imported = await importFeishuPublicUrl(
      'https://qcntpn5n60jv.feishu.cn/wiki/mockDocToken',
      async () => '<html><body>fallback should not be used</body></html>',
    );

    assert.equal(imported.importQuality, 'partial');
    assert.match(imported.content, /<blockquote><p>引用容器正文<\/p><\/blockquote>/);
    assert.match(imported.content, /新版飞书扩展块（53 已降级）/);
    assert.match(imported.content, /新版扩展块正文/);
    assert.match(imported.content, /data-kind="feishu-block-999"/);
    assert.match(imported.content, /飞书未支持块/);
    assert.equal(imported.unsupportedBlocks?.some(block => block.type === '34'), false);
    assert.ok(imported.unsupportedBlocks?.some(block => block.type === '53'));
    assert.ok(imported.unsupportedBlocks?.some(block => block.type === '999'));
    assert.doesNotMatch(imported.warnings.join('\n'), /已在导入中跳过/);
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

test('importFeishuPublicUrl expands advanced Feishu blocks instead of dropping them', async () => {
  const blocks = [
    {
      block_id: 'page',
      block_type: 1,
      children: ['title', 'chatCard', 'task', 'okr', 'agenda', 'linkPreview', 'sourceSynced', 'wikiList', 'aiTemplate'],
    },
    {
      block_id: 'title',
      block_type: 3,
      heading1: { elements: [{ text_run: { content: '高级模块导入测试' } }] },
    },
    {
      block_id: 'chatCard',
      block_type: 20,
      chat_card: { title: '飞书群名片', url: 'https://example.com/group' },
    },
    {
      block_id: 'task',
      block_type: 35,
      children: ['taskText'],
      task: { title: '飞书任务模块' },
    },
    {
      block_id: 'taskText',
      parent_id: 'task',
      block_type: 2,
      text: { elements: [{ text_run: { content: '任务正文可见' } }] },
    },
    {
      block_id: 'okr',
      block_type: 36,
      children: ['okrText'],
      okr: { title: 'OKR 模块' },
    },
    {
      block_id: 'okrText',
      parent_id: 'okr',
      block_type: 2,
      text: { elements: [{ text_run: { content: 'OKR 子内容可见' } }] },
    },
    {
      block_id: 'agenda',
      block_type: 44,
      children: ['agendaItem'],
      agenda: { title: '会议议程' },
    },
    {
      block_id: 'agendaItem',
      parent_id: 'agenda',
      block_type: 45,
      children: ['agendaItemText'],
      agenda_item: { title: '议程项' },
    },
    {
      block_id: 'agendaItemText',
      parent_id: 'agendaItem',
      block_type: 2,
      text: { elements: [{ text_run: { content: '议程项正文可见' } }] },
    },
    {
      block_id: 'linkPreview',
      block_type: 48,
      link_preview: { title: '链接预览标题', url: 'https://example.com/preview' },
    },
    {
      block_id: 'sourceSynced',
      block_type: 49,
      children: ['sourceText'],
      source_synced: { title: '源同步块' },
    },
    {
      block_id: 'sourceText',
      parent_id: 'sourceSynced',
      block_type: 2,
      text: { elements: [{ text_run: { content: '同步块正文可见' } }] },
    },
    {
      block_id: 'wikiList',
      block_type: 51,
      sub_page_list: { title: 'Wiki 子页面列表' },
    },
    {
      block_id: 'aiTemplate',
      block_type: 52,
      ai_template: { title: 'AI 模板' },
    },
  ];
  const { server, baseUrl } = await startMockFeishuApi(blocks);
  const previousAppId = process.env.FEISHU_APP_ID;
  const previousSecret = process.env.FEISHU_APP_SECRET;
  const previousBaseUrl = process.env.FEISHU_OPEN_API_BASE_URL;
  process.env.FEISHU_APP_ID = 'test-app';
  process.env.FEISHU_APP_SECRET = 'test-secret';
  process.env.FEISHU_OPEN_API_BASE_URL = baseUrl;

  try {
    const imported = await importFeishuPublicUrl(
      'https://qcntpn5n60jv.feishu.cn/wiki/mockDocToken',
      async () => '<html><body>fallback should not be used</body></html>',
    );

    assert.equal(imported.importQuality, 'partial');
    assert.match(imported.content, /data-kind="group"/);
    assert.match(imported.content, /飞书群名片/);
    assert.match(imported.content, /飞书任务模块（35 已降级）/);
    assert.match(imported.content, /任务正文可见/);
    assert.match(imported.content, /OKR 模块（36 已降级）/);
    assert.match(imported.content, /OKR 子内容可见/);
    assert.match(imported.content, /会议议程（44 已降级）/);
    assert.match(imported.content, /议程项正文可见/);
    assert.match(imported.content, /data-kind="link"/);
    assert.match(imported.content, /链接预览标题/);
    assert.match(imported.content, /源同步块（49 已降级）/);
    assert.match(imported.content, /同步块正文可见/);
    assert.match(imported.content, /data-kind="feishu-block-51"/);
    assert.match(imported.content, /Wiki 子页面列表/);
    assert.match(imported.content, /data-kind="template"/);
    assert.match(imported.content, /AI 模板/);
    assert.doesNotMatch(imported.content, /data-href="AI 模板"/);
    assert.doesNotMatch(imported.warnings.join('\n'), /已在导入中跳过/);
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

test('importFeishuPublicUrl fetches token-only Open API bitable data', async () => {
  const blocks = [
    {
      block_id: 'title',
      block_type: 3,
      heading1: { elements: [{ text_run: { content: 'Token Bitable' } }] },
    },
    {
      block_id: 'bitable',
      block_type: 18,
      bitable: { app_token: 'app_token', table_id: 'tbl_token', table_name: '远端多维表格' },
    },
  ];
  const { server, baseUrl } = await startMockFeishuApi(blocks, {}, {
    'app_token/tbl_token/fields': [
      { field_id: 'fld_name', field_name: '名称', type: 1 },
      { field_id: 'fld_done', field_name: '完成', type: 7 },
    ],
    'app_token/tbl_token/records': [
      { record_id: 'rec_1', fields: { 名称: '远端记录', 完成: true } },
    ],
    'app_token/tbl_token/views': [
      { view_id: 'view_grid', view_name: '表格视图', view_type: 'grid' },
    ],
  });
  const previousAppId = process.env.FEISHU_APP_ID;
  const previousSecret = process.env.FEISHU_APP_SECRET;
  const previousBaseUrl = process.env.FEISHU_OPEN_API_BASE_URL;
  process.env.FEISHU_APP_ID = 'test-app';
  process.env.FEISHU_APP_SECRET = 'test-secret';
  process.env.FEISHU_OPEN_API_BASE_URL = baseUrl;

  try {
    const imported = await importFeishuPublicUrl(
      'https://qcntpn5n60jv.feishu.cn/wiki/mockDocToken',
      async () => '<html><body>fallback should not be used</body></html>',
    );

    assert.equal(imported.importQuality, 'full');
    assert.match(imported.content, /data-local-block="bitable"/);
    assert.match(imported.content, /远端多维表格/);
    assert.match(imported.content, /远端记录/);
    assert.equal(imported.unsupportedBlocks, undefined);
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

test('importFeishuPublicUrl keeps unavailable token-only Open API bitable as partial card', async () => {
  const blocks = [
    {
      block_id: 'title',
      block_type: 3,
      heading1: { elements: [{ text_run: { content: 'Token Bitable' } }] },
    },
    {
      block_id: 'bitable',
      block_type: 18,
      bitable: { app_token: 'app_token', table_id: 'missing_table', table_name: '远端多维表格' },
    },
  ];
  const { server, baseUrl } = await startMockFeishuApi(blocks);
  const previousAppId = process.env.FEISHU_APP_ID;
  const previousSecret = process.env.FEISHU_APP_SECRET;
  const previousBaseUrl = process.env.FEISHU_OPEN_API_BASE_URL;
  process.env.FEISHU_APP_ID = 'test-app';
  process.env.FEISHU_APP_SECRET = 'test-secret';
  process.env.FEISHU_OPEN_API_BASE_URL = baseUrl;

  try {
    const imported = await importFeishuPublicUrl(
      'https://qcntpn5n60jv.feishu.cn/wiki/mockDocToken',
      async () => '<html><body>fallback should not be used</body></html>',
    );

    assert.equal(imported.importQuality, 'partial');
    assert.match(imported.content, /data-local-block="embed" data-kind="bitable"/);
    assert.match(imported.content, /远端多维表格/);
    assert.match(imported.warnings.join('\n'), /多维表格数据拉取失败|未返回可用字段/);
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

test('importFeishuPublicUrl lists tables when Open API bitable omits table id', async () => {
  const blocks = [
    {
      block_id: 'title',
      block_type: 3,
      heading1: { elements: [{ text_run: { content: 'App Token Bitable' } }] },
    },
    {
      block_id: 'bitable',
      block_type: 18,
      bitable: { app_token: 'app_token', table_name: '自动选表' },
    },
  ];
  const { server, baseUrl } = await startMockFeishuApi(blocks, {}, {
    'app_token/tables': [
      { table_id: 'tbl_first', name: '第一张表' },
    ],
    'app_token/tbl_first/fields': [
      { field_id: 'fld_name', field_name: '名称', type: 1 },
    ],
    'app_token/tbl_first/records': [
      { record_id: 'rec_1', fields: { 名称: '自动拉取记录' } },
    ],
    'app_token/tbl_first/views': [
      { view_id: 'view_grid', view_name: '表格视图', view_type: 'grid' },
    ],
  });
  const previousAppId = process.env.FEISHU_APP_ID;
  const previousSecret = process.env.FEISHU_APP_SECRET;
  const previousBaseUrl = process.env.FEISHU_OPEN_API_BASE_URL;
  process.env.FEISHU_APP_ID = 'test-app';
  process.env.FEISHU_APP_SECRET = 'test-secret';
  process.env.FEISHU_OPEN_API_BASE_URL = baseUrl;

  try {
    const imported = await importFeishuPublicUrl(
      'https://qcntpn5n60jv.feishu.cn/wiki/mockDocToken',
      async () => '<html><body>fallback should not be used</body></html>',
    );

    assert.equal(imported.importQuality, 'full');
    assert.match(imported.content, /data-local-block="bitable"/);
    assert.match(imported.content, /第一张表/);
    assert.match(imported.content, /自动拉取记录/);
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

test('importFeishuPublicUrl imports a wiki-backed standalone bitable app', async () => {
  const { server, baseUrl } = await startMockFeishuApi([], {}, {
    'app_wiki/tables': [
      { table_id: 'tbl_main', name: '主表' },
      { table_id: 'tbl_other', name: '副表' },
    ],
    'app_wiki/tbl_main/fields': [
      { field_id: 'fld_name', field_name: '任务', type: 1, is_primary: true },
      { field_id: 'fld_status', field_name: '状态', type: 3, property: { options: [{ id: 'todo', name: '待处理' }] } },
    ],
    'app_wiki/tbl_main/records': [
      { record_id: 'rec_1', fields: { 任务: '主表记录', 状态: '待处理' } },
    ],
    'app_wiki/tbl_main/views': [
      { view_id: 'view_grid', view_name: '表格', view_type: 'grid' },
    ],
    'app_wiki/tbl_other/fields': [
      { field_id: 'fld_label', field_name: '标签', type: 1, is_primary: true },
    ],
    'app_wiki/tbl_other/records': [
      { record_id: 'rec_2', fields: { 标签: '副表记录' } },
    ],
    'app_wiki/tbl_other/views': [
      { view_id: 'view_grid2', view_name: '表格', view_type: 'grid' },
    ],
  }, { wikiObjType: 'bitable', appName: '学习测验地图' });

  const previousAppId = process.env.FEISHU_APP_ID;
  const previousSecret = process.env.FEISHU_APP_SECRET;
  const previousBaseUrl = process.env.FEISHU_OPEN_API_BASE_URL;
  process.env.FEISHU_APP_ID = 'test-app';
  process.env.FEISHU_APP_SECRET = 'test-secret';
  process.env.FEISHU_OPEN_API_BASE_URL = baseUrl;

  try {
    const imported = await importFeishuPublicUrl(
      'https://sudo.feishu.cn/wiki/app_wiki?table=tbl_other',
      async () => '<html><body>fallback should not be used</body></html>',
    );

    assert.equal(imported.title, '学习测验地图');
    assert.equal(imported.importQuality, 'full');
    assert.match(imported.content, /data-local-block="bitable"/);
    assert.match(imported.content, /主表记录/);
    assert.match(imported.content, /副表记录/);
    // ?table=tbl_other 指定的表应排在前面。
    assert.ok(imported.content.indexOf('副表记录') < imported.content.indexOf('主表记录'));
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

test('public Feishu sample fixtures are covered by capability matrix', () => {
  FEISHU_PUBLIC_SAMPLE_FIXTURES.forEach(sample => {
    const row = getSampleCapabilityRow(sample.id);
    assert.ok(row, `${sample.id} should have a capability row`);
    assert.equal(row?.title.length ? true : false, true);
    sample.expectedCapabilities.forEach(capability => {
      assert.ok(row?.capabilities.includes(capability as any), `${sample.id} should include ${capability}`);
    });
  });
});

test('importFeishuPublicHtml converts public samples into local renderable blocks', () => {
  FEISHU_PUBLIC_SAMPLE_FIXTURES
    .filter(sample => sample.id !== 'business-report')
    .forEach(sample => {
      const imported = importFeishuPublicHtml(sample.rawHtml, sample.url);
      assert.equal(imported.title, sample.title);
      assert.equal(imported.importQuality, 'fallback');
      assert.match(imported.content, /<h1>/);
      assert.doesNotMatch(imported.content, /<blockquote><p>来源：/);
      if (sample.id === 'bitable-quickstart') {
        assert.equal(imported.coverUrl, '/static/01.gif');
        assert.match(imported.content, /data-local-block="doc-nav"/);
        assert.match(imported.content, /feishu-doc-nav__link/);
      }
      assert.ok(imported.warnings.length > 0);
      if (sample.expectedCapabilities.includes('columns')) {
        assert.match(imported.content, /data-local-block="columns"/);
      }
      if (sample.expectedCapabilities.includes('highlight')) {
        assert.match(imported.content, /data-type="highlight-block"/);
        assert.match(imported.content, /data-icon="/);
      }
      if (sample.expectedCapabilities.includes('dashboard')) {
        assert.match(imported.content, /data-local-block="dashboard"/);
        assert.match(imported.content, /slices/);
      }
      if (sample.expectedCapabilities.includes('table')) {
        assert.match(imported.content, /class="feishu-table/);
      }
      if (sample.expectedCapabilities.includes('embed')) {
        assert.match(imported.content, /data-local-block="embed"/);
      }
      sample.unsupportedBlocks.forEach(type => {
        assert.ok(imported.unsupportedBlocks?.some(block => block.type === type), `${sample.id} should mark ${type} unsupported`);
      });
    });
});

test('bitable quickstart sample renders content columns instead of ratio placeholders', () => {
  const sample = FEISHU_PUBLIC_SAMPLE_FIXTURES.find(item => item.id === 'bitable-quickstart');
  assert.ok(sample);
  const imported = importFeishuPublicHtml(sample.rawHtml, sample.url);

  assert.equal(imported.title, '多维表格 快速入门指南 & 学习测验地图');
  assert.match(imported.content, /data-local-block="doc-nav"/);
  assert.doesNotMatch(imported.content, /<p>首页 \| 新人必逛/);
  assert.match(imported.content, /data-local-block="columns"/);
  assert.match(imported.content, /data-local-block="bitable"/);
  assert.match(imported.content, /多维表格学习地图/);
  assert.match(imported.content, /按阶段看板/);
  assert.match(imported.content, /资源画册/);
  assert.match(imported.content, /官方课程资源推荐/);
  assert.match(imported.content, /多维表格学习地图/);
  assert.match(imported.content, /data-local-block="embed"/);
  assert.match(imported.content, /<ul>/);
  assert.match(imported.content, /data-desc="推荐资料"/);
  assert.match(imported.content, /初阶操作/);
  assert.match(imported.content, /中阶操作/);
  assert.doesNotMatch(imported.content, /分栏 50%/);
  assert.doesNotMatch(imported.content, /data-local-block="dashboard"/);
});

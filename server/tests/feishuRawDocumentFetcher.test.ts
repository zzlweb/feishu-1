import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fetchFeishuRawDocumentData } from '../src/import/feishuRawDocumentFetcher';

function startMockFeishuApi(
  blocks: unknown[],
  bitable: Record<string, unknown[]> = {},
  options: { wikiObjType?: string; wikiTitle?: string } = {},
  media: Record<string, { body: string; contentType: string }> = {},
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
        data: {
          node: {
            obj_token: token,
            obj_type: options.wikiObjType || 'docx',
            title: options.wikiTitle || '',
          },
        },
      }));
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
        res.setHeader('Content-Length', String(Buffer.byteLength(item.body)));
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

test('fetchFeishuRawDocumentData returns raw document blocks and bitable API data', async () => {
  const blocks = [
    {
      block_id: 'page',
      block_type: 1,
      children: ['title', 'table', 'image', 'bitable'],
      page: { elements: [{ text_run: { content: '原始文档' } }] },
    },
    {
      block_id: 'title',
      parent_id: 'page',
      block_type: 3,
      heading1: { elements: [{ text_run: { content: '原始文档' } }] },
    },
    {
      block_id: 'table',
      parent_id: 'page',
      block_type: 31,
      children: ['cell1', 'cell2'],
      table: {
        cells: ['cell1', 'cell2'],
        property: { row_size: 1, column_size: 2 },
      },
    },
    {
      block_id: 'cell1',
      parent_id: 'table',
      block_type: 32,
      children: ['cell1Text', 'cellImage'],
      table_cell: { col_span: 2, background_color: 5 },
    },
    {
      block_id: 'cell1Text',
      parent_id: 'cell1',
      block_type: 2,
      text: { elements: [{ text_run: { content: '单元格完整文本' } }] },
    },
    {
      block_id: 'cellImage',
      parent_id: 'cell1',
      block_type: 27,
      image: { token: 'cell_img_token' },
    },
    {
      block_id: 'cell2',
      parent_id: 'table',
      block_type: 32,
      table_cell: {},
    },
    {
      block_id: 'image',
      parent_id: 'page',
      block_type: 27,
      image: { token: 'img_token' },
    },
    {
      block_id: 'bitable',
      parent_id: 'page',
      block_type: 18,
      bitable: { app_token: 'app_token', table_id: 'tbl_main', table_name: '任务表' },
    },
  ];
  const { server, baseUrl } = await startMockFeishuApi(blocks, {
    'app_token/tables': [{ table_id: 'tbl_main', name: '任务表' }],
    'app_token/tbl_main/fields': [
      { field_id: 'fld_name', field_name: '任务', type: 1 },
      { field_id: 'fld_attachment', field_name: '附件', type: 17 },
    ],
    'app_token/tbl_main/records': [{
      record_id: 'rec_1',
      fields: {
        任务: '保持原始数据',
        附件: [{ file_token: 'bitable_file_token', name: '记录附件.png', mime_type: 'image/png' }],
      },
    }],
    'app_token/tbl_main/views': [{ view_id: 'view_grid', view_name: '表格视图', view_type: 'grid' }],
  }, {}, {
    img_token: { body: 'image-body', contentType: 'image/png' },
    cell_img_token: { body: 'cell-image-body', contentType: 'image/webp' },
    bitable_file_token: { body: 'bitable-attachment-body', contentType: 'image/png' },
  });

  try {
    const data = await fetchFeishuRawDocumentData('https://example.feishu.cn/wiki/mockDocToken', {
      config: { appId: 'test-app', appSecret: 'test-secret', baseUrl },
      includeTenantAccessToken: true,
      downloadMedia: true,
    });

    assert.equal(data.tenantAccessToken, 'test-token');
    assert.equal(data.target.type, 'docx');
    assert.equal(data.document?.blocks.length, blocks.length);
    assert.deepEqual(data.document?.rootBlockIds, ['title', 'table', 'image', 'bitable']);
    assert.equal(data.document?.contentTree.some(node => node.blockId === 'table'), true);
    assert.equal(data.tableSummaries[0]?.rowSize, 1);
    assert.equal(data.tableSummaries[0]?.columnSize, 2);
    assert.equal(data.tableSummaries[0]?.isCompleteShape, true);
    assert.equal(data.tableDetails[0]?.rows[0]?.[0]?.childNodes[0]?.blockId, 'cell1Text');
    assert.equal(data.tableDetails[0]?.rows[0]?.[0]?.childNodes[1]?.blockId, 'cellImage');
    assert.equal(
      data.mediaRefs.some(ref => ref.downloadUrl === `${baseUrl}/open-apis/drive/v1/medias/img_token/download`),
      true,
    );
    assert.equal(data.mediaAssets?.filter(asset => asset.status === 'downloaded').length, 3);
    assert.equal(data.mediaAssets?.find(asset => asset.token === 'cell_img_token')?.contentType, 'image/webp');
    assert.equal(data.mediaRefs.some(ref => ref.type === 'bitable-attachment' && ref.token === 'bitable_file_token'), true);
    assert.equal(data.bitables[0]?.tableData[0]?.fields[0]?.field_name, '任务');
    assert.equal(data.bitables[0]?.tableData[0]?.records[0]?.fields?.任务, '保持原始数据');
    assert.equal(data.stats.blockCount, blocks.length);
    assert.equal(data.stats.bitableFieldCount, 2);
    assert.equal(data.stats.bitableRecordCount, 1);
    assert.equal(data.stats.bitableViewCount, 1);
    assert.equal(data.stats.downloadedMediaCount, 3);
    assert.equal(data.stats.treeNodeCount, 8);
    assert.equal(data.stats.orphanBlockCount, 0);
    assert.equal(data.completeness.isComplete, true);
    assert.equal(data.completeness.media.expectedCount, 3);
    assert.equal(data.completeness.coverage.rawBlocksPreserved, true);
    assert.equal(data.completeness.coverage.mediaBinariesDownloaded, true);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('fetchFeishuRawDocumentData fetches every table for standalone bitable links', async () => {
  const { server, baseUrl } = await startMockFeishuApi([], {
    'app_wiki/tables': [
      { table_id: 'tbl_main', name: '主表' },
      { table_id: 'tbl_other', name: '副表' },
    ],
    'app_wiki/tbl_main/fields': [{ field_id: 'fld_name', field_name: '名称', type: 1 }],
    'app_wiki/tbl_main/records': [{ record_id: 'rec_1', fields: { 名称: '主表记录' } }],
    'app_wiki/tbl_main/views': [{ view_id: 'view_grid', view_name: '表格', view_type: 'grid' }],
    'app_wiki/tbl_other/fields': [{ field_id: 'fld_label', field_name: '标签', type: 1 }],
    'app_wiki/tbl_other/records': [{ record_id: 'rec_2', fields: { 标签: '副表记录' } }],
    'app_wiki/tbl_other/views': [{ view_id: 'view_grid2', view_name: '表格', view_type: 'grid' }],
  }, { wikiObjType: 'bitable', wikiTitle: '原始多维表格' });

  try {
    const data = await fetchFeishuRawDocumentData('https://example.feishu.cn/wiki/app_wiki', {
      config: { appId: 'test-app', appSecret: 'test-secret', baseUrl },
    });

    assert.equal(data.target.type, 'bitable');
    assert.equal(data.target.title, '原始多维表格');
    assert.equal(data.bitables.length, 1);
    assert.equal(data.bitables[0]?.source, 'standalone');
    assert.equal(data.bitables[0]?.tableData.length, 2);
    assert.deepEqual(data.bitables[0]?.tableData.map(table => table.tableId), ['tbl_main', 'tbl_other']);
    assert.equal(data.stats.bitableTableCount, 2);
    assert.equal(data.stats.bitableRecordCount, 2);
    assert.equal(data.document, undefined);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

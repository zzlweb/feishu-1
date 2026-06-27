import test from 'node:test';
import assert from 'node:assert/strict';
import {
  importFeishuPublicHtml,
  importFeishuPublicUrl,
  isAllowedFeishuPublicUrl,
} from '../src/feishuPublicImporter';
import { BUSINESS_REPORT_FIXTURE_HTML } from '../src/fixtures/feishuBusinessReport';

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
  assert.ok(imported.warnings.length > 0);
});

test('importFeishuPublicUrl uses injected fetch html provider', async () => {
  const imported = await importFeishuPublicUrl(
    'https://qcntpn5n60jv.feishu.cn/wiki/H58uwRchYi7889k6dnJcVoMMnO5',
    async () => BUSINESS_REPORT_FIXTURE_HTML,
  );
  assert.equal(imported.title, '业务经营周报');
  assert.match(imported.content, /4972/);
});

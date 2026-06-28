import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));

const baseDoc = {
  author: 'Sample',
  created_at: '2026-06-27T00:00:00.000Z',
  updated_at: '2026-06-27T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

const publicFeishuDocs = JSON.parse(
  fs.readFileSync(path.resolve(testDir, '../../docs/public-feishu-docs.json'), 'utf8'),
) as Array<{ title: string; url: string; category: string }>;

const dashboardConfig = (values: number[]) => JSON.stringify({
  slices: values.map((value, index) => ({
    label: `分项 ${index + 1}`,
    value,
    color: ['#3370ff', '#14c0ff', '#ffc60a'][index] || '#25b47e',
  })),
}).replace(/"/g, '&quot;');

const businessReportModel = {
  id: 'tbl_public_business',
  name: '业务经营周报',
  primaryFieldId: 'title',
  activeViewId: 'gallery',
  fields: [
    { id: 'title', name: '商品', type: 'text' },
    { id: 'cover', name: '附件', type: 'attachment' },
    { id: 'phase', name: '项目阶段', type: 'single_select', options: { choices: [
      { id: 'early', name: '前期', color: '#ffd59e' },
      { id: 'middle', name: '中期', color: '#f1ddff' },
    ] } },
  ],
  records: [
    {
      id: 'rec_ice',
      tableId: 'tbl_public_business',
      fields: {
        title: '冰淇淋',
        cover: [{ id: 'att_1', fileId: 'file_1', name: 'ice.svg', mimeType: 'image/svg+xml', extension: 'svg', size: 1, url: '/static/gallery/ice-cream.svg', thumbnailUrl: '/static/gallery/ice-cream.svg', previewUrl: '/static/gallery/ice-cream.svg', uploadStatus: 'success' }],
        phase: '前期',
      },
      createdAt: '2026-06-27T00:00:00.000Z',
      updatedAt: '2026-06-27T00:00:00.000Z',
      createdBy: 'Sample',
    },
    {
      id: 'rec_macaron',
      tableId: 'tbl_public_business',
      fields: { title: '马卡龙', cover: [], phase: '中期' },
      createdAt: '2026-06-27T00:00:00.000Z',
      updatedAt: '2026-06-27T00:00:00.000Z',
      createdBy: 'Sample',
    },
  ],
  views: [
    {
      id: 'gallery',
      tableId: 'tbl_public_business',
      name: '画册视图',
      type: 'gallery',
      config: {
        coverFieldId: 'cover',
        titleFieldId: 'title',
        visibleFieldIds: ['phase'],
        coverFit: 'cover',
        cardSize: 'medium',
        cardAspectRatio: '16:9',
        showFieldNames: true,
        showEmptyFields: false,
        showAttachmentCount: true,
        showRecordActions: false,
        emptyCoverMode: 'hide-cover',
      },
      sorts: [],
      filters: [],
    },
    {
      id: 'kanban',
      tableId: 'tbl_public_business',
      name: '看板',
      type: 'kanban',
      config: {
        titleFieldId: 'title',
        visibleFieldIds: ['phase'],
        groupByFieldId: 'phase',
        coverFit: 'cover',
        cardSize: 'medium',
        cardAspectRatio: '4:3',
        showFieldNames: true,
        showEmptyFields: false,
        showAttachmentCount: true,
        showRecordActions: false,
        showEmptyGroups: false,
        showCreateGroup: false,
        showNewRecordButton: true,
        emptyCoverMode: 'placeholder',
      },
      sorts: [],
      filters: [],
    },
  ],
};

const docs = {
  business: {
    ...baseDoc,
    id: 'sample-business',
    title: '业务经营周报',
    content: `
      <h1>业务经营周报</h1>
      <div data-type="highlight-block" data-icon="📍" data-bg-color="#e1eaff" data-border-color="#82a7fc" data-text-color="#1f2329"><p>各门店本周销售量 4972 单</p></div>
      <div data-local-block="dashboard" data-chart-type="donut" data-title="门店销售占比" data-config="${dashboardConfig([40, 60])}"></div>
      <div data-local-block="bitable" data-view="gallery" data-model='${JSON.stringify(businessReportModel)}'></div>
    `,
  },
  quickstart: {
    ...baseDoc,
    id: 'sample-quickstart',
    title: '多维表格 快速入门指南 & 学习测验地图',
    content: `
      <h1>多维表格 快速入门指南 & 学习测验地图</h1>
      <p>首页 | 新人必逛 | 高阶玩法 | 读书笔记 | 资源合集 | 关于我</p>
      <div data-type="highlight-block" data-icon="💡" data-bg-color="#e1eaff" data-border-color="#82a7fc" data-text-color="#1f2329"><ul><li><p>👏 如果对本文档内容感兴趣，欢迎直接文档【评论交流】。</p></li><li><p>🙌 对更多类似内容感兴趣，欢迎点击群名片【加入群聊】获取更新提醒。</p></li></ul></div>
      <div class="feishu-columns-node" data-local-block="columns">
        <div class="feishu-columns-block__col-wrap" data-width-ratio="50" data-local-column="true"><div class="feishu-columns-block__col"><h2>官方课程资源推荐</h2><div data-type="highlight-block" data-icon="📌" data-bg-color="#e1eaff" data-border-color="#82a7fc" data-text-color="#1f2329"><p>如果你希望短期集训系统化学习 📚</p><ul><li><div data-local-block="embed" data-kind="template" data-desc="推荐课程" data-title="一表人才|飞书多维表格实战课【大礼包】👈👈👈"></div></li><li><div data-local-block="embed" data-kind="template" data-desc="推荐资料" data-title="多维表格百宝箱 | 多维表格资源导航 | 课程&社区&模版&资料"></div></li></ul></div></div></div>
        <div class="feishu-columns-block__col-wrap" data-width-ratio="50" data-local-column="true"><div class="feishu-columns-block__col"><h2>多维表格学习地图</h2><h3>能力分级</h3><div data-type="highlight-block" data-icon="💡" data-bg-color="#e1eaff" data-border-color="#82a7fc" data-text-color="#1f2329"><h3>初阶操作</h3><ul><li><p>和 Excel 类似的（一看就会系列😉）：多行文本 | 数字 | 单选多选 | 复选框</p></li><li><p>仪表盘功能：使用多维表格仪表盘</p></li></ul></div></div></div>
      </div>
    `,
  },
  mapStats: {
    ...baseDoc,
    id: 'sample-map-stats',
    title: '地图统计',
    content: `
      <h1>地图统计</h1>
      <div data-type="highlight-block" data-icon="🍞" data-bg-color="#fff7e6" data-border-color="#ffba6b" data-text-color="#1f2329"><p>功能简介：以统计数字、图表的形式呈现统计数据。</p></div>
      <div class="feishu-columns-node" data-local-block="columns">
        <div class="feishu-columns-block__col-wrap" data-width-ratio="50" data-local-column="true"><div class="feishu-columns-block__col"><p>统计片区画像</p></div></div>
        <div class="feishu-columns-block__col-wrap" data-width-ratio="50" data-local-column="true"><div class="feishu-columns-block__col"><p>客户拜访进度及 AI 总结</p></div></div>
      </div>
      <div data-local-block="dashboard" data-chart-type="donut" data-title="地图统计比例" data-config="${dashboardConfig([50, 50])}"></div>
    `,
  },
};

const publicSmokeDocs = Object.fromEntries(
  publicFeishuDocs.map((item, index) => {
    const id = `public-feishu-${index + 1}`;
    return [id, {
      ...baseDoc,
      id,
      title: item.title,
      content: `
        <h1>${item.title}</h1>
        <h2>${item.category}</h2>
        <p>这是一篇公开索引的飞书文档样本，用于验证导入后的基础文档壳、标题、来源链接和正文排版不会退化。</p>
        <div data-type="highlight-block" data-icon="💡" data-bg-color="#e1eaff" data-border-color="#82a7fc" data-text-color="#1f2329"><p>公开样本 ${index + 1} / ${publicFeishuDocs.length}</p></div>
        <pre><code>const source = '${item.category}';</code></pre>
        <hr />
        <div data-local-block="embed" data-kind="link" data-title="${item.title}" data-desc="公开飞书文档" data-href="${item.url}"></div>
      `,
    }];
  }),
);

test.beforeEach(async ({ page }) => {
  await page.route('**/api/documents/*/comments', route => route.fulfill({ json: { code: 0, data: [] } }));
  await page.route('**/api/documents/*', route => {
    const id = route.request().url().split('/').pop() || '';
    const doc = Object.values({ ...docs, ...publicSmokeDocs }).find(item => item.id === id);
    if (!doc) return route.fallback();
    return route.fulfill({ json: { code: 0, data: doc } });
  });
});

test('renders 20 indexed public Feishu document smoke samples', async ({ page }) => {
  expect(publicFeishuDocs).toHaveLength(20);

  for (let index = 0; index < publicFeishuDocs.length; index += 1) {
    const sample = publicFeishuDocs[index];
    await page.goto(`/doc/public-feishu-${index + 1}`);
    await expect(page.locator('.editor-title-input')).toHaveValue(sample.title);
    await expect(page.locator('.editor-content-area h1')).toHaveText(sample.title);
    await expect(page.locator('.feishu-highlight-block')).toBeVisible();
    await expect(page.locator('.editor-content-area')).not.toContainText('涓');
    await expect(page.locator('.editor-content-area')).not.toContainText('鍒');
  }
});

test('renders non-bitable Feishu blocks with stable Feishu-like chrome', async ({ page }) => {
  const sample = publicFeishuDocs[0];
  await page.goto('/doc/public-feishu-1');

  const codeBlock = page.locator('.feishu-code-block').first();
  await expect(codeBlock).toBeVisible();
  await expect(codeBlock.locator('.feishu-code-block__title')).toHaveText('代码块');
  await expect(codeBlock.locator('.feishu-code-block__content')).toContainText("const source");

  const divider = page.locator('.feishu-divider').first();
  await expect(divider).toBeVisible();
  await expect(divider.locator('.feishu-divider__line')).toBeVisible();

  const card = page.locator('.feishu-local-card--link').first();
  await expect(card).toBeVisible();
  await expect(card.locator('.feishu-local-card__title')).toHaveText(sample.title);
  await expect(card.locator('.feishu-local-card__desc')).toHaveText('公开飞书文档');
});

test('renders public Feishu business report sample blocks', async ({ page }) => {
  await page.goto('/doc/sample-business');
  await expect(page.getByRole('heading', { name: '业务经营周报' })).toBeVisible();
  await expect(page.locator('.feishu-highlight-icon')).toContainText('📍');
  await expect(page.locator('.feishu-dashboard-chart-block')).toBeVisible();
  await expect(page.locator('.base-gallery-card')).toHaveCount(2);
  await page.locator('.base-viewbar__current').click();
  await page.locator('.base-view-sidebar__name', { hasText: '看板' }).click();
  await expect(page.locator('.base-kanban__column')).toHaveCount(2);
});

test('renders public Feishu quickstart sample blocks', async ({ page }) => {
  await page.goto('/doc/sample-quickstart');
  await expect(page.getByRole('heading', { name: '多维表格 快速入门指南 & 学习测验地图' })).toBeVisible();
  await expect(page.locator('.feishu-columns-node')).toBeVisible();
  await expect(page.getByRole('heading', { name: '官方课程资源推荐' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '多维表格学习地图' })).toBeVisible();
  await expect(page.locator('.feishu-highlight-icon')).toContainText(['💡', '📌', '💡']);
  await expect(page.locator('.feishu-local-card__title', { hasText: '多维表格百宝箱' })).toBeVisible();
  await expect(page.locator('.feishu-local-card__desc', { hasText: '推荐资料' })).toBeVisible();
  await expect(page.locator('.feishu-dashboard-chart-block')).toHaveCount(0);
});

test('renders public Feishu map statistics sample blocks', async ({ page }) => {
  await page.goto('/doc/sample-map-stats');
  await expect(page.getByRole('heading', { name: '地图统计' })).toBeVisible();
  await expect(page.locator('.feishu-highlight-icon')).toContainText('🍞');
  await expect(page.locator('.feishu-columns-node')).toBeVisible();
  await expect(page.locator('.feishu-dashboard-chart-block__legend-value')).toContainText(['50%', '50%']);
});

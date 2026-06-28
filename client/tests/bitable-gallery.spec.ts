import { expect, test } from '@playwright/test';

const legacyGalleryDocument = {
  id: 'bitable-gallery-e2e',
  title: 'Bitable Gallery E2E',
  content: `
    <p>before</p>
    <div
      data-local-block="bitable"
      data-title="画册"
      data-view="gallery"
      data-columns='["名称","状态"]'
      data-rows='[["产品 A","待处理"],["产品 B","已完成"],["产品 C","待处理"]]'
      data-covers='[]'
    ></div>
    <p>after</p>
  `,
  author: 'E2E',
  created_at: '2026-05-26T00:00:00.000Z',
  updated_at: '2026-05-26T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

const noAttachmentModel = {
  id: 'tbl_no_attachment',
  name: '无附件表',
  primaryFieldId: 'title',
  activeViewId: 'gallery',
  fields: [
    { id: 'title', name: '名称', type: 'text' },
    { id: 'status', name: '状态', type: 'single_select' },
  ],
  records: [
    {
      id: 'rec_a',
      tableId: 'tbl_no_attachment',
      fields: { title: '没有封面的记录', status: '待处理' },
      createdAt: '2026-05-26T00:00:00.000Z',
      updatedAt: '2026-05-26T00:00:00.000Z',
      createdBy: 'E2E',
    },
  ],
  views: [
    {
      id: 'gallery',
      tableId: 'tbl_no_attachment',
      name: '画册',
      type: 'gallery',
      config: {
        titleFieldId: 'title',
        visibleFieldIds: ['status'],
        coverFit: 'cover',
        cardSize: 'medium',
        cardAspectRatio: '4:3',
        showFieldNames: false,
        showEmptyFields: false,
        showAttachmentCount: true,
        showRecordActions: false,
        emptyCoverMode: 'placeholder',
      },
    },
  ],
};

const businessReportParityModel = {
  id: 'tbl_business_parity',
  name: '业务经营周报校验',
  primaryFieldId: 'title',
  activeViewId: 'view_gallery',
  fields: [
    { id: 'title', name: '商品', type: 'text' },
    { id: 'cover', name: '附件', type: 'attachment' },
    { id: 'main', name: '是否当前主推', type: 'checkbox' },
    { id: 'phase', name: '项目阶段', type: 'single_select', options: { choices: [
      { id: 'early', name: '前期', color: '#ffd59e' },
      { id: 'middle', name: '中期', color: '#f1ddff' },
      { id: 'late', name: '后期', color: '#4e83fd' },
      { id: 'empty', name: '空分组', color: '#dee0e3' },
    ] } },
  ],
  records: [
    {
      id: 'rec_cover',
      tableId: 'tbl_business_parity',
      fields: {
        title: '冰淇淋',
        cover: [{ id: 'att_1', fileId: 'file_1', name: 'ice.svg', mimeType: 'image/svg+xml', extension: 'svg', size: 1, url: '/static/gallery/ice-cream.svg', thumbnailUrl: '/static/gallery/ice-cream.svg', previewUrl: '/static/gallery/ice-cream.svg', uploadStatus: 'success' }],
        main: true,
        phase: '前期',
      },
      createdAt: '2026-05-26T00:00:00.000Z',
      updatedAt: '2026-05-26T00:00:00.000Z',
      createdBy: 'E2E',
    },
    {
      id: 'rec_no_cover',
      tableId: 'tbl_business_parity',
      fields: { title: '马卡龙', cover: [], main: false, phase: '中期' },
      createdAt: '2026-05-26T00:00:00.000Z',
      updatedAt: '2026-05-26T00:00:00.000Z',
      createdBy: 'E2E',
    },
  ],
  views: [
    {
      id: 'view_gallery',
      tableId: 'tbl_business_parity',
      name: '画册视图',
      type: 'gallery',
      config: {
        coverFieldId: 'cover',
        titleFieldId: 'title',
        visibleFieldIds: ['main'],
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
      id: 'view_kanban',
      tableId: 'tbl_business_parity',
      name: '看板',
      type: 'kanban',
      config: {
        titleFieldId: 'title',
        visibleFieldIds: ['main', 'phase'],
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
        showNewRecordButton: false,
        emptyCoverMode: 'placeholder',
      },
      sorts: [],
      filters: [],
    },
  ],
};

const visibleViewScopeModel = {
  id: 'tbl_visible_scope',
  name: 'Visible View Scope',
  primaryFieldId: 'title',
  activeViewId: 'view_calendar',
  fields: [
    { id: 'title', name: 'Name', type: 'text' },
    { id: 'status', name: 'Status', type: 'single_select', options: { choices: [
      { id: 'todo', name: 'Todo', color: '#dee8ff' },
      { id: 'done', name: 'Done', color: '#c7effb' },
    ] } },
  ],
  records: [
    {
      id: 'rec_1',
      tableId: 'tbl_visible_scope',
      fields: { title: 'Record 1', status: 'Todo' },
      createdAt: '2026-05-26T00:00:00.000Z',
      updatedAt: '2026-05-26T00:00:00.000Z',
      createdBy: 'E2E',
    },
  ],
  views: [
    { id: 'view_grid', tableId: 'tbl_visible_scope', name: 'Table View', type: 'grid', config: {}, sorts: [], filters: [] },
    {
      id: 'view_kanban',
      tableId: 'tbl_visible_scope',
      name: 'Kanban View',
      type: 'kanban',
      config: {
        titleFieldId: 'title',
        visibleFieldIds: ['status'],
        groupByFieldId: 'status',
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
    {
      id: 'view_gallery',
      tableId: 'tbl_visible_scope',
      name: 'Gallery View',
      type: 'gallery',
      config: {
        titleFieldId: 'title',
        visibleFieldIds: ['status'],
        coverFit: 'cover',
        cardSize: 'medium',
        cardAspectRatio: '4:3',
        showFieldNames: true,
        showEmptyFields: false,
        showAttachmentCount: true,
        showRecordActions: false,
        emptyCoverMode: 'placeholder',
      },
      sorts: [],
      filters: [],
    },
    { id: 'view_calendar', tableId: 'tbl_visible_scope', name: 'Calendar View', type: 'calendar', config: {}, sorts: [], filters: [] },
    { id: 'view_form', tableId: 'tbl_visible_scope', name: 'Form View', type: 'form', config: {}, sorts: [], filters: [] },
    { id: 'view_gantt', tableId: 'tbl_visible_scope', name: 'Gantt View', type: 'gantt', config: { dayWidth: 40 }, sorts: [], filters: [] },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/documents/bitable-gallery-e2e/comments', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents/bitable-gallery-e2e', route =>
    route.fulfill({ json: { code: 0, data: legacyGalleryDocument } }),
  );
});

async function openGallery(page: import('@playwright/test').Page) {
  await page.goto('/doc/bitable-gallery-e2e');
  await expect(page.locator('.feishu-base-block')).toBeVisible();
  await expect(page.locator('.feishu-base-block')).toHaveAttribute('data-base-view-type', 'gallery');
  await expect(page.locator('.base-gallery-card')).toHaveCount(3);
}

async function createGridViewFromGallery(page: import('@playwright/test').Page) {
  await page.locator('.base-viewbar__current').first().click();
  const switcher = page.locator('.base-view-sidebar').first();
  await expect(switcher).toBeVisible();
  await switcher.getByRole('button', { name: /新建/ }).hover();
  await page.locator('.base-view-sidebar__create-list').getByRole('button', { name: /表格视图/ }).click();
  await expect(page.locator('.feishu-base-block').first()).toHaveAttribute('data-base-view-type', 'grid');
}

test('migrates an older gallery block without data-view as gallery instead of grid', async ({ page }) => {
  const olderGalleryDocument = {
    ...legacyGalleryDocument,
    content: `<div data-local-block="bitable" data-title="画册" data-columns='["名称"]' data-rows='[["记录 1"],["记录 2"]]'></div>`,
  };
  await page.unroute('**/api/documents/bitable-gallery-e2e');
  await page.route('**/api/documents/bitable-gallery-e2e', route =>
    route.fulfill({ json: { code: 0, data: olderGalleryDocument } }),
  );

  await page.goto('/doc/bitable-gallery-e2e');
  await expect(page.locator('.feishu-base-block')).toHaveAttribute('data-base-view-type', 'gallery');
  await expect(page.locator('.base-gallery-card')).toHaveCount(2);
  await expect(page.locator('.base-grid-canvas')).toHaveCount(0);
});

test('migrates legacy cards and shares records through the view dropdown', async ({ page }) => {
  await openGallery(page);

  await createGridViewFromGallery(page);
  await page.locator('.base-grid-canvas').click({ position: { x: 120, y: 48 } });
  const editor = page.locator('.base-grid-cell-editor');
  await expect(editor).toBeVisible();
  await editor.fill('更新后的产品');
  await editor.press('Enter');
  await page.locator('.base-viewbar__current').click();
  await page.locator('.base-view-sidebar__name', { hasText: '画册' }).click();
  await expect(page.locator('.base-gallery-card__title').first()).toHaveText('更新后的产品');
});

test('opens grid cell editor on double click', async ({ page }) => {
  await openGallery(page);

  await createGridViewFromGallery(page);
  await page.locator('.base-grid-canvas').dblclick({ position: { x: 120, y: 48 } });
  const editor = page.locator('.base-grid-cell-editor');
  await expect(editor).toBeVisible();
  await editor.fill('双击编辑产品');
  await editor.press('Enter');
  await page.locator('.base-viewbar__current').click();
  await page.locator('.base-view-sidebar__name', { hasText: '画册' }).click();
  await expect(page.locator('.base-gallery-card__title').first()).toHaveText('双击编辑产品');
});

test('uses an attachment field as gallery cover and updates it by dropping on a card', async ({ page }) => {
  await page.route('**/api/uploads', route =>
    route.fulfill({
      status: 201,
      json: { code: 0, data: { name: 'cover.png', type: 'image/png', size: 8, url: '/static/uploads/cover.png' } },
    }),
  );
  await openGallery(page);

  await page.getByRole('button', { name: '画册设置' }).click();
  const settings = page.locator('.base-settings');
  await expect(settings).toBeVisible();
  await settings.getByLabel('封面字段').selectOption({ label: '附件' });
  await settings.getByRole('button', { name: '×' }).click();

  const card = page.locator('.base-gallery-card').first();
  await card.evaluate((element, mimeType) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['image'], 'cover.png', { type: mimeType }));
    element.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, 'image/png');
  await expect(card.locator('img')).toHaveAttribute('src', /\/static\/uploads\/cover\.png$/);
});

test('inserts gallery and table as separate blocks rather than nested views', async ({ page }) => {
  await openGallery(page);

  await page.locator('.ProseMirror p', { hasText: 'after' }).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/画册');
  const menu = page.locator('.slash-menu-feishu').first();
  await expect(menu).toBeVisible();
  await menu.getByText('画册', { exact: true }).click();

  await expect(page.locator('.feishu-base-block')).toHaveCount(2);
  const insertedGallery = page.locator('.feishu-base-block').last();
  await expect(insertedGallery).toHaveAttribute('data-base-view-type', 'gallery');
  await expect(insertedGallery.locator('.base-gallery-card')).toHaveCount(3);
  await expect(insertedGallery.locator('.base-viewbar__current')).toContainText('画册');
  await insertedGallery.locator('.base-viewbar__current').click();
  await expect(insertedGallery.locator('.base-view-sidebar__item')).toHaveCount(1);
  await insertedGallery.locator('.base-viewbar__current').click();

  await page.locator('.ProseMirror p', { hasText: 'after' }).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/表格');
  const tableMenu = page.locator('.slash-menu-feishu').first();
  await expect(tableMenu).toBeVisible();
  await tableMenu.getByText('表格', { exact: true }).last().click();

  await expect(page.locator('.feishu-base-block')).toHaveCount(3);
  const insertedTable = page.locator('.feishu-base-block[data-base-view-type="grid"]').first();
  await expect(page.locator('.feishu-base-block[data-base-view-type="grid"]')).toHaveCount(1);
  await expect(insertedTable).toHaveAttribute('data-base-view-type', 'grid');
  await expect(insertedTable.locator('.base-grid-canvas')).toBeVisible();
  await expect(insertedTable.locator('.base-gallery-card')).toHaveCount(0);
  await expect(insertedTable.locator('.base-viewbar__current')).toContainText('表格');
});

test('dragging an image to gallery creates a shared record and cover', async ({ page }) => {
  await page.route('**/api/uploads', route =>
    route.fulfill({
      status: 201,
      json: { code: 0, data: { name: 'new-card.jpg', type: 'image/jpeg', size: 12, url: '/static/uploads/new-card.jpg' } },
    }),
  );
  await openGallery(page);

  await page.locator('.base-gallery-surface').evaluate(element => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['image'], 'new-card.jpg', { type: 'image/jpeg' }));
    element.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  await expect(page.locator('.base-gallery-card')).toHaveCount(4);
  await expect(page.locator('.base-gallery-card__title').last()).toHaveText('new-card');
  await expect(page.locator('.base-gallery-card').last().locator('img')).toHaveAttribute('src', /\/static\/uploads\/new-card\.jpg$/);

  await expect(page.locator('.base-gallery-card')).toHaveCount(4);
});

test('keeps gallery usable without an attachment field and can add one from settings', async ({ page }) => {
  const document = {
    ...legacyGalleryDocument,
    content: `<div data-local-block="bitable" data-model='${JSON.stringify(noAttachmentModel)}'></div>`,
  };
  await page.unroute('**/api/documents/bitable-gallery-e2e');
  await page.route('**/api/documents/bitable-gallery-e2e', route =>
    route.fulfill({ json: { code: 0, data: document } }),
  );
  await page.goto('/doc/bitable-gallery-e2e');

  await expect(page.locator('.base-gallery-card')).toHaveCount(1);
  await expect(page.locator('.base-gallery-empty-cover')).toContainText('选择附件字段作为封面');
  await page.getByRole('button', { name: '画册设置' }).click();
  await expect(page.locator('.base-settings__hint')).toContainText('当前没有附件字段');
  await page.getByRole('button', { name: '创建附件字段' }).click();
  await expect(page.locator('.base-settings').getByLabel('封面字段')).toHaveValue(/fld_attachment_/);
});

test('renders business report gallery and kanban parity config', async ({ page }) => {
  const document = {
    ...legacyGalleryDocument,
    content: `<div data-local-block="bitable" data-model='${JSON.stringify(businessReportParityModel)}'></div>`,
  };
  await page.unroute('**/api/documents/bitable-gallery-e2e');
  await page.route('**/api/documents/bitable-gallery-e2e', route =>
    route.fulfill({ json: { code: 0, data: document } }),
  );

  await page.goto('/doc/bitable-gallery-e2e');
  const block = page.locator('.feishu-base-block').first();
  await expect(block).toHaveAttribute('data-base-view-type', 'gallery');
  await expect(block.locator('.base-gallery-card')).toHaveCount(2);
  await expect(block.locator('.base-gallery-card__cover')).toHaveCount(1);
  await expect(block.locator('.base-checkbox-value.is-checked')).toHaveCount(1);

  await block.locator('.base-viewbar__current').click();
  await block.locator('.base-view-sidebar__name', { hasText: '看板' }).click();
  await expect(block).toHaveAttribute('data-base-view-type', 'kanban');
  await expect(block.locator('.base-kanban__column')).toHaveCount(2);
  await expect(block.locator('.base-kanban__column', { hasText: '空分组' })).toHaveCount(0);
  await expect(block.locator('.base-kanban__create-group')).toHaveCount(0);
  await expect(block.locator('.base-kanban__column-add')).toHaveCount(0);
});

test('limits imported bitable view switcher to table kanban and gallery', async ({ page }) => {
  const document = {
    ...legacyGalleryDocument,
    content: `<div data-local-block="bitable" data-model='${JSON.stringify(visibleViewScopeModel)}'></div>`,
  };
  await page.unroute('**/api/documents/bitable-gallery-e2e');
  await page.route('**/api/documents/bitable-gallery-e2e', route =>
    route.fulfill({ json: { code: 0, data: document } }),
  );

  await page.goto('/doc/bitable-gallery-e2e');
  const block = page.locator('.feishu-base-block').first();
  await expect(block).toHaveAttribute('data-base-view-type', 'grid');
  await block.locator('.base-viewbar__current').click();

  const sidebar = block.locator('.base-view-sidebar');
  await expect(sidebar.locator('.base-view-sidebar__item')).toHaveCount(3);
  await expect(sidebar).toContainText('Table View');
  await expect(sidebar).toContainText('Kanban View');
  await expect(sidebar).toContainText('Gallery View');
  await expect(sidebar).not.toContainText('Calendar View');
  await expect(sidebar).not.toContainText('Form View');
  await expect(sidebar).not.toContainText('Gantt View');

  await sidebar.locator('.base-view-sidebar__new').hover();
  await expect(sidebar.locator('.base-view-sidebar__create-list button')).toHaveCount(3);
});

test('applies grouping and filtering as gallery view configuration only', async ({ page }) => {
  await openGallery(page);
  await page.getByRole('button', { name: '画册设置' }).click();
  const settings = page.locator('.base-settings');
  await settings.getByLabel('分组字段').selectOption({ label: '状态' });
  await expect(page.locator('.base-gallery-group__header')).toHaveCount(2);

  await settings.getByLabel('筛选字段').selectOption({ label: '状态' });
  await settings.getByPlaceholder('包含内容').fill('已完成');
  await expect(page.locator('.base-gallery-card')).toHaveCount(1);
  await settings.getByRole('button', { name: '×' }).click();

  await createGridViewFromGallery(page);
  await expect(page.locator('.base-grid-footer')).toContainText('3 条记录');
});

test('opens record modal on card click and supports multi selection', async ({ page }) => {
  await openGallery(page);

  await page.locator('.base-gallery-canvas-card-hit').first().click();
  await expect(page.locator('.bitable-record-card-mask')).toBeVisible();
  await expect(page.locator('.bitable-card-modal-header-v2-title')).toContainText('产品 A');
  await page.keyboard.press('Escape');
  await expect(page.locator('.bitable-record-card-mask')).toHaveCount(0);

  await page.locator('.base-gallery-canvas-card-hit').first().click({ modifiers: ['Control'] });
  await page.locator('.base-gallery-canvas-card-hit').nth(1).click({ modifiers: ['Shift'] });
  await expect(page.locator('.base-gallery-canvas-card-hit.is-selected')).toHaveCount(2);
  await expect(page.locator('.bitable-record-card-mask')).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(page.locator('.base-gallery-canvas-card-hit.is-selected')).toHaveCount(0);
});

test('locks gallery view configuration controls', async ({ page }) => {
  await openGallery(page);
  await page.getByRole('button', { name: '画册设置' }).click();

  const settings = page.locator('.base-settings');
  await settings.getByRole('button', { name: '锁定视图' }).click();
  await expect(settings.getByLabel('封面字段')).toBeDisabled();
  await expect(settings.getByLabel('卡片尺寸')).toBeDisabled();
  await expect(settings.getByLabel('分组字段')).toBeDisabled();
  await expect(settings.getByPlaceholder('搜索记录')).toBeDisabled();
  await expect(settings.getByRole('button', { name: '删除视图' })).toHaveCount(0);
});

test('keeps the global block control aligned with the bitable header across views', async ({ page }) => {
  await openGallery(page);

  const block = page.locator('.feishu-base-block').first();
  const assertBlockControlAligned = async () => {
    const viewbar = block.locator('.base-viewbar');
    const initialViewbarBox = await viewbar.boundingBox();
    expect(initialViewbarBox).not.toBeNull();
    await viewbar.hover({ position: { x: Math.min(320, initialViewbarBox!.width - 8), y: 8 } });
    const tools = page.locator('.block-inline-tools');
    await expect(tools).toBeVisible();

    const [toolsBox, viewbarBox, blockBox] = await Promise.all([tools.boundingBox(), viewbar.boundingBox(), block.boundingBox()]);
    expect(toolsBox).not.toBeNull();
    expect(viewbarBox).not.toBeNull();
    expect(blockBox).not.toBeNull();
    const toolsCenter = toolsBox!.y + toolsBox!.height / 2;
    const viewbarCenter = viewbarBox!.y + viewbarBox!.height / 2;
    expect(Math.abs(toolsCenter - viewbarCenter)).toBeLessThanOrEqual(1);
    expect(Math.abs(toolsBox!.x + toolsBox!.width - blockBox!.x)).toBeLessThanOrEqual(1);
  };

  await assertBlockControlAligned();
  await block.locator('.base-viewbar__current').click();
  await block.locator('.base-view-sidebar__new').hover();
  await block.locator('.base-view-sidebar__create-list').getByRole('button', { name: /看板视图/ }).click();
  await expect(block).toHaveAttribute('data-base-view-type', 'kanban');
  await assertBlockControlAligned();

  const [kanbanBox, scrollBox] = await Promise.all([
    block.boundingBox(),
    page.locator('.editor-scroll').boundingBox(),
  ]);
  expect(kanbanBox).not.toBeNull();
  expect(scrollBox).not.toBeNull();
  expect(kanbanBox!.x).toBeGreaterThanOrEqual(scrollBox!.x + 40);
  expect(kanbanBox!.x + kanbanBox!.width).toBeLessThanOrEqual(scrollBox!.x + scrollBox!.width - 40);

  const beforeBox = await page.locator('.ProseMirror p', { hasText: 'before' }).boundingBox();
  expect(beforeBox).not.toBeNull();
  const startX = kanbanBox!.x + kanbanBox!.width / 2;
  const startY = (beforeBox!.y + beforeBox!.height + kanbanBox!.y) / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, kanbanBox!.y + kanbanBox!.height - 12, { steps: 8 });
  await page.mouse.up();

  const selectionBox = await page.locator('.feishu-box-selection-band').boundingBox();
  expect(selectionBox).not.toBeNull();
  expect(Math.abs(selectionBox!.x - kanbanBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(selectionBox!.width - kanbanBox!.width)).toBeLessThanOrEqual(1);
});

test('shows the active gallery icon and creates a kanban view over shared records', async ({ page }) => {
  await openGallery(page);
  await expect(page.locator('.base-viewbar__current [data-view-icon="gallery"]')).toBeVisible();

  await page.locator('.base-viewbar__current').click();
  await page.locator('.base-view-sidebar__new').hover();
  await page.locator('.base-view-sidebar__create-list').getByRole('button', { name: /看板视图/ }).click();

  const block = page.locator('.feishu-base-block').first();
  await expect(block).toHaveAttribute('data-base-view-type', 'kanban');
  await expect(block.locator('.base-viewbar__current [data-view-icon="kanban"]')).toBeVisible();
  await expect(block.locator('.base-kanban__column')).toHaveCount(3);
  await expect(block.locator('.base-kanban__card')).toHaveCount(3);

  await block.locator('.base-viewbar__current').click();
  await block.locator('.base-view-sidebar__name', { hasText: '画册' }).click();
  await expect(block.locator('.base-gallery-card')).toHaveCount(3);
});

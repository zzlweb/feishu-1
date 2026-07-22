import { expect, test, type Page } from '@playwright/test';

const recordModalModel = {
  id: 'tbl_record_modal_e2e',
  name: '记录卡片 E2E',
  primaryFieldId: 'title',
  activeViewId: 'grid',
  fields: [
    { id: 'title', name: '任务名', type: 'text' },
    { id: 'note', name: '备注', type: 'text' },
    { id: 'due', name: '截止日期', type: 'date' },
    { id: 'files', name: '附件', type: 'attachment' },
  ],
  records: [
    {
      id: 'rec_main',
      tableId: 'tbl_record_modal_e2e',
      fields: {
        title: '主任务',
        note: '说明',
        due: '2026-07-16',
        files: [],
      },
      comments: [
        {
          id: 'rcmt_1',
          content: '已有评论',
          author: 'E2E',
          createdAt: '2026-07-16T01:00:00.000Z',
        },
      ],
      createdAt: '2026-07-16T00:00:00.000Z',
      updatedAt: '2026-07-16T00:00:00.000Z',
      createdBy: 'E2E',
    },
    {
      id: 'rec_next',
      tableId: 'tbl_record_modal_e2e',
      fields: { title: '下一条', note: '', due: '', files: [] },
      createdAt: '2026-07-16T00:00:00.000Z',
      updatedAt: '2026-07-16T00:00:00.000Z',
      createdBy: 'E2E',
    },
  ],
  views: [
    {
      id: 'grid',
      tableId: 'tbl_record_modal_e2e',
      name: '表格',
      type: 'grid',
      config: {},
      filters: [],
      sorts: [],
    },
  ],
};

const recordModalDocument = {
  id: 'bitable-record-modal-e2e',
  title: 'Bitable Record Modal E2E',
  content: `<div data-local-block="bitable" data-model='${JSON.stringify(recordModalModel)}'></div>`,
  author: 'E2E',
  created_at: '2026-07-16T00:00:00.000Z',
  updated_at: '2026-07-16T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

async function openRecordModal(page: Page) {
  await page.route('**/api/documents/bitable-record-modal-e2e/comments', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents/bitable-record-modal-e2e', route =>
    route.fulfill({ json: { code: 0, data: recordModalDocument } }),
  );
  await page.goto('/doc/bitable-record-modal-e2e');
  const block = page.locator('.feishu-base-block').first();
  await expect(block).toBeVisible();
  await expect(block.locator('.base-grid-canvas')).toBeVisible();
  await block.locator('.base-grid-canvas').hover({ position: { x: 140, y: 52 } });
  const opener = block.locator('.base-grid-row-hover-actions__view');
  await opener.click();
  const modal = page.locator('.bitable-record-card-content');
  await expect(modal).toBeVisible();
  await expect(page.locator('.bitable-card-modal-header-v2-title')).toContainText('主任务');
  return { block, modal, opener };
}

test('traps keyboard focus and restores it to the record trigger on close', async ({ page }) => {
  const { modal, opener } = await openRecordModal(page);

  await expect(modal).toBeFocused();
  for (let index = 0; index < 16; index += 1) {
    await page.keyboard.press('Tab');
    const focusIsOwnedByModal = await page.evaluate(() => {
      const active = document.activeElement;
      return Boolean(active && (
        document.querySelector('.bitable-record-card-content')?.contains(active)
        || active.closest('[data-e2e="bitable-card-attachment-panel"], [data-e2e="bitable-card-date-panel"], .t-select__dropdown')
      ));
    });
    expect(focusIsOwnedByModal).toBe(true);
  }

  await modal.getByRole('button', { name: '关闭' }).click();
  await expect(modal).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('record modal aligns field rows for text date and attachment', async ({ page }) => {
  const { modal } = await openRecordModal(page);

  await expect(modal.getByRole('tab', { name: '详情' })).toHaveAttribute('aria-selected', 'true');
  await expect(modal.locator('.bitable-field-name', { hasText: '任务名' })).toBeVisible();
  await expect(modal.locator('.bitable-field-name', { hasText: '截止日期' })).toBeVisible();
  await expect(modal.locator('.bitable-field-name', { hasText: '附件' })).toBeVisible();
  await expect(modal.locator('.bitable-card-field-value--date')).toBeVisible();
  await expect(modal.locator('.bitable-card-attachment-add')).toBeVisible();
  await expect(modal.locator('.bitable-card-attachment-empty')).toContainText('暂无附件');

  await modal.getByRole('tab', { name: '评论' }).click();
  const comments = page.locator('[data-e2e="bitable-card-comments"]');
  await expect(comments).toBeVisible();
  await expect(comments).toContainText('已有评论');
  await comments.getByPlaceholder('输入评论').fill('新增一条');
  await comments.getByRole('button', { name: '发送' }).click();
  await expect(comments).toContainText('新增一条');
});

test('attachment panel anchors to plus and stays inside white modal', async ({ page }) => {
  const { modal } = await openRecordModal(page);

  await modal.locator('.bitable-card-attachment-add').click();
  const panel = page.locator('[data-e2e="bitable-card-attachment-panel"]');
  await expect(panel).toBeVisible();
  expect(await panel.evaluate(el => el.parentElement?.tagName)).toBe('BODY');

  const [modalBox, panelBox, addBox] = await Promise.all([
    modal.boundingBox(),
    panel.boundingBox(),
    modal.locator('.bitable-card-attachment-add').boundingBox(),
  ]);
  expect(modalBox).toBeTruthy();
  expect(panelBox).toBeTruthy();
  expect(addBox).toBeTruthy();

  // 面板整体落在白色 modal 内，不漂到灰色遮罩
  expect(panelBox!.x).toBeGreaterThanOrEqual(modalBox!.x - 1);
  expect(panelBox!.y).toBeGreaterThanOrEqual(modalBox!.y - 1);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(modalBox!.x + modalBox!.width + 1);
  expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(modalBox!.y + modalBox!.height + 1);

  // 锚定右侧 +：面板右缘靠近 + 右缘，或左缘靠近 + 左缘
  const panelRight = panelBox!.x + panelBox!.width;
  const addRight = addBox!.x + addBox!.width;
  const rightDelta = Math.abs(panelRight - addRight);
  const leftDelta = Math.abs(panelBox!.x - addBox!.x);
  expect(Math.min(rightDelta, leftDelta)).toBeLessThanOrEqual(28);
  expect(panelBox!.y).toBeGreaterThanOrEqual(addBox!.y - 4);
});

test('modal child popovers sit above the mask by z-index', async ({ page }) => {
  const { modal } = await openRecordModal(page);

  const maskZ = await page.locator('.bitable-record-card-mask').evaluate(el => Number(getComputedStyle(el).zIndex));
  expect(maskZ).toBeGreaterThanOrEqual(10070);

  await modal.locator('.bitable-card-attachment-add').click();
  const attachmentPanel = page.locator('[data-e2e="bitable-card-attachment-panel"]');
  await expect(attachmentPanel).toBeVisible();
  const attachmentZ = await attachmentPanel.evaluate(el => Number(getComputedStyle(el).zIndex));
  expect(attachmentZ).toBeGreaterThan(maskZ);

  // 再次点击 + 关闭附件面板（勿点遮罩，避免关掉整个 modal）
  await modal.locator('.bitable-card-attachment-add').click();
  await expect(attachmentPanel).toHaveCount(0);

  await modal.locator('.bitable-card-date-input-wrap').click();
  const datePanel = page.locator('[data-e2e="bitable-card-date-panel"]');
  await expect(datePanel).toBeVisible();
  const dateZ = await datePanel.evaluate(el => Number(getComputedStyle(el).zIndex));
  expect(dateZ).toBeGreaterThan(maskZ);

  const [modalBox, dateBox] = await Promise.all([modal.boundingBox(), datePanel.boundingBox()]);
  expect(modalBox).toBeTruthy();
  expect(dateBox).toBeTruthy();
  expect(dateBox!.x).toBeGreaterThanOrEqual(modalBox!.x - 1);
  expect(dateBox!.y).toBeGreaterThanOrEqual(modalBox!.y - 1);
  expect(dateBox!.x + dateBox!.width).toBeLessThanOrEqual(modalBox!.x + modalBox!.width + 1);
  expect(dateBox!.y + dateBox!.height).toBeLessThanOrEqual(modalBox!.y + modalBox!.height + 1);
});

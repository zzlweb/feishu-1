import { expect, test } from '@playwright/test';

const kanbanModel = {
  id: 'tbl_kanban_e2e',
  name: '看板 E2E',
  primaryFieldId: 'title',
  activeViewId: 'kanban',
  fields: [
    { id: 'title', name: '任务名', type: 'text' },
    { id: 'note', name: '备注', type: 'text' },
    {
      id: 'status',
      name: '任务状态',
      type: 'single_select',
      options: {
        choices: [
          { id: 'todo', name: '未开始', color: '#dee8ff' },
          { id: 'doing', name: '进行中', color: '#f8e6c2' },
          { id: 'done', name: '已完成', color: '#c7effb' },
        ],
      },
    },
  ],
  records: [
    {
      id: 'rec_todo',
      tableId: 'tbl_kanban_e2e',
      fields: { title: '', note: '', status: '未开始' },
      createdAt: '2026-06-07T00:00:00.000Z',
      updatedAt: '2026-06-07T00:00:00.000Z',
      createdBy: 'E2E',
    },
    {
      id: 'rec_doing',
      tableId: 'tbl_kanban_e2e',
      fields: { title: '', note: '', status: '进行中' },
      createdAt: '2026-06-07T00:00:00.000Z',
      updatedAt: '2026-06-07T00:00:00.000Z',
      createdBy: 'E2E',
    },
    {
      id: 'rec_done',
      tableId: 'tbl_kanban_e2e',
      fields: { title: '', note: '', status: '已完成' },
      createdAt: '2026-06-07T00:00:00.000Z',
      updatedAt: '2026-06-07T00:00:00.000Z',
      createdBy: 'E2E',
    },
  ],
  views: [
    {
      id: 'kanban',
      tableId: 'tbl_kanban_e2e',
      name: '看板',
      type: 'kanban',
      config: {
        titleFieldId: 'title',
        visibleFieldIds: ['note'],
        coverFit: 'cover',
        cardSize: 'medium',
        cardAspectRatio: '4:3',
        showFieldNames: false,
        showEmptyFields: false,
        showAttachmentCount: true,
        showRecordActions: false,
        emptyCoverMode: 'placeholder',
      },
      filters: [],
      sorts: [],
    },
  ],
};

const kanbanDocument = {
  id: 'bitable-kanban-e2e',
  title: 'Bitable Kanban E2E',
  content: `<div data-local-block="bitable" data-model='${JSON.stringify(kanbanModel)}'></div>`,
  author: 'E2E',
  created_at: '2026-06-07T00:00:00.000Z',
  updated_at: '2026-06-07T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/documents/bitable-kanban-e2e/comments', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents/bitable-kanban-e2e', route =>
    route.fulfill({ json: { code: 0, data: kanbanDocument } }),
  );
});

async function openKanban(page: import('@playwright/test').Page) {
  await page.goto('/doc/bitable-kanban-e2e');
  await expect(page.locator('.feishu-base-block')).toBeVisible();
  await expect(page.locator('.feishu-base-block')).toHaveAttribute('data-base-view-type', 'kanban');
  await expect(page.locator('.base-kanban__card')).toHaveCount(3);
}

test('opens record modal when clicking a kanban card', async ({ page }) => {
  await openKanban(page);

  await page.locator('.base-kanban__card-body').first().click();
  await expect(page.locator('.bitable-record-card-mask')).toBeVisible();
  await expect(page.locator('.bitable-card-modal-header-v2-title')).toContainText('未命名记录');
  await expect(page.locator('.base-kanban__card.is-selected')).toHaveCount(1);
  await expect(page.locator('.bitable-item-view-tab.is-active')).toContainText('详情');
  await expect(page.locator('.bitable-field-name', { hasText: '任务名' })).toBeVisible();
  await expect(page.locator('.bitable-field-name', { hasText: '备注' })).toBeVisible();
  await expect(page.locator('.card_edit_hide_toggle')).toContainText('1 个隐藏字段');

  await page.keyboard.press('Escape');
  await expect(page.locator('.bitable-record-card-mask')).toHaveCount(0);
  await expect(page.locator('.base-kanban__card.is-selected')).toHaveCount(0);
});

test('opens record modal from kanban card context menu', async ({ page }) => {
  await openKanban(page);

  await page.locator('.base-kanban__card').nth(1).click({ button: 'right' });
  await page.locator('.base-kanban__card-menu').getByRole('button', { name: '查看详情' }).click();
  await expect(page.locator('.bitable-record-card-mask')).toBeVisible();
});

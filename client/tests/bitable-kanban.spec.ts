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
      fields: { title: '任务 1', note: '', status: '未开始' },
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
        groupByFieldId: 'status',
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

const kanbanNoTopAddModel = {
  ...kanbanModel,
  id: 'tbl_kanban_no_top_add',
  views: [
    {
      ...kanbanModel.views[0],
      config: {
        ...kanbanModel.views[0].config,
        showNewRecordButton: false,
      },
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
  await expect(page.locator('.bitable-card-modal-header-v2-title')).toContainText('任务 1');
  await expect(page.locator('.base-kanban__card.is-selected')).toHaveCount(1);
  await expect(page.locator('.bitable-item-view-tab.is-active')).toContainText('详情');
  await expect(page.locator('.bitable-field-name', { hasText: '任务名' })).toBeVisible();
  await expect(page.locator('.bitable-field-name', { hasText: '备注' })).toBeVisible();
  await expect(page.locator('.card_edit_hide_toggle')).toContainText('1 个隐藏字段');

  await page.keyboard.press('Escape');
  await expect(page.locator('.bitable-record-card-mask')).toHaveCount(0);
  await expect(page.locator('.base-kanban__card.is-selected')).toHaveCount(0);
});

test('opens kanban cards with Enter and Space from a stable keyboard focus', async ({ page }) => {
  await openKanban(page);

  const firstCard = page.locator('.base-kanban__card').first();
  await firstCard.focus();
  await expect(firstCard).toBeFocused();
  await expect(firstCard).toHaveAttribute('role', 'button');
  await expect(firstCard).toHaveAttribute('aria-label', '记录：任务 1');
  await expect(firstCard).toHaveAttribute('aria-pressed', 'false');

  await page.keyboard.press('Enter');
  await expect(page.locator('.bitable-record-card-mask')).toBeVisible();
  await expect(firstCard).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(firstCard).toHaveAttribute('aria-pressed', 'false');

  await firstCard.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.bitable-record-card-mask')).toBeVisible();
  await expect(page.locator('.bitable-card-modal-header-v2-title')).toContainText('任务 1');
});

test('opens record modal from kanban card context menu', async ({ page }) => {
  await openKanban(page);

  await page.locator('.base-kanban__card').nth(1).click({ button: 'right' });
  const cardMenu = page.locator('.base-kanban__card-menu--portal');
  await expect(cardMenu).toBeVisible();
  expect(await cardMenu.evaluate(el => el.parentElement?.tagName)).toBe('BODY');
  await cardMenu.getByRole('button', { name: '查看详情' }).click();
  await expect(page.locator('.bitable-record-card-mask')).toBeVisible();
});

test('reports affected records and migrates them before deleting a kanban group', async ({ page }) => {
  await openKanban(page);

  const openDelete = async () => {
    await page.getByRole('button', { name: '未开始 更多操作' }).click();
    await page.locator('.base-kanban__column-menu--portal').getByRole('button', { name: '删除分组' }).click();
  };

  await openDelete();
  const dialog = page.locator('[data-e2e="kanban-group-delete-dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('1 条记录位于该分组');
  await page.getByRole('button', { name: '取消' }).last().click();
  await expect(page.getByRole('button', { name: '未开始 更多操作' })).toBeVisible();

  await openDelete();
  await dialog.locator('select').selectOption({ label: '已完成' });
  const saveRequest = page.waitForRequest(request =>
    request.url().endsWith('/api/documents/bitable-kanban-e2e') && request.method() === 'PUT',
  );
  await page.getByRole('button', { name: '迁移并删除' }).click();
  const body = (await saveRequest).postDataJSON() as { content?: string };
  await expect(page.getByRole('button', { name: '未开始 更多操作' })).toHaveCount(0);
  expect(body.content).toContain('done');
  expect(body.content).not.toContain('未开始');
});

test('column menu portals to body and is not clipped by column', async ({ page }) => {
  await openKanban(page);

  await page.locator('.base-kanban__column').first().getByRole('button', { name: /更多操作/ }).click();
  const columnMenu = page.locator('.base-kanban__column-menu--portal');
  await expect(columnMenu).toBeVisible();
  expect(await columnMenu.evaluate(el => el.parentElement?.tagName)).toBe('BODY');
  const box = await columnMenu.boundingBox();
  expect(box).toBeTruthy();
  expect(box!.width).toBeGreaterThan(80);
  expect(box!.height).toBeGreaterThan(40);
  await expect(columnMenu.getByRole('button', { name: '新建记录' })).toBeVisible();
});

test('column cards scroll container is the card list not the header', async ({ page }) => {
  await openKanban(page);

  const cards = page.locator('.base-kanban__column').first().locator('.base-kanban__column-cards');
  const header = page.locator('.base-kanban__column').first().locator('.base-kanban__column-header');
  await expect(cards).toBeVisible();
  await expect(header).toBeVisible();

  const cardsOverflowY = await cards.evaluate(el => getComputedStyle(el).overflowY);
  expect(['auto', 'scroll', 'overlay']).toContain(cardsOverflowY);
  const headerOverflowY = await header.evaluate(el => getComputedStyle(el).overflowY);
  expect(headerOverflowY === 'visible' || headerOverflowY === 'auto').toBeTruthy();
});

test('keeps column add entry when new-record button is enabled', async ({ page }) => {
  await openKanban(page);
  await expect(page.locator('.base-kanban__column-add').first()).toBeVisible();
  await expect(page.locator('.base-kanban__column-add').first()).toContainText('新建任务');
});

test('column menu still offers add when showNewRecordButton is false', async ({ page }) => {
  const document = {
    ...kanbanDocument,
    content: `<div data-local-block="bitable" data-model='${JSON.stringify(kanbanNoTopAddModel)}'></div>`,
  };
  await page.unroute('**/api/documents/bitable-kanban-e2e');
  await page.route('**/api/documents/bitable-kanban-e2e', route =>
    route.fulfill({ json: { code: 0, data: document } }),
  );
  await page.goto('/doc/bitable-kanban-e2e');
  await expect(page.locator('.base-kanban__card')).toHaveCount(3);
  await expect(page.locator('.base-kanban__column-add')).toHaveCount(0);

  await page.locator('.base-kanban__column').first().getByRole('button', { name: /更多操作/ }).click();
  const columnMenu = page.locator('.base-kanban__column-menu--portal');
  await expect(columnMenu.getByRole('button', { name: '新建记录' })).toBeVisible();
  await columnMenu.getByRole('button', { name: '新建记录' }).click();
  await expect(page.locator('.base-kanban__card')).toHaveCount(4);
});

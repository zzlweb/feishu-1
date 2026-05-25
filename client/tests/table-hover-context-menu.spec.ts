import { expect, test } from '@playwright/test';

const e2eDocument = {
  id: 'table-hover-menu-e2e',
  title: 'Table Hover Menu E2E',
  content: '<p></p>',
  author: 'E2E',
  created_at: '2026-05-23T00:00:00.000Z',
  updated_at: '2026-05-23T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/documents/table-hover-menu-e2e/comments', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents/table-hover-menu-e2e', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { code: 0, data: e2eDocument } });
    }
    return route.fulfill({ json: { code: 0, data: e2eDocument } });
  });
});

async function insertTableViaSlashMenu(page: import('@playwright/test').Page) {
  const firstParagraph = page.locator('.ProseMirror p').first();
  await expect(firstParagraph).toBeVisible();
  await firstParagraph.hover();

  const addButton = page.locator('.block-add-btn').first();
  await expect(addButton).toBeVisible();
  await addButton.hover();

  const slashMenu = page.locator('.slash-menu-feishu').first();
  await expect(slashMenu).toBeVisible();

  const tableItem = slashMenu.locator('.slash-item--has-submenu').first();
  await expect(tableItem).toBeVisible();
  await tableItem.hover();

  const gridCell = page.locator('.slash-table-grid-flyout .table-grid-picker__cell').nth(10);
  await expect(gridCell).toBeVisible();
  await gridCell.click();

  await expect(page.locator('.feishu-table-host, .tableWrapper').first()).toBeVisible();
}

test('shows block menu (not table menu) after leaving table hover for text below', async ({ page }) => {
  await page.goto('/doc/table-hover-menu-e2e');

  await insertTableViaSlashMenu(page);

  const editor = page.locator('.ProseMirror');
  await editor.press('ArrowDown');
  await editor.press('ArrowDown');
  await editor.type('text below table');

  const tableHost = page.locator('.feishu-table-host, .tableWrapper').first();
  const tableHandle = page.locator('.feishu-table-chrome__handle').first();
  await tableHost.hover();
  await tableHandle.hover();
  await expect(page.locator('.context-menu')).toBeVisible();

  const textBelow = page.locator('.ProseMirror p', { hasText: 'text below table' });
  await expect(textBelow).toBeVisible();
  await textBelow.hover();
  await expect(page.locator('.context-menu')).toBeHidden({ timeout: 3_000 });
  await expect(tableHost).not.toHaveClass(/is-table-block-active/);

  const blockDrag = page.locator('.block-drag-row').first();
  await expect(blockDrag).toBeVisible();
  await blockDrag.hover();
  await expect(page.locator('.context-menu')).toBeVisible();
});

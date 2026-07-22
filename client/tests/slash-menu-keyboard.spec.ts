import { expect, test, type Page } from '@playwright/test';

const slashDocument = {
  id: 'slash-menu-keyboard-e2e',
  title: 'Slash keyboard E2E',
  content: '<p></p>',
  author: 'E2E',
  created_at: '2026-07-22T00:00:00.000Z',
  updated_at: '2026-07-22T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
  version: 1,
  schema_version: 1,
};

async function openDocument(page: Page) {
  await page.route('**/api/documents/slash-menu-keyboard-e2e/comments', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents/slash-menu-keyboard-e2e', route =>
    route.fulfill({ json: { code: 0, data: slashDocument } }),
  );
  await page.goto('/doc/slash-menu-keyboard-e2e');
  await expect(page.locator('.ProseMirror')).toBeVisible();
}

test('keyboard opens, navigates, exits, and confirms the table submenu', async ({ page }) => {
  await openDocument(page);
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await editor.pressSequentially('/table');

  const menu = page.getByRole('menu', { name: '插入块' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: '表格', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');

  const submenu = page.getByRole('menu', { name: '插入选项' });
  const grid = submenu.getByRole('grid');
  await expect(grid).toHaveAttribute('aria-label', '表格大小 1 行 1 列');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(grid).toHaveAttribute('aria-label', '表格大小 2 行 2 列');

  await page.keyboard.press('Escape');
  await expect(submenu).toBeHidden();
  await expect(menu).toBeVisible();
  await expect(editor).toContainText('/table');

  await page.keyboard.press('Enter');
  await expect(submenu).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  await expect(page.locator('.feishu-table-host, .tableWrapper').first()).toBeVisible();
  await expect(editor).not.toContainText('/table');
});

test('cancelling the image file chooser preserves the slash text', async ({ page }) => {
  await openDocument(page);
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await editor.pressSequentially('/image');

  const menu = page.getByRole('menu', { name: '插入块' });
  await expect(menu).toBeVisible();
  const chooserPromise = page.waitForEvent('filechooser');
  await menu.getByRole('menuitem', { name: '图片', exact: true }).click();
  await chooserPromise;

  await expect(menu).toBeHidden();
  await expect(editor).toContainText('/image');
  await expect(page.locator('.media-file-block, img')).toHaveCount(0);
});

import { expect, test } from '@playwright/test';

const colorDocument = {
  id: 'block-color-e2e',
  title: 'Block Color E2E',
  content: '<p>Color me</p>',
  author: 'E2E',
  created_at: '2026-05-23T00:00:00.000Z',
  updated_at: '2026-05-23T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/documents/block-color-e2e/comments', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents/block-color-e2e', route =>
    route.fulfill({ json: { code: 0, data: colorDocument } }),
  );
});

test('applies font color from block context menu', async ({ page }) => {
  await page.goto('/doc/block-color-e2e');

  const paragraph = page.locator('.ProseMirror p').first();
  await expect(paragraph).toContainText('Color me');
  await paragraph.hover();

  const blockHandle = page.locator('.block-drag-row').first();
  await expect(blockHandle).toBeVisible();
  await blockHandle.hover();

  const contextMenu = page.locator('.context-menu').first();
  await expect(contextMenu).toBeVisible();

  await contextMenu.getByText('颜色', { exact: true }).hover();
  const colorFlyout = page.locator('.context-color-flyout').first();
  await expect(colorFlyout).toBeVisible();

  await colorFlyout.locator('.feishu-color-panel__font-btn').nth(2).click();

  await expect(paragraph.locator('span[style*="color"]')).toHaveCSS('color', 'rgb(216, 57, 49)');
});

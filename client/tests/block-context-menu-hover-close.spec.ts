import { expect, test } from '@playwright/test';

const e2eDocument = {
  id: 'block-menu-hover-close-e2e',
  title: 'Block Menu Hover Close E2E',
  content: '<p>段落一</p><p>段落二用于移出菜单</p>',
  author: 'E2E',
  created_at: '2026-07-22T00:00:00.000Z',
  updated_at: '2026-07-22T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/documents/block-menu-hover-close-e2e/comments', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents/block-menu-hover-close-e2e', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { code: 0, data: e2eDocument } });
    }
    return route.fulfill({ json: { code: 0, data: e2eDocument } });
  });
});

test('closes block context menu after pointer leaves menu for editor content', async ({ page }) => {
  await page.goto('/doc/block-menu-hover-close-e2e');

  const firstParagraph = page.locator('.ProseMirror p').first();
  await expect(firstParagraph).toBeVisible();
  await firstParagraph.hover();

  const blockDrag = page.locator('.block-drag-row').first();
  await expect(blockDrag).toBeVisible();
  await blockDrag.hover();

  const menu = page.locator('.context-menu').first();
  await expect(menu).toBeVisible();

  const menuBox = await menu.boundingBox();
  expect(menuBox).not.toBeNull();
  if (menuBox) {
    await page.mouse.move(menuBox.x + menuBox.width / 2, menuBox.y + 40);
  }
  await expect(menu).toBeVisible();

  const secondParagraph = page.locator('.ProseMirror p').nth(1);
  const targetBox = await secondParagraph.boundingBox();
  expect(targetBox).not.toBeNull();
  if (targetBox) {
    // 快速划出：途经块柄区域再落到正文，覆盖 relatedTarget 落在锚点上的卡住场景
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 6 });
  }

  await expect(menu).toBeHidden({ timeout: 3_000 });
});

test('keeps block context menu open while moving between handle and menu', async ({ page }) => {
  await page.goto('/doc/block-menu-hover-close-e2e');

  const firstParagraph = page.locator('.ProseMirror p').first();
  await firstParagraph.hover();
  const blockDrag = page.locator('.block-drag-row').first();
  await blockDrag.hover();

  const menu = page.locator('.context-menu').first();
  await expect(menu).toBeVisible();

  const handleBox = await blockDrag.boundingBox();
  const menuBox = await menu.boundingBox();
  expect(handleBox).not.toBeNull();
  expect(menuBox).not.toBeNull();
  if (handleBox && menuBox) {
    await page.mouse.move(menuBox.x + menuBox.width / 2, menuBox.y + 24, { steps: 4 });
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2, { steps: 4 });
    await page.mouse.move(menuBox.x + menuBox.width / 2, menuBox.y + 48, { steps: 4 });
  }

  await expect(menu).toBeVisible();
});

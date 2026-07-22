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

test('opens and exits block submenus with the keyboard', async ({ page }) => {
  await page.goto('/doc/block-color-e2e');

  const paragraph = page.locator('.ProseMirror p').first();
  await paragraph.hover();
  await page.locator('.block-drag-row').first().hover();

  const contextMenu = page.getByRole('menu', { name: '块操作' });
  await expect(contextMenu).toBeVisible();
  const colorTrigger = contextMenu.getByRole('menuitem', { name: '颜色' });
  await colorTrigger.focus();
  await page.keyboard.press('ArrowRight');

  const colorFlyout = page.getByRole('menu', { name: '颜色' });
  await expect(colorFlyout).toBeVisible();
  await expect(colorTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect(colorFlyout.locator('button').first()).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(colorFlyout).toHaveCount(0);
  await expect(colorTrigger).toBeFocused();

  const addBelowTrigger = contextMenu.getByRole('menuitem', { name: '在下方添加' });
  await addBelowTrigger.focus();
  await page.keyboard.press('ArrowRight');
  const addBelowFlyout = page.getByRole('menu', { name: '在下方添加' });
  await expect(addBelowFlyout).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(addBelowFlyout).toHaveCount(0);
  await expect(addBelowTrigger).toBeFocused();
});

test('offers an actionable recovery when clipboard access is rejected', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new DOMException('permission denied', 'NotAllowedError')),
      },
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: () => false,
    });
  });
  await page.goto('/doc/block-color-e2e');

  const openBlockMenu = async () => {
    await page.locator('.ProseMirror p').first().hover();
    await page.locator('.block-drag-row').first().hover();
    await expect(page.getByRole('menu', { name: '块操作' })).toBeVisible();
  };

  await openBlockMenu();
  await page.getByRole('menuitem', { name: /复制.*Ctrl\+C/ }).click();
  await expect(page.getByText('复制失败，请使用 Ctrl+C 重试')).toBeVisible();

  await openBlockMenu();
  await page.getByRole('menuitem', { name: /剪切.*Ctrl\+X/ }).click();
  await expect(page.getByText('剪切失败，请使用 Ctrl+X 重试')).toBeVisible();

  await openBlockMenu();
  await page.getByRole('menuitem', { name: '复制链接', exact: true }).click();
  await expect(page.getByText('复制失败，请从地址栏复制链接')).toBeVisible();
});

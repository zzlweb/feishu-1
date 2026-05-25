import { expect, test, type Locator, type Page } from '@playwright/test';

const dragDocument = {
  id: 'block-drag-e2e',
  title: 'Block Drag E2E',
  content: '<p>Alpha block</p><p>Beta block</p><table><tbody><tr><td><p>Table cell</p></td></tr></tbody></table><p>Omega block</p>',
  author: 'E2E',
  created_at: '2026-05-25T00:00:00.000Z',
  updated_at: '2026-05-25T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/documents/block-drag-e2e/comments', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents/block-drag-e2e', route =>
    route.fulfill({ json: { code: 0, data: dragDocument } }),
  );
  await page.goto('/doc/block-drag-e2e');
});

async function dragFromHandleTo(page: Page, handle: Locator, target: Locator, placement: 'before' | 'after') {
  const handleBox = await handle.boundingBox();
  const targetBox = await target.boundingBox();
  expect(handleBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  if (!handleBox || !targetBox) return;

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  const endX = targetBox.x + Math.min(40, targetBox.width / 2);
  const endY = placement === 'before' ? targetBox.y + 2 : targetBox.y + targetBox.height - 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 12 });
  await expect(page.locator('.block-drag-drop-indicator')).toBeVisible();
  await expect(page.locator('.block-drag-preview')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('.block-drag-preview')).toHaveCount(0);
}

test('drags a paragraph block using the left block handle', async ({ page }) => {
  const alpha = page.locator('.ProseMirror > p', { hasText: 'Alpha block' });
  const omega = page.locator('.ProseMirror > p', { hasText: 'Omega block' });
  await alpha.hover();

  const handle = page.locator('.block-drag-row').first();
  await expect(handle).toBeVisible();
  await dragFromHandleTo(page, handle, omega, 'after');

  const order = await page.locator('.ProseMirror > *').evaluateAll(nodes =>
    nodes.map(node => node.textContent?.trim()).filter(Boolean),
  );
  expect(order).toEqual(['Beta block', 'Table cell', 'Omega block', 'Alpha block']);
});

test('drags a table block using its top-left block handle', async ({ page }) => {
  const table = page.locator('.feishu-table-host, .tableWrapper').first();
  const alpha = page.locator('.ProseMirror > p', { hasText: 'Alpha block' });
  await table.hover();

  const handle = page.locator('.feishu-table-chrome__handle').first();
  await expect(handle).toBeVisible();
  await dragFromHandleTo(page, handle, alpha, 'before');

  const firstBlock = page.locator('.ProseMirror > *').first();
  await expect(firstBlock).toContainText('Table cell');
  await expect(page.locator('.ProseMirror > p').first()).toHaveText('Alpha block');
});

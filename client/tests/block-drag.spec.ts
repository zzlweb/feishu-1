import { expect, test, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const dragDocument = {
  id: 'block-drag-e2e',
  title: 'Block Drag E2E',
  content: '<p>Alpha block</p><p>Beta block</p><img src="/static/uploads/sample-crop.png" alt="拖拽图片"><table><tbody><tr><td><p>Table cell</p></td></tr></tbody></table><div class="feishu-columns-node" data-local-block="columns"><div class="feishu-columns-block__col-wrap" data-width-ratio="50" data-local-column="true"><div class="feishu-columns-block__col"><p>Left column</p></div></div><div class="feishu-columns-block__col-wrap" data-width-ratio="50" data-local-column="true"><div class="feishu-columns-block__col"><p>Right column</p></div></div></div><p>Omega block</p>',
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
  await page.route('**/static/uploads/sample-crop.png', route =>
    route.fulfill({ path: fileURLToPath(new URL('./fixtures/sample-crop.png', import.meta.url)) }),
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
  // 落在目标块水平中央，避免误触左右分栏热区
  const endX = targetBox.x + targetBox.width / 2;
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
    nodes.map(node => {
      if (node.classList.contains('feishu-columns-node') || node.querySelector?.('.feishu-columns-block__col')) {
        return 'columns';
      }
      return node.textContent?.trim() || '';
    }).filter(Boolean),
  );
  expect(order.at(-1)).toBe('Alpha block');
  expect(order).toContain('Beta block');
  expect(order).toContain('Omega block');
});

test('drags a paragraph beside another paragraph to create two columns', async ({ page }) => {
  const alpha = page.locator('.ProseMirror > p', { hasText: 'Alpha block' });
  const beta = page.locator('.ProseMirror > p', { hasText: 'Beta block' });
  await alpha.hover();
  const handle = page.locator('.block-drag-row').first();
  await expect(handle).toBeVisible();

  const handleBox = await handle.boundingBox();
  const targetBox = await beta.boundingBox();
  expect(handleBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  if (!handleBox || !targetBox) return;

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width - 4, targetBox.y + targetBox.height / 2, { steps: 14 });
  await expect(page.locator('.block-drag-drop-indicator--side')).toBeVisible();
  await page.mouse.up();

  const columns = page.locator('.feishu-columns-node').filter({ hasText: 'Alpha block' });
  await expect(columns).toHaveCount(1);
  await expect(columns.locator('.feishu-columns-block__col').filter({ hasText: 'Alpha block' })).toHaveCount(1);
  await expect(columns.locator('.feishu-columns-block__col').filter({ hasText: 'Beta block' })).toHaveCount(1);
});

test('drags an image directly into another column with a thumbnail preview', async ({ page }) => {
  const image = page.locator('.feishu-image').first();
  const rightColumnText = page.locator('.feishu-columns-block__col', { hasText: 'Right column' }).locator('p');
  const imageBox = await image.boundingBox();
  const targetBox = await rightColumnText.boundingBox();
  expect(imageBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  if (!imageBox || !targetBox) return;

  await page.mouse.move(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + 20, targetBox.y + targetBox.height - 2, { steps: 12 });
  await expect(page.locator('.block-drag-preview--media')).toBeVisible();
  await expect(page.locator('.block-drag-drop-indicator')).toBeVisible();
  await page.mouse.up();

  const rightColumn = page.locator('.feishu-columns-block__col', { hasText: 'Right column' });
  await expect(rightColumn.locator('.feishu-image-block-wrap')).toHaveCount(1);
  await expect(page.locator('.ProseMirror > .feishu-image-block-wrap')).toHaveCount(0);
});

test('drags an image onto another image side to create image-grid layout', async ({ page }) => {
  await page.unroute('**/api/documents/block-drag-e2e');
  await page.route('**/api/documents/block-drag-e2e', route =>
    route.fulfill({
      json: {
        code: 0,
        data: {
          ...dragDocument,
          content: [
            '<p>Intro</p>',
            '<img class="feishu-image" src="/static/uploads/sample-crop.png" alt="图一">',
            '<img class="feishu-image" src="/static/uploads/sample-crop.png" alt="图二">',
            '<p>Tail</p>',
          ].join(''),
        },
      },
    }),
  );
  await page.goto('/doc/block-drag-e2e');

  const wraps = page.locator('.ProseMirror .feishu-image-block-wrap');
  await expect(wraps).toHaveCount(2);

  const firstWrap = wraps.nth(0);
  const secondWrap = wraps.nth(1);
  await firstWrap.hover();
  const handle = page.locator('.block-drag-row').first();
  await expect(handle).toBeVisible();

  const handleBox = await handle.boundingBox();
  const targetBox = await secondWrap.boundingBox();
  expect(handleBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  if (!handleBox || !targetBox) return;

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + Math.min(12, targetBox.width * 0.08), targetBox.y + targetBox.height / 2, { steps: 16 });
  await expect(page.locator('.block-drag-drop-indicator--side')).toBeVisible({ timeout: 5_000 });
  await page.mouse.up();

  await expect(page.locator('.feishu-image-grid')).toHaveCount(1);
  await expect(page.locator('.feishu-image-grid__cell')).toHaveCount(2);
  await expect(page.locator('.ProseMirror .feishu-image-block-wrap')).toHaveCount(0);
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

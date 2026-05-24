import { expect, test } from '@playwright/test';

const richDocument = {
  id: 'block-marquee-e2e',
  title: 'Block Marquee E2E',
  content: '<p>Alpha paragraph text</p><p>Beta paragraph text</p><p>Gamma paragraph text</p><blockquote>Quote block</blockquote><pre><code>const value = 1;</code></pre>',
  author: 'E2E',
  created_at: '2026-05-23T00:00:00.000Z',
  updated_at: '2026-05-23T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/documents/block-marquee-e2e/comments', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents/block-marquee-e2e', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { code: 0, data: richDocument } });
    }
    return route.fulfill({ json: { code: 0, data: richDocument } });
  });
});

test('selects multiple blocks from the gutter with a marquee rectangle', async ({ page }) => {
  await page.goto('/doc/block-marquee-e2e');

  const editorArea = page.locator('.editor-content-area');
  const first = page.locator('.ProseMirror p').nth(0);
  const third = page.locator('.ProseMirror p').nth(2);
  await expect(first).toBeVisible();

  const areaBox = await editorArea.boundingBox();
  const firstBox = await first.boundingBox();
  const thirdBox = await third.boundingBox();
  expect(areaBox).not.toBeNull();
  expect(firstBox).not.toBeNull();
  expect(thirdBox).not.toBeNull();

  if (!areaBox || !firstBox || !thirdBox) return;

  const second = page.locator('.ProseMirror p').nth(1);
  const secondBox = await second.boundingBox();
  expect(secondBox).not.toBeNull();
  if (!secondBox) return;

  const startX = firstBox.x + firstBox.width / 2;
  const startY = firstBox.y + firstBox.height + (secondBox.y - (firstBox.y + firstBox.height)) / 2;
  const endX = thirdBox.x + thirdBox.width / 2;
  const endY = thirdBox.y + thirdBox.height + 8;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 12 });
  await expect(page.locator('.feishu-box-selection-rect')).toBeVisible();
  await page.mouse.up();

  await expect(page.locator('.feishu-box-selection-rect')).toBeHidden();
  await expect(page.locator('.feishu-box-selection-band')).toHaveCount(3);
});

test('keeps native text selection when dragging from text', async ({ page }) => {
  await page.goto('/doc/block-marquee-e2e');

  const first = page.locator('.ProseMirror p').nth(0);
  await expect(first).toBeVisible();
  const box = await first.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.move(box.x + 8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 96, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect(page.locator('.feishu-box-selection-band')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString() ?? '')).not.toBe('');
});

test('does not start marquee from block drag handle or action button', async ({ page }) => {
  await page.goto('/doc/block-marquee-e2e');

  const first = page.locator('.ProseMirror p').nth(0);
  await first.hover();

  const dragHandle = page.locator('.block-drag-row').first();
  await expect(dragHandle).toBeVisible();
  const handleBox = await dragHandle.boundingBox();
  expect(handleBox).not.toBeNull();
  if (!handleBox) return;

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 20, handleBox.y + 80, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.feishu-box-selection-rect')).toBeHidden();
  await expect(page.locator('.feishu-box-selection-band')).toHaveCount(0);

  await expect(page.locator('.feishu-box-selection-rect')).toBeHidden();
});

test('does not start marquee from blank padding inside a block row', async ({ page }) => {
  await page.goto('/doc/block-marquee-e2e');

  const first = page.locator('.ProseMirror p').nth(0);
  await expect(first).toBeVisible();
  const box = await first.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 8, box.y + box.height + 80, { steps: 8 });
  await page.mouse.up();

  await expect(page.locator('.feishu-box-selection-rect')).toBeHidden();
  await expect(page.locator('.feishu-box-selection-band')).toHaveCount(0);
});

test('does not select task items when marquee passes over them', async ({ page }) => {
  await page.goto('/doc/block-marquee-e2e');

  await page.locator('.ProseMirror').click();
  await page.keyboard.type('/todo');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Task one');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/todo');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Task two');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Plain paragraph below');

  const taskList = page.locator('ul[data-type="taskList"]').first();
  const paragraph = page.locator('.ProseMirror p', { hasText: 'Plain paragraph below' });
  await expect(taskList).toBeVisible();
  await expect(paragraph).toBeVisible();

  const taskBox = await taskList.boundingBox();
  const paraBox = await paragraph.boundingBox();
  expect(taskBox).not.toBeNull();
  expect(paraBox).not.toBeNull();
  if (!taskBox || !paraBox) return;

  const startX = paraBox.x + paraBox.width / 2;
  const startY = taskBox.y + taskBox.height + (paraBox.y - (taskBox.y + taskBox.height)) / 2;
  const endX = taskBox.x + taskBox.width / 2;
  const endY = taskBox.y + 4;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 12 });
  await page.mouse.up();

  await expect(page.locator('ul[data-type="taskList"] .feishu-box-selection-band')).toHaveCount(0);
});

test('does not start marquee from task checkbox', async ({ page }) => {
  await page.goto('/doc/block-marquee-e2e');

  await page.locator('.ProseMirror').click();
  await page.keyboard.type('/todo');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Task one');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Task two');

  const checkbox = page.locator('ul[data-type="taskList"] input[type="checkbox"]').first();
  await expect(checkbox).toBeVisible();
  const box = await checkbox.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 120, { steps: 10 });
  await page.mouse.up();

  await expect(page.locator('.feishu-box-selection-rect')).toBeHidden();
  await expect(page.locator('.feishu-box-selection-band')).toHaveCount(0);
});

test('supports reverse drag selection', async ({ page }) => {
  await page.goto('/doc/block-marquee-e2e');

  const first = page.locator('.ProseMirror p').nth(0);
  const third = page.locator('.ProseMirror p').nth(2);
  await expect(third).toBeVisible();
  const firstBox = await first.boundingBox();
  const thirdBox = await third.boundingBox();
  const second = page.locator('.ProseMirror p').nth(1);
  const secondBox = await second.boundingBox();
  const pre = page.locator('pre').first();
  const preBox = await pre.boundingBox();
  expect(firstBox).not.toBeNull();
  expect(thirdBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  expect(preBox).not.toBeNull();
  if (!firstBox || !thirdBox || !secondBox || !preBox) return;

  const startX = firstBox.x + firstBox.width / 2;
  const gapBelowFirst = firstBox.y + firstBox.height + (secondBox.y - (firstBox.y + firstBox.height)) / 2;
  const belowLastBlock = preBox.y + preBox.height + 16;

  await page.mouse.move(startX, belowLastBlock);
  await page.mouse.down();
  await page.mouse.move(startX, gapBelowFirst, { steps: 12 });
  await page.mouse.up();

  await expect.poll(() => page.locator('.feishu-box-selection-band').count()).toBeGreaterThanOrEqual(3);
});

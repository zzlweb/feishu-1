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

test('selects and deletes multiple task controls with a marquee', async ({ page }) => {
  await page.route('**/api/documents/block-marquee-e2e', route =>
    route.fulfill({
      json: {
        code: 0,
        data: {
          ...richDocument,
          content: '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><div><p>Task one</p></div></li><li data-type="taskItem" data-checked="false"><div><p>Task two</p></div></li><li data-type="taskItem" data-checked="false"><div><p>Keep task</p></div></li></ul>',
        },
      },
    }),
  );
  await page.goto('/doc/block-marquee-e2e');

  const first = page.locator('ul[data-type="taskList"] li').nth(0).locator('p');
  const second = page.locator('ul[data-type="taskList"] li').nth(1).locator('p');
  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  if (!firstBox || !secondBox) return;

  await page.mouse.move(firstBox.x + firstBox.width - 16, firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(secondBox.x + 120, secondBox.y + secondBox.height / 2, { steps: 12 });
  await page.mouse.up();

  await expect(page.locator('.feishu-box-selection-band')).toHaveCount(2);
  await page.keyboard.press('Delete');
  await expect(page.locator('ul[data-type="taskList"] li')).toHaveCount(1);
  await expect(page.locator('ul[data-type="taskList"] li')).toHaveText('Keep task');
});

test('deletes ordered, bullet and task controls selected together', async ({ page }) => {
  await page.route('**/api/documents/block-marquee-e2e', route =>
    route.fulfill({
      json: {
        code: 0,
        data: {
          ...richDocument,
          content: '<ol><li><p>Ordered control</p></li></ol><ul><li><p>Bullet control</p></li></ul><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><div><p>Task control</p></div></li></ul><p>Keep paragraph</p>',
        },
      },
    }),
  );
  await page.goto('/doc/block-marquee-e2e');

  const first = page.locator('ol li').first();
  const last = page.locator('ul[data-type="taskList"] li').first();
  const firstBox = await first.boundingBox();
  const lastBox = await last.boundingBox();
  const areaBox = await page.locator('.editor-content-area').boundingBox();
  expect(firstBox).not.toBeNull();
  expect(lastBox).not.toBeNull();
  expect(areaBox).not.toBeNull();
  if (!firstBox || !lastBox || !areaBox) return;

  await page.mouse.move(firstBox.x + firstBox.width - 16, firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(areaBox.x + areaBox.width - 12, lastBox.y + lastBox.height / 2, { steps: 12 });
  await page.mouse.up();

  await expect(page.locator('.feishu-box-selection-band')).toHaveCount(3);
  await page.keyboard.press('Delete');
  await expect(page.locator('.ProseMirror > ol, .ProseMirror > ul')).toHaveCount(0);
  await expect(page.locator('.ProseMirror > p')).toHaveText('Keep paragraph');
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

test('deletes a task control selected from blank space in its row', async ({ page }) => {
  await page.route('**/api/documents/block-marquee-e2e', route =>
    route.fulfill({
      json: {
        code: 0,
        data: {
          ...richDocument,
          content: '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><div><p>Delete this control</p></div></li><li data-type="taskItem" data-checked="false"><div><p>Keep this control</p></div></li></ul>',
        },
      },
    }),
  );
  await page.goto('/doc/block-marquee-e2e');

  const target = page.locator('ul[data-type="taskList"] li').first().locator('p');
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.move(box.x + box.width - 16, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect(page.locator('.feishu-box-selection-band')).toHaveCount(1);
  await page.keyboard.press('Delete');
  await expect(page.locator('ul[data-type="taskList"] li')).toHaveCount(1);
  await expect(page.locator('ul[data-type="taskList"] li')).toHaveText('Keep this control');
});

test('keeps native text selection when dragging inside a list control', async ({ page }) => {
  await page.route('**/api/documents/block-marquee-e2e', route =>
    route.fulfill({
      json: {
        code: 0,
        data: {
          ...richDocument,
          content: '<ol><li><p>Selectable ordered control text</p></li></ol><ul><li><p>Bullet control text</p></li></ul>',
        },
      },
    }),
  );
  await page.goto('/doc/block-marquee-e2e');

  const text = page.locator('ol li p').first();
  const box = await text.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.move(box.x + 8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect(page.locator('.feishu-box-selection-band')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString() ?? '')).not.toBe('');
});

test('removes the last empty task control with Backspace or Delete', async ({ page }) => {
  for (const key of ['Backspace', 'Delete']) {
    await page.route('**/api/documents/block-marquee-e2e', route =>
      route.fulfill({
        json: {
          code: 0,
          data: {
            ...richDocument,
            content: '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><div><p></p></div></li></ul>',
          },
        },
      }),
    );
    await page.goto('/doc/block-marquee-e2e');

    await page.locator('ul[data-type="taskList"] p').click();
    await page.keyboard.press(key);
    await expect(page.locator('ul[data-type="taskList"]')).toHaveCount(0);
    await expect(page.locator('.ProseMirror > p')).toHaveCount(1);
  }
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

import { expect, test, type Locator, type Page } from '@playwright/test';

const integrationModel = {
  id: 'tbl_bitable_block_e2e',
  name: '块级集成',
  primaryFieldId: 'title',
  activeViewId: 'grid',
  fields: [
    { id: 'title', name: '任务名', type: 'text' },
    { id: 'note', name: '备注', type: 'text' },
  ],
  records: [
    {
      id: 'rec_1',
      tableId: 'tbl_bitable_block_e2e',
      fields: { title: '任务 A', note: '' },
      createdAt: '2026-07-16T00:00:00.000Z',
      updatedAt: '2026-07-16T00:00:00.000Z',
      createdBy: 'E2E',
    },
  ],
  views: [
    {
      id: 'grid',
      tableId: 'tbl_bitable_block_e2e',
      name: '表格',
      type: 'grid',
      config: {},
      filters: [],
      sorts: [],
    },
  ],
};

const integrationDocument = {
  id: 'bitable-block-integration-e2e',
  title: 'Bitable Block Integration',
  content: `
    <p>before bitable</p>
    <div data-local-block="bitable" data-model='${JSON.stringify(integrationModel)}'></div>
    <p>after bitable</p>
  `,
  author: 'E2E',
  created_at: '2026-07-16T00:00:00.000Z',
  updated_at: '2026-07-16T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

async function openIntegrationDoc(page: Page) {
  await page.route('**/api/documents/bitable-block-integration-e2e/comments', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents/bitable-block-integration-e2e', route =>
    route.fulfill({ json: { code: 0, data: integrationDocument } }),
  );
  await page.goto('/doc/bitable-block-integration-e2e');
  const block = page.locator('.feishu-bitable-block').first();
  await expect(block).toBeVisible();
  await expect(block).toHaveAttribute('data-base-view-type', 'grid');
  return block;
}

async function revealBitableHandle(page: Page, block: Locator) {
  await block.hover();
  const handle = page.locator('.block-drag-row').first();
  await expect(handle).toBeVisible();
  return handle;
}

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
  await page.mouse.move(endX, endY, { steps: 14 });
  await expect(page.locator('.block-drag-drop-indicator')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('.block-drag-preview')).toHaveCount(0);
}

test('copies bitable block link from context menu', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const block = await openIntegrationDoc(page);
  const handle = await revealBitableHandle(page, block);
  await handle.click();

  const menu = page.locator('.bitable-context-menu').first();
  await expect(menu).toBeVisible();
  await menu.locator('[data-name="copyAnchorLink"]').click();
  await expect(menu).toHaveCount(0);

  await expect.poll(async () => block.getAttribute('data-block-id')).toBeTruthy();
  const blockId = await block.getAttribute('data-block-id');
  expect(blockId).toBeTruthy();

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain(`#${blockId}`);
  expect(clipboard).toContain('/doc/bitable-block-integration-e2e');
});

test('drags a bitable block with the left handle', async ({ page }) => {
  const block = await openIntegrationDoc(page);
  const after = page.locator('.ProseMirror > p', { hasText: 'after bitable' });
  const handle = await revealBitableHandle(page, block);
  await dragFromHandleTo(page, handle, after, 'after');

  const order = await page.locator('.ProseMirror > *').evaluateAll(nodes =>
    nodes.map(node => {
      const el = node as HTMLElement;
      if (
        el.classList.contains('feishu-bitable-block')
        || el.querySelector?.('.feishu-bitable-block')
        || el.getAttribute('data-local-block') === 'bitable'
      ) {
        return 'bitable';
      }
      return el.textContent?.trim() || '';
    }).filter(Boolean),
  );
  expect(order).toEqual(['before bitable', 'after bitable', 'bitable']);
});

test('deletes bitable through block menu', async ({ page }) => {
  const block = await openIntegrationDoc(page);
  const handle = await revealBitableHandle(page, block);
  await handle.click();
  const menu = page.locator('.bitable-context-menu').first();
  await expect(menu).toBeVisible();
  await menu.locator('.delete-item, [data-name="delete"]').first().click();
  await expect(page.locator('.feishu-bitable-block')).toHaveCount(0);
  await expect(page.locator('.ProseMirror > p', { hasText: 'before bitable' })).toBeVisible();
});

test('aligns viewbar and content left edge with document title', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const block = await openIntegrationDoc(page);

  const title = page.locator('.editor-title-input');
  await expect(title).toBeVisible();
  const viewbar = block.locator('.base-viewbar').first();
  const content = block.locator('.base-view-content').first();
  await expect(viewbar).toBeVisible();
  await expect(content).toBeVisible();

  const [titleBox, viewbarBox, contentBox, pageBox] = await Promise.all([
    title.boundingBox(),
    viewbar.boundingBox(),
    content.boundingBox(),
    block.locator('.base-viewbar__page').boundingBox(),
  ]);
  expect(titleBox).toBeTruthy();
  expect(viewbarBox).toBeTruthy();
  expect(contentBox).toBeTruthy();
  expect(pageBox).toBeTruthy();

  // 标题区、Viewbar、内容区共享同一左边界
  expect(Math.abs(viewbarBox!.x - titleBox!.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(contentBox!.x - titleBox!.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(pageBox!.x - titleBox!.x)).toBeLessThanOrEqual(2);

  await viewbar.hover({ position: { x: Math.min(240, viewbarBox!.width - 8), y: 8 } });
  const tools = page.locator('.block-inline-tools');
  await expect(tools).toBeVisible();
  const [toolsBox, blockBox] = await Promise.all([tools.boundingBox(), block.boundingBox()]);
  expect(toolsBox).toBeTruthy();
  expect(blockBox).toBeTruthy();
  expect(Math.abs(toolsBox!.x + toolsBox!.width - blockBox!.x)).toBeLessThanOrEqual(2);
});

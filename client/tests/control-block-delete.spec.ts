import { expect, test } from '@playwright/test';

const controlDocument = {
  id: 'control-block-delete-e2e',
  title: 'Control Block Delete E2E',
  content: `
    <p>before</p>
    <div
      data-local-block="bitable"
      data-title="现象分类"
      data-columns='["现象一级","现象二级","现象三级"]'
      data-rows='[["网络质量类","频繁掉线",""],["装维服务类","履约不及时",""]]'
    ></div>
    <div data-local-block="div-table" data-rows="2" data-cols="2"></div>
    <div data-local-block="embed" data-kind="subdoc" data-title="子文档" data-desc="/doc/child" data-href="/doc/child"></div>
    <div data-local-block="sync" data-sync-id="sync-delete"><p>同步内容</p></div>
    <p>after</p>
  `,
  author: 'E2E',
  created_at: '2026-05-25T00:00:00.000Z',
  updated_at: '2026-05-25T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/documents/control-block-delete-e2e/comments', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents/control-block-delete-e2e', route =>
    route.fulfill({ json: { code: 0, data: controlDocument } }),
  );
  await page.goto('/doc/control-block-delete-e2e');
  await expect(page.locator('.feishu-bitable-block')).toBeVisible();
  await expect(page.locator('.feishu-div-table')).toBeVisible();
  await expect(page.locator('.feishu-local-card')).toBeVisible();
  await expect(page.locator('.feishu-sync-block')).toBeVisible();
});

async function deleteThroughBlockMenu(page: import('@playwright/test').Page, target: string) {
  await page.locator(target).hover();
  const blockHandle = page.locator('.block-drag-row');
  await expect(blockHandle).toBeVisible();
  await blockHandle.hover();

  const menu = page.locator('.context-menu').first();
  await expect(menu).toBeVisible();
  await menu.locator('.context-menu-item--danger').click();
}

test('deletes a bitable control through its block menu', async ({ page }) => {
  await deleteThroughBlockMenu(page, '.feishu-bitable-block');
  await expect(page.locator('.feishu-bitable-block')).toHaveCount(0);
  await expect(page.locator('.feishu-local-card')).toBeVisible();
});

test('deletes a selected bitable control with Backspace', async ({ page }) => {
  await page.locator('.feishu-bitable-block__tail').first().click();
  await expect(page.locator('.feishu-bitable-block')).toHaveClass(/is-selected/);

  await page.keyboard.press('Backspace');
  await expect(page.locator('.feishu-bitable-block')).toHaveCount(0);
});

test('deletes a selected embed control with Delete', async ({ page }) => {
  await page.locator('.feishu-local-card__icon').click();
  await expect(page.locator('.feishu-local-card')).toHaveClass(/is-selected/);

  await page.keyboard.press('Delete');
  await expect(page.locator('.feishu-local-card')).toHaveCount(0);
});

test('deletes an embed control through its block menu', async ({ page }) => {
  await deleteThroughBlockMenu(page, '.feishu-local-card__icon');
  await expect(page.locator('.feishu-local-card')).toHaveCount(0);
  await expect(page.locator('.feishu-bitable-block')).toBeVisible();
});

test('deletes legacy table and sync controls through their block menus', async ({ page }) => {
  await deleteThroughBlockMenu(page, '.feishu-div-table');
  await expect(page.locator('.feishu-div-table')).toHaveCount(0);

  await deleteThroughBlockMenu(page, '.feishu-sync-block__label');
  await expect(page.locator('.feishu-sync-block')).toHaveCount(0);
});

test('marquee selection deletes widget controls including content containers', async ({ page }) => {
  const bitable = page.locator('.feishu-bitable-block');
  const sync = page.locator('.feishu-sync-block');
  const firstBox = await bitable.boundingBox();
  const lastBox = await sync.boundingBox();
  expect(firstBox).not.toBeNull();
  expect(lastBox).not.toBeNull();
  if (!firstBox || !lastBox) return;

  const editorArea = page.locator('.editor-content-area');
  const areaBox = await editorArea.boundingBox();
  expect(areaBox).not.toBeNull();
  if (!areaBox) return;

  await page.mouse.move(areaBox.x + 4, firstBox.y - 4);
  await page.mouse.down();
  await page.mouse.move(areaBox.x + areaBox.width - 4, lastBox.y + lastBox.height + 4, { steps: 12 });
  await page.mouse.up();

  await expect(page.locator('.feishu-box-selection-band')).toHaveCount(4);
  await page.keyboard.press('Delete');
  await expect(page.locator('.feishu-bitable-block, .feishu-div-table, .feishu-local-card, .feishu-sync-block')).toHaveCount(0);
});

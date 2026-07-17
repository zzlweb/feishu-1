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

async function revealBlockHandle(page: import('@playwright/test').Page, target: string) {
  await page.locator(target).first().hover();
  const blockHandle = page.locator('.block-drag-row');
  await expect(blockHandle).toBeVisible();
  return blockHandle;
}

/** 普通块：悬停块柄打开 .context-menu；多维表格：需点击块柄打开 .bitable-context-menu */
async function deleteThroughBlockMenu(
  page: import('@playwright/test').Page,
  target: string,
  options?: { bitable?: boolean },
) {
  const blockHandle = await revealBlockHandle(page, target);
  if (options?.bitable) {
    await blockHandle.click();
    const menu = page.locator('.bitable-context-menu').first();
    await expect(menu).toBeVisible();
    await menu.locator('.delete-item, [data-name="delete"]').first().click();
    return;
  }

  await blockHandle.hover();
  const menu = page.locator('.context-menu').first();
  await expect(menu).toBeVisible();
  await menu.locator('.context-menu-item--danger').click();
}

test('deletes a bitable control through its block menu', async ({ page }) => {
  await deleteThroughBlockMenu(page, '.feishu-bitable-block', { bitable: true });
  await expect(page.locator('.feishu-bitable-block')).toHaveCount(0);
  await expect(page.locator('.feishu-local-card')).toBeVisible();
});

test('deletes a selected bitable control with Backspace', async ({ page }) => {
  // 点击块柄会同步 NodeSelection；Esc 关掉菜单后 Backspace 删除选中块
  const handle = await revealBlockHandle(page, '.feishu-bitable-block');
  await handle.click();
  await expect(page.locator('.feishu-bitable-block')).toHaveClass(/is-selected/);
  await page.keyboard.press('Escape');
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

  // 可能额外选中相邻段落；至少覆盖 4 个控件块
  await expect.poll(async () => page.locator('.feishu-box-selection-band').count()).toBeGreaterThanOrEqual(4);
  await page.keyboard.press('Delete');
  await expect(page.locator('.feishu-bitable-block, .feishu-div-table, .feishu-local-card, .feishu-sync-block')).toHaveCount(0);
});

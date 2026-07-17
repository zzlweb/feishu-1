import { expect, test, type Page } from '@playwright/test';

const gridDocument = {
  id: 'bitable-grid-e2e',
  title: 'Bitable Grid E2E',
  content: `
    <p>before</p>
    <div
      data-local-block="bitable"
      data-title="表格视图"
      data-view="grid"
      data-columns='["标题","状态","优先级"]'
      data-rows='[["任务 1","待处理","高"],["任务 2","进行中","中"],["任务 3","已完成","低"]]'
    ></div>
    <p>after</p>
  `,
  author: 'E2E',
  created_at: '2026-07-16T00:00:00.000Z',
  updated_at: '2026-07-16T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

async function openGrid(page: Page) {
  await page.route('**/api/documents/bitable-grid-e2e/comments', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents/bitable-grid-e2e', route =>
    route.fulfill({ json: { code: 0, data: gridDocument } }),
  );
  await page.goto('/doc/bitable-grid-e2e');
  const block = page.locator('.feishu-bitable-block').first();
  await expect(block).toBeVisible();
  await expect(block.locator('.base-grid-canvas')).toBeVisible();
  return block;
}

test('grid shows field headers, row numbers, add-field and add-record areas', async ({ page }) => {
  const block = await openGrid(page);

  await expect(block.locator('.base-grid-overlay-header').first()).toBeVisible();
  await expect(block.locator('.base-grid-field-name').first()).toContainText('标题');
  await expect(block.locator('.base-grid-index-rail')).toBeVisible();
  await expect(block.locator('.base-grid-index-row__number').first()).toBeVisible();
  await expect(block.locator('.base-grid-add-field-column')).toBeVisible();
  await expect(block.locator('.base-grid-add-row-hit').first()).toBeVisible();
});

test('grid add-field button opens popover and creates a field', async ({ page }) => {
  const block = await openGrid(page);

  await block.locator('.base-grid-add-field-column__header').click();
  const popover = page.locator('[data-e2e="bitable-add-field-popover"]');
  await expect(popover).toBeVisible();

  await popover.getByRole('button', { name: '确定' }).click();
  await expect(popover).toBeHidden();
  await expect(block.locator('.base-grid-field-name', { hasText: '字段 1' })).toBeVisible();
});

test('grid field menu portals to body without clipping', async ({ page }) => {
  const block = await openGrid(page);

  await block.locator('.base-grid-field-chevron').first().click();
  const fieldMenu = page.locator('.base-grid-field-menu--portal');
  await expect(fieldMenu).toBeVisible();
  expect(await fieldMenu.evaluate(el => el.parentElement?.tagName)).toBe('BODY');
  const fieldBox = await fieldMenu.boundingBox();
  expect(fieldBox).toBeTruthy();
  expect(fieldBox!.width).toBeGreaterThan(100);
  expect(fieldBox!.height).toBeGreaterThan(40);
  expect(fieldBox!.x).toBeGreaterThanOrEqual(0);
  expect(fieldBox!.y).toBeGreaterThanOrEqual(0);
});

test('grid cell menu portals to body without clipping', async ({ page }) => {
  const block = await openGrid(page);

  await block.locator('.base-grid-canvas').click({ button: 'right', position: { x: 120, y: 60 } });
  const cellMenu = page.locator('.base-grid-cell-menu--portal');
  await expect(cellMenu).toBeVisible();
  expect(await cellMenu.evaluate(el => el.parentElement?.tagName)).toBe('BODY');
  const cellBox = await cellMenu.boundingBox();
  expect(cellBox).toBeTruthy();
  expect(cellBox!.width).toBeGreaterThan(80);
  expect(cellBox!.height).toBeGreaterThan(40);
});

test('grid filter group sort panels portal and stay in viewport', async ({ page }) => {
  const block = await openGrid(page);
  await block.hover();

  await block.getByRole('button', { name: '筛选' }).click();
  const filterPanel = page.locator('.base-toolbar-panel--portal.base-toolbar-panel--filter');
  await expect(filterPanel).toBeVisible();
  expect(await filterPanel.evaluate(el => el.parentElement?.tagName)).toBe('BODY');
  const filterBox = await filterPanel.boundingBox();
  expect(filterBox).toBeTruthy();
  expect(filterBox!.x).toBeGreaterThanOrEqual(0);
  expect(filterBox!.y).toBeGreaterThanOrEqual(0);
  expect(filterBox!.x + filterBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  const filterRow = filterPanel.locator('.base-toolbar-panel__filter-row').first();
  await expect(filterRow).toBeVisible();
  const filterLayout = await filterRow.evaluate(el => {
    const style = getComputedStyle(el);
    const children = [...el.children] as HTMLElement[];
    return {
      display: style.display,
      columns: style.gridTemplateColumns,
      childTops: children.map(child => Math.round(child.getBoundingClientRect().top)),
      inputBorder: getComputedStyle(el.querySelector('.base-toolbar-panel__filter-value') as HTMLElement).borderTopWidth,
    };
  });
  expect(filterLayout.display).toBe('grid');
  expect(filterLayout.columns.split(' ').length).toBeGreaterThanOrEqual(3);
  const topSpread = Math.max(...filterLayout.childTops) - Math.min(...filterLayout.childTops);
  expect(topSpread).toBeLessThanOrEqual(8);
  expect(filterLayout.inputBorder).not.toBe('0px');
  await page.keyboard.press('Escape');
  await page.mouse.click(8, 8);

  await block.getByRole('button', { name: '分组' }).click();
  const groupPanel = page.locator('[data-e2e="bitable-group-config-panel"].bitable-group-panel--portal');
  await expect(groupPanel).toBeVisible();
  expect(await groupPanel.evaluate(el => el.parentElement?.tagName)).toBe('BODY');
  await page.mouse.click(8, 8);

  await block.getByRole('button', { name: '排序' }).click();
  const sortPanel = page.locator('[data-e2e="bitable-sort-config-panel"].bitable-sort-panel--portal');
  await expect(sortPanel).toBeVisible();
  expect(await sortPanel.evaluate(el => el.parentElement?.tagName)).toBe('BODY');
});

test('grid row height control updates view config', async ({ page }) => {
  const block = await openGrid(page);
  await block.hover();

  await block.getByRole('button', { name: '行高' }).click();
  const rowHeightPanel = page.locator('.base-toolbar-panel--rowHeight');
  await expect(rowHeightPanel).toBeVisible();
  await rowHeightPanel.getByRole('button', { name: '高' }).click();
  await expect(block.getByRole('button', { name: '行高' })).toHaveClass(/is-active/);
});

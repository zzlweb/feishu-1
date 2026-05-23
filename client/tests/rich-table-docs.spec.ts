import { expect, test } from '@playwright/test';

const tableDocument = {
  id: 'rich-table-docs-e2e',
  title: 'Rich Table Docs E2E',
  content: `
    <p>before</p>
    <table>
      <tbody>
        <tr><td><p>Alpha</p></td><td><p>Beta</p></td><td><p>Gamma</p></td></tr>
        <tr><td><p>Delta</p></td><td><p>Epsilon</p></td><td><p>Zeta</p></td></tr>
        <tr><td><p>Eta</p></td><td><p>Theta</p></td><td><p>Iota</p></td></tr>
      </tbody>
    </table>
    <p>after</p>
  `,
  author: 'E2E',
  created_at: '2026-05-23T00:00:00.000Z',
  updated_at: '2026-05-23T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/documents/rich-table-docs-e2e/comments', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents/rich-table-docs-e2e', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { code: 0, data: tableDocument } });
    }
    return route.fulfill({ json: { code: 0, data: tableDocument } });
  });
});

async function openRichTable(page: import('@playwright/test').Page) {
  await page.goto('/doc/rich-table-docs-e2e');
  await expect(page.locator('.feishu-table-host, .tableWrapper').first()).toBeVisible();
  await expect(page.locator('td[data-table-cell="true"][data-cell-id]').first()).toBeVisible();
}

test('edits a rich text cell without selecting the table block', async ({ page }) => {
  await openRichTable(page);

  const firstCell = page.locator('td[data-table-cell="true"]').first();
  await firstCell.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type('Edited cell');

  await expect(firstCell).toContainText('Edited cell');
  await expect(page.locator('.feishu-table-host.is-table-block-active, .tableWrapper.is-table-block-active')).toHaveCount(0);
  await expect(page.locator('td.selectedCell')).toHaveCount(0);
});

test('keeps text selection and cell range selection mutually exclusive', async ({ page }) => {
  await openRichTable(page);

  const text = page.locator('td[data-table-cell="true"] p', { hasText: 'Alpha' }).first();
  const box = await text.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 4, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + Math.min(box!.width - 4, 44), box!.y + box!.height / 2, { steps: 6 });
  await page.mouse.up();

  const selectedText = await page.evaluate(() => window.getSelection()?.toString() || '');
  expect(selectedText.length).toBeGreaterThan(0);
  await expect(page.locator('td.selectedCell')).toHaveCount(0);
});

test('selects a rectangular cell range in either drag direction', async ({ page }) => {
  await openRichTable(page);

  const cells = page.locator('td[data-table-cell="true"]');
  const start = await cells.nth(0).boundingBox();
  const end = await cells.nth(8).boundingBox();
  expect(start).not.toBeNull();
  expect(end).not.toBeNull();

  await page.mouse.move(start!.x + start!.width - 6, start!.y + start!.height - 6);
  await page.mouse.down();
  await page.mouse.move(end!.x + end!.width - 6, end!.y + end!.height - 6, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('td.selectedCell')).toHaveCount(9);

  await page.keyboard.press('Escape');
  await page.mouse.move(end!.x + 6, end!.y + 6);
  await page.mouse.down();
  await page.mouse.move(start!.x + 6, start!.y + 6, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('td.selectedCell')).toHaveCount(9);
});

test('resizes columns and rows without creating native text selection', async ({ page }) => {
  await openRichTable(page);

  const host = page.locator('.feishu-table-host, .tableWrapper').first();
  await host.hover();
  const colHandle = page.locator('[data-table-resize-handle="true"].feishu-table-chrome__resize-col').first();
  await expect(colHandle).toBeVisible();
  const colBox = await colHandle.boundingBox();
  expect(colBox).not.toBeNull();
  const beforeWidth = await page.locator('col[data-col-index="0"]').evaluate(el => getComputedStyle(el).width);

  await page.mouse.move(colBox!.x + colBox!.width / 2, colBox!.y + colBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(colBox!.x + 46, colBox!.y + colBox!.height / 2, { steps: 8 });
  await page.mouse.up();

  const afterWidth = await page.locator('col[data-col-index="0"]').evaluate(el => getComputedStyle(el).width);
  expect(afterWidth).not.toBe(beforeWidth);
  const selectedText = await page.evaluate(() => window.getSelection()?.toString() || '');
  expect(selectedText).toBe('');

  const rowHandle = page.locator('[data-table-resize-handle="true"].feishu-table-chrome__resize-row').first();
  await expect(rowHandle).toBeVisible();
  const rowBox = await rowHandle.boundingBox();
  expect(rowBox).not.toBeNull();
  const firstRow = page.locator('tr[data-row-id]').first();
  const beforeHeight = await firstRow.evaluate(el => getComputedStyle(el).height);

  await page.mouse.move(rowBox!.x + rowBox!.width / 2, rowBox!.y + rowBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(rowBox!.x + rowBox!.width / 2, rowBox!.y + 36, { steps: 8 });
  await page.mouse.up();

  const afterHeight = await firstRow.evaluate(el => getComputedStyle(el).height);
  expect(afterHeight).not.toBe(beforeHeight);
});

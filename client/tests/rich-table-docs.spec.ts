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
  await page.evaluate(() => {
    const paragraph = document.querySelector('td[data-table-cell="true"] p');
    if (!(paragraph instanceof HTMLElement)) return;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
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

test('selects and highlights a full column from the column rail', async ({ page }) => {
  await openRichTable(page);

  const host = page.locator('.feishu-table-host, .tableWrapper').first();
  await host.hover();
  const secondColumnRail = page.locator('[data-table-axis-handle="true"].feishu-table-chrome__rail-block--col').nth(1);
  await expect(secondColumnRail).toBeVisible();
  await secondColumnRail.click();

  await expect(host).toHaveClass(/feishu-table-host--rail-col-selected|tableWrapper.*feishu-table-host--rail-col-selected/);
  await expect(page.locator('.feishu-table-chrome__selection-outline--col')).toBeVisible();
  await expect(secondColumnRail).toHaveClass(/is-selected/);
});

test('selects and highlights a full row from the row rail', async ({ page }) => {
  await openRichTable(page);

  const host = page.locator('.feishu-table-host, .tableWrapper').first();
  await host.hover();
  const secondRowRail = page.locator('[data-table-axis-handle="true"].feishu-table-chrome__rail-block--row').nth(1);
  await expect(secondRowRail).toBeVisible();
  await secondRowRail.click();

  await expect(host).toHaveClass(/feishu-table-host--rail-row-selected|tableWrapper.*feishu-table-host--rail-row-selected/);
  await expect(page.locator('.feishu-table-chrome__selection-outline--row')).toBeVisible();
  await expect(secondRowRail).toHaveClass(/is-selected/);
});

test('does not reorder rows when dragging the row rail', async ({ page }) => {
  await openRichTable(page);

  const host = page.locator('.feishu-table-host, .tableWrapper').first();
  await host.hover();
  const firstRowRail = page.locator('[data-table-axis-handle="true"].feishu-table-chrome__rail-block--row').first();
  const thirdRowRail = page.locator('[data-table-axis-handle="true"].feishu-table-chrome__rail-block--row').nth(2);
  const firstBox = await firstRowRail.boundingBox();
  const thirdBox = await thirdRowRail.boundingBox();
  expect(firstBox).not.toBeNull();
  expect(thirdBox).not.toBeNull();

  await page.mouse.move(firstBox!.x + firstBox!.width / 2, firstBox!.y + firstBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(thirdBox!.x + thirdBox!.width / 2, thirdBox!.y + thirdBox!.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect(page.locator('td[data-table-cell="true"]').first()).toContainText('Alpha');
  await expect(page.locator('.feishu-table-chrome__drag-line--row')).toHaveCount(0);
});

test('clips a selected column outline to the horizontal table viewport', async ({ page }) => {
  const wideTableDocument = {
    ...tableDocument,
    content: `
      <table>
        <tbody>
          <tr>${Array.from({ length: 8 }, (_, i) => `<td><p>C${i + 1}</p></td>`).join('')}</tr>
          <tr>${Array.from({ length: 8 }, (_, i) => `<td><p>R2C${i + 1}</p></td>`).join('')}</tr>
        </tbody>
      </table>
    `,
  };
  await page.route('**/api/documents/rich-table-docs-e2e', route =>
    route.fulfill({ json: { code: 0, data: wideTableDocument } }),
  );
  await openRichTable(page);

  const host = page.locator('.feishu-table-host, .tableWrapper').first();
  await host.hover();
  await page.locator('[data-table-axis-handle="true"].feishu-table-chrome__rail-block--col').first().click();
  await page.waitForTimeout(150);

  const surface = page.locator('.feishu-table-scroll').first();
  await surface.evaluate(el => {
    el.scrollLeft = 100;
    el.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await expect.poll(() => surface.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);

  const outline = page.locator('.feishu-table-chrome__selection-outline--col');
  await expect(outline).toBeVisible();
  const surfaceBox = await surface.boundingBox();
  const outlineBox = await outline.boundingBox();
  expect(surfaceBox).not.toBeNull();
  expect(outlineBox).not.toBeNull();
  expect(outlineBox!.x).toBeGreaterThanOrEqual(surfaceBox!.x - 1);
});

test('opens the table-cell insert menu at the cursor-positioned plus button', async ({ page }) => {
  await openRichTable(page);

  const firstCell = page.locator('td[data-table-cell="true"]').first();
  await firstCell.click();
  await page.evaluate(() => {
    const paragraph = document.querySelector('td[data-table-cell="true"] p');
    if (!(paragraph instanceof HTMLElement)) return;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.keyboard.press('Backspace');
  await expect(firstCell).toHaveText('');

  const plus = page.locator('.feishu-table-chrome__cell-handle--insert').first();
  await expect(plus).toBeVisible();

  await plus.hover();
  await expect(page.locator('.slash-menu').first()).toBeVisible();
  await page.mouse.move(20, 20);
  await expect(page.locator('.slash-menu').first()).toBeHidden();
  await expect(firstCell.locator('.ProseMirror-selectednode')).toHaveCount(0);
});

test('opens block context menu from the text cell handle', async ({ page }) => {
  await openRichTable(page);

  const firstCell = page.locator('td[data-table-cell="true"]').first();
  await firstCell.click();

  const handle = page.locator('.feishu-table-chrome__cell-handle--block').first();
  await expect(handle).toBeVisible();
  await handle.hover();
  await expect(page.locator('.context-menu').first()).toBeVisible();
});

test('deletes the whole table from its block menu', async ({ page }) => {
  await openRichTable(page);

  const host = page.locator('.feishu-table-host, .tableWrapper').first();
  await host.hover();
  const handle = page.locator('.feishu-table-chrome__handle').first();
  await expect(handle).toBeVisible();
  await handle.hover();

  const menu = page.locator('.context-menu').first();
  await expect(menu).toBeVisible();
  await menu.locator('.context-menu-item--danger').click();

  await expect(page.locator('.feishu-table-host, .tableWrapper')).toHaveCount(0);
});

test('deletes embedded block content inside a table cell with Backspace', async ({ page }) => {
  const docWithEmbed = {
    ...tableDocument,
    content: `
      <table class="feishu-table">
        <tbody>
          <tr>
            <td data-table-cell="true" data-cell-id="cell-embed-1" data-row-index="0" data-col-index="0">
              <div data-local-block="embed" data-kind="subdoc" data-title="子文档" data-desc="/doc/child" data-href="/doc/child" class="feishu-local-card feishu-local-card--subdoc">
                <div class="feishu-local-card__icon">↗</div>
                <div class="feishu-local-card__body">
                  <div class="feishu-local-card__title">子文档</div>
                  <div class="feishu-local-card__desc">/doc/child</div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    `,
  };

  await page.route('**/api/documents/rich-table-docs-e2e', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { code: 0, data: docWithEmbed } });
    }
    return route.fulfill({ json: { code: 0, data: docWithEmbed } });
  });

  await openRichTable(page);

  const embedCard = page.locator('td .feishu-local-card').first();
  await expect(embedCard).toBeVisible();
  await embedCard.click();
  await page.keyboard.press('Backspace');
  await expect(page.locator('td .feishu-local-card')).toHaveCount(0);
});

test('resizes columns without exposing row resize handles', async ({ page }) => {
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
  await expect(page.locator('[data-table-resize-handle="true"].feishu-table-chrome__resize-row')).toHaveCount(0);
});
